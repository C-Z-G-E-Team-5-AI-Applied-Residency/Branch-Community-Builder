from typing import Annotated

from pydantic import BaseModel, StringConstraints

# Stripped before the length check so whitespace-only text can't slip past
# min_length=1 and silently unlock the has_responded gate.
ResponseText = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=500)]


class PromptResponseCreate(BaseModel):
    response_text: ResponseText


class PromptResponseUpdate(BaseModel):
    response_text: ResponseText
