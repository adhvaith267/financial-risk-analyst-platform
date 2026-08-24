from fastapi import APIRouter, Depends

from app.agent.graph import ask
from app.auth import require_roles
from app.core.errors import InvalidInputError
from app.schemas.agent import AgentAskRequest, AgentAskResponse, AgentTraceStep

router = APIRouter(
    prefix="/agent",
    tags=["agent"],
    dependencies=[Depends(require_roles("analyst", "admin"))],
)


@router.post("/ask", response_model=AgentAskResponse)
def agent_ask(request: AgentAskRequest) -> AgentAskResponse:
    if not request.question.strip():
        raise InvalidInputError("question must not be blank")
    answer, trace = ask(request.question)
    return AgentAskResponse(answer=answer, trace=[AgentTraceStep(**step) for step in trace])
