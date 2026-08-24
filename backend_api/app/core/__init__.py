# app/core/__init__.py
from .security import (
    get_password_hash,
    hash_password,
    verify_password,
    create_access_token,
    create_refresh_token,
    decode_token,
    verify_token,
    generate_otp,
    generate_secure_token,
    generate_api_key,
    validate_password_strength,
    security,
    oauth2_scheme,
    SecurityHeaders,
    SecurityService
)

from .dependencies import (
    get_current_user,
    get_current_admin,
    get_current_therapist,
    get_current_client,
    get_current_active_user,
    get_current_user_ws,      # ✅ Ajouté
    get_user_from_websocket   # ✅ Ajouté
)

from .config import settings
from .database import get_db, engine, Base, SessionLocal