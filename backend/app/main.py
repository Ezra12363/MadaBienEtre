# app/main.py
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException
import logging
import time
from contextlib import asynccontextmanager

from .core.config import settings
from .core.database import init_database
from .core.middleware import setup_middlewares
from .core.security import SecurityHeaders

# Import des routers
from .api import (
    auth, users, therapists, bookings, offers, payments,
    reviews, notifications, geolocation, chatbot, ai,
    pricing, sos, websocket, analytics, admin
)

# Configuration du logging
log_level = getattr(logging, settings.LOG_LEVEL.upper(), logging.INFO)
logging.basicConfig(
    level=log_level,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Gestion du cycle de vie de l'application"""
    # Startup
    logger.info(f"Starting {settings.APP_NAME} v{settings.API_VERSION}")
    logger.info(f"Environment: {settings.ENVIRONMENT}")
    logger.info(f"Log Level: {settings.LOG_LEVEL}")
    
    # Initialiser la base de données
    try:
        init_database()
        logger.info("Database initialized successfully")
    except Exception as e:
        logger.error(f"Database initialization error: {e}")
    
    yield
    
    # Shutdown
    logger.info(f"Shutting down {settings.APP_NAME}")

# Création de l'application
app = FastAPI(
    title=settings.APP_NAME,
    version=settings.API_VERSION,
    description="API pour Mada Bien-être - Massage à domicile avec IA",
    lifespan=lifespan,
    docs_url="/docs" if settings.DEBUG else None,
    redoc_url="/redoc" if settings.DEBUG else None
)

# Middlewares
setup_middlewares(app)

# Gestionnaires d'exceptions
@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(request: Request, exc: StarletteHTTPException):
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "status": "error",
            "message": exc.detail,
            "status_code": exc.status_code,
            "timestamp": time.time()
        }
    )

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    errors = []
    for error in exc.errors():
        errors.append({
            "field": ".".join(str(loc) for loc in error["loc"]),
            "message": error["msg"],
            "type": error["type"]
        })
    
    return JSONResponse(
        status_code=422,
        content={
            "status": "error",
            "message": "Validation error",
            "errors": errors,
            "status_code": 422,
            "timestamp": time.time()
        }
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
            "timestamp": time.time()
        }
    )

# Routes de base
@app.get("/")
async def root():
    return {
        "name": settings.APP_NAME,
        "version": settings.API_VERSION,
        "environment": settings.ENVIRONMENT,
        "docs": "/docs" if settings.DEBUG else None,
        "status": "running",
        "timestamp": time.time()
    }

@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "environment": settings.ENVIRONMENT,
        "timestamp": time.time()
    }

@app.get("/version")
async def version():
    return {
        "version": settings.API_VERSION,
        "name": settings.APP_NAME,
        "environment": settings.ENVIRONMENT
    }

# ✅ Inclusion des routers avec le bon prefix
app.include_router(auth.router)  # Résultat: /api/v1/api/auth/...
app.include_router(users.router)
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

# WebSocket routes (sans prefix)
app.include_router(websocket.router)

# Middleware de log des requêtes
@app.middleware("http")
async def log_requests(request: Request, call_next):
    start_time = time.time()
    
    logger.info(f"Request: {request.method} {request.url.path}")
    
    response = await call_next(request)
    
    process_time = time.time() - start_time
    logger.info(f"Response: {response.status_code} - Duration: {process_time:.3f}s")
    
    response.headers["X-Process-Time"] = str(process_time)
    return response

# Point d'entrée pour uvicorn
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=settings.DEBUG,
        log_level=settings.LOG_LEVEL.lower()
    )