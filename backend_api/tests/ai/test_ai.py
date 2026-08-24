import pytest
from fastapi.testclient import TestClient

class TestAI:
    
    def test_chatbot_message(self, client: TestClient, auth_headers):
        response = client.post("/api/v1/chatbot/message",
            headers=auth_headers,
            json={
                "message": "Quel type de massage me convient le mieux ?"
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert "response" in data
        assert "conversation_id" in data
    
    def test_chatbot_faq(self, client: TestClient, auth_headers):
        response = client.post("/api/v1/chatbot/faq",
            params={"question": "prix"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "answer" in data
        assert "question" in data
    
    def test_recommend_therapist(self, client: TestClient, auth_headers):
        response = client.post("/api/v1/ai/recommend-therapist",
            headers=auth_headers,
            json={
                "user_id": 1,
                "massage_type": "relaxant",
                "budget_max": 50000,
                "distance_max": 10
            }
        )
        assert response.status_code in [200, 404]
    
    def test_predict_price(self, client: TestClient, auth_headers):
        response = client.post("/api/v1/ai/predict-price",
            headers=auth_headers,
            json={
                "massage_type": "relaxant",
                "duration": 60,
                "distance": 5,
                "demand_level": "medium"
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert "suggested_price" in data
        assert "min_price" in data
        assert "max_price" in data
    
    def test_chat_suggestions(self, client: TestClient, auth_headers):
        response = client.get("/api/v1/chatbot/suggestions", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert "suggestions" in data
        assert isinstance(data["suggestions"], list)