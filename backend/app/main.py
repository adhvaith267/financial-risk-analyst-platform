import logging
from uuid import uuid4

from fastapi import FastAPI
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy.exc import SQLAlchemyError
from starlette.exceptions import HTTPException as StarletteHTTPException
from starlette.requests import Request

from app.api.routes.agent import router as agent_router
from app.api.routes.credit import router as credit_router
from app.api.routes.dashboard import router as dashboard_router
from app.api.routes.market import router as market_router
from app.api.routes.stress import router as stress_router
from app.core.config import get_settings
from app.core.db import check_database
from app.core.errors import ApplicationError, DatabaseUnavailableError

settings = get_settings()
logging.basicConfig(
    level=getattr(logging, settings.log_level),
    format="%(asctime)s %(levelname)s %(name)s %(message)s",
)
logger = logging.getLogger("riskora.api")

app = FastAPI(
    title="Financial Risk Analyst API",
    root_path="/api",
    docs_url="/docs" if settings.app_env != "production" else None,
    redoc_url="/redoc" if settings.app_env != "production" else None,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=get_settings().allowed_origins_list,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type", "X-Request-ID"],
)

app.include_router(credit_router)
app.include_router(market_router)
app.include_router(stress_router)
app.include_router(agent_router)
app.include_router(dashboard_router)


@app.middleware("http")
async def request_id_middleware(request: Request, call_next):
    supplied_request_id = request.headers.get("X-Request-ID", "").strip()
    request_id = supplied_request_id[:128] if supplied_request_id else uuid4().hex
    request.state.request_id = request_id
    response = await call_next(request)
    response.headers["X-Request-ID"] = request_id
    return response


@app.exception_handler(ApplicationError)
async def application_error_handler(request: Request, exc: ApplicationError) -> JSONResponse:
    return JSONResponse(
        status_code=exc.status_code,
        content={
            **exc.context,
            "detail": exc.detail,
            "code": exc.code,
            "request_id": getattr(request.state, "request_id", None),
        },
    )


@app.exception_handler(SQLAlchemyError)
async def database_error_handler(request: Request, exc: SQLAlchemyError) -> JSONResponse:
    request_id = getattr(request.state, "request_id", None)
    logger.exception(
        "Database error request_id=%s",
        request_id,
    )
    error = DatabaseUnavailableError("The database is temporarily unavailable.")
    return await application_error_handler(request, error)


@app.exception_handler(StarletteHTTPException)
async def http_error_handler(request: Request, exc: StarletteHTTPException) -> JSONResponse:
    detail = exc.detail if isinstance(exc.detail, str) else "The request could not be completed."
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "detail": detail,
            "code": "http_error",
            "request_id": getattr(request.state, "request_id", None),
        },
        headers=exc.headers,
    )


@app.exception_handler(RequestValidationError)
async def validation_error_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
    return JSONResponse(
        status_code=422,
        content={
            "detail": "Request validation failed.",
            "code": "validation_error",
            "errors": jsonable_encoder(exc.errors()),
            "request_id": getattr(request.state, "request_id", None),
        },
    )


@app.exception_handler(Exception)
async def unexpected_error_handler(request: Request, exc: Exception) -> JSONResponse:
    request_id = getattr(request.state, "request_id", None)
    logger.exception(
        "Unhandled application error request_id=%s",
        request_id,
    )
    return JSONResponse(
        status_code=500,
        content={
            "detail": "Internal server error.",
            "code": "internal_error",
            "request_id": getattr(request.state, "request_id", None),
        },
    )


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}


@app.get("/ready")
def ready() -> dict:
    try:
        check_database()
    except SQLAlchemyError as exc:
        raise DatabaseUnavailableError("The database is not ready.") from exc
    return {"status": "ok", "checks": {"database": "ok"}}
