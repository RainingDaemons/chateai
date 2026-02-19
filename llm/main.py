import os, time, uuid, threading, json

from vllm import LLM
from dotenv import load_dotenv
from fastapi import FastAPI, Request, Form, BackgroundTasks, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from server.schemas import Message, ChatRequest, ChatChoice, ChatResponse
from server.utils import build_prompt_from_messages, build_model_params
from rag.rag_retriever import RAGRetriever, build_context
from rag.rag_indexer import RAGIndexer

load_dotenv()

# Config
MODEL_DIR = os.getenv("MODEL_DIR")
MODEL_DATA_TYPE = os.getenv("MODEL_DTYPE")
MODEL_MAX_TOKENS = int(os.getenv("MODEL_MAX_TOKENS"))
MODEL_GPU_MAX_THRESHOLD = float(os.getenv("GPU_UTIL"))
TRUST_REMOTE_CODE = os.getenv("TRUST_REMOTE_CODE")
SHOW_INTERNAL_THINKING = os.getenv("SHOW_INTERNAL_THINKING")

DOCS_DIR = os.getenv("DOCS_DIR")
RAG_INDEX_PATH = os.getenv("RAG_INDEX_PATH")
RAG_META_PATH = os.getenv("RAG_META_PATH")
RAG_EMBED_MODEL = os.getenv("RAG_EMBED_MODEL")
RAG_ENABLED = os.getenv("RAG_ENABLED")
ALLOWED_EXTS = {".pdf", ".md"}  # Extensiones soportadas en RAG

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

# RAG init
retriever = None
_reindex_lock = threading.Lock()

def _rebuild_index_and_reload():
    global retriever
    indexer = RAGIndexer(DOCS_DIR, RAG_INDEX_PATH, RAG_META_PATH, RAG_EMBED_MODEL)
    indexer.main()
    retriever = RAGRetriever(RAG_INDEX_PATH, RAG_META_PATH, RAG_EMBED_MODEL)

if RAG_ENABLED:
    _rebuild_index_and_reload()

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

@app.post("/v1/chat/rag")
async def chat_rag(
        request: Request,
        background: BackgroundTasks,
        sync: bool = Form(True)
    ):
    """
    Subir documentos y guadarlos, después reindexar y cargar preguntas en el retriever.
    Acepta un máximo de 10 documentos por llamada a la API.
    """
    if not RAG_ENABLED:
        raise HTTPException(
            status_code=400, 
            detail="RAG no está activado"
        )

    form = await request.form()

    # En caso que venga chat: Leer y convertir a JSON
    chat_json = form.get("chat")
    chat_req = None
    if chat_json:
        try:
            chat_obj = json.loads(chat_json)
            chat_req = ChatRequest(**chat_obj)
        except Exception as e:
            raise HTTPException(
                status_code=400, 
                detail=f"JSON inválido en campo 'chat': {e}"
            )
    
    # En caso que vengan archivos: Recolectar y enumeradar como file0, file1, etc.
    uploads = []
    for i in range(10):
        key = f"file{i}"
        values = form.getlist(key)
        for val in values:
            if hasattr(val, "filename") and hasattr(val, "read"):
                uploads.append(val)

    if not uploads:
        raise HTTPException(
            status_code=400,
            detail="No se adjuntaron archivos"
        )

    if len(uploads) > 10:
        raise HTTPException(
            status_code=400, 
            detail="Máximo 10 archivos por solicitud."
        )

    # Validar extensiones de archivos
    os.makedirs(DOCS_DIR, exist_ok=True)
    for uf in uploads:
        _, ext = os.path.splitext(uf.filename or "")
        ext = ext.lower()
        if ext not in ALLOWED_EXTS:
            raise HTTPException(
                status_code=415,
                detail=f"Formato no soportado en '{uf.filename}'. Solo se permiten: {', '.join(sorted(ALLOWED_EXTS))}"
            )

    # Guardar todos los archivos
    saved_files = []
    for uf in uploads:
        safe_name = (uf.filename or "unnamed").replace("/", "_").replace("\\", "_")
        dst_path = os.path.join(DOCS_DIR, safe_name)
        content = await uf.read()
        with open(dst_path, "wb") as f:
            f.write(content)
        saved_files.append(safe_name)

    # Reindex + reload retriever
    def _task_reindex():
        try:
            with _reindex_lock:
                _rebuild_index_and_reload()
        except Exception as e:
            print(f"[RAG] Error en reindex task: {e}")

    if sync:
        with _reindex_lock:
            _rebuild_index_and_reload()
        
        # Si vienen mensajes entonces llamar al retriever
        if chat_req:
            # Obtener última pregunta del usuario
            user_query = None
            for m in reversed(chat_req.messages):
                if m.role == "user":
                    user_query = m.content
                    break

            if not user_query:
                raise HTTPException(
                    status_code=400, 
                    detail="El campo 'chat' no contiene mensajes del usuario."
                )
            
            # Recuperar contexto desde RAG
            docs = retriever.retrieve(user_query, top_k=5)
            context = build_context(docs)

            # Renderizar prompt desde messages
            prompt = build_prompt_from_messages(chat_req.messages, _tokenizer, SHOW_INTERNAL_THINKING, True, context)

            # Cargar modelo con parametros especificados
            sampling = build_model_params(chat_req.params, chat_req.max_tokens or 2048)

            outputs = llm.generate(prompts=[prompt], sampling_params=sampling)
            text = outputs[0].outputs[0].text

            res = ChatResponse(
                id=str(uuid.uuid4()),
                api="/v1/chat/rag",
                created=int(time.time()),
                model=os.path.basename(MODEL_DIR),
                choices=[ChatChoice(index=0, message=Message(role="assistant", content=text))]
            )
            
            return res
        
        # Si no hay chat, solo confirmar que se indexaron los archivos
        else:
            return {"status": "ok", "indexed": True, "files": saved_files}
    # Utilizar modo asincrónico para testing o evitar bloqueos de la API
    else:
        background.add_task(_task_reindex)
        
        if chat_req:
            return {
                "status": "accepted",
                "indexed": "in_progress",
                "files": saved_files,
                "warning": "Reintenta el chat cuando termine el reindex o usa sync=true."
            }
        else:
            return {"status": "accepted", "indexed": "in_progress", "files": saved_files}
