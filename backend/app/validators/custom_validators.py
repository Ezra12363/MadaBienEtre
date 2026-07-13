from typing import Optional, List, Dict, Any
import re

def validate_massage_type(massage_type: str) -> bool:
    """Valider un type de massage"""
    valid_types = [
        'relaxant', 'therapeutique', 'sportif', 'reflexologie',
        'prenatal', 'pierres chaudes', 'shiatsu', 'deep tissue',
        'suédois', 'personnalise'
    ]
    return massage_type.lower() in valid_types

def validate_booking_status(status: str) -> bool:
    """Valider un statut de réservation"""
    valid_statuses = [
        'pending', 'negotiating', 'confirmed', 'in_progress',
        'completed', 'cancelled_by_client', 'cancelled_by_therapist',
        'expired'
    ]
    return status in valid_statuses

def validate_payment_method(method: str) -> bool:
    """Valider une méthode de paiement"""
    valid_methods = ['mobile_money', 'card', 'cash', 'vanila_pay']
    return method in valid_methods

def validate_payment_provider(provider: str) -> bool:
    """Valider un fournisseur de paiement"""
    valid_providers = ['mvola', 'orange_money', 'airtel_money', 'stripe', 'vanila_pay']
    return provider in valid_providers

def validate_user_role(role: str) -> bool:
    """Valider un rôle utilisateur"""
    valid_roles = ['CLIENT', 'THERAPIST', 'ADMIN']
    return role in valid_roles

def validate_verification_status(status: str) -> bool:
    """Valider un statut de vérification"""
    valid_statuses = ['pending', 'approved', 'rejected']
    return status in valid_statuses

def validate_preferred_gender(gender: str) -> bool:
    """Valider une préférence de genre"""
    valid_genders = ['male', 'female', 'any']
    return gender in valid_genders

def validate_time_slot(start_time: str, end_time: str) -> bool:
    """Valider un créneau horaire"""
    try:
        start = datetime.strptime(start_time, '%H:%M')
        end = datetime.strptime(end_time, '%H:%M')
        return start < end
    except ValueError:
        return False

def validate_phone_provider(phone: str) -> str:
    """Identifier le fournisseur d'un numéro de téléphone"""
    # MVola: 032, 034, 038
    if re.match(r'^(\+261|0)(32|34|38)[0-9]{7}$', phone):
        return 'mvola'
    # Orange Money: 033, 039
    elif re.match(r'^(\+261|0)(33|39)[0-9]{7}$', phone):
        return 'orange_money'
    # Airtel Money: 031, 035, 037
    elif re.match(r'^(\+261|0)(31|35|37)[0-9]{7}$', phone):
        return 'airtel_money'
    else:
        return None

def validate_booking_slot(booking_id: int, therapist_id: int, date: datetime, db) -> bool:
    """Valider qu'un créneau est disponible"""
    # Vérifier les conflits
    existing_bookings = db.query(Booking).filter(
        Booking.therapist_id == therapist_id,
        Booking.scheduled_date == date,
        Booking.status.in_(['confirmed', 'in_progress', 'pending'])
    ).first()
    
    return existing_bookings is None

def validate_withdrawal_amount(amount: float, balance: float) -> bool:
    """Valider un montant de retrait"""
    return 0 < amount <= balance