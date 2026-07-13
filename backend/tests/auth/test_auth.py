import pytest
from fastapi.testclient import TestClient

class TestAuth:
    
    def test_register_success(self, client: TestClient, test_user_data):
        response = client.post("/api/v1/auth/register", json=test_user_data)
        assert response.status_code == 201
        data = response.json()
        assert "message" in data
        assert "user_id" in data
        assert data["message"] == "Registration successful. OTP sent to your email."
    
    def test_register_duplicate_email(self, client: TestClient, test_user_data):
        # Première inscription
        client.post("/api/v1/auth/register", json=test_user_data)
        
        # Deuxième inscription avec le même email
        response = client.post("/api/v1/auth/register", json=test_user_data)
        assert response.status_code == 400
        assert "Email already registered" in response.text
    
    def test_register_duplicate_phone(self, client: TestClient, test_user_data):
        # Première inscription
        client.post("/api/v1/auth/register", json=test_user_data)
        
        # Deuxième inscription avec le même téléphone
        user_data = test_user_data.copy()
        user_data["email"] = "another@example.com"
        response = client.post("/api/v1/auth/register", json=user_data)
        assert response.status_code == 400
        assert "Phone number already registered" in response.text
    
    def test_login_success(self, client: TestClient, test_user_data):
        # Inscription
        client.post("/api/v1/auth/register", json=test_user_data)
        
        # Activer l'utilisateur
        from app.services.auth_service import AuthService
        from app.core.database import get_db
        db = next(get_db())
        AuthService.verify_otp(db, test_user_data["email"], "123456")
        
        # Connexion
        response = client.post("/api/v1/auth/login", json={
            "email": test_user_data["email"],
            "password": test_user_data["password"]
        })
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert "token_type" in data
        assert data["token_type"] == "bearer"
    
    def test_login_invalid_credentials(self, client: TestClient, test_user_data):
        response = client.post("/api/v1/auth/login", json={
            "email": test_user_data["email"],
            "password": "wrongpassword"
        })
        assert response.status_code == 401
        assert "Invalid credentials" in response.text
    
    def test_login_unverified_account(self, client: TestClient, test_user_data):
        # Inscription sans vérification OTP
        client.post("/api/v1/auth/register", json=test_user_data)
        
        # Tentative de connexion
        response = client.post("/api/v1/auth/login", json={
            "email": test_user_data["email"],
            "password": test_user_data["password"]
        })
        assert response.status_code == 401
        assert "Account not verified" in response.text
    
    def test_verify_otp_success(self, client: TestClient, test_user_data):
        # Inscription
        client.post("/api/v1/auth/register", json=test_user_data)
        
        # Vérification OTP
        response = client.post("/api/v1/auth/verify-otp", json={
            "email": test_user_data["email"],
            "otp_code": "123456"
        })
        assert response.status_code == 200
        assert "Account verified successfully" in response.text
    
    def test_verify_otp_invalid_code(self, client: TestClient, test_user_data):
        # Inscription
        client.post("/api/v1/auth/register", json=test_user_data)
        
        # Vérification OTP avec mauvais code
        response = client.post("/api/v1/auth/verify-otp", json={
            "email": test_user_data["email"],
            "otp_code": "000000"
        })
        assert response.status_code == 400
        assert "Invalid OTP" in response.text
    
    def test_forgot_password(self, client: TestClient, test_user_data):
        # Inscription et vérification
        client.post("/api/v1/auth/register", json=test_user_data)
        client.post("/api/v1/auth/verify-otp", json={
            "email": test_user_data["email"],
            "otp_code": "123456"
        })
        
        # Demande de réinitialisation
        response = client.post("/api/v1/auth/forgot-password", json={
            "email": test_user_data["email"]
        })
        assert response.status_code == 200
        assert "OTP sent to your email" in response.text
    
    def test_reset_password_success(self, client: TestClient, test_user_data):
        # Inscription et vérification
        client.post("/api/v1/auth/register", json=test_user_data)
        client.post("/api/v1/auth/verify-otp", json={
            "email": test_user_data["email"],
            "otp_code": "123456"
        })
        
        # Demande de réinitialisation
        client.post("/api/v1/auth/forgot-password", json={
            "email": test_user_data["email"]
        })
        
        # Réinitialisation
        response = client.post("/api/v1/auth/reset-password", json={
            "email": test_user_data["email"],
            "otp_code": "123456",
            "new_password": "NewPass123!@#"
        })
        assert response.status_code == 200
        assert "Password reset successfully" in response.text
    
    def test_get_current_user(self, client: TestClient, test_user_data, auth_headers):
        response = client.get("/api/v1/auth/me", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["email"] == test_user_data["email"]
        assert data["fullname"] == test_user_data["fullname"]
        assert data["role"] == test_user_data["role"]
    
    def test_change_password(self, client: TestClient, test_user_data, auth_headers):
        response = client.put("/api/v1/auth/change-password", 
            headers=auth_headers,
            json={
                "old_password": test_user_data["password"],
                "new_password": "NewPass123!@#"
            }
        )
        assert response.status_code == 200
        assert "Password changed successfully" in response.text