import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.main import app
from app.core.database import Base, get_db
from app.core.config import settings
from app.models import *

# Base de données de test
SQLALCHEMY_DATABASE_URL = "sqlite:///./test.db"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def override_get_db():
    try:
        db = TestingSessionLocal()
        yield db
    finally:
        db.close()

app.dependency_overrides[get_db] = override_get_db

@pytest.fixture(scope="session")
def db_engine():
    Base.metadata.create_all(bind=engine)
    yield engine
    Base.metadata.drop_all(bind=engine)

@pytest.fixture(scope="function")
def db_session(db_engine):
    connection = db_engine.connect()
    transaction = connection.begin()
    session = TestingSessionLocal(bind=connection)
    
    yield session
    
    session.close()
    transaction.rollback()
    connection.close()

@pytest.fixture(scope="module")
def client():
    with TestClient(app) as test_client:
        yield test_client

@pytest.fixture
def test_user_data():
    return {
        "fullname": "Test User",
        "email": "test@example.com",
        "phone": "0321234567",
        "password": "Test123!@#",
        "role": "CLIENT"
    }

@pytest.fixture
def test_therapist_data():
    return {
        "fullname": "Test Therapist",
        "email": "therapist@example.com",
        "phone": "0321234568",
        "password": "Test123!@#",
        "role": "THERAPIST"
    }

@pytest.fixture
def test_booking_data():
    return {
        "massage_type_id": 1,
        "duration_minutes": 60,
        "preferred_gender": "any",
        "address": "Lot III A 78, Antananarivo",
        "latitude": -18.8792,
        "longitude": 47.5079,
        "scheduled_date": "2026-12-31T10:00:00",
        "client_price_proposed": 80000,
        "special_instructions": "Test booking"
    }

@pytest.fixture
def auth_headers(client, test_user_data):
    # Créer un utilisateur
    response = client.post("/api/v1/auth/register", json=test_user_data)
    assert response.status_code == 201
    
    # Activer l'utilisateur (simuler OTP)
    from app.services.auth_service import AuthService
    from app.core.database import get_db
    db = next(get_db())
    user = AuthService.verify_otp(db, test_user_data["email"], "123456")
    assert user is not None
    
    # Se connecter
    response = client.post("/api/v1/auth/login", json={
        "email": test_user_data["email"],
        "password": test_user_data["password"]
    })
    assert response.status_code == 200
    
    token = response.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}