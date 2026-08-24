# app/core/middleware.py
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.trustedhost import TrustedHostMiddleware
from starlette.middleware.gzip import GZipMiddleware
from starlette.middleware.httpsredirect import HTTPSRedirectMiddleware
# from starlette.middleware.sessions import SessionMiddleware
import time
import logging
import json
from typing import Callable, Dict, Any
from .config import settings
from .security import SecurityHeaders

logger = logging.getLogger(__name__)

class LoggingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        start_time = time.time()
        logger.info(f"Request: {request.method} {request.url.path}")
        
        try:
            response = await call_next(request)
        except Exception as e:
            logger.error(f"Error processing request: {str(e)}")
            raise
        
        process_time = time.time() - start_time
        response.headers["X-Process-Time"] = str(process_time)
        logger.info(f"Response: {response.status_code} - Duration: {process_time:.3f}s")
        
        return response

class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        response = await call_next(request)
        for key, value in SecurityHeaders.get_headers().items():
            response.headers[key] = value
        return response

class RequestIDMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        import uuid
        request_id = request.headers.get("X-Request-ID")
        if not request_id:
            request_id = str(uuid.uuid4())
        request.state.request_id = request_id
        response = await call_next(request)
        response.headers["X-Request-ID"] = request_id
        return response

class BodyLoggingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        if not settings.DEBUG:
            return await call_next(request)
        
        body = await request.body()
        if body:
            try:
                decoded_body = body.decode('utf-8')
                if decoded_body:
                    logger.debug(f"Request body: {decoded_body[:500]}...")
            except:
                pass
        
        async def receive():
            return {"type": "http.request", "body": body}
        request._receive = receive
        
        response = await call_next(request)
        return response

class RateLimitMiddleware(BaseHTTPMiddleware):
    def __init__(self, app, max_requests: int = 100, window: int = 60):
        super().__init__(app)
        self.max_requests = max_requests
        self.window = window
        self.requests = {}
    
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        if not settings.RATE_LIMIT_ENABLED:
            return await call_next(request)
        
        client_id = request.client.host if request.client else "unknown"
        now = time.time()
        
        if client_id in self.requests:
            self.requests[client_id] = [
                req_time for req_time in self.requests[client_id]
                if now - req_time < self.window
            ]
        else:
            self.requests[client_id] = []
        
        if len(self.requests[client_id]) >= self.max_requests:
            return Response(
                content=json.dumps({
                    "detail": "Too many requests. Please try again later."
                }),
                status_code=429,
                media_type="application/json"
            )
        
        self.requests[client_id].append(now)
        return await call_next(request)

class ExceptionHandlerMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        try:
            return await call_next(request)
        except Exception as e:
            logger.error(f"Unhandled exception: {str(e)}", exc_info=True)
            return Response(
                content=json.dumps({
                    "detail": "An internal error occurred",
                    "error": str(e) if settings.DEBUG else None
                }),
                status_code=500,
                media_type="application/json"
            )

def setup_middlewares(app):
    """Configurer tous les middlewares pour l'application"""
    
    # CORS
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.CORS_ORIGINS,
        allow_credentials=settings.CORS_ALLOW_CREDENTIALS,
        allow_methods=settings.CORS_ALLOW_METHODS,
        allow_headers=settings.CORS_ALLOW_HEADERS,
    )
    
    # Compression GZip
    app.add_middleware(GZipMiddleware, minimum_size=1000)
    
    # Limitation de taux
    app.add_middleware(
        RateLimitMiddleware,
        max_requests=settings.RATE_LIMIT_REQUESTS,
        window=settings.RATE_LIMIT_PERIOD
    )
    
    # Logging
    app.add_middleware(LoggingMiddleware)
    
    # En-têtes de sécurité
    app.add_middleware(SecurityHeadersMiddleware)
    
    # ID de requête
    app.add_middleware(RequestIDMiddleware)
    
    # Gestion d'exceptions
    app.add_middleware(ExceptionHandlerMiddleware)
    
    # Logging du corps des requêtes (développement)
    if settings.DEBUG:
        app.add_middleware(BodyLoggingMiddleware)
    
    # Trusted Host (production)
    if settings.ENVIRONMENT == "production":
        app.add_middleware(
            TrustedHostMiddleware,
            allowed_hosts=["*"]
        )
        app.add_middleware(HTTPSRedirectMiddleware)
    
    logger.info("Middlewares configurés avec succès")
    return app