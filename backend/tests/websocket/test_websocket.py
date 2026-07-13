import pytest
from fastapi.testclient import TestClient
from fastapi import WebSocket

class TestWebSocket:
    
    def test_websocket_connection(self, client: TestClient):
        with client.websocket_connect("/ws/tracking/1") as websocket:
            data = websocket.receive_json()
            assert data["type"] == "connection_established"
    
    def test_websocket_chat(self, client: TestClient):
        with client.websocket_connect("/ws/chat/1") as websocket:
            data = websocket.receive_json()
            assert data["type"] == "connection_established"
            
            # Envoyer un message
            websocket.send_json({
                "type": "message",
                "user_id": 1,
                "username": "Test User",
                "message": "Hello!"
            })
            
            response = websocket.receive_json()
            assert response["type"] == "message"
            assert response["message"] == "Hello!"
    
    def test_websocket_location_update(self, client: TestClient):
        with client.websocket_connect("/ws/tracking/1") as websocket:
            data = websocket.receive_json()
            assert data["type"] == "connection_established"
            
            # Envoyer une mise à jour de position
            websocket.send_json({
                "type": "location_update",
                "user_id": 1,
                "latitude": -18.8792,
                "longitude": 47.5079,
                "booking_id": 1
            })
            
            response = websocket.receive_json()
            assert response["type"] == "location_update"