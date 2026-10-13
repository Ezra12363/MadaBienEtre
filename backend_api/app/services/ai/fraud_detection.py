from typing import Dict, Any
from datetime import datetime

from sqlalchemy import func
from sqlalchemy.orm import Session

from ...models.user import User
from ...models.booking import Booking
from ...models.payment import Payment


async def detect_fraud(booking: Booking, db: Session) -> Dict[str, Any]:
    """Détection de fraude pour une réservation (score heuristique)."""
    flags = []
    risk_score = 0.0
    recommendations = []

    # 1. Client
    client = db.query(User).filter(User.id == booking.client_id).first()
    if client:
        created = getattr(client, "created_at", None)
        if created and (datetime.utcnow() - created.replace(tzinfo=None)).days < 7:
            flags.append("Compte client récent")
            risk_score += 0.2

        previous_bookings = db.query(Booking).filter(
            Booking.client_id == client.id,
            Booking.status == "completed",
        ).count()
        if previous_bookings == 0:
            flags.append("Aucun historique de réservation")
            risk_score += 0.15

    # 2. Thérapeute
    if booking.therapist_id:
        therapist = db.query(User).filter(User.id == booking.therapist_id).first()
        if therapist:
            if therapist.verification_status == "pending":
                flags.append("Thérapeute non vérifié")
                risk_score += 0.25
            elif therapist.verification_status == "rejected":
                flags.append("Thérapeute rejeté")
                risk_score += 0.5

    # 3. Prix
    if booking.final_price:
        avg_price = db.query(func.avg(Booking.final_price)).filter(
            Booking.massage_type_id == booking.massage_type_id,
            Booking.status == "completed",
        ).scalar() or 0

        if avg_price > 0:
            price_ratio = float(booking.final_price) / float(avg_price)
            if price_ratio > 3:
                flags.append("Prix anormalement élevé")
                risk_score += 0.3
            elif price_ratio < 0.3:
                flags.append("Prix anormalement bas")
                risk_score += 0.2

    # 4. Paiements
    payments = db.query(Payment).filter(Payment.booking_id == booking.id).all()
    for payment in payments:
        if payment.status == "failed":
            flags.append("Paiement échoué")
            risk_score += 0.1
        if payment.status == "refunded":
            flags.append("Paiement remboursé")
            risk_score += 0.15

    # 5. Annulations
    if booking.status in ["cancelled_by_client", "cancelled_by_therapist", "cancelled"]:
        client_cancellations = db.query(Booking).filter(
            Booking.client_id == booking.client_id,
            Booking.status.in_(["cancelled_by_client", "cancelled_by_therapist", "cancelled"]),
        ).count()
        if client_cancellations > 5:
            flags.append("Taux d'annulation élevé")
            risk_score += 0.2

    # 6. Avis suspects
    if booking.status == "completed":
        try:
            from ...models.review import Review

            review = db.query(Review).filter(Review.booking_id == booking.id).first()
            if review and review.rating is not None and review.rating < 2:
                flags.append("Note très basse")
                risk_score += 0.1
        except Exception:  # noqa: BLE001
            pass

    # 7. Adresse
    address = getattr(booking, "address", None)
    if address:
        suspicious_keywords = ["test", "fake", "unknown", "inconnu"]
        if any(k in address.lower() for k in suspicious_keywords):
            flags.append("Adresse suspecte")
            risk_score += 0.1

    final_risk_score = min(risk_score, 1.0)
    is_fraudulent = final_risk_score > 0.7

    if is_fraudulent:
        recommendations = [
            "Vérifier manuellement le compte client",
            "Contacter le client pour confirmation",
            "Bloquer la réservation si nécessaire",
            "Notifier l'équipe de sécurité",
        ]
    elif final_risk_score > 0.4:
        recommendations = [
            "Surveiller cette réservation",
            "Vérifier les informations du client",
            "Confirmer par téléphone",
        ]

    return {
        "is_fraudulent": is_fraudulent,
        "risk_score": round(final_risk_score, 2),
        "confidence": 0.8,
        "flags": flags,
        "recommendations": recommendations,
        "flag_count": len(flags),
    }
