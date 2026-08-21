# app/core/config.py
import os
from typing import Optional, List
from dotenv import load_dotenv
from pydantic_settings import BaseSettings
from pydantic import ConfigDict

load_dotenv()

class Settings(BaseSettings):
    BASE_URL: str = os.getenv("BASE_URL", "http://localhost:8000")
    # Application
    APP_NAME: str = "Mada Bien-être API"
    ENVIRONMENT: str = "development"
    DEBUG: bool = True
    API_VERSION: str = "1.0.0"
    
    # JWT
    SECRET_KEY: str = os.getenv("SECRET_KEY", "madabienetre_secret_key_2026")
    ALGORITHM: str = os.getenv("ALGORITHM", "HS256")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", 1440))
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    
    # Database
    DATABASE_URL: str = os.getenv("DATABASE_URL", "postgresql+psycopg2://admin:admin@localhost:5432/db_madabienetre")
    DB_NAME: str = os.getenv("DB_NAME", "db_madabienetre")
    DB_USER: str = os.getenv("DB_USER", "admin")
    DB_PASSWORD: str = os.getenv("DB_PASSWORD", "admin")
    DB_HOST: str = os.getenv("DB_HOST", "localhost")
    DB_PORT: str = os.getenv("DB_PORT", "5432")
    DB_POOL_SIZE: int = 20
    DB_MAX_OVERFLOW: int = 40
    
    # Email
    EMAIL_HOST: str = os.getenv("EMAIL_HOST", "smtp.gmail.com")
    EMAIL_PORT: int = int(os.getenv("EMAIL_PORT", 587))
    EMAIL_USER: str = os.getenv("EMAIL_USER", "")
    EMAIL_PASSWORD: str = os.getenv("EMAIL_PASSWORD", "")
    EMAIL_FROM: str = os.getenv("EMAIL_FROM", "noreply@mada-bienetre.com")
    
    # SMS
    SMS_ENABLED: bool = os.getenv("SMS_ENABLED", "False").lower() == "true"
    SMS_ACCOUNT_SID: Optional[str] = os.getenv("SMS_ACCOUNT_SID")
    SMS_AUTH_TOKEN: Optional[str] = os.getenv("SMS_AUTH_TOKEN")
    SMS_FROM_NUMBER: Optional[str] = os.getenv("SMS_FROM_NUMBER")
    
    # Cloudinary
    CLOUDINARY_CLOUD_NAME: str = os.getenv("CLOUDINARY_CLOUD_NAME", "")
    CLOUDINARY_API_KEY: str = os.getenv("CLOUDINARY_API_KEY", "")
    CLOUDINARY_API_SECRET: str = os.getenv("CLOUDINARY_API_SECRET", "")
    
    # Stripe
    STRIPE_SECRET_KEY: str = os.getenv("STRIPE_SECRET_KEY", "")
    STRIPE_PUBLISHABLE_KEY: str = os.getenv("STRIPE_PUBLISHABLE_KEY", "")
    STRIPE_WEBHOOK_SECRET: str = os.getenv("STRIPE_WEBHOOK_SECRET", "")
    
    # Mobile Money
    MOBILE_MONEY_API_KEY: Optional[str] = os.getenv("MOBILE_MONEY_API_KEY")
    MOBILE_MONEY_API_URL: Optional[str] = os.getenv("MOBILE_MONEY_API_URL")
    
    # Vanila Pay
    VANILA_PAY_API_KEY: Optional[str] = os.getenv("VANILA_PAY_API_KEY")
    VANILA_PAY_API_URL: str = os.getenv("VANILA_PAY_API_URL", "https://api.vanila-pay.com/v1")
    VANILA_PAY_MERCHANT_ID: Optional[str] = os.getenv("VANILA_PAY_MERCHANT_ID")
    
    # OpenRouter AI
    OPENROUTER_API_KEY: str = os.getenv("OPENROUTER_API_KEY", "")
    OPENROUTER_BASE_URL: str = os.getenv("OPENROUTER_BASE_URL", "https://openrouter.ai/api/v1")
    OPENROUTER_MODEL: str = "mistralai/mistral-7b-instruct:free"
    
    # WebSocket
    WS_MAX_CONNECTIONS: int = 1000
    WS_PING_INTERVAL: int = 30
    WS_PING_TIMEOUT: int = 10
    
    # ✅ CORS — ajout de l'IP locale (10.230.25.30) pour permettre
    # au téléphone / émulateur d'accéder au backend en développement
    CORS_ORIGINS: List[str] = [
         "http://localhost:3000",
        "http://localhost:8081",
        "http://localhost:19000",
        "http://localhost:8000",
        "http://10.95.220.30:3000",
        "http://10.95.220.30:8081",
        "http://10.95.220.30:19000",
        "http://10.95.220.30:8000",
        "exp://10.95.220.30:19000",
        "exp://10.95.220.30:8081",
        "https://mada-bienetre.com",
        "https://*.mada-bienetre.com"
    ]
    CORS_ALLOW_CREDENTIALS: bool = True
    CORS_ALLOW_METHODS: List[str] = ["*"]
    CORS_ALLOW_HEADERS: List[str] = ["*"]
    
    # Rate Limiting
    RATE_LIMIT_ENABLED: bool = True
    RATE_LIMIT_REQUESTS: int = 100
    RATE_LIMIT_PERIOD: int = 60
    
    # File Upload
    MAX_UPLOAD_SIZE: int = 10 * 1024 * 1024  # 10 MB
    ALLOWED_UPLOAD_EXTENSIONS: List[str] = [".jpg", ".jpeg", ".png", ".gif", ".pdf", ".doc", ".docx"]
    
    # Security
    BCRYPT_ROUNDS: int = 12
    OTP_EXPIRY_MINUTES: int = 10
    BOOKING_EXPIRY_MINUTES: int = 30
    OFFER_EXPIRY_MINUTES: int = 15
    
    # Logging
    LOG_LEVEL: str = os.getenv("LOG_LEVEL", "INFO")
    LOG_FILE: str = os.getenv("LOG_FILE", "app.log")
    
    # Features
    FEATURE_PAYMENTS: bool = True
    FEATURE_AI: bool = True
    FEATURE_CHAT: bool = True
    FEATURE_SOS: bool = True
    FEATURE_PUSH_NOTIFICATIONS: bool = True
    
    model_config = ConfigDict(
        env_file=".env",
        case_sensitive=True,
        extra="ignore"
    )

settings = Settings()