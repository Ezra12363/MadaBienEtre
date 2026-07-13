import pytest
from fastapi.testclient import TestClient

class TestUsers:
    
    def test_get_users_admin(self, client: TestClient, auth_headers):
        response = client.get("/api/v1/users/", headers=auth_headers)
        # Vérifier que l'utilisateur a le rôle ADMIN
        user_data = client.get("/api/v1/auth/me", headers=auth_headers).json()
        if user_data["role"] == "ADMIN":
            assert response.status_code == 200
            assert isinstance(response.json(), list)
    
    def test_get_user_by_id(self, client: TestClient, auth_headers):
        response = client.get("/api/v1/auth/me", headers=auth_headers)
        user_id = response.json()["id"]
        
        response = client.get(f"/api/v1/users/{user_id}", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == user_id
    
    def test_update_user_profile(self, client: TestClient, auth_headers, test_user_data):
        response = client.put("/api/v1/users/profile", 
            headers=auth_headers,
            json={
                "fullname": "Updated Name"
            }
        )
        assert response.status_code == 200
        assert "Profile updated successfully" in response.text
        
        # Vérifier la mise à jour
        me_response = client.get("/api/v1/auth/me", headers=auth_headers)
        assert me_response.json()["fullname"] == "Updated Name"
    
    def test_upload_profile_photo(self, client: TestClient, auth_headers):
        # Créer un fichier test
        files = {"file": ("test.jpg", b"fake image content", "image/jpeg")}
        response = client.post("/api/v1/users/upload-profile-photo", 
            headers=auth_headers,
            files=files
        )
        assert response.status_code == 200
        assert "profile_image" in response.json()