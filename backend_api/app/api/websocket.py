# app/api/websocket.py
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends, Query
from sqlalchemy.orm import Session
from typing import Optional
import json
import asyncio
from datetime import datetime

from ..core.database import get_db
from ..core.dependencies import get_current_user_ws, get_user_from_websocket
from ..models.booking import Booking
from ..models.user import User
from ..services.websocket_manager import manager

router = APIRouter(tags=["WebSocket"])

@router.websocket("/ws/tracking/{booking_id}")
async def websocket_tracking(
    websocket: WebSocket,
    booking_id: int,
    token: Optional[str] = Query(None)
):
    """WebSocket pour le suivi en temps réel du massage"""
    await manager.connect(websocket)
    
    try:
        # Authentification via token
        user = None
        if token:
            try:
                user = await get_current_user_ws(token)
            except Exception:
                await websocket.send_json({"error": "Authentication failed"})
                await websocket.close()
                return
        
        # Récupérer la réservation
        db = next(get_db())
        booking = db.query(Booking).filter(Booking.id == booking_id).first()
        if not booking:
            await websocket.send_json({"error": "Booking not found"})
            await websocket.close()
            return
        
        # Vérifier les autorisations
        if user and user.id not in [booking.client_id, booking.therapist_id]:
            await websocket.send_json({"error": "Not authorized"})
            await websocket.close()
            return
        
        # Ajouter à la room
        room_id = f"booking_{booking_id}"
        await manager.join_room(websocket, room_id)
        
        # Envoyer la dernière position
        if user:
            therapist = db.query(User).filter(User.id == booking.therapist_id).first()
            if therapist:
                await websocket.send_json({
                    "type": "location_update",
                    "therapist_id": therapist.id,
                    "latitude": therapist.latitude,
                    "longitude": therapist.longitude,
                    "status": booking.status,
                    "timestamp": datetime.utcnow().isoformat()
                })
        
        # Écouter les messages
        while True:
            data = await websocket.receive_json()
            
            if data.get("type") == "location_update":
                # Le thérapeute met à jour sa position
                if user and user.id == booking.therapist_id:
                    await manager.broadcast_to_room(
                        room_id,
                        {
                            "type": "location_update",
                            "therapist_id": user.id,
                            "latitude": data.get("latitude"),
                            "longitude": data.get("longitude"),
                            "timestamp": datetime.utcnow().isoformat()
                        },
                        exclude=websocket
                    )
            
            elif data.get("type") == "status_update":
                if user and user.id in [booking.client_id, booking.therapist_id]:
                    booking.status = data.get("status")
                    db.commit()
                    
                    await manager.broadcast_to_room(
                        room_id,
                        {
                            "type": "status_update",
                            "status": booking.status,
                            "timestamp": datetime.utcnow().isoformat()
                        }
                    )
    
    except WebSocketDisconnect:
        await manager.disconnect(websocket)
    except Exception as e:
        await websocket.send_json({"error": str(e)})
        await manager.disconnect(websocket)

@router.websocket("/ws/chat/{booking_id}")
async def websocket_chat(
    websocket: WebSocket,
    booking_id: int,
    token: Optional[str] = Query(None)
):
    """WebSocket pour le chat en temps réel entre client et thérapeute"""
    await manager.connect(websocket)
    
    try:
        # Authentification
        user = None
        if token:
            try:
                user = await get_current_user_ws(token)
            except Exception:
                await websocket.send_json({"error": "Authentication failed"})
                await websocket.close()
                return
        
        # Récupérer la réservation
        db = next(get_db())
        booking = db.query(Booking).filter(Booking.id == booking_id).first()
        if not booking:
            await websocket.send_json({"error": "Booking not found"})
            await websocket.close()
            return
        
        if user and user.id not in [booking.client_id, booking.therapist_id]:
            await websocket.send_json({"error": "Not authorized"})
            await websocket.close()
            return
        
        room_id = f"chat_{booking_id}"
        await manager.join_room(websocket, room_id)
        
        while True:
            data = await websocket.receive_json()
            
            if data.get("type") == "message":
                await manager.broadcast_to_room(
                    room_id,
                    {
                        "type": "message",
                        "user_id": data.get("user_id"),
                        "username": data.get("username"),
                        "message": data.get("message"),
                        "timestamp": datetime.utcnow().isoformat()
                    }
                )
            
            elif data.get("type") == "typing":
                await manager.broadcast_to_room(
                    room_id,
                    {
                        "type": "typing",
                        "user_id": data.get("user_id"),
                        "is_typing": data.get("is_typing")
                    },
                    exclude=websocket
                )
            
            elif data.get("type") == "image":
                await manager.broadcast_to_room(
                    room_id,
                    {
                        "type": "image",
                        "user_id": data.get("user_id"),
                        "image_url": data.get("image_url"),
                        "timestamp": datetime.utcnow().isoformat()
                    }
                )
    
    except WebSocketDisconnect:
        await manager.disconnect(websocket)
    except Exception as e:
        await websocket.send_json({"error": str(e)})
        await manager.disconnect(websocket)

@router.get("/ws/connections")
async def get_connections():
    """Obtenir les connexions WebSocket actives"""
    return {
        "active_connections": len(manager.active_connections),
        "rooms": list(manager.rooms.keys())
    }