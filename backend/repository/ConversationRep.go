package repository

import (
	"context"
	"database/sql"
	"errors"
	"time"

	"chateai/backend/entities"
)

type ConversationRep struct {
	DB *sql.DB
}

func NewConversationRepo(db *sql.DB) *ConversationRep {
	return &ConversationRep{DB: db}
}

// Insertar nueva conversación en la BD
func (r *ConversationRep) Create(name string) (int64, error) {
	const stmt = `
        INSERT INTO CONVERSATIONS (name, created_at, updated_at)
        VALUES(?, ?, NULL);
    `
	now := time.Now().UTC().Format(time.RFC3339)

	res, err := r.DB.Exec(stmt, name, now)
	if err != nil {
		return 0, err
	}

	id, err := res.LastInsertId()
	if err != nil {
		return 0, err
	}
	return id, nil
}

// Obtener todas las conversaciones
func (r *ConversationRep) GetAll() ([]entities.Conversation, error) {
	rows, err := r.DB.Query(`
        SELECT id, name, created_at, updated_at
        FROM CONVERSATIONS
        ORDER BY created_at DESC
    `)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var convs []entities.Conversation
	for rows.Next() {
		var (
			id         int
			name       string
			createdStr string
			updatedStr sql.NullString
		)

		if err := rows.Scan(&id, &name, &createdStr, &updatedStr); err != nil {
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

		convs = append(convs, entities.Conversation{
			ID:         id,
			Name:       name,
			Created_at: createdOut,
			Updated_at: updatedOut,
		})
	}

	if err := rows.Err(); err != nil {
		return nil, err
	}

	return convs, nil
}

// Actualizar nombre de conversación
func (r *ConversationRep) UpdateName(id int64, name string) (int64, error) {
	// Validaciones previas
	if id <= 0 {
		return 0, errors.New("id inválido")
	}
	if name == "" {
		return 0, errors.New("name no puede ser vacío")
	}

	const stmt = `
        UPDATE conversations
        SET name = $1, updated_at = $2
        WHERE id = $3;
    `

	now := time.Now().UTC().Format(time.RFC3339)
	res, err := r.DB.Exec(stmt, name, now, id)
	if err != nil {
		return 0, err
	}
	rows, err := res.RowsAffected()
	if err != nil {
		return 0, err
	}
	if rows == 0 {
		return 0, sql.ErrNoRows
	}
	return rows, nil
}

// Eliminar conversación
func (r *ConversationRep) Delete(ctx context.Context, id int64) (int64, error) {
	if id <= 0 {
		return 0, errors.New("id inválido")
	}

	// Comenzar transacción para asegurar borrado correcto
	tx, err := r.DB.BeginTx(ctx, &sql.TxOptions{Isolation: sql.LevelReadCommitted})
	if err != nil {
		return 0, err
	}
	defer func() {
		if p := recover(); p != nil {
			_ = tx.Rollback()
			panic(p)
		}
	}()

	// 1) Borrar mensajes asociados
	if _, err := tx.ExecContext(ctx, `
        DELETE FROM messages WHERE conversation_id = $1
    `, id); err != nil {
		_ = tx.Rollback()
		return 0, err
	}

	// 2) Borrar la conversación
	res, err := tx.ExecContext(ctx, `
        DELETE FROM conversations WHERE id = $1
    `, id)
	if err != nil {
		_ = tx.Rollback()
		return 0, err
	}

	rows, err := res.RowsAffected()
	if err != nil {
		_ = tx.Rollback()
		return 0, err
	}
	if rows == 0 {
		_ = tx.Rollback()
		return 0, sql.ErrNoRows
	}

	if err := tx.Commit(); err != nil {
		return 0, err
	}

	return rows, nil
}
