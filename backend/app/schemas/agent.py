from pydantic import BaseModel, Field


class AgentAskRequest(BaseModel):
    question: str = Field(min_length=1, max_length=4000)


class AgentTraceStep(BaseModel):
    tool: str
    label: str
    status: str  # "ok" | "error"


class AgentAskResponse(BaseModel):
    answer: str
    trace: list[AgentTraceStep]
