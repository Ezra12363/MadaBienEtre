from typing import Any, Dict, Optional, List
from datetime import datetime

def success_response(
    data: Any = None,
    message: str = "Success",
    status_code: int = 200
) -> Dict[str, Any]:
    """Réponse de succès standardisée"""
    return {
        "status": "success",
        "message": message,
        "data": data,
        "timestamp": datetime.utcnow().isoformat(),
        "status_code": status_code
    }

def error_response(
    message: str = "Error",
    errors: Optional[Any] = None,
    status_code: int = 400
) -> Dict[str, Any]:
    """Réponse d'erreur standardisée"""
    return {
        "status": "error",
        "message": message,
        "errors": errors,
        "timestamp": datetime.utcnow().isoformat(),
        "status_code": status_code
    }

def paginated_response(
    items: List[Any],
    total: int,
    page: int = 1,
    limit: int = 20,
    message: str = "Success"
) -> Dict[str, Any]:
    """Réponse paginée standardisée"""
    total_pages = (total + limit - 1) // limit
    
    return {
        "status": "success",
        "message": message,
        "data": {
            "items": items,
            "pagination": {
                "total": total,
                "page": page,
                "limit": limit,
                "total_pages": total_pages,
                "has_next": page < total_pages,
                "has_previous": page > 1
            }
        },
        "timestamp": datetime.utcnow().isoformat()
    }

def created_response(
    data: Any,
    message: str = "Created successfully",
    location: Optional[str] = None
) -> Dict[str, Any]:
    """Réponse de création standardisée"""
    response = success_response(data, message, 201)
    if location:
        response["location"] = location
    return response

def no_content_response(message: str = "Operation successful") -> Dict[str, Any]:
    """Réponse sans contenu"""
    return {
        "status": "success",
        "message": message,
        "timestamp": datetime.utcnow().isoformat()
    }

def validation_error_response(errors: Dict[str, List[str]]) -> Dict[str, Any]:
    """Réponse d'erreur de validation"""
    return error_response(
        message="Validation error",
        errors=errors,
        status_code=422
    )

def not_found_response(resource: str = "Resource") -> Dict[str, Any]:
    """Réponse de ressource non trouvée"""
    return error_response(
        message=f"{resource} not found",
        status_code=404
    )

def unauthorized_response(message: str = "Unauthorized") -> Dict[str, Any]:
    """Réponse d'accès non autorisé"""
    return error_response(
        message=message,
        status_code=401
    )

def forbidden_response(message: str = "Forbidden") -> Dict[str, Any]:
    """Réponse d'accès interdit"""
    return error_response(
        message=message,
        status_code=403
    )

def conflict_response(message: str = "Conflict") -> Dict[str, Any]:
    """Réponse de conflit"""
    return error_response(
        message=message,
        status_code=409
    )

def too_many_requests_response(message: str = "Too many requests") -> Dict[str, Any]:
    """Réponse de trop de requêtes"""
    return error_response(
        message=message,
        status_code=429
    )