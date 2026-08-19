from pydantic import BaseModel


class AgentAskRequest(BaseModel):
    question: str


class AgentAskResponse(BaseModel):
    answer: str
