package entities

type Conversation struct {
	ID     		int	   `json:"id"`
	Name   		string `json:"name"`
	Created_at 	string `json:"created_at"`
	Updated_at  string `json:"updated_at"`
}
