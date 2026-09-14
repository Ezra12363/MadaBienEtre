from pydantic import BaseModel, Field


class ClientOnlineStatusUpdate(BaseModel):
    is_online: bool = Field(
        ...,
        description="True = En ligne, False = Hors ligne",
    )


class ClientOnlineStatusResponse(BaseModel):
    success: bool = True
    is_online: bool
    message: str