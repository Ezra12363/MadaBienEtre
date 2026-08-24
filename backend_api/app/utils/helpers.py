import re
import uuid
import random
import string
from typing import Optional, Dict, Any, List
from datetime import datetime, timedelta

def generate_reference(prefix: str = "REF") -> str:
    """Générer une référence unique"""
    return f"{prefix}_{datetime.utcnow().strftime('%Y%m%d')}_{uuid.uuid4().hex[:8]}"

def generate_otp(length: int = 6) -> str:
    """Générer un code OTP"""
    return ''.join(random.choices(string.digits, k=length))

def generate_random_password(length: int = 12) -> str:
    """Générer un mot de passe aléatoire"""
    characters = string.ascii_letters + string.digits + "!@#$%^&*()"
    return ''.join(random.choices(characters, k=length))

def slugify(text: str) -> str:
    """Convertir un texte en slug"""
    text = text.lower()
    text = re.sub(r'[^\w\s-]', '', text)
    text = re.sub(r'[-\s]+', '-', text)
    return text.strip('-')

def truncate_text(text: str, max_length: int = 100, suffix: str = "...") -> str:
    """Tronquer un texte"""
    if len(text) <= max_length:
        return text
    return text[:max_length - len(suffix)] + suffix

def format_phone(phone: str) -> str:
    """Formater un numéro de téléphone"""
    # Supprimer les espaces et caractères non numériques
    phone = re.sub(r'[^\d+]', '', phone)
    
    # Format international
    if phone.startswith('0') and len(phone) == 10:
        phone = '+261' + phone[1:]
    
    return phone

def is_valid_phone(phone: str) -> bool:
    """Vérifier si un numéro de téléphone est valide"""
    pattern = r'^(\+261|0)[0-9]{9}$'
    return bool(re.match(pattern, phone))

def is_valid_email(email: str) -> bool:
    """Vérifier si un email est valide"""
    pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    return bool(re.match(pattern, email))

def get_current_date() -> str:
    """Obtenir la date actuelle au format ISO"""
    return datetime.utcnow().isoformat()

def get_date_range(days: int) -> Dict[str, datetime]:
    """Obtenir une plage de dates"""
    end_date = datetime.utcnow()
    start_date = end_date - timedelta(days=days)
    return {"start_date": start_date, "end_date": end_date}

def parse_date(date_str: str) -> Optional[datetime]:
    """Parser une date"""
    try:
        return datetime.fromisoformat(date_str.replace('Z', '+00:00'))
    except ValueError:
        try:
            return datetime.strptime(date_str, "%Y-%m-%d %H:%M:%S")
        except ValueError:
            return None

def format_price(amount: float, currency: str = "Ar") -> str:
    """Formatter un prix"""
    return f"{amount:,.0f} {currency}"

def calculate_percentage(value: float, total: float) -> float:
    """Calculer un pourcentage"""
    if total == 0:
        return 0.0
    return (value / total) * 100

def safe_float(value: Any) -> float:
    """Convertir en float en toute sécurité"""
    try:
        return float(value)
    except (ValueError, TypeError):
        return 0.0

def safe_int(value: Any) -> int:
    """Convertir en int en toute sécurité"""
    try:
        return int(value)
    except (ValueError, TypeError):
        return 0

def merge_dicts(dict1: Dict[str, Any], dict2: Dict[str, Any]) -> Dict[str, Any]:
    """Fusionner deux dictionnaires"""
    result = dict1.copy()
    result.update(dict2)
    return result

def chunk_list(items: List[Any], size: int) -> List[List[Any]]:
    """Diviser une liste en morceaux"""
    return [items[i:i + size] for i in range(0, len(items), size)]

def get_client_ip(request: Any) -> str:
    """Obtenir l'IP du client"""
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0]
    return request.client.host if request.client else "unknown"

def is_dict_empty(dict_obj: Dict) -> bool:
    """Vérifier si un dictionnaire est vide"""
    return not bool(dict_obj)