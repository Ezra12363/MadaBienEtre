# app/main.py
# ============================================================
# MADA BIEN-ÊTRE — MAIN FASTAPI APPLICATION
# API REST + IA + CHAT CLIENT/THÉRAPEUTE + WEBSOCKET
# ============================================================

from contextlib import asynccontextmanager
from pathlib import Path
import logging
import time

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from starlette.exceptions import HTTPException as StarletteHTTPException

from .core.config import settings
from .core.database import init_database
from .core.middleware import setup_middlewares

from .api import (
    auth,
    users,
    therapists,
    bookings,
    offers,
    payments,
    wallet,  # ✅ PAIEMENT : wallet thérapeute, retraits, vue admin
    reviews,
    notifications,
    geolocation,
    chatbot,
    ai,
    pricing,
    sos,
    websocket,
    analytics,
    admin,
    massage_public,
    certificates,
    client_status,
    chat,
)

from .api.availability import router as availability_router


# ============================================================
# LOGGING
# ============================================================

logging.basicConfig(
    level=getattr(
        settings,
        "LOG_LEVEL",
        "INFO",
    ).upper(),
    format=(
        "%(asctime)s - %(name)s - "
        "%(levelname)s - %(message)s"
    ),
)

logger = logging.getLogger(__name__)


# ============================================================
# CHEMINS ABSOLUS
# app/main.py -> racine du backend
# ============================================================

BACKEND_ROOT = Path(__file__).resolve().parent.parent
UPLOAD_ROOT = BACKEND_ROOT / "uploads"

UPLOAD_SUBDIRECTORIES = (
    "profiles",
    "documents",
    "certificates",
    "massage_types",
)

for subdir in UPLOAD_SUBDIRECTORIES:
    (UPLOAD_ROOT / subdir).mkdir(
        parents=True,
        exist_ok=True,
    )

logger.info("Backend root: %s", BACKEND_ROOT)
logger.info("Upload root: %s", UPLOAD_ROOT)


# ============================================================
# LIFESPAN
# ============================================================

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info(
        "Starting %s v%s",
        settings.APP_NAME,
        settings.API_VERSION,
    )

    logger.info(
        "Environment: %s",
        settings.ENVIRONMENT,
    )

    logger.info(
        "Log Level: %s",
        settings.LOG_LEVEL,
    )

    try:
        init_database()
        logger.info("Database initialized successfully")

    except Exception:
        # Conserver ce comportement si l'initialisation
        # de la base est gérée ailleurs dans le projet.
        logger.exception("Database initialization error")

    yield

    logger.info(
        "Shutting down %s",
        settings.APP_NAME,
    )


# ============================================================
# APPLICATION FASTAPI
# ============================================================

app = FastAPI(
    title=settings.APP_NAME,
    version=settings.API_VERSION,
    description=(
        "API Mada Bien-Être : réservation de massages, "
        "gestion des thérapeutes, intelligence artificielle, "
        "négociation et messagerie Client-Thérapeute."
    ),
    lifespan=lifespan,
    docs_url="/docs" if settings.DEBUG else None,
    redoc_url="/redoc" if settings.DEBUG else None,
)


# ============================================================
# STATIC FILES
# URL : /uploads/profiles/photo.jpg
# FICHIER : BACKEND_ROOT/uploads/profiles/photo.jpg
# ============================================================

app.mount(
    "/uploads",
    StaticFiles(
        directory=str(UPLOAD_ROOT),
        check_dir=True,
    ),
    name="uploads",
)

logger.info(
    "Static files mounted at /uploads -> %s",
    UPLOAD_ROOT,
)


# ============================================================
# MIDDLEWARES
# ============================================================

setup_middlewares(app)


# ============================================================
# HTTP EXCEPTION HANDLER
# ============================================================

@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(
    request: Request,
    exc: StarletteHTTPException,
):
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "status": "error",
            "message": exc.detail,
            "status_code": exc.status_code,
            "timestamp": time.time(),
        },
        headers=getattr(exc, "headers", None),
    )


# ============================================================
# VALIDATION EXCEPTION HANDLER
# ============================================================

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(
    request: Request,
    exc: RequestValidationError,
):
    errors = [
        {
            "field": ".".join(
                str(part) for part in error["loc"]
            ),
            "message": error["msg"],
            "type": error["type"],
        }
        for error in exc.errors()
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


# ============================================================
# GENERAL EXCEPTION HANDLER
# ============================================================

@app.exception_handler(Exception)
async def general_exception_handler(
    request: Request,
    exc: Exception,
):
    logger.error(
        "Unhandled exception on %s %s",
        request.method,
        request.url.path,
        exc_info=True,
    )

    return JSONResponse(
        status_code=500,
        content={
            "status": "error",
            "message": "Internal server error",
            "detail": (
                str(exc)
                if settings.DEBUG
                else None
            ),
            "status_code": 500,
            "timestamp": time.time(),
        },
    )


# ============================================================
# REQUEST LOGGING MIDDLEWARE
# ============================================================

@app.middleware("http")
async def log_requests(
    request: Request,
    call_next,
):
    start_time = time.perf_counter()

    logger.info(
        "REQUEST -> %s %s",
        request.method,
        request.url.path,
    )

    try:
        response = await call_next(request)

    except Exception:
        logger.exception(
            "Request failed: %s %s",
            request.method,
            request.url.path,
        )
        raise

    process_time = time.perf_counter() - start_time

    response.headers["X-Process-Time"] = (
        f"{process_time:.6f}"
    )

    logger.info(
        "RESPONSE <- %s %s %.3fs",
        response.status_code,
        request.url.path,
        process_time,
    )

    return response


# ============================================================
# SYSTEM ENDPOINTS
# ============================================================

@app.get("/", tags=["System"])
async def root():
    return {
        "name": settings.APP_NAME,
        "version": settings.API_VERSION,
        "environment": settings.ENVIRONMENT,
        "docs": (
            "/docs"
            if settings.DEBUG
            else None
        ),
        "status": "running",
        "timestamp": time.time(),
    }


@app.get("/health", tags=["System"])
async def health_check():
    return {
        "status": "healthy",
        "environment": settings.ENVIRONMENT,
        "timestamp": time.time(),
    }


@app.get("/version", tags=["System"])
async def version():
    return {
        "version": settings.API_VERSION,
        "name": settings.APP_NAME,
        "environment": settings.ENVIRONMENT,
    }


# ============================================================
# API ROUTERS — AUTHENTIFICATION ET UTILISATEURS
# ============================================================

app.include_router(auth.router)
app.include_router(users.router)
app.include_router(availability_router)
app.include_router(client_status.router)

app.include_router(therapists.router)


# ============================================================
# API ROUTERS — RÉSERVATIONS ET OFFRES
# ============================================================

app.include_router(bookings.router)
app.include_router(offers.router)


# ============================================================
# API ROUTERS — PAIEMENTS, WALLET, AVIS ET NOTIFICATIONS
#
# payments.router            : initiate / verify / webhooks / reçu PDF
# wallet.router              : wallet thérapeute, retraits, vue admin
# wallet.withdrawals_router  : POST /withdrawals/create (ancien écran)
# ============================================================

app.include_router(payments.router)
app.include_router(wallet.router)
app.include_router(wallet.withdrawals_router)
app.include_router(reviews.router)
app.include_router(notifications.router)


# ============================================================
# API ROUTERS — GÉOLOCALISATION ET MASSAGES
# ============================================================

app.include_router(geolocation.router)
app.include_router(massage_public.router)


# ============================================================
# API ROUTERS — CHATBOT IA ET INTELLIGENCE ARTIFICIELLE
# ============================================================

app.include_router(chatbot.router)
app.include_router(ai.router)
app.include_router(pricing.router)


# ============================================================
# API ROUTERS — MESSAGERIE CLIENT / THÉRAPEUTE
#
# chat.router :
#     API REST pour les conversations, messages et images.
#
# Le WebSocket du chat (/ws/chat/{booking_id}) est défini dans
# app/api/websocket.py et chargé plus bas avec websocket.router :
# il n'y a donc PAS de chat.ws_router.
# ============================================================

app.include_router(chat.router)


# ============================================================
# API ROUTERS — SOS, ANALYTICS ET ADMINISTRATION
# ============================================================

app.include_router(sos.router)
app.include_router(analytics.router)
app.include_router(admin.router)


# ============================================================
# API ROUTERS — CERTIFICATS
# ============================================================

app.include_router(certificates.router)
app.include_router(certificates.public_router)


# ============================================================
# API ROUTERS — WEBSOCKET EXISTANT
# ============================================================

app.include_router(websocket.router)


# ============================================================
# POINT D'ENTRÉE
# ============================================================

if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=settings.DEBUG,
        log_level=settings.LOG_LEVEL.lower(),
    )