package repository

import (
	"database/sql"
	"time"

	"chateai/backend/entities"
)

type MessageRep struct {
	DB *sql.DB
}

func NewMessageRepo(db *sql.DB) *MessageRep {
	return &MessageRep{DB: db}
}

// Insertar nuevo mensaje en la BD
func (r *MessageRep) Create(conversationID int, role string, content string) (int64, error) {
	const stmt = `
        INSERT INTO MESSAGES (conversation_id, role, content, created_at, updated_at)
        VALUES (?, ?, ?, ?, NULL)
    `
	now := time.Now().UTC().Format(time.RFC3339)

	res, err := r.DB.Exec(stmt, conversationID, role, content, now)
	if err != nil {
		return 0, err
	}

	id, err := res.LastInsertId()
	if err != nil {
		return 0, err
	}
	return id, nil
}

// Obtener todos los mensajes de una conversación determinada
func (r *MessageRep) GetByConversationID(convID int) ([]entities.Message, error) {
	rows, err := r.DB.Query(`
        SELECT role, content, created_at, updated_at
        FROM MESSAGES
        WHERE conversation_id = ?
        ORDER BY created_at ASC
    `, convID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var msgs []entities.Message
	for rows.Next() {
		var (
			role       string
			content    string
			createdStr string
			updatedStr sql.NullString
		)

		if err := rows.Scan(&role, &content, &createdStr, &updatedStr); err != nil {
			return nil, err
		}

		createdOut := "(INVALID)"
		if t, err := time.Parse(time.RFC3339, createdStr); err == nil {
			createdOut = t.UTC().Format("02-01-2006 15:04:05")
		}

		updatedOut := "(NULL)"
		if updatedStr.Valid && updatedStr.String != "" {
			if t, err := time.Parse(time.RFC3339, updatedStr.String); err == nil {
				updatedOut = t.UTC().Format("02-01-2006 15:04:05")
			} else {
				updatedOut = "(INVALID)"
			}
		}

		msgs = append(msgs, entities.Message{
			ID:             0,
			ConversationID: 0,
			Role:           role,
			Content:        content,
			CreatedAt:      createdOut,
			UpdatedAt:      updatedOut,
		})
	}

	if err := rows.Err(); err != nil {
		return nil, err
	}

	return msgs, nil
}

// Obtener todos los mensajes
func (r *MessageRep) GetAll() ([]entities.Message, error) {
	rows, err := r.DB.Query(`
        SELECT conversation_id, role, content, created_at, updated_at
        FROM MESSAGES
        ORDER BY created_at ASC
    `)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var msgs []entities.Message
	for rows.Next() {
		var (
			convID     int
			role       string
			content    string
			createdStr string
			updatedStr sql.NullString
		)

		if err := rows.Scan(&convID, &role, &content, &createdStr, &updatedStr); err != nil {
			return nil, err
		}

		// Parse y formatea created_at
		createdOut := "(INVALID)"
		if t, err := time.Parse(time.RFC3339, createdStr); err == nil {
			createdOut = t.UTC().Format("02-01-2006 15:04:05")
		}

		// Parse y formatea updated_at si existe
		updatedOut := "(NULL)"
		if updatedStr.Valid && updatedStr.String != "" {
			if t, err := time.Parse(time.RFC3339, updatedStr.String); err == nil {
				updatedOut = t.UTC().Format("02-01-2006 15:04:05")
			} else {
				updatedOut = "(INVALID)"
			}
		}

		msgs = append(msgs, entities.Message{
			ID:             0,
			ConversationID: convID,
			Role:           role,
			Content:        content,
			CreatedAt:      createdOut,
			UpdatedAt:      updatedOut,
		})
	}

	if err := rows.Err(); err != nil {
		return nil, err
	}

	return msgs, nil
}
