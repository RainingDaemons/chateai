package main

import (
	"context"
	"database/sql"
	"encoding/base64"
	"errors"
	"fmt"
	"log"
	"mime"
	"os"
	"path/filepath"
	"runtime"
	"strings"

	"chateai/backend"
	db "chateai/backend/database"
	"chateai/backend/repository"
)

// App struct
type App struct {
	ctx      context.Context
	app      *backend.Core
	db       *sql.DB
	convRepo *repository.ConversationRep
	msgRepo  *repository.MessageRep
	docsBase string
}

// File struct
type FilePayload struct {
	Name       string `json:"name"`
	Mime       string `json:"mime"`
	DataBase64 string `json:"dataBase64"`
}

/*
* WAILS
 */
// NewApp creates a new App application struct
func NewApp() *App {
	return &App{}
}

// startup is called at application startup
func (a *App) startup(ctx context.Context) {
	a.ctx = ctx

	dbPath := "./data/data.db"

	// Asegurar que el directorio exista
	if err := ensureDir(filepath.Dir(dbPath)); err != nil {
		log.Fatal("[!] No se pudo crear el directorio de datos: ", err)
	}

	// Cargar BD
	sqliteDB, err := db.Connect(dbPath)
	if err != nil {
		log.Fatal(err)
	}

	// Crear tablas si no existen
	if err := db.InitSchema(sqliteDB); err != nil {
		log.Fatal("[!] Inicializando esquema de BD...", err)
	}

	// Inyectar repositorio en la aplicación
	a.db = sqliteDB
	a.convRepo = repository.NewConversationRepo(a.db)
	a.msgRepo = repository.NewMessageRepo(a.db)
	a.app = backend.NewApp(a.convRepo, a.msgRepo)
}

// domReady is called after front-end resources have been loaded
func (a App) domReady(ctx context.Context) {
	// Add your action here
}

// beforeClose is called when the application is about to quit,
// either by clicking the window close button or calling runtime.Quit.
// Returning true will cause the application to continue, false will continue shutdown as normal.
func (a *App) beforeClose(ctx context.Context) (prevent bool) {
	return false
}

// shutdown is called at application termination
func (a *App) shutdown(ctx context.Context) {
	// Close DB connection
	if a.db != nil {
		_ = a.db.Close()
	}

}

// Greet returns a greeting for the given name
func (a *App) Greet(name string) string {
	return fmt.Sprintf("Hello %s, It's show time!", name)
}

/*
* SYSTEM UTILS
 */
// Ensure some directory exists
func ensureDir(dir string) error {
	return os.MkdirAll(dir, os.ModePerm)
}

// Get info for some directory existence
func dirExists(p string) bool {
	info, err := os.Stat(p)
	return err == nil && info.IsDir()
}

// Get source directory
func getSourceDir() (string, error) {
	// Obtener directorio del archivo fuente
	if _, file, _, ok := runtime.Caller(0); ok && file != "" {
		return filepath.Dir(file), nil
	}

	// Alt: Obtener directorio del ejecutable
	if exe, err := os.Executable(); err == nil && exe != "" {
		return filepath.Dir(exe), nil
	}

	// Alt: Obtener directorio de trabajo
	if wd, err := os.Getwd(); err == nil && wd != "" {
		return wd, nil
	}

	return "", errors.New("No se pudo determinar el directorio raiz")
}

// Find data/docs directory
func findUpwardsFor(startDir, subpath string, maxDepth int) (string, bool) {
	cur := filepath.Clean(startDir)
	for i := 0; i <= maxDepth; i++ {
		candidate := filepath.Join(cur, subpath)
		if dirExists(candidate) {
			return candidate, true
		}
		next := filepath.Dir(cur)
		if next == cur {
			break
		}
		cur = next
	}
	return "", false
}

// Update docsBase directory
func (a *App) getDocsBase() (string, error) {
	if a.docsBase != "" {
		return a.docsBase, nil
	}

	startDir, err := getSourceDir()
	if err != nil {
		return "", err
	}

	// Busca hacia arriba un directorio que contenga "data/docs" (hasta 8 niveles)
	if p, ok := findUpwardsFor(startDir, filepath.Join("data", "docs"), 8); ok {
		a.docsBase = filepath.Clean(p)
		return a.docsBase, nil
	}

	return "", errors.New("No se encontró la carpeta data/docs en el directorio de ejecución")
}

// Restrict allowed path
func (a *App) isPathAllowed(abs string) bool {
	allowedBase, err := a.getDocsBase()
	if err != nil {
		log.Printf("[!] Error: no se pudo resolver docsBase: %v", err)
		return false
	}

	abs = filepath.Clean(abs)
	base := filepath.Clean(allowedBase)

	rel, err := filepath.Rel(base, abs)
	if err != nil {
		return false
	}

	return !strings.HasPrefix(rel, "..")
}

// Read local files
func (a *App) ReadLocalFile(path string) (*FilePayload, error) {
	if path == "" {
		return nil, errors.New("ruta vacía")
	}
	abs, err := filepath.Abs(path)
	if err != nil {
		return nil, err
	}

	if !a.isPathAllowed(abs) {
		return nil, errors.New("acceso denegado a la ruta solicitada")
	}
	info, err := os.Stat(abs)
	if err != nil {
		return nil, err
	}
	if info.IsDir() {
		return nil, errors.New("la ruta es un directorio, no un archivo")
	}

	b, err := os.ReadFile(abs)
	if err != nil {
		return nil, err
	}

	ext := strings.ToLower(filepath.Ext(abs))
	m := mime.TypeByExtension(ext)
	// Fallback genérico
	if m == "" {
		m = "application/octet-stream"
	}

	return &FilePayload{
		Name:       info.Name(),
		Mime:       m,
		DataBase64: base64.StdEncoding.EncodeToString(b),
	}, nil
}

/*
* FRONT UTILS
 */
func (a *App) GetDocsDir() (string, error) {
	return a.getDocsBase()
}

/*
* CONVERSATIONS
 */
// Insert conversation in BD
func (a *App) DBCreateConversation(name string) any {
	res, err := a.app.CreateConversation(name)
	if err != nil {
		log.Println("Error al guardar el mensaje:", err)
		return nil
	}
	return res
}

// Get all conversations
func (a *App) DBGetAllConversations() any {
	res, err := a.app.GetAllConversations()
	if err != nil {
		log.Println("Error al obtener conversaciones:", err)
		return nil
	}
	return res
}

// Update conversation name
func (a *App) DBUpdateConversationName(id int64, name string) any {
	res, err := a.app.UpdateConversationName(id, name)
	if err != nil {
		log.Println("Error al actualizar nombre de conversación:", err)
		return nil
	}
	return res
}

// Delete conversation
func (a *App) DBDeleteConversation(id int64) any {
	res, err := a.app.DeleteConversation(a.ctx, id)
	if err != nil {
		log.Println("Error al eliminar conversación:", err)
		return nil
	}
	return res
}

/*
* MESSAGES
 */
// Insert message in BD
func (a *App) DBCreateMessage(convID int, role string, content string) any {
	res, err := a.app.CreateMessage(convID, role, content)
	if err != nil {
		log.Println("Error al guardar el mensaje:", err)
		return nil
	}
	return res
}

// Get all messages from specific conversation
func (a *App) DBGetMessagesByConversationID(id int) any {
	res, err := a.app.GetMessagesByConversationID(id)
	if err != nil {
		log.Println("Error al obtener mensajes:", err)
		return nil
	}
	return res
}

// Get all messages
func (a *App) DBGetAllMessages() any {
	res, err := a.app.GetAllMessages()
	if err != nil {
		log.Println("Error al obtener mensajes:", err)
		return nil
	}
	return res
}
