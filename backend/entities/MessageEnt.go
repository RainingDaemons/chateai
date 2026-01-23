package entities

type Message struct {
    ID             int    `json:"id,omitempty"`
    ConversationID int    `json:"conversation_id,omitempty"`
    Role           string `json:"role"`
    Content        string `json:"content"`
    CreatedAt      string `json:"created_at"`
    UpdatedAt      string `json:"updated_at"`
}
