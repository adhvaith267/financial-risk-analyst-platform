from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes.agent import router as agent_router
from app.api.routes.credit import router as credit_router
from app.api.routes.market import router as market_router
from app.api.routes.stress import router as stress_router

app = FastAPI(title="Financial Risk Analyst API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(credit_router)
app.include_router(market_router)
app.include_router(stress_router)
app.include_router(agent_router)


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}
