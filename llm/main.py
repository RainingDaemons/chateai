import os
import time
import uuid

from vllm import LLM
from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from schemas import Message, ChatRequest, ChatChoice, ChatResponse
from utils import build_prompt_from_messages, build_model_params

load_dotenv()

MODEL_DIR = os.getenv("MODEL_DIR")
MODEL_DATA_TYPE = os.getenv("MODEL_DTYPE")
MODEL_MAX_TOKENS = int(os.getenv("MODEL_MAX_TOKENS"))
MODEL_GPU_MAX_THRESHOLD = float(os.getenv("GPU_UTIL"))
TRUST_REMOTE_CODE = os.getenv("TRUST_REMOTE_CODE")
SHOW_INTERNAL_THINKING = os.getenv("SHOW_INTERNAL_THINKING")

# Server init
app = FastAPI(title="vLLM API")
app.add_middleware(
    CORSMiddleware,
    allow_origins="http://wails.localhost:34115",
    allow_methods=["*"],
    allow_headers=["*"],
)

llm = LLM(
    model=MODEL_DIR,
    trust_remote_code=TRUST_REMOTE_CODE,
    dtype=MODEL_DATA_TYPE,
    max_model_len=MODEL_MAX_TOKENS,
    gpu_memory_utilization=MODEL_GPU_MAX_THRESHOLD,
)

_tokenizer = llm.get_tokenizer()

@app.get("/health")
def health():
    return {"status": "ok"}

@app.post("/v1/chat/completions", response_model=ChatResponse)
def chat_completions(req: ChatRequest):
    if not req.messages:
        return {"error": "Campo messages no puede estar vacío"}

    # Renderizar prompt desde messages
    prompt = build_prompt_from_messages(req.messages, _tokenizer, SHOW_INTERNAL_THINKING)

    # Cargar modelo con parametros especificados
    sampling = build_model_params(req.params, req.max_tokens or 2048)
    
    outputs = llm.generate(prompts=[prompt], sampling_params=sampling)
    text = outputs[0].outputs[0].text

    # Preparar respuesta
    res = ChatResponse(
        id=str(uuid.uuid4()),
        api="/v1/chat/completions",
        created=int(time.time()),
        model=os.path.basename(MODEL_DIR),
        choices=[
            ChatChoice(
                index=0,
                message=Message(role="assistant", content=text)
            )
        ]
    )

    return res
