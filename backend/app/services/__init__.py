# app/services/__init__.py
from .auth_service import AuthService
from .email_service import send_otp_email, send_emergency_email, send_booking_confirmation_email
from .upload_service import upload_image, upload_profile_image, upload_document
from .notification_service import send_notification, NotificationService

# ✅ Import conditionnel de payment_service
try:
    from .payment_service import (
        create_stripe_payment,
        create_mobile_money_payment,
        create_vanila_pay_payment,
        verify_payment
    )
except ImportError:
    print("⚠️ Payment service import failed")

from .rating_service import update_therapist_rating
from .websocket_manager import WebSocketManager