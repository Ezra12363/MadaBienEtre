from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from ..core.database import get_db
from ..core.dependencies import get_current_user, get_current_therapist
from ..models.user import User
from ..models.booking import Booking
from geoalchemy2 import functions as geo_func
from pydantic import BaseModel

router = APIRouter(prefix="/geolocation", tags=["Geolocation"])

class LocationUpdate(BaseModel):
    latitude: float
    longitude: float

@router.post("/update")
async def update_location(
    location: LocationUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Mettre à jour la localisation de l'utilisateur"""
    current_user.latitude = location.latitude
    current_user.longitude = location.longitude
    current_user.last_location = f"POINT({location.longitude} {location.latitude})"
    db.commit()
    
    return {"message": "Location updated"}

@router.get("/current/{user_id}")
async def get_user_location(
    user_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Obtenir la localisation d'un utilisateur"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    return {
        "user_id": user.id,
        "latitude": user.latitude,
        "longitude": user.longitude,
        "last_updated": user.updated_at
    }

@router.get("/nearby-therapists")
async def get_nearby_therapists(
    latitude: float,
    longitude: float,
    radius_km: int = 10,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Trouver les thérapeutes à proximité avec PostGIS"""
    therapists = db.query(User).filter(
        User.role == "THERAPIST",
        User.is_online == True,
        User.is_available == True,
        User.verification_status == "approved",
        User.is_active == True,
        User.deleted_at.is_(None),
        func.ST_DWithin(
            User.last_location,
            func.ST_SetSRID(func.ST_MakePoint(longitude, latitude), 4326),
            radius_km * 1000
        )
    ).all()
    
    result = []
    for therapist in therapists:
        distance = db.query(
            func.ST_Distance(
                User.last_location,
                func.ST_SetSRID(func.ST_MakePoint(longitude, latitude), 4326)
            )
        ).filter(User.id == therapist.id).scalar()
        
        result.append({
            "id": therapist.id,
            "fullname": therapist.fullname,
            "rating": float(therapist.rating) if therapist.rating else 0,
            "total_reviews": therapist.total_reviews,
            "base_price": float(therapist.base_price) if therapist.base_price else 0,
            "profile_image": therapist.profile_image,
            "is_online": therapist.is_online,
            "distance_meters": distance if distance else 0,
            "experience_years": therapist.experience_years,
            "bio": therapist.bio
        })
    
    return sorted(result, key=lambda x: x["distance_meters"])

@router.get("/booking/{booking_id}/location")
async def get_booking_locations(
    booking_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Obtenir les positions pour le suivi d'une réservation"""
    booking = db.query(Booking).filter(Booking.id == booking_id).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    # Vérifier les autorisations
    if current_user.id not in [booking.client_id, booking.therapist_id] and current_user.role != "ADMIN":
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Position du client
    client = db.query(User).filter(User.id == booking.client_id).first()
    
    # Position du thérapeute (si assigné)
    therapist = None
    if booking.therapist_id:
        therapist = db.query(User).filter(User.id == booking.therapist_id).first()
    
    return {
        "client": {
            "latitude": client.latitude if client else None,
            "longitude": client.longitude if client else None,
            "address": booking.address
        },
        "therapist": {
            "latitude": therapist.latitude if therapist else None,
            "longitude": therapist.longitude if therapist else None,
            "is_online": therapist.is_online if therapist else False
        } if therapist else None,
        "booking_status": booking.status
    }