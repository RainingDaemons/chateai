package main

import (
	"context"
	"database/sql"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"mime"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"sync"

	backend "chateai/backend"
	db "chateai/backend/database"
	"chateai/backend/repository"

	"github.com/pelletier/go-toml/v2"
	"github.com/joho/godotenv"
)

// App struct
type App struct {
	ctx      context.Context
	app      *backend.Core
	db       *sql.DB
	convRepo *repository.ConversationRep
	msgRepo  *repository.MessageRep
	docsBase string
	mu   	 sync.RWMutex
    cfg  	 backend.UserSettings
	cfgPath  string
	ft     	 map[string]any
    ftPath   string
	scPath	 string
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

	// Asegurar que el directorio exista
	dbPath := "./data/data.db"
	if err := ensureDir(filepath.Dir(dbPath)); err != nil {
		log.Fatal("[!] No se pudo crear el directorio de datos: ", err)
	}

	// Cargar configuración del usuario
	a.cfgPath = "settings.toml"
	if err := ensureDir(filepath.Dir(a.cfgPath)); err != nil {
		log.Fatal("[!] No se pudo crear el directorio de datos: ", err)
	}

	if !fileExists(a.cfgPath) {
        log.Printf("[!] No se encontró archivo de configuración: %s", a.cfgPath)
        return
    }

	if err := a.loadUserSettings(); err != nil {
        log.Printf("[!] Error cargando config: %v", err)
    }

	// Cargar finetuning params
	a.ftPath = "finetuning.json"
    if err := ensureDir(filepath.Dir(a.ftPath)); err != nil {
        log.Fatal("[!] No se pudo crear el directorio de finetuning: ", err)
    }

	if !fileExists(a.ftPath) {
        log.Printf("[!] No se encontró archivo de finetuning: %s", a.cfgPath)
        return
    }

    if err := a.loadFinetuning(); err != nil {
        log.Printf("[!] Error cargando archivo de finetuning: %v", err)
    }

	// Cargar secrets
	a.scPath = ".secrets"
    if err := ensureDir(filepath.Dir(a.scPath)); err != nil {
        log.Fatal("[!] No se pudo crear el directorio de secrets: ", err)
    }

	if !fileExists(a.scPath) {
        log.Printf("[!] No se encontró archivo secrets: %s", a.cfgPath)
        return
    }

    if err := godotenv.Load(a.scPath); err != nil {
        log.Printf("[!] Error cargando archivo secrets: %v", err)
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
func (a *App) domReady(ctx context.Context) {
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
	if err != nil {
        return false
    }
	return info.IsDir()
}

// Get info for some file existence
func fileExists(p string) bool {
    info, err := os.Stat(p)
    if err != nil {
        return false
    }
    return info.Mode().IsRegular()
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

/*
* USER SETTINGS
 */
func (a *App) loadUserSettings() error {
    a.mu.Lock()
    defer a.mu.Unlock()

    b, err := os.ReadFile(a.cfgPath)
    if err != nil {
        return err
    }
    var c backend.UserSettings
    if err := toml.Unmarshal(b, &c); err != nil {
        return err
    }
    a.cfg = c
    return nil
}

func (a *App) validateUSPatch(p backend.UserSettingsPatch) (backend.UserSettings, []error) {
    candidate := a.cfg
    var verrs []error

	// Validaciones general
	if p.General != nil {
		if p.General.Root != nil {
            candidate.General.Root = *p.General.Root
        }
        if p.General.LLMModelDir != nil {
            candidate.General.LLMModelDir = *p.General.LLMModelDir
        }
        if p.General.EmbeddingModelDir != nil {
            candidate.General.EmbeddingModelDir = *p.General.EmbeddingModelDir
        }
    }

    // Validaciones server
    if p.Server != nil {
		if p.Server.DType != nil {
			dtype := strings.TrimSpace(*p.Server.DType)
			if dtype == "" {
                verrs = append(verrs, fmt.Errorf("[!] UserSettings: dtype no puede ser vacío"))
            } else {
				candidate.Server.DType = dtype
			}
        }
        if p.Server.MaxTokens != nil {
            if *p.Server.MaxTokens <= 0 {
                verrs = append(verrs, fmt.Errorf("[!] UserSettings: max_tokens inválido"))
            } else {
				candidate.Server.MaxTokens = *p.Server.MaxTokens
			}	
        }
        if p.Server.GPUUtil != nil {
            gu := *p.Server.GPUUtil
            if gu < 0 || gu > 1 {
                verrs = append(verrs, fmt.Errorf("[!] UserSettings: gpu_util debe estar entre 0 y 1"))
            } else {
				candidate.Server.GPUUtil = gu
			}
        }
        if p.Server.AllowedExts != nil {
            ok := true
            for _, ext := range p.Server.AllowedExts {
                if len(ext) == 0 || ext[0] != '.' {
                    ok = false
                    break
                }
            }
            if !ok {
                verrs = append(verrs, fmt.Errorf("[!] UserSettings: allowed_exts inválido"))
            } else {
				candidate.Server.AllowedExts = p.Server.AllowedExts
			}	
        }
    }

	// Validaciones llm
	if p.LLM != nil {
        if p.LLM.ShowInternalThinking != nil {
            candidate.LLM.ShowInternalThinking = *p.LLM.ShowInternalThinking
        }
        if p.LLM.UseLanguageInstruct != nil {
            candidate.LLM.UseLanguageInstruct = *p.LLM.UseLanguageInstruct
        }
		if p.LLM.LanguageInstruct != nil {
            candidate.LLM.LanguageInstruct = *p.LLM.LanguageInstruct
        }
		if p.LLM.InternalThinking != nil {
            candidate.LLM.InternalThinking = *p.LLM.InternalThinking
        }
		if p.LLM.SystemPrompt != nil {
            candidate.LLM.SystemPrompt = *p.LLM.SystemPrompt
        }
    }

	return candidate, verrs
}

func (a *App) saveUserSettings(c backend.UserSettings) error {
    b, err := toml.Marshal(c)
    if err != nil {
        return err
    }

    // Asegurar directorio por si la ruta cambia
    if err := ensureDir(filepath.Dir(a.cfgPath)); err != nil {
        return err
    }

    // Escribe a archivo temporal y renombra de forma atómica
    tmp := a.cfgPath + ".tmp"
    if err := os.WriteFile(tmp, b, 0o600); err != nil {
        return err
    }
    _ = os.Rename(a.cfgPath, a.cfgPath+".bak")
    return os.Rename(tmp, a.cfgPath)
}

/*
* FINETUNING PARAMS
 */
func jsonCopyMap(src map[string]any) map[string]any {
    if src == nil {
        return nil
    }

    b, _ := json.Marshal(src)
    var dst map[string]any
    _ = json.Unmarshal(b, &dst)

    return dst
}

func (a *App) loadFinetuning() error {
    a.mu.Lock()
    defer a.mu.Unlock()

    b, err := os.ReadFile(a.ftPath)
    if err != nil {
        return err
    }

    var cfg map[string]any
    if err := json.Unmarshal(b, &cfg); err != nil {
        return err
    }

    a.ft = cfg
    return nil
}

func (a *App) saveFinetuning(snapshot map[string]any) error {
    b, err := json.MarshalIndent(snapshot, "", "  ")
    if err != nil {
        return err
    }
	// Establecer tamaño máximo
    if len(b) > 1_000_000 {
        return fmt.Errorf("[!] SaveFinetuning: finetuning.json demasiado grande (%d bytes)", len(b))
    }

    if err := ensureDir(filepath.Dir(a.ftPath)); err != nil {
        return err
    }

    tmp := a.ftPath + ".tmp"
    if err := os.WriteFile(tmp, b, 0o600); err != nil {
        return err
    }
    _ = os.Rename(a.ftPath, a.ftPath+".bak")
    return os.Rename(tmp, a.ftPath)
}

/*
* SECRETS
 */
var (
    allowedSecretKeys = map[string]bool{
        "LANGSEARCH_API_KEY": true,
    }
)

func (a *App) readSecretsMap() (map[string]string, error) {
    if !fileExists(a.scPath) {
        return map[string]string{}, nil
    }
    m, err := godotenv.Read(a.scPath)
    if err != nil {
        return nil, err
    }
    return m, nil
}

func (a *App) writeSecretsMap(m map[string]string) error {
	// Asegurar directorio y permisos de escritura
	if err := ensureDir(filepath.Dir(a.scPath)); err != nil {
        return err
    }
	
	// Escribir en el archivo .secrets
	if err := godotenv.Write(m, a.scPath); err != nil {
        return fmt.Errorf("escribiendo .secrets: %w", err)
    }

    // Actualizar variables del proceso
    if err := godotenv.Overload(a.scPath); err != nil {
        return fmt.Errorf("refrescando entorno: %w", err)
    }
    return nil
}

func (a *App) UpdateSecrets(key, value string) error {
    key = strings.TrimSpace(key)
    value = strings.TrimSpace(value)

    if !allowedSecretKeys[key] {
        return fmt.Errorf("clave no permitida")
    }

    a.mu.Lock()
    defer a.mu.Unlock()

    kv, err := a.readSecretsMap()
    if err != nil {
        return err
    }
    kv[key] = value

    if err := a.writeSecretsMap(kv); err != nil {
        return err
    }

    return nil
}

/*
* FRONT EXPOSE
 */
func (a *App) GetDocsDir() (string, error) {
	return a.getDocsBase()
}

func (a *App) GetUserSettings() (backend.UserSettings, error) {
    a.mu.RLock()
    defer a.mu.RUnlock()
    return a.cfg, nil
}

func (a *App) ApplyNewUserSettings(patch backend.UserSettingsPatch) (backend.UserSettings, error) {
    // Validación y armado del candidate sin aplicar cambios en configuración
    a.mu.Lock()
    current := a.cfg
    a.mu.Unlock()

	candidate, verrs := a.validateUSPatch(patch)
    if len(verrs) > 0 {
        for _, e := range verrs {
            fmt.Println(e)
        }
        return current, errors.Join(verrs...)
    }

	// Aplicar cambios y guardar
	a.mu.Lock()
    a.cfg = candidate
    snapshot := a.cfg
    a.mu.Unlock()

    if err := a.saveUserSettings(snapshot); err != nil {
        return backend.UserSettings{}, err
    }

    return snapshot, nil
}

func (a *App) ReadLocalFile(path string) (*backend.FilePayload, error) {
	if path == "" {
		return nil, errors.New("[!] ReadLocalFile: ruta proporcionada está vacía")
	}
	abs, err := filepath.Abs(path)
	if err != nil {
		return nil, err
	}

	if !a.isPathAllowed(abs) {
		return nil, errors.New("[!] ReadLocalFile: acceso denegado a la ruta solicitada")
	}
	info, err := os.Stat(abs)
	if err != nil {
		return nil, err
	}
	if info.IsDir() {
		return nil, errors.New("[!] ReadLocalFile: la ruta es un directorio, no un archivo")
	}

	b, err := os.ReadFile(abs)
	if err != nil {
		return nil, err
	}

	ext := strings.ToLower(filepath.Ext(abs))
	m := mime.TypeByExtension(ext)
	if m == "" {
		m = "application/octet-stream"
	}

	return &backend.FilePayload{
		Name:       info.Name(),
		Mime:       m,
		DataBase64: base64.StdEncoding.EncodeToString(b),
	}, nil
}

func (a *App) GetFinetuning() (map[string]any, error) {
    a.mu.RLock()
    defer a.mu.RUnlock()

    // Si no hay información cargada en memoria, devuelve error
    if a.ft == nil {
        return map[string]any{}, nil
    }
    return jsonCopyMap(a.ft), nil
}

func (a *App) SaveFinetuning(newCfg map[string]any) (map[string]any, error) {
    if newCfg == nil {
        return nil, errors.New("[!] SaveFinetuning: Nueva configuración no puede ser nula")
    }

    // Guardar cambios en memoria
    a.mu.Lock()
    a.ft = jsonCopyMap(newCfg)
    snapshot := jsonCopyMap(a.ft)
    a.mu.Unlock()

    if err := a.saveFinetuning(snapshot); err != nil {
        return nil, err
    }
    return snapshot, nil
}

func (a *App) GetLangsearchAPIKey() (string, error) {
    return os.Getenv("LANGSEARCH_API_KEY"), nil
}

func (a *App) UpdateLangsearchAPIKey(newValue string) (bool, error) {
	if err := a.UpdateSecrets("LANGSEARCH_API_KEY", newValue); err != nil {
        return false, err
    }
    return true, nil
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
