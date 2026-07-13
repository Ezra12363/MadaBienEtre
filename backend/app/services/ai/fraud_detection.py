# app/services/ai/fraud_detection.py
from typing import Dict, Any, List
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from ...models.user import User
from ...models.booking import Booking
from ...models.payment import Payment
from sqlalchemy import func

async def detect_fraud(booking: Booking, db: Session) -> Dict[str, Any]:
    """
    Détection de fraude pour une réservation
    """
    flags = []
    risk_score = 0.0
    recommendations = []
    
    # 1. Vérifier le client
    client = db.query(User).filter(User.id == booking.client_id).first()
    if client:
        if client.created_at and (datetime.utcnow() - client.created_at).days < 7:
            flags.append("Compte client récent")
            risk_score += 0.2
        
        previous_bookings = db.query(Booking).filter(
            Booking.client_id == client.id,
            Booking.status == "completed"
        ).count()
        if previous_bookings == 0:
            flags.append("Aucun historique de réservation")
            risk_score += 0.15
    
    # 2. Vérifier le thérapeute
    if booking.therapist_id:
        therapist = db.query(User).filter(User.id == booking.therapist_id).first()
        if therapist:
            if therapist.verification_status == "pending":
                flags.append("Thérapeute non vérifié")
                risk_score += 0.25
            elif therapist.verification_status == "rejected":
                flags.append("Thérapeute rejeté")
                risk_score += 0.5
    
    # 3. Vérifier le prix
    if booking.final_price:
        avg_price = db.query(func.avg(Booking.final_price)).filter(
            Booking.massage_type_id == booking.massage_type_id,
            Booking.status == "completed"
        ).scalar() or 0
        
        if avg_price > 0:
            price_ratio = float(booking.final_price) / float(avg_price)
            if price_ratio > 3:
                flags.append("Prix anormalement élevé")
                risk_score += 0.3
            elif price_ratio < 0.3:
                flags.append("Prix anormalement bas")
                risk_score += 0.2
    
    # 4. Vérifier les paiements
    payments = db.query(Payment).filter(
        Payment.booking_id == booking.id
    ).all()
    
    for payment in payments:
        if payment.status == "failed":
            flags.append("Paiement échoué")
            risk_score += 0.1
        if payment.status == "refunded":
            flags.append("Paiement remboursé")
            risk_score += 0.15
    
    # Normaliser le score
    final_risk_score = min(risk_score, 1.0)
    
    is_fraudulent = final_risk_score > 0.7
    
    if is_fraudulent:
        recommendations = [
            "Vérifier manuellement le compte client",
            "Contacter le client pour confirmation",
            "Bloquer la réservation si nécessaire",
            "Notifier l'équipe de sécurité"
        ]
    elif final_risk_score > 0.4:
        recommendations = [
            "Surveiller cette réservation",
            "Vérifier les informations du client",
            "Confirmer par téléphone"
        ]
    
    return {
        "is_fraudulent": is_fraudulent,
        "risk_score": final_risk_score,
        "confidence": 0.8,
        "flags": flags,
        "recommendations": recommendations,
        "flag_count": len(flags)
    }