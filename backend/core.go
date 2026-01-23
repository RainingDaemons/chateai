package backend

import (
    "context"
    "database/sql"
	"encoding/json"
    "fmt"

	"chateai/backend/entities"
	"chateai/backend/repository"
)

type Core struct {
	convRepo *repository.ConversationRep
    msgRepo  *repository.MessageRep
}

func NewApp(convRepo *repository.ConversationRep, msgRepo *repository.MessageRep) *Core {
	return &Core{
		convRepo: convRepo,
        msgRepo:  msgRepo,
	}
}

/*
* CONVERSATIONS
*/
// Guardar conversación en BD
func (c *Core) CreateConversation(name string) (string, error) {
    id, err := c.convRepo.Create(name)
    if err != nil {
        return "", err
    }

    resp := struct {
        Status string 	 `json:"status"`
        Data   struct {} `json:"data"`
		ID 	   int64	 `json:"id"`
    }{
        Status: "success",
    }
    resp.ID = id

    b, err := json.Marshal(resp)
    if err != nil {
        return "", err
    }
    return string(b), nil
}

// Devolver conversaciones en formato JSON
func (c *Core) GetAllConversations() (string, error) {
	data, err := c.convRepo.GetAll()
	if err != nil {
		return "", err
	}
	b, err := json.Marshal(struct {
		Status string                  `json:"status"`
		Data   []entities.Conversation `json:"data"`
	}{
		Status: "success",
		Data:   data,
	})
	if err != nil {
		return "", err
	}
	return string(b), nil
}

// Actualizar nombre de conversación
func (c *Core) UpdateConversationName(id int64, name string) (string, error) {
    rows, err := c.convRepo.UpdateName(id, name)
    if err != nil {
        if err == sql.ErrNoRows {
            resp := struct {
                Status string `json:"status"`
                Error  string `json:"error"`
            }{
                Status: "not_found",
                Error:  fmt.Sprintf("conversation id=%d no existe", id),
            }
            b, _ := json.Marshal(resp)
            return string(b), nil
        }
        return "", err
    }

    resp := struct {
        Status         string `json:"status"`
        RowsAffected   int64  `json:"rows_affected"`
        ID             int64  `json:"id"`
        Name           string `json:"name"`
    }{
        Status:         "success",
        RowsAffected:   rows,
        ID:             id,
        Name:           name,
    }
    b, err := json.Marshal(resp)
    if err != nil {
        return "", err
    }
    return string(b), nil
}

// Eliminar conversación de la BD
func (c *Core) DeleteConversation(ctx context.Context, id int64) (string, error) {
    rows, err := c.convRepo.Delete(ctx, id)
    if err != nil {
        if err == sql.ErrNoRows {
            payload := struct {
                Status string `json:"status"`
                Error  string `json:"error"`
                ID     int64  `json:"id"`
            }{
                Status: "not_found",
                Error:  fmt.Sprintf("conversation id=%d no existe", id),
                ID:     id,
            }
            b, _ := json.Marshal(payload)
            return string(b), nil
        }
        return "", err
    }

    payload := struct {
        Status       string `json:"status"`
        RowsAffected int64  `json:"rows_affected"`
        ID           int64  `json:"id"`
    }{
        Status:       "success",
        RowsAffected: rows,
        ID:           id,
    }

    b, err := json.Marshal(payload)
    if err != nil {
        return "", err
    }
    return string(b), nil
}

/*
* MESSAGES
*/
// Guardar mensaje en BD
func (c *Core) CreateMessage(conversationID int, role string, content string) (string, error) {
    id, err := c.msgRepo.Create(conversationID, role, content)
    if err != nil {
        return "", err
    }

    resp := struct {
        Status string 	 `json:"status"`
        Data   struct {} `json:"data"`
		ID 	   int64	 `json:"id"`
    }{
        Status: "success",
    }
    resp.ID = id

    b, err := json.Marshal(resp)
    if err != nil {
        return "", err
    }
    return string(b), nil
}

// Devolver mensajes asociados a conversación en JSON
func (c *Core) GetMessagesByConversationID(convID int) (string, error) {
    data, err := c.msgRepo.GetByConversationID(convID)
    if err != nil {
        return "", err
    }
    b, err := json.Marshal(struct {
        Status string              `json:"status"`
        Data   []entities.Message  `json:"data"`
    }{
        Status: "success",
        Data:   data,
    })
    if err != nil {
        return "", err
    }
    return string(b), nil
}

// Devolver todos los mensajes en formato JSON
func (c *Core) GetAllMessages() (string, error) {
	data, err := c.msgRepo.GetAll()
	if err != nil {
		return "", err
	}
	b, err := json.Marshal(struct {
		Status string                  `json:"status"`
		Data   []entities.Message      `json:"data"`
	}{
		Status: "success",
		Data:   data,
	})
	if err != nil {
		return "", err
	}
	return string(b), nil
}
