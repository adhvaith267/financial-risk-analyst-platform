from fastapi import FastAPI

from app.api.routes.credit import router as credit_router
from app.api.routes.market import router as market_router
from app.api.routes.stress import router as stress_router

app = FastAPI(title="Financial Risk Analyst API")

app.include_router(credit_router)
app.include_router(market_router)
app.include_router(stress_router)


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}
