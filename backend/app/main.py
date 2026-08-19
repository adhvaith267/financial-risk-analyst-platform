from fastapi import FastAPI

from app.api.routes.credit import router as credit_router

app = FastAPI(title="Financial Risk Analyst API")

app.include_router(credit_router)


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}
