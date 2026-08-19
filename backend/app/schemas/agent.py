from pydantic import BaseModel


class AgentAskRequest(BaseModel):
    question: str


class AgentTraceStep(BaseModel):
    tool: str
    label: str
    status: str  # "ok" | "error"


class AgentAskResponse(BaseModel):
    answer: str
    trace: list[AgentTraceStep]
