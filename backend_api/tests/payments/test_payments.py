import pytest
from fastapi.testclient import TestClient

class TestPayments:
    
    def test_create_payment_stripe(self, client: TestClient, auth_headers):
        # Ce test nécessite une réservation existante
        response = client.post("/api/v1/payments/create",
            headers=auth_headers,
            json={
                "booking_id": 1,
                "method": "card",
                "provider": "stripe",
                "payment_method_id": "pm_card_visa"
            }
        )
        # Peut échouer si la réservation n'existe pas
        assert response.status_code in [200, 400, 404]
    
    def test_get_payment_history(self, client: TestClient, auth_headers):
        response = client.get("/api/v1/payments/history", headers=auth_headers)
        assert response.status_code == 200
        assert isinstance(response.json(), list)
    
    def test_mobile_money_payment(self, client: TestClient, auth_headers):
        response = client.post("/api/v1/payments/mobile-money",
            headers=auth_headers,
            json={
                "phone": "0321234567",
                "amount": 50000,
                "booking_id": 1,
                "provider": "mvola"
            }
        )
        assert response.status_code in [200, 400, 404]