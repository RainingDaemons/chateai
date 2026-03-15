package backend

/*
* System
*/
type FilePayload struct {
	Name       string `json:"name"`
	Mime       string `json:"mime"`
	DataBase64 string `json:"dataBase64"`
}

/*
* User settings
*/
type General struct {
    Root              string `toml:"root" json:"root"`
    LLMModelDir       string `toml:"llm_model_dir" json:"llm_model_dir"`
    EmbeddingModelDir string `toml:"embedding_model_dir" json:"embedding_model_dir"`
}

type Server struct {
    DType       string   `toml:"dtype" json:"dtype"`
    MaxTokens   int      `toml:"max_tokens" json:"max_tokens"`
    GPUUtil     float64  `toml:"gpu_util" json:"gpu_util"`
    AllowedExts []string `toml:"allowed_exts" json:"allowed_exts"`
}

type LLM struct {
    ShowInternalThinking bool   `toml:"show_internal_thinking" json:"show_internal_thinking"`
    UseLanguageInstruct  bool   `toml:"use_language_instruct" json:"use_language_instruct"`
    LanguageInstruct     string `toml:"language_instruct" json:"language_instruct"`
    InternalThinking     string `toml:"internal_thinking" json:"internal_thinking"`
    SystemPrompt         string `toml:"system_prompt" json:"system_prompt"`
}

type UserSettings struct {
    General	General `toml:"general" json:"general"`
    Server	Server  `toml:"server" json:"server"`
    LLM		LLM     `toml:"llm" json:"llm"`
}

type GeneralPatch struct {
    Root              *string `json:"root"`
    LLMModelDir       *string `json:"llm_model_dir"`
    EmbeddingModelDir *string `json:"embedding_model_dir"`
}

type ServerPatch struct {
    MaxTokens   *int      `json:"max_tokens"`
    GPUUtil     *float64  `json:"gpu_util"`
    AllowedExts []string  `json:"allowed_exts"`
    DType       *string   `json:"dtype"`
}

type LLMPatch struct {
    ShowInternalThinking *bool   `json:"show_internal_thinking"`
    UseLanguageInstruct  *bool   `json:"use_language_instruct"`
	LanguageInstruct     *string `json:"language_instruct"`
    InternalThinking     *string `json:"internal_thinking"`
    SystemPrompt         *string `json:"system_prompt"`
}

type UserSettingsPatch struct {
	General *GeneralPatch `json:"general`
    Server  *ServerPatch  `json:"server"`
    LLM     *LLMPatch     `json:"llm"`
}