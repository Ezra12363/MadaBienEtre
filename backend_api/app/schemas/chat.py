# app/schemas/chat.py
from typing import Optional

from pydantic import BaseModel, Field, field_validator

MAX_MESSAGE_LENGTH = 2000


class ChatSendRequest(BaseModel):
    message: str = Field(..., max_length=MAX_MESSAGE_LENGTH)
    client_id: Optional[str] = Field(default=None, max_length=64)

    @field_validator("message")
    @classmethod
    def not_blank(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Le message ne peut pas être vide.")
        return value
