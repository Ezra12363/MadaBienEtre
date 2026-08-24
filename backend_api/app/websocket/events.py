from typing import Dict, Any, Optional
from datetime import datetime
import json
from .connection_manager import manager

class WebSocketEvents:
    """Événements WebSocket prédéfinis"""
    
    @staticmethod
    def connection_established(connection_id: str, user_id: Optional[int] = None) -> Dict[str, Any]:
        return {
            "type": "connection_established",
            "connection_id": connection_id,
            "user_id": user_id,
            "timestamp": datetime.utcnow().isoformat()
        }
    
    @staticmethod
    def new_booking(booking_data: Dict[str, Any]) -> Dict[str, Any]:
        return {
            "type": "new_booking",
            "data": booking_data,
            "timestamp": datetime.utcnow().isoformat()
        }
    
    @staticmethod
    def booking_update(booking_id: int, status: str, data: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        return {
            "type": "booking_update",
            "booking_id": booking_id,
            "status": status,
            "data": data or {},
            "timestamp": datetime.utcnow().isoformat()
        }
    
    @staticmethod
    def new_offer(offer_data: Dict[str, Any]) -> Dict[str, Any]:
        return {
            "type": "new_offer",
            "data": offer_data,
            "timestamp": datetime.utcnow().isoformat()
        }
    
    @staticmethod
    def offer_accepted(offer_id: int, booking_id: int, final_price: float) -> Dict[str, Any]:
        return {
            "type": "offer_accepted",
            "offer_id": offer_id,
            "booking_id": booking_id,
            "final_price": final_price,
            "timestamp": datetime.utcnow().isoformat()
        }
    
    @staticmethod
    def location_update(user_id: int, latitude: float, longitude: float, booking_id: Optional[int] = None) -> Dict[str, Any]:
        return {
            "type": "location_update",
            "user_id": user_id,
            "latitude": latitude,
            "longitude": longitude,
            "booking_id": booking_id,
            "timestamp": datetime.utcnow().isoformat()
        }
    
    @staticmethod
    def sos_alert(sos_data: Dict[str, Any]) -> Dict[str, Any]:
        return {
            "type": "sos_alert",
            "data": sos_data,
            "timestamp": datetime.utcnow().isoformat()
        }
    
    @staticmethod
    def notification(user_id: int, title: str, body: str, data: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        return {
            "type": "notification",
            "user_id": user_id,
            "title": title,
            "body": body,
            "data": data or {},
            "timestamp": datetime.utcnow().isoformat()
        }
    
    @staticmethod
    def chat_message(room_id: str, user_id: int, username: str, message: str) -> Dict[str, Any]:
        return {
            "type": "chat_message",
            "room_id": room_id,
            "user_id": user_id,
            "username": username,
            "message": message,
            "timestamp": datetime.utcnow().isoformat()
        }
    
    @staticmethod
    def typing_indicator(room_id: str, user_id: int, is_typing: bool) -> Dict[str, Any]:
        return {
            "type": "typing",
            "room_id": room_id,
            "user_id": user_id,
            "is_typing": is_typing,
            "timestamp": datetime.utcnow().isoformat()
        }
    
    @staticmethod
    def payment_confirmation(payment_data: Dict[str, Any]) -> Dict[str, Any]:
        return {
            "type": "payment_confirmation",
            "data": payment_data,
            "timestamp": datetime.utcnow().isoformat()
        }
    
    @staticmethod
    def review_created(review_data: Dict[str, Any]) -> Dict[str, Any]:
        return {
            "type": "review_created",
            "data": review_data,
            "timestamp": datetime.utcnow().isoformat()
        }
    
    @staticmethod
    def error(message: str, code: Optional[str] = None) -> Dict[str, Any]:
        return {
            "type": "error",
            "message": message,
            "code": code,
            "timestamp": datetime.utcnow().isoformat()
        }