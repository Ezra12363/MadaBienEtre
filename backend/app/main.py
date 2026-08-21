from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from fastapi.staticfiles import StaticFiles
from starlette.exceptions import HTTPException as StarletteHTTPException
import logging
import time
from pathlib import Path
from contextlib import asynccontextmanager

from .core.config import settings
from .core.database import init_database
from .core.middleware import setup_middlewares

from .api import (
    auth, users, therapists, bookings, offers, payments,
    reviews, notifications, geolocation, chatbot, ai,
    pricing, sos, websocket, analytics, admin,
    certificates,
)
from .api.availability import router as availability_router

logging.basicConfig(
    level=getattr(settings, "LOG_LEVEL", "INFO").upper(),
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)

# ============================================================
# CHEMIN UNIQUE ET ABSOLU POUR LES UPLOADS
# app/main.py -> parents[1] = racine du backend
# IMPORTANT : admin.py utilise exactement la même racine.
# ============================================================
BACKEND_ROOT = Path(__file__).resolve().parent.parent
UPLOAD_ROOT = BACKEND_ROOT / "uploads"

for subdir in ("profiles", "documents", "certificates", "massage_types"):
    (UPLOAD_ROOT / subdir).mkdir(parents=True, exist_ok=True)

logger.info("📁 Backend root: %s", BACKEND_ROOT)
logger.info("📁 Upload root: %s", UPLOAD_ROOT)
logger.info("📁 Massage images: %s", UPLOAD_ROOT / "massage_types")


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting %s v%s", settings.APP_NAME, settings.API_VERSION)
    logger.info("Environment: %s", settings.ENVIRONMENT)
    logger.info("Log Level: %s", settings.LOG_LEVEL)
    try:
        init_database()
        logger.info("Database initialized successfully")
    except Exception as exc:
        logger.error("Database initialization error: %s", exc, exc_info=True)
    yield
    logger.info("Shutting down %s", settings.APP_NAME)


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.API_VERSION,
    description="API pour Mada Bien-être - Massage à domicile avec IA",
    lifespan=lifespan,
    docs_url="/docs" if settings.DEBUG else None,
    redoc_url="/redoc" if settings.DEBUG else None,
)

# ============================================================
# STATIC FILES — UNE SEULE SOURCE DE VÉRITÉ
# /uploads/massage_types/xxx.jpg
#      ↓
# BACKEND_ROOT/uploads/massage_types/xxx.jpg
# ============================================================
app.mount(
    "/uploads",
    StaticFiles(directory=str(UPLOAD_ROOT), check_dir=True),
    name="uploads",
)
logger.info("📁 Static /uploads monté sur: %s", UPLOAD_ROOT)

setup_middlewares(app)


@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(request: Request, exc: StarletteHTTPException):
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "status": "error",
            "message": exc.detail,
            "status_code": exc.status_code,
            "timestamp": time.time(),
        },
    )


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    errors = [
        {
            "field": ".".join(str(loc) for loc in err["loc"]),
            "message": err["msg"],
            "type": err["type"],
        }
        for err in exc.errors()
    ]
    return JSONResponse(
        status_code=422,
        content={
            "status": "error",
            "message": "Validation error",
            "errors": errors,
            "status_code": 422,
            "timestamp": time.time(),
        },
    )


@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    logger.error("Unhandled exception: %s", exc, exc_info=True)
    return JSONResponse(
        status_code=500,
        content={
            "status": "error",
            "message": "Internal server error",
            "detail": str(exc) if settings.DEBUG else None,
            "status_code": 500,
            "timestamp": time.time(),
        },
    )


@app.get("/")
async def root():
    return {
        "name": settings.APP_NAME,
        "version": settings.API_VERSION,
        "environment": settings.ENVIRONMENT,
        "docs": "/docs" if settings.DEBUG else None,
        "status": "running",
        "timestamp": time.time(),
    }


@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "environment": settings.ENVIRONMENT,
        "timestamp": time.time(),
    }


@app.get("/version")
async def version():
    return {
        "version": settings.API_VERSION,
        "name": settings.APP_NAME,
        "environment": settings.ENVIRONMENT,
    }


# ============================================================
# ROUTERS
# ============================================================
app.include_router(auth.router)
app.include_router(users.router)
app.include_router(availability_router)
app.include_router(therapists.router)
app.include_router(bookings.router)
app.include_router(offers.router)
app.include_router(payments.router)
app.include_router(reviews.router)
app.include_router(notifications.router)
app.include_router(geolocation.router)
app.include_router(chatbot.router)
app.include_router(ai.router)
app.include_router(pricing.router)
app.include_router(sos.router)
app.include_router(analytics.router)
app.include_router(admin.router)
app.include_router(certificates.router)
app.include_router(certificates.public_router)
app.include_router(websocket.router)


@app.middleware("http")
async def log_requests(request: Request, call_next):
    start_time = time.time()
    logger.info("→ %s %s", request.method, request.url.path)
    response = await call_next(request)
    process_time = time.time() - start_time
    logger.info("← %s %.3fs", response.status_code, process_time)
    response.headers["X-Process-Time"] = str(process_time)
    return response


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=settings.DEBUG,
        log_level=settings.LOG_LEVEL.lower(),
    )
