import inspect

from vllm import SamplingParams
from typing import Optional, Dict
from schemas import Numeric, Message

def build_prompt_from_messages(messages, tokenizer, internal_thinking):
    """
    Utilizar una chat template del tokenizer especificado, en caso contrario generar un prompt nuevo
    """
    language_instruct = (
        "Responde SIEMPRE en el mismo idioma que el usuario usó en su mensaje. "
        "Si el usuario mezcla idiomas, responde en el idioma predominante. "
        "Nunca cambies el idioma por tu cuenta."
    )

    # Switch: Evitar razonamiento interno
    if not internal_thinking:
        thinking_instruct = (
            "Nunca reveles cadenas de pensamiento ni contenido interno como <think>. "
            "Si necesitas razonar, hazlo internamente y devuelve solo la respuesta final."
        )
    else: 
        thinking_instruct = ""
    
    messages = [Message(role="system", content=language_instruct),
        Message(role="system", content=thinking_instruct)] + messages

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
