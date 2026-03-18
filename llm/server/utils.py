import inspect

from vllm import SamplingParams
from typing import Optional, Dict
from server.schemas import Numeric, Message

def build_prompt_from_messages(messages, tokenizer, show_internal_thinking, use_language_instruct, prompt_thinking, prompt_language, prompt_system, using_rag=None, context=None):
    """
    Utilizar una chat template del tokenizer especificado, en caso contrario generar un prompt nuevo
    """
    system_instruct = ""

    # Utilizar prompt de lenguage
    if use_language_instruct:
        system_instruct += prompt_language

    # Utilizar prompt de razonamiento interno
    if not show_internal_thinking:
        system_instruct += prompt_thinking

    # Reglas del sistema cuando se utiliza RAG
    if using_rag:
        rag_context = (
            "REQUISITOS DE CITADO (OBLIGATORIO):\n"
            "- Para documentos locales usa: [doc:{nombre}|chunk:{id}|score:{s}]\n"
            "- Para páginas web usa: [site:{url}|chunk:{id}|score:{s}]\n"
            "- Incluye SIEMPRE al menos una cita para cada punto clave o afirmación factual que hagas.\n"
            "- Coloca la(s) cita(s) al final de la frase o bullet correspondiente.\n"
            "- PROHIBIDO usar referencias numéricas, notas o footnotes (p. ej. [1], [2], [CONTEXTO][1]).\n"
            "- NO inventes URLs y NO uses ningún otro formato de cita.\n\n"
            f"### CONTEXTO\n{context}\n### FIN CONTEXTO"
        )

        system_instruct += prompt_system + rag_context
    
    if system_instruct != "":
        messages = [Message(role="system", content=system_instruct)] + messages

    # Utilizar plantilla de chat del tokenizer en caso de que exista
    try:
        prompt = tokenizer.apply_chat_template(
            [m.model_dump() for m in messages],
            tokenize=False,
            add_generation_prompt=True,
        )
        return prompt
    
    # Alt: No existe plantilla, entonces construir el prompt
    except Exception:
        sys = "\n".join([m.content for m in messages if m.role == "system"]).strip()

        hist = []
        for m in messages:
            if m.role == "user":
                hist.append(f"Usuario: {m.content}")
            elif m.role == "assistant":
                hist.append(f"Asistente: {m.content}")
        
        hist_txt = "\n".join(hist)
        system_part = f"{sys}\n\n" if sys else ""
        return f"{system_part}{hist_txt}\nAsistente:"

def build_model_params(params: Optional[Dict[str, Numeric]], model_max_tokens: int) -> SamplingParams:
    """
    - Construcción de parametros especificados por usuario
    - Especifica limite de seguridad para tokens
    """
    params = dict(params or {})
    params.setdefault("max_tokens", model_max_tokens or 2048)

    # Devolver params o intentar reconstruirlos
    try:
        return SamplingParams(**params)
    except TypeError:
        sig = inspect.signature(SamplingParams.__init__)
        allowed = set(sig.parameters.keys()) - {"self", "kwargs"}
        filtered = {k: v for k, v in params.items() if k in allowed}

        return SamplingParams(**filtered)
