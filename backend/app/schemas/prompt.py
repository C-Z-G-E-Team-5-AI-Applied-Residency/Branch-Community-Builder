from pydantic import BaseModel


class PromptResponseCreate(BaseModel):
    response_text: str


class PromptResponseUpdate(BaseModel):
    response_text: str
