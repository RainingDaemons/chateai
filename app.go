package main

import (
	"context"
	"database/sql"
	"fmt"
	"log"

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
}

// NewApp creates a new App application struct
func NewApp() *App {
	return &App{}
}

// startup is called at application startup
func (a *App) startup(ctx context.Context) {
	a.ctx = ctx

	// Cargar BD
	sqliteDB, err := db.Connect("./data.db")
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
