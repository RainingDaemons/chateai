<h1 align="center">ChateAI</h1>

<div align="center">
  <img alt="ChateAI Logo" src="./build/appicon.png" width="200" />

  <p>Multiplatform desktop interface for visualizing, managing and interacting with LLMs.</p>

  <img src="./build/chateai.gif" alt="ChateAI preview" width="800" />
</div>

# Installation

## ChateAI

Building from source:
```bash
cd /chateai/frontend/
pnpm install
cd ..
go mod tidy
# for windows machines
wails build --platform windows/amd64 -o chateai_win_amd64.exe
# for linux machines
wails build --platform linux/amd64 -o chateai_linux_amd64 -tags webkit2_41
# for macos machines
wails build --platform darwin/universal -o chateai_mac_universal.app
```

## LLM Server

Building dockerfile:
```bash
docker build -t llm-server /chateai/llm
```

Put your custom LLM model inside `/models` folder and change MODEL_DIR var in `.env`, then run:
```bash
python autorunner.py
```

If you are going to use the RAG feature, download first the recommended embedding model by running:
```bash
python setup.py
```

If you are going to use the internet browse feature, you need to setup at least a free account in [Langsearch](https://langsearch.com//) and generate an api key, inside `/models` folder change LANGSEARCH_API_KEY var in `.env` file

# Requirements

- [Git](https://git-scm.com/) installed and accessible in your terminal
- [Go 1.25+](https://go.dev/dl/)
- [Wails](https://wails.io/docs/gettingstarted/installation) installed and accesible in your terminal
- [Node.js](https://nodejs.org/en/download/)
- [PNPM](https://pnpm.io/installation) recommended
- [Python](https://www.python.org/downloads/)
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) to launch LLM server

Note:
- [SolidJS](https://docs.solidjs.com/), [TailwindCSS](https://tailwindcss.com/) and [Kobalte](https://kobalte.dev/docs/core/overview/introduction/) are used for frontend interfaces.
- [Garble](https://github.com/burrowers/garble) needed to generate obfuscated builds for Wails.

# Feature Support

| Feature | Status | Description |
|---------|--------|-------------|
| LLM Server | 🟢 | Inference endpoint for local LLMs deployment |
| Storage | 🟢 | Store conversations in local database |
| Search | 🟢 | Find messages in conversations history |
| RAG | 🟢 | Documents context for conversations |
| Internet browse | 🟢 | Internet context for conversations |
| Finetuning | 🟢 | Finetune LLMs messages (temperature, repetition, etc.) |
| Markdown support | 🟡 | Markdown formatting for LLMs messages |
| Light/Dark mode | 🟢 | Customizable visual experience with Light and Dark themes |
| Custom options | 🔴 | Customizable app options |

🟢 Supported &nbsp;&nbsp; 🟡 In Development &nbsp;&nbsp; 🔴 Planned

# Contributing

We welcome contributions! Please see our [Contributing Guidelines](CONTRIBUTING.md) for details on how to get started.

# License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

# Author

Felipe Gutiérrez Carilao

GitHub: @rainingdaemons
