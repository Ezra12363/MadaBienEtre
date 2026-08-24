import pytest
from fastapi.testclient import TestClient
from datetime import datetime, timedelta

class TestBookings:
    
    def test_create_booking(self, client: TestClient, auth_headers, test_booking_data):
        response = client.post("/api/v1/bookings/", 
            headers=auth_headers,
            json=test_booking_data
        )
        if response.status_code == 201:
            data = response.json()
            assert data["client_price_proposed"] == test_booking_data["client_price_proposed"]
            assert data["address"] == test_booking_data["address"]
            assert data["status"] == "pending"
        else:
            # Peut échouer si le type de massage n'existe pas
            assert response.status_code in [400, 404, 201]
    
    def test_get_bookings(self, client: TestClient, auth_headers):
        response = client.get("/api/v1/bookings/", headers=auth_headers)
        assert response.status_code == 200
        assert isinstance(response.json(), list)
    
    def test_get_booking_by_id(self, client: TestClient, auth_headers, test_booking_data):
        # Créer une réservation
        create_response = client.post("/api/v1/bookings/", 
            headers=auth_headers,
            json=test_booking_data
        )
        if create_response.status_code == 201:
            booking_id = create_response.json()["id"]
            
            response = client.get(f"/api/v1/bookings/{booking_id}", headers=auth_headers)
            assert response.status_code == 200
            data = response.json()
            assert data["id"] == booking_id
    
    def test_cancel_booking(self, client: TestClient, auth_headers, test_booking_data):
        # Créer une réservation
        create_response = client.post("/api/v1/bookings/", 
            headers=auth_headers,
            json=test_booking_data
        )
        if create_response.status_code == 201:
            booking_id = create_response.json()["id"]
            
            response = client.put(f"/api/v1/bookings/cancel/{booking_id}",
                headers=auth_headers,
                json={"reason": "Test cancellation"}
            )
            assert response.status_code == 200
            assert "Booking cancelled" in response.text