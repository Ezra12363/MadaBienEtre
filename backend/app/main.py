# app/main.py
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from fastapi.staticfiles import StaticFiles
from starlette.exceptions import HTTPException as StarletteHTTPException
import logging
import time
import os
from contextlib import asynccontextmanager

from .core.config import settings
from .core.database import init_database
from .core.middleware import setup_middlewares

# ✅ Import des routers
from .api import (
    auth, users, therapists, bookings, offers, payments,
    reviews, notifications, geolocation, chatbot, ai,
    pricing, sos, websocket, analytics, admin,
    certificates,
)

# ✅ Import du router availability (doit être séparé)
from .api.availability import router as availability_router

# ============================================================
# CONFIGURATION DU LOGGING
# ============================================================
logging.basicConfig(
    level=getattr(logging, settings.LOG_LEVEL.upper(), logging.INFO),
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


# ============================================================
# LIFESPAN
# ============================================================
@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info(f"Starting {settings.APP_NAME} v{settings.API_VERSION}")
    logger.info(f"Environment: {settings.ENVIRONMENT}")
    logger.info(f"Log Level: {settings.LOG_LEVEL}")
    try:
        init_database()
        logger.info("Database initialized successfully")
    except Exception as e:
        logger.error(f"Database initialization error: {e}")
    yield
    logger.info(f"Shutting down {settings.APP_NAME}")


# ============================================================
# CRÉATION DE L'APPLICATION
# ============================================================
app = FastAPI(
    title=settings.APP_NAME,
    version=settings.API_VERSION,
    description="API pour Mada Bien-être - Massage à domicile avec IA",
    lifespan=lifespan,
    docs_url="/docs" if settings.DEBUG else None,
    redoc_url="/redoc" if settings.DEBUG else None,
)


# ============================================================
# FICHIERS STATIQUES (uploads)
# ============================================================
upload_dir = "uploads"
# ✅ "massage_types" ajouté : dossier où admin.py enregistre les icônes/images
#    des types de massage (voir app/api/admin.py — _save_massage_image).
for sub in ("profiles", "documents", "certificates", "massage_types"):
    os.makedirs(os.path.join(upload_dir, sub), exist_ok=True)

app.mount("/uploads", StaticFiles(directory=upload_dir), name="uploads")
logger.info(f"📁 Dossier '{upload_dir}' monté sur /uploads")


# ============================================================
# MIDDLEWARES
# ============================================================
setup_middlewares(app)


# ============================================================
# GESTIONNAIRES D'EXCEPTIONS
# ============================================================
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
    logger.error(f"Unhandled exception: {exc}", exc_info=True)
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


# ============================================================
# ROUTES DE BASE
# ============================================================
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
# ✅ INCLUSION DES ROUTERS
# ⚠️ IMPORTANT — ORDRE DE ROUTAGE FastAPI/Starlette :
# Starlette matche les routes dans l'ORDRE d'inclusion. Comme
# `availability_router` et `therapists.router` partagent tous les
# deux le préfixe "/therapists", tout routeur définissant un chemin
# dynamique du type "/{therapist_id}" DOIT être inclus APRÈS les
# routeurs qui définissent des chemins statiques ("/availability",
# "/toggle-online", "/toggle-available", ...), sinon ces chemins
# statiques sont interceptés par "/{therapist_id}" (FastAPI essaie
# alors de convertir "availability" en entier → 422).
#
# ⚠️ CORRECTIF : availability_router doit donc être enregistré
# AVANT therapists.router (et non "en dernier" comme précédemment).
# ============================================================
app.include_router(auth.router)
app.include_router(users.router)
app.include_router(availability_router)   # ✅ AVANT therapists.router (chemins statiques)
app.include_router(therapists.router)     # ← contient /{therapist_id} (chemin dynamique)
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


# ============================================================
# MIDDLEWARE DE LOG DES REQUÊTES
# ============================================================
@app.middleware("http")
async def log_requests(request: Request, call_next):
    start_time = time.time()
    logger.info(f"→ {request.method} {request.url.path}")
    response = await call_next(request)
    process_time = time.time() - start_time
    logger.info(f"← {response.status_code} ({process_time:.3f}s)")
    response.headers["X-Process-Time"] = str(process_time)
    return response


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