import re
from typing import Optional, Any, List
from datetime import datetime

def validate_email(email: str) -> bool:
    """Valider un email"""
    pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    return bool(re.match(pattern, email))

def validate_phone(phone: str) -> bool:
    """Valider un numéro de téléphone malgache"""
    pattern = r'^(\+261|0)[0-9]{9}$'
    return bool(re.match(pattern, phone))

def validate_password(password: str) -> tuple:
    """Valider un mot de passe"""
    errors = []
    
    if len(password) < 8:
        errors.append("Le mot de passe doit contenir au moins 8 caractères")
    if not re.search(r'[A-Z]', password):
        errors.append("Le mot de passe doit contenir au moins une majuscule")
    if not re.search(r'[a-z]', password):
        errors.append("Le mot de passe doit contenir au moins une minuscule")
    if not re.search(r'[0-9]', password):
        errors.append("Le mot de passe doit contenir au moins un chiffre")
    if not re.search(r'[!@#$%^&*(),.?":{}|<>]', password):
        errors.append("Le mot de passe doit contenir au moins un caractère spécial")
    
    return len(errors) == 0, errors

def validate_name(name: str) -> bool:
    """Valider un nom"""
    if not name or len(name) < 2:
        return False
    return bool(re.match(r'^[a-zA-ZÀ-ÿ\s\-]{2,100}$', name))

def validate_address(address: str) -> bool:
    """Valider une adresse"""
    if not address or len(address) < 5:
        return False
    return len(address) <= 500

def validate_url(url: str) -> bool:
    """Valider une URL"""
    pattern = r'^https?://[a-zA-Z0-9\-\.]+\.[a-zA-Z]{2,}(/.*)?$'
    return bool(re.match(pattern, url))

def validate_date(date_str: str) -> bool:
    """Valider une date"""
    try:
        datetime.fromisoformat(date_str.replace('Z', '+00:00'))
        return True
    except ValueError:
        return False

def validate_future_date(date_str: str) -> bool:
    """Valider que la date est dans le futur"""
    if not validate_date(date_str):
        return False
    dt = datetime.fromisoformat(date_str.replace('Z', '+00:00'))
    return dt > datetime.utcnow()

def validate_coordinates(latitude: float, longitude: float) -> bool:
    """Valider des coordonnées GPS"""
    return -90 <= latitude <= 90 and -180 <= longitude <= 180

def validate_rating(rating: int) -> bool:
    """Valider une note"""
    return 1 <= rating <= 5

def validate_price(price: float) -> bool:
    """Valider un prix"""
    return price > 0

def validate_duration(duration: int) -> bool:
    """Valider une durée"""
    return 30 <= duration <= 180

def validate_amount(amount: float) -> bool:
    """Valider un montant"""
    return amount > 0 and amount <= 10000000  # 10 millions max

def validate_otp(otp: str) -> bool:
    """Valider un code OTP"""
    return bool(re.match(r'^[0-9]{6}$', otp))

def validate_uuid(uuid_str: str) -> bool:
    """Valider un UUID"""
    pattern = r'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    return bool(re.match(pattern, uuid_str.lower()))

def validate_json(json_str: str) -> bool:
    """Valider un JSON"""
    import json
    try:
        json.loads(json_str)
        return True
    except:
        return False

def validate_array(data: Any) -> bool:
    """Valider que c'est un tableau"""
    return isinstance(data, list)

def validate_object(data: Any) -> bool:
    """Valider que c'est un objet"""
    return isinstance(data, dict)