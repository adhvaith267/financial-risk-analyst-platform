from fastapi import APIRouter

from app.agent.graph import ask
from app.schemas.agent import AgentAskRequest, AgentAskResponse

router = APIRouter(prefix="/agent", tags=["agent"])


@router.post("/ask", response_model=AgentAskResponse)
def agent_ask(request: AgentAskRequest) -> AgentAskResponse:
    answer = ask(request.question)
    return AgentAskResponse(answer=answer)
