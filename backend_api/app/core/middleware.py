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
    """
    Configurer tous les middlewares pour l'application.

    ⚠️ ORDRE CRITIQUE — CORS DOIT ÊTRE AJOUTÉ EN DERNIER :
    Starlette empile les middlewares avec `add_middleware()` en les
    insérant en TÊTE de pile (insert(0, ...)). Le DERNIER middleware
    ajouté devient donc le PLUS EXTÉRIEUR (le premier à traiter la
    requête entrante, le dernier à traiter la réponse sortante).

    Le CORSMiddleware doit être le plus extérieur de tous, sinon les
    réponses générées par d'autres middlewares AVANT d'atteindre le
    CORS (ex: 429 du RateLimitMiddleware, 500 de
    l'ExceptionHandlerMiddleware) ne passent jamais par le CORS et
    n'ont donc pas l'en-tête "Access-Control-Allow-Origin". Résultat
    concret : le navigateur web bloque la requête (erreur CORS dans
    la console), alors qu'une app native (Android/iOS) — qui ne fait
    ni preflight OPTIONS ni vérification CORS — fonctionne sans
    problème. C'est exactement ce qui empêchait l'upload CIN et
    certificat_pro de fonctionner depuis le web.

    On ajoute donc CORS en tout dernier ici, pour qu'il enveloppe
    absolument tout le reste.
    """

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

    # ✅ CORS — ajouté EN DERNIER pour devenir le middleware le plus
    # extérieur et garantir que TOUTE réponse (y compris les erreurs
    # générées par les middlewares ci-dessus) reçoit les en-têtes CORS.
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.CORS_ORIGINS,
        allow_credentials=settings.CORS_ALLOW_CREDENTIALS,
        allow_methods=settings.CORS_ALLOW_METHODS,
        allow_headers=settings.CORS_ALLOW_HEADERS,
    )

    logger.info("Middlewares configurés avec succès (CORS en position extérieure)")
    return app