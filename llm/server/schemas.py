from typing import List, Optional, Literal, Dict, Union
from pydantic import BaseModel, Field

Numeric = Union[int, float]

class Message(BaseModel):
    role: Literal["system", "user", "assistant"]
    content: str

class ChatRequest(BaseModel):
    messages: List[Message] = Field(min_length=1)
    params: Optional[Dict[str, Numeric]] = None
    max_tokens: Optional[int] = 2048

class ChatChoice(BaseModel):
    index: int
    message: Message

class ChatResponse(BaseModel):
    id: str
    api: str
    created: int
    model: str
    choices: List[ChatChoice]
