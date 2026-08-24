# app/api/payments.py
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import Optional, List, Dict, Any  # ✅ Ajout de typing
from datetime import datetime
import uuid

from ..core.database import get_db
from ..core.dependencies import get_current_user, get_current_admin
from ..models.payment import Payment
from ..models.booking import Booking
from ..models.user import User
from ..schemas.payment import (
    PaymentCreate, 
    PaymentResponse, 
    PaymentMethod,
    PaymentProvider,
    MobileMoneyPaymentRequest,
    CardPaymentRequest,
    VanilaPayPaymentRequest,
    PaymentHistoryResponse,
    RefundRequest,
    WithdrawalRequest,
    PaymentMethodResponse
)
from ..services.payment_service import (
    create_stripe_payment, 
    create_mobile_money_payment,
    create_vanila_pay_payment,
    verify_payment,
    create_refund as create_refund_service
)
from ..services.notification_service import send_notification

router = APIRouter(prefix="/payments", tags=["Payments"])

@router.post("/create", response_model=PaymentResponse, status_code=status.HTTP_201_CREATED)
async def create_payment(
    payment_data: PaymentCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Créer un paiement"""
    booking = db.query(Booking).filter(Booking.id == payment_data.booking_id).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    if booking.client_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Vérifier si un paiement existe déjà
    existing_payment = db.query(Payment).filter(
        Payment.booking_id == payment_data.booking_id,
        Payment.status == "completed"
    ).first()
    if existing_payment:
        raise HTTPException(status_code=400, detail="Payment already completed")
    
    # Créer le paiement en fonction de la méthode
    amount = float(booking.final_price or booking.client_price_proposed)
    
    if payment_data.method == "mobile_money":
        payment_result = create_mobile_money_payment(
            amount=amount,
            phone=payment_data.phone_number,
            provider=payment_data.provider
        )
    elif payment_data.method == "card":
        payment_result = create_stripe_payment(
            amount=amount,
            currency="MGA",
            payment_method_id=payment_data.payment_method_id
        )
    elif payment_data.method == "vanila_pay":
        payment_result = create_vanila_pay_payment(
            amount=amount,
            user_id=current_user.id
        )
    else:
        raise HTTPException(status_code=400, detail="Invalid payment method")
    
    # Créer l'enregistrement de paiement
    payment = Payment(
        booking_id=payment_data.booking_id,
        user_id=current_user.id,
        amount=amount,
        method=payment_data.method,
        provider=payment_data.provider,
        status="pending" if payment_result.get("status") == "pending" else "completed",
        transaction_id=payment_result.get("transaction_id", str(uuid.uuid4())),
        payment_data=payment_result
    )
    
    db.add(payment)
    
    # Si le paiement est réussi, mettre à jour la réservation
    if payment_result.get("status") == "completed":
        booking.status = "confirmed"
        payment.status = "completed"
        
        # Notifier le thérapeute
        if booking.therapist_id:
            send_notification(
                booking.therapist_id,
                "Paiement reçu",
                f"Le paiement de {amount} Ar a été reçu pour la réservation #{booking.id}",
                "payment_received",
                {"booking_id": booking.id}
            )
    
    db.commit()
    db.refresh(payment)
    
    return payment

@router.get("/history", response_model=List[PaymentHistoryResponse])
async def get_payment_history(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    limit: int = 50
):
    """Historique des paiements de l'utilisateur"""
    payments = db.query(Payment).filter(
        Payment.user_id == current_user.id
    ).order_by(Payment.created_at.desc()).limit(limit).all()
    
    return payments

@router.get("/{payment_id}", response_model=PaymentResponse)
async def get_payment(
    payment_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Détails d'un paiement"""
    payment = db.query(Payment).filter(Payment.id == payment_id).first()
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")
    
    if payment.user_id != current_user.id and current_user.role != "ADMIN":
        raise HTTPException(status_code=403, detail="Not authorized")
    
    return payment

@router.post("/mobile-money")
async def mobile_money_payment(
    request: MobileMoneyPaymentRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Paiement via Mobile Money"""
    result = create_mobile_money_payment(
        amount=request.amount,
        phone=request.phone,
        provider=request.provider
    )
    
    if result.get("status") == "completed":
        payment = Payment(
            booking_id=request.booking_id,
            user_id=current_user.id,
            amount=request.amount,
            method="mobile_money",
            provider=request.provider,
            status="completed",
            transaction_id=result.get("transaction_id"),
            payment_data=result
        )
        db.add(payment)
        
        booking = db.query(Booking).filter(Booking.id == request.booking_id).first()
        if booking:
            booking.status = "confirmed"
        
        db.commit()
    
    return result

@router.post("/card")
async def card_payment(
    request: CardPaymentRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Paiement par carte bancaire"""
    result = create_stripe_payment(
        amount=request.amount,
        currency=request.currency,
        payment_method_id=request.payment_method_id
    )
    
    if result.get("status") == "completed":
        payment = Payment(
            booking_id=request.booking_id,
            user_id=current_user.id,
            amount=request.amount,
            method="card",
            provider="stripe",
            status="completed",
            transaction_id=result.get("transaction_id"),
            payment_data=result
        )
        db.add(payment)
        
        booking = db.query(Booking).filter(Booking.id == request.booking_id).first()
        if booking:
            booking.status = "confirmed"
        
        db.commit()
    
    return result

@router.post("/vanila-pay")
async def vanila_pay_payment(
    request: VanilaPayPaymentRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Paiement via Vanila Pay (Madagascar)"""
    result = create_vanila_pay_payment(
        amount=request.amount,
        user_id=current_user.id,
        description=request.description
    )
    
    if result.get("status") == "completed":
        payment = Payment(
            booking_id=request.booking_id,
            user_id=current_user.id,
            amount=request.amount,
            method="vanila_pay",
            provider="vanila_pay",
            status="completed",
            transaction_id=result.get("transaction_id"),
            payment_data=result
        )
        db.add(payment)
        
        booking = db.query(Booking).filter(Booking.id == request.booking_id).first()
        if booking:
            booking.status = "confirmed"
        
        db.commit()
    
    return result

@router.post("/refund")
async def refund_payment(
    request: RefundRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Rembourser un paiement"""
    payment = db.query(Payment).filter(Payment.id == request.payment_id).first()
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")
    
    if payment.user_id != current_user.id and current_user.role != "ADMIN":
        raise HTTPException(status_code=403, detail="Not authorized")
    
    if payment.status != "completed":
        raise HTTPException(status_code=400, detail="Payment not completed")
    
    # Créer le remboursement
    result = create_refund_service(
        payment_id=payment.transaction_id,
        amount=request.amount,
        reason=request.reason
    )
    
    if result.get("status") == "completed":
        payment.status = "refunded"
        payment.refunded_at = datetime.utcnow()
        db.commit()
    
    return result

@router.get("/methods", response_model=PaymentMethodResponse)
async def get_payment_methods():
    """Obtenir les méthodes de paiement disponibles"""
    return PaymentMethodResponse()

@router.post("/verify/{transaction_id}")
async def verify_payment_status(
    transaction_id: str,
    current_user: User = Depends(get_current_user)
):
    """Vérifier le statut d'un paiement"""
    result = verify_payment(transaction_id)
    return result

@router.get("/admin/payments")
async def admin_get_payments(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin),
    status: Optional[str] = None,  # ✅ Optional est maintenant importé
    limit: int = 100
):
    """Admin - Liste des paiements"""
    query = db.query(Payment)
    if status:
        query = query.filter(Payment.status == status)
    return query.order_by(Payment.created_at.desc()).limit(limit).all()

@router.get("/admin/stats")
async def admin_get_payment_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin)
):
    """Admin - Statistiques des paiements"""
    total_payments = db.query(Payment).count()
    completed_payments = db.query(Payment).filter(Payment.status == "completed").count()
    pending_payments = db.query(Payment).filter(Payment.status == "pending").count()
    failed_payments = db.query(Payment).filter(Payment.status == "failed").count()
    refunded_payments = db.query(Payment).filter(Payment.status == "refunded").count()
    
    from sqlalchemy import func
    total_amount = db.query(func.sum(Payment.amount)).filter(
        Payment.status == "completed"
    ).scalar() or 0
    
    return {
        "total_payments": total_payments,
        "completed_payments": completed_payments,
        "pending_payments": pending_payments,
        "failed_payments": failed_payments,
        "refunded_payments": refunded_payments,
        "total_amount": float(total_amount)
    }