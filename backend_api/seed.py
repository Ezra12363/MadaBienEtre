# seed.py
"""
Script de seeding pour Mada Bien-être
Insère les données initiales dans la base de données PostgreSQL
"""

import random
import bcrypt
from datetime import datetime, timedelta
from decimal import Decimal
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

# Configuration de la base de données
DATABASE_URL = "postgresql+psycopg2://admin:admin@localhost:5432/db_madabienetre"
engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(bind=engine)
session = SessionLocal()

# Import des modèles
from app.models.user import User
from app.models.massage import MassageType
from app.models.therapist import TherapistSpecialty
from app.models.booking import Booking
from app.models.negotiation import Negotiation
from app.models.payment import Payment
from app.models.review import Review
from app.models.notification import Notification, NotificationPreference
from app.models.sos import EmergencyContact, SOSAlert, SafetyCheck
from app.models.availability import TherapistAvailability, BlockedDate, BookingSlot
from app.models.analytics import UserAnalytics, BookingAnalytics, PlatformAnalytics
from app.models.ai_prediction import AIPrediction, AIModel, AIFeedback
from app.models.therapist import TherapistEarnings, Withdrawal, TherapistRating
from app.models.therapist_certificate import TherapistCertificate
from app.models.session import MassageSession
from app.models.offer import Offer


# ============================================================
# 1. FONCTIONS UTILITAIRES
# ============================================================

def hash_password(password: str) -> str:
    """Hashage du mot de passe avec bcrypt"""
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode('utf-8'), salt).decode('utf-8')


def generate_certificate_number(therapist_id: int) -> str:
    """Génère un numéro de certificat unique"""
    return f"MBE-{therapist_id:04d}-{datetime.now().year}"


def get_cin_number(index: int) -> str:
    """Génère un numéro CIN malgache"""
    prefix = random.choice(['101', '102', '103', '104', '105'])
    return f"{prefix}{random.randint(100000, 999999)}"


def generate_phone(prefix: str, used_phones: set) -> str:
    """
    Génère un numéro de téléphone unique de 10 chiffres
    Format: 0XX XXXXXXX (10 chiffres au total)
    """
    while True:
        number = f"{prefix}{random.randint(1000000, 9999999)}"
        if number not in used_phones:
            used_phones.add(number)
            return number


def clean_email_name(name: str) -> str:
    """
    Nettoie le nom pour l'email (supprime les espaces et les caractères spéciaux)
    """
    # Remplacer les espaces par des points
    name = name.replace(' ', '.')
    # Supprimer les accents
    name = name.replace('é', 'e').replace('è', 'e').replace('ê', 'e')
    name = name.replace('à', 'a').replace('â', 'a')
    name = name.replace('ô', 'o').replace('î', 'i').replace('ï', 'i')
    name = name.replace('ù', 'u').replace('û', 'u')
    name = name.replace('ç', 'c')
    # Mettre en minuscules
    name = name.lower()
    return name


# ============================================================
# 2. NETTOYAGE DE LA BASE DE DONNÉES
# ============================================================

def clear_database():
    """Supprime toutes les données dans le bon ordre"""
    print("🧹 Nettoyage des données existantes...")
    
    session.query(AIFeedback).delete()
    session.query(AIModel).delete()
    session.query(AIPrediction).delete()
    session.query(PlatformAnalytics).delete()
    session.query(BookingAnalytics).delete()
    session.query(UserAnalytics).delete()
    session.query(BookingSlot).delete()
    session.query(BlockedDate).delete()
    session.query(TherapistAvailability).delete()
    session.query(SafetyCheck).delete()
    session.query(SOSAlert).delete()
    session.query(EmergencyContact).delete()
    session.query(NotificationPreference).delete()
    session.query(Notification).delete()
    session.query(Offer).delete()
    session.query(Review).delete()
    session.query(Withdrawal).delete()
    session.query(TherapistRating).delete()
    session.query(TherapistEarnings).delete()
    session.query(TherapistCertificate).delete()
    session.query(TherapistSpecialty).delete()
    session.query(MassageSession).delete()
    session.query(Negotiation).delete()
    session.query(Payment).delete()
    session.query(Booking).delete()
    session.query(User).delete()
    session.query(MassageType).delete()
    
    session.commit()
    print("✅ Nettoyage terminé")


# ============================================================
# 3. UTILISATEURS
# ============================================================

def create_users():
    """Crée tous les utilisateurs et retourne l'ID de l'admin"""
    print("📦 Création des utilisateurs...")

    default_password = "password123"
    hashed_password = hash_password(default_password)
    
    users_data = []
    used_phones = set()
    
    # 1. ADMIN - ZEBUTECH
    admin = User(
        fullname="ZEBUTECH Admin",
        email="zebutech.madagascar@gmail.com",
        phone="0342363727",
        password=hash_password("admin123"),
        role="ADMIN",
        is_active=True,
        verification_status="approved",
        is_online=True,
        address="Lot IBM 17Bis - 3eme Etage, ISORAKA, Antananarivo",
        latitude=-18.8792,
        longitude=47.5079,
        created_at=datetime.now()
    )
    users_data.append(admin)
    used_phones.add("0342363727")

    # 2. CLIENTS (30 clients)
    client_names = [
        ("Rakotoarisoa", "Mamy"), ("Randrianasolo", "Tiana"), 
        ("Andrianarivo", "Nomena"), ("Rakotomalala", "Faniry"),
        ("Randrianirina", "Hanta"), ("Rakotoarison", "Lalao"),
        ("Andriambololona", "Rina"), ("Razanakoto", "Hery"),
        ("Randriamanantena", "Miaro"), ("Rakotoniaina", "Faneva"),
        ("Andrianjafy", "Sandratra"), ("Rakotondramboa", "Rado"),
        ("Randriamiarana", "Tahina"), ("Andriamanampisoa", "Miora"),
        ("Rakotovao", "Nandrianina"), ("Randrianasolo", "Antsa"),
        ("Andriatsitohaina", "Fenitra"), ("Rakotomalala", "Nantenaina"),
        ("Randrianarisoa", "Haja"), ("Rakotoarivony", "Tantely"),
        ("Andrianorosoa", "Mampionona"), ("Rakotozafy", "Fidimalala"),
        ("Randriamanantena", "Toky"), ("Rakotoarisoa", "Miarintsoa"),
        ("Andrianirina", "Harijaona"), ("Rakotondrasoa", "Rijatiana"),
        ("Randrianasolo", "Tovohery"), ("Andriantsoa", "Mihaja"),
        ("Rakotoniaina", "Fandresena"), ("Randriambelo", "Hasina")
    ]

    client_locations = [
        (-18.8792, 47.5079), (-18.8830, 47.5100), (-18.8770, 47.5050),
        (-18.8850, 47.5120), (-18.8800, 47.5090), (-18.8780, 47.5060),
        (-18.8840, 47.5110), (-18.8810, 47.5080), (-18.8760, 47.5040),
        (-18.8860, 47.5130), (-18.8820, 47.5100), (-18.8790, 47.5070),
        (-18.8835, 47.5105), (-18.8775, 47.5055), (-18.8855, 47.5125),
        (-18.8805, 47.5095), (-18.8785, 47.5065), (-18.8845, 47.5115),
        (-18.8815, 47.5085), (-18.8765, 47.5045), (-18.8865, 47.5135),
        (-18.8825, 47.5105), (-18.8795, 47.5075), (-18.8835, 47.5110),
        (-18.8775, 47.5050), (-18.8855, 47.5120), (-18.8805, 47.5085),
        (-18.8785, 47.5060), (-18.8845, 47.5115), (-18.8815, 47.5095)
    ]

    for i, (last, first) in enumerate(client_names):
        fullname = f"{first} {last}"
        clean_first = clean_email_name(first)
        clean_last = clean_email_name(last)
        email = f"{clean_first}.{clean_last}@email.com"
        phone = generate_phone("032", used_phones)
        lat, lng = client_locations[i % len(client_locations)]
        
        client = User(
            fullname=fullname,
            email=email,
            phone=phone,
            password=hashed_password,
            role="CLIENT",
            is_active=True,
            verification_status="approved",
            address=f"Lot {random.randint(1, 500)} A {random.choice(['Ambohijatovo', 'Antaninarenina', 'Andraharo', 'Ambohipo', 'Ampasankazanga', 'Ankadivato', 'Isoraka', 'Ankazomanga'])}",
            latitude=lat + random.uniform(-0.002, 0.002),
            longitude=lng + random.uniform(-0.002, 0.002),
            created_at=datetime.now() - timedelta(days=random.randint(1, 365))
        )
        users_data.append(client)

    # 3. THÉRAPEUTES (20 thérapeutes)
    therapist_names = [
        ("Rakoto", "Jean"), ("Randria", "Sarah"), ("Rabe", "Hery"),
        ("Raharison", "Miaro"), ("Rakotondrasoa", "Tiana"), 
        ("Andrianantenaina", "Toky"), ("Rakotoarimanana", "Lova"),
        ("Randrianarison", "Haja"), ("Rakotomalala", "Miora"),
        ("Andrianarisoa", "NyAina"),  # ✅ Supprimé l'espace
        ("Rakotoarivony", "Tahina"),
        ("Randriamampionona", "Faneva"), ("Rakotoniaina", "Rado"),
        ("Andriamanampisoa", "Antsa"), ("Rakotovao", "Nomena"),
        ("Randrianasolo", "Hanta"), ("Andriatsitohaina", "Faniry"),
        ("Rakotomalala", "Mamy"), ("Randrianirina", "Lalao"),
        ("Rakotoarison", "Rina")
    ]

    therapist_specialties_data = [
        {"specialty": ["Massage Suédois", "Deep Tissue"], "experience": 5, "base_price": 40000},
        {"specialty": ["Massage Suédois", "Shiatsu"], "experience": 4, "base_price": 35000},
        {"specialty": ["Deep Tissue", "Massage Sportif"], "experience": 7, "base_price": 50000},
        {"specialty": ["Réflexologie Planitaire", "Massage Suédois"], "experience": 3, "base_price": 30000},
        {"specialty": ["Shiatsu", "Deep Tissue"], "experience": 6, "base_price": 45000},
        {"specialty": ["Massage Suédois", "Massage Relaxant"], "experience": 4, "base_price": 35000},
        {"specialty": ["Deep Tissue", "Massage Thérapeutique"], "experience": 8, "base_price": 55000},
        {"specialty": ["Réflexologie Planitaire"], "experience": 2, "base_price": 25000},
        {"specialty": ["Massage Sportif", "Deep Tissue"], "experience": 6, "base_price": 50000},
        {"specialty": ["Massage Prénatal", "Massage Suédois"], "experience": 5, "base_price": 42000},
        {"specialty": ["Massage aux Pierres Chaudes", "Massage Suédois"], "experience": 4, "base_price": 48000},
        {"specialty": ["Massage Thérapeutique", "Deep Tissue"], "experience": 7, "base_price": 52000},
        {"specialty": ["Massage Relaxant", "Massage Suédois"], "experience": 3, "base_price": 32000},
        {"specialty": ["Shiatsu"], "experience": 5, "base_price": 38000},
        {"specialty": ["Massage Sportif", "Massage Suédois"], "experience": 4, "base_price": 40000},
        {"specialty": ["Deep Tissue", "Massage Thérapeutique"], "experience": 6, "base_price": 48000},
        {"specialty": ["Massage Prénatal"], "experience": 3, "base_price": 38000},
        {"specialty": ["Réflexologie Planitaire", "Massage Suédois"], "experience": 4, "base_price": 35000},
        {"specialty": ["Massage aux Pierres Chaudes", "Deep Tissue"], "experience": 5, "base_price": 50000},
        {"specialty": ["Massage Relaxant", "Massage Thérapeutique"], "experience": 3, "base_price": 36000}
    ]

    therapists = []
    for i, (last, first) in enumerate(therapist_names):
        fullname = f"{first} {last}"
        clean_first = clean_email_name(first)
        clean_last = clean_email_name(last)
        email = f"{clean_first}.{clean_last}@therapist.com"
        phone = generate_phone("033", used_phones)
        specs = therapist_specialties_data[i % len(therapist_specialties_data)]
        
        lat = -18.8792 + random.uniform(-0.05, 0.05)
        lng = 47.5079 + random.uniform(-0.05, 0.05)
        
        therapist = User(
            fullname=fullname,
            email=email,
            phone=phone,
            password=hashed_password,
            role="THERAPIST",
            is_active=True,
            verification_status="pending",  # ✅ PENDING fa tsy approved
            profile_image=f"therapist_{i+1}_profile.jpg",
            bio=f"Thérapeute professionnel spécialisé en {', '.join(specs['specialty'])}. {random.randint(2, 10)} ans d'expérience. Passionné par le bien-être et la santé.",
            experience_years=specs["experience"],
            rating=Decimal("0.00"),  # ✅ 0.00 raha mbola pending
            total_reviews=0,  # ✅ 0 raha mbola pending
            is_online=random.choice([True, True, True, False]),
            is_available=True,
            service_radius=random.randint(5, 15),
            base_price=specs["base_price"],
            cin_number=get_cin_number(i),
            address=f"Lot {random.randint(1, 300)} {random.choice(['Ambohijatovo', 'Antaninarenina', 'Andraharo', 'Ambohipo', 'Ampasankazanga', 'Ankadivato', 'Isoraka', 'Ankazomanga'])}",
            latitude=lat,
            longitude=lng,
            created_at=datetime.now() - timedelta(days=random.randint(1, 180))
        )
        users_data.append(therapist)
        therapists.append((therapist, specs))

    for user in users_data:
        session.add(user)
    
    session.commit()
    
    admin_obj = session.query(User).filter(User.email == "zebutech.madagascar@gmail.com").first()
    admin_id = admin_obj.id if admin_obj else None
    
    print(f"✅ {len(users_data)} utilisateurs créés (1 Admin ID:{admin_id}, 30 Clients, 20 Thérapeutes)")
    print(f"   ⚠️  Status des thérapeutes: 'pending' (en attente de validation admin)")
    return therapists, admin_id


# ============================================================
# 4. TYPES DE MASSAGE (selon le PDF)
# ============================================================

def create_massage_types():
    """Crée les types de massage selon le PDF"""
    print("📦 Création des types de massage...")
    
    massage_types = [
        {
            "name": "Massage Relaxant",
            "description": "Massage doux destiné à réduire le stress et favoriser la relaxation générale.",
            "duration_min": 30,
            "duration_max": 90,
            "min_price": Decimal("20000"),
            "recommended_price": Decimal("40000"),
            "category": "relaxant",
            "icon_url": "/icons/relaxing.png",
            "display_order": 1
        },
        {
            "name": "Massage Californien",
            "description": "Massage fluide et enveloppant favorisant la détente du corps et de l'esprit.",
            "duration_min": 45,
            "duration_max": 90,
            "min_price": Decimal("30000"),
            "recommended_price": Decimal("50000"),
            "category": "relaxant",
            "icon_url": "/icons/californian.png",
            "display_order": 2
        },
        {
            "name": "Massage Suédois",
            "description": "Massage dynamique utilisant différentes techniques pour détendre les muscles et améliorer la circulation.",
            "duration_min": 45,
            "duration_max": 90,
            "min_price": Decimal("30000"),
            "recommended_price": Decimal("55000"),
            "category": "therapeutique",
            "icon_url": "/icons/swedish.png",
            "display_order": 3
        },
        {
            "name": "Massage aux Pierres Chaudes",
            "description": "Massage réalisé avec des pierres chaudes pour procurer une profonde sensation de détente.",
            "duration_min": 60,
            "duration_max": 120,
            "min_price": Decimal("45000"),
            "recommended_price": Decimal("70000"),
            "category": "relaxant",
            "icon_url": "/icons/hot-stone.png",
            "display_order": 4
        },
        {
            "name": "Massage du Dos",
            "description": "Massage ciblé sur le dos, les épaules et la nuque pour soulager les tensions musculaires.",
            "duration_min": 30,
            "duration_max": 60,
            "min_price": Decimal("20000"),
            "recommended_price": Decimal("35000"),
            "category": "therapeutique",
            "icon_url": "/icons/back-massage.png",
            "display_order": 5
        },
        {
            "name": "Massage Sportif",
            "description": "Massage destiné aux personnes pratiquant une activité physique afin de détendre les muscles sollicités.",
            "duration_min": 45,
            "duration_max": 90,
            "min_price": Decimal("30000"),
            "recommended_price": Decimal("55000"),
            "category": "sportif",
            "icon_url": "/icons/sports.png",
            "display_order": 6
        },
        {
            "name": "Réflexologie Planitaire",
            "description": "Massage et stimulation des pieds favorisant la relaxation et le bien-être général.",
            "duration_min": 30,
            "duration_max": 60,
            "min_price": Decimal("20000"),
            "recommended_price": Decimal("35000"),
            "category": "reflexologie",
            "icon_url": "/icons/reflexology.png",
            "display_order": 7
        },
        {
            "name": "Shiatsu",
            "description": "Technique de pression exercée avec les doigts et les paumes sur différentes zones du corps.",
            "duration_min": 45,
            "duration_max": 90,
            "min_price": Decimal("30000"),
            "recommended_price": Decimal("50000"),
            "category": "therapeutique",
            "icon_url": "/icons/shiatsu.png",
            "display_order": 8
        },
        {
            "name": "Massage Ayurvedique",
            "description": "Massage inspiré des traditions ayurvédiques utilisant des mouvements adaptés pour favoriser détente et équilibre.",
            "duration_min": 60,
            "duration_max": 120,
            "min_price": Decimal("40000"),
            "recommended_price": Decimal("65000"),
            "category": "personnalise",
            "icon_url": "/icons/ayurvedic.png",
            "display_order": 9
        },
        {
            "name": "Massage Traditionnel Malgache",
            "description": "Massage inspiré des pratiques traditionnelles malgaches, adapté à la relaxation et au bien-être.",
            "duration_min": 45,
            "duration_max": 90,
            "min_price": Decimal("25000"),
            "recommended_price": Decimal("45000"),
            "category": "personnalise",
            "icon_url": "/icons/malagasy.png",
            "display_order": 10
        },
        {
            "name": "Deep Tissue",
            "description": "Massage profond qui cible les couches profondes des muscles et des tissus conjonctifs.",
            "duration_min": 60,
            "duration_max": 90,
            "min_price": Decimal("45000"),
            "recommended_price": Decimal("60000"),
            "category": "therapeutique",
            "icon_url": "/icons/deep-tissue.png",
            "display_order": 11
        },
        {
            "name": "Massage Thérapeutique",
            "description": "Massage ciblé pour traiter des problèmes musculaires spécifiques et des douleurs chroniques.",
            "duration_min": 60,
            "duration_max": 90,
            "min_price": Decimal("40000"),
            "recommended_price": Decimal("55000"),
            "category": "therapeutique",
            "icon_url": "/icons/therapeutic.png",
            "display_order": 12
        },
        {
            "name": "Massage Prénatal",
            "description": "Massage spécialement adapté aux femmes enceintes pour soulager les douleurs et réduire le stress.",
            "duration_min": 45,
            "duration_max": 60,
            "min_price": Decimal("42000"),
            "recommended_price": Decimal("55000"),
            "category": "prenatal",
            "icon_url": "/icons/prenatal.png",
            "display_order": 13
        }
    ]
    
    created_types = []
    for mt in massage_types:
        massage_type = MassageType(**mt)
        session.add(massage_type)
        created_types.append(massage_type)
    
    session.commit()
    print(f"✅ {len(created_types)} types de massage créés")
    return created_types


# ============================================================
# 5. SPÉCIALITÉS DES THÉRAPEUTES
# ============================================================

def create_therapist_specialties(therapists, massage_types):
    """Crée les spécialités des thérapeutes"""
    print("📦 Création des spécialités des thérapeutes...")
    
    massage_type_map = {mt.name: mt for mt in massage_types}
    
    for therapist, specs in therapists:
        for specialty_name in specs["specialty"]:
            if specialty_name in massage_type_map:
                specialty = TherapistSpecialty(
                    therapist_id=therapist.id,
                    massage_type_id=massage_type_map[specialty_name].id
                )
                session.add(specialty)
    
    session.commit()
    print(f"✅ Spécialités des thérapeutes créées")


# ============================================================
# 6. DISPONIBILITÉS DES THÉRAPEUTES
# ============================================================

def create_availabilities(therapists):
    """Crée les disponibilités des thérapeutes"""
    print("📦 Création des disponibilités des thérapeutes...")
    
    for therapist in therapists:
        therapist_obj = therapist[0]
        
        for day in range(6):
            start_hour = random.choice([7, 8, 9, 10])
            end_hour = start_hour + random.choice([8, 9, 10])
            
            if end_hour > 20:
                end_hour = 20
            
            availability = TherapistAvailability(
                therapist_id=therapist_obj.id,
                day_of_week=day + 1,
                start_time=datetime.strptime(f"{start_hour:02d}:00", "%H:%M").time(),
                end_time=datetime.strptime(f"{end_hour:02d}:00", "%H:%M").time(),
                is_available=True,
                is_recurring=True
            )
            session.add(availability)
        
        if random.random() < 0.4:
            availability = TherapistAvailability(
                therapist_id=therapist_obj.id,
                day_of_week=0,
                start_time=datetime.strptime("09:00", "%H:%M").time(),
                end_time=datetime.strptime("15:00", "%H:%M").time(),
                is_available=True,
                is_recurring=True
            )
            session.add(availability)
    
    session.commit()
    print(f"✅ Disponibilités des thérapeutes créées")


# ============================================================
# 7. RÉSERVATIONS
# ============================================================

def create_bookings(therapists, massage_types):
    """Crée les réservations"""
    print("📦 Création des réservations...")
    
    clients = session.query(User).filter(User.role == "CLIENT").all()
    therapists_obj = [t[0] for t in therapists]
    
    bookings_data = []
    statuses = ["pending", "negotiating", "confirmed", "in_progress", "completed", "cancelled_by_client", "cancelled_by_therapist"]
    
    for i in range(60):
        client = random.choice(clients)
        therapist = random.choice(therapists_obj)
        massage_type = random.choice(massage_types)
        
        booking_date = datetime.now() - timedelta(days=random.randint(1, 90))
        duration = random.choice([60, 90, 120])
        client_price = massage_type.min_price + random.randint(0, 20000)
        final_price = client_price + random.randint(0, 15000)
        
        status = random.choices(
            statuses,
            weights=[0.05, 0.10, 0.20, 0.10, 0.35, 0.10, 0.10]
        )[0]
        
        gender = random.choice(["male", "female", "any"])
        address = f"Lot {random.randint(1, 500)} {random.choice(['Ambohijatovo', 'Antaninarenina', 'Andraharo', 'Ambohipo', 'Ampasankazanga', 'Ankadivato', 'Isoraka', 'Ankazomanga'])}"
        
        booking = Booking(
            client_id=client.id,
            therapist_id=therapist.id if status not in ["pending"] else None,
            massage_type_id=massage_type.id,
            status=status,
            client_price_proposed=client_price,
            therapist_initial_price=final_price - random.randint(0, 10000),
            final_price=final_price if status in ["confirmed", "in_progress", "completed"] else None,
            client_latitude=client.latitude,
            client_longitude=client.longitude,
            address=address,
            scheduled_date=booking_date + timedelta(hours=random.randint(8, 20)),
            scheduled_duration_minutes=duration,
            preferred_gender=gender,
            special_instructions=random.choice([
                None,
                "Privilégier les zones douloureuses",
                "Massage doux de préférence",
                "Je préfère une pression ferme",
                "Attention à mon dos",
                "Utiliser de l'huile parfumée",
                "Je suis allergique à la lavande"
            ]),
            created_at=booking_date,
            expires_at=booking_date + timedelta(hours=24)
        )
        session.add(booking)
        bookings_data.append(booking)
    
    session.commit()
    print(f"✅ {len(bookings_data)} réservations créées")
    return bookings_data


# ============================================================
# 8. NÉGOCIATIONS
# ============================================================

def create_negotiations(bookings):
    """Crée les négociations pour les réservations"""
    print("📦 Création des négociations...")
    
    negotiations_data = []
    
    for booking in bookings[:40]:
        if booking.status in ["pending", "negotiating", "confirmed"]:
            client_offer = Negotiation(
                booking_id=booking.id,
                user_id=booking.client_id,
                user_type="client",
                price_offered=booking.client_price_proposed,
                message=random.choice([
                    "Je propose ce prix pour ce massage",
                    "Je souhaite un massage de qualité à ce tarif",
                    "Prix proposé pour la prestation",
                    "Je suis ouvert à la négociation",
                    None
                ]),
                status="sent",
                created_at=booking.created_at,
                expires_at=booking.created_at + timedelta(hours=2)
            )
            session.add(client_offer)
            negotiations_data.append(client_offer)
            
            if booking.status in ["negotiating", "confirmed"] and booking.therapist_id:
                therapist_offer = Negotiation(
                    booking_id=booking.id,
                    user_id=booking.therapist_id,
                    user_type="therapist",
                    price_offered=booking.final_price or booking.client_price_proposed + 5000,
                    message=random.choice([
                        "Je propose ce prix pour ce massage",
                        "Prix ajusté selon mes tarifs",
                        "Je peux faire ce prix",
                        None
                    ]),
                    status=random.choice(["accepted", "sent"]),
                    created_at=booking.created_at + timedelta(minutes=random.randint(5, 30)),
                    expires_at=booking.created_at + timedelta(hours=3)
                )
                session.add(therapist_offer)
                negotiations_data.append(therapist_offer)
    
    session.commit()
    print(f"✅ {len(negotiations_data)} négociations créées")


# ============================================================
# 9. PAIEMENTS
# ============================================================

def create_payments(bookings):
    """Crée les paiements"""
    print("📦 Création des paiements...")
    
    payments_data = []
    methods = ["mobile_money", "card", "cash"]
    providers = ["mvola", "orange_money", "airtel_money", "stripe"]
    statuses = ["pending", "processing", "completed", "failed"]
    
    for booking in bookings:
        if booking.status in ["confirmed", "in_progress", "completed"] and booking.final_price:
            payment = Payment(
                booking_id=booking.id,
                user_id=booking.client_id,
                amount=booking.final_price,
                currency="MGA",
                method=random.choice(methods),
                provider=random.choice(providers) if random.random() < 0.7 else None,
                status=random.choices(
                    statuses,
                    weights=[0.1, 0.1, 0.7, 0.1]
                )[0],
                transaction_id=f"TX{random.randint(100000, 999999)}",
                payer_name=session.query(User).filter(User.id == booking.client_id).first().fullname,
                payer_phone=session.query(User).filter(User.id == booking.client_id).first().phone,
                created_at=booking.created_at + timedelta(minutes=random.randint(10, 60)),
                completed_at=booking.created_at + timedelta(minutes=random.randint(30, 120)) if random.random() < 0.7 else None
            )
            session.add(payment)
            payments_data.append(payment)
    
    session.commit()
    print(f"✅ {len(payments_data)} paiements créés")


# ============================================================
# 10. AVIS
# ============================================================

def create_reviews(bookings):
    """Crée les avis"""
    print("📦 Création des avis...")
    
    reviews_data = []
    review_comments = [
        "Excellent massage, très professionnel !",
        "Très bonne prestation, je recommande !",
        "Massage parfait, détente assurée.",
        "Le thérapeute était à l'écoute et très compétent.",
        "Prestation de qualité, je reviendrai !",
        "Bon massage, mais un peu cher.",
        "Très satisfait du service.",
        "Le massage a soulagé mes tensions.",
        "Professionalisme et bienveillance.",
        "Super expérience, je recommande vivement !",
        "Massage agréable et relaxant.",
        "Le thérapeute connaît bien son métier.",
        "Prestation correcte mais sans plus.",
        "Très bon rapport qualité-prix.",
        "Massage qui a répondu à mes attentes.",
        "Je suis ravi de cette expérience.",
        "Le massage m'a fait beaucoup de bien.",
        "Professionnel et à l'écoute des besoins.",
        "Je recommande ce thérapeute.",
        "Massage de qualité, je suis satisfait."
    ]
    
    negative_comments = [
        "Massage un peu décevant.",
        "Pas à la hauteur de mes attentes.",
        "Le thérapeute était en retard.",
        "Massage trop doux à mon goût.",
        "Prix trop élevé pour la prestation."
    ]
    
    for booking in bookings:
        if booking.status == "completed" and booking.therapist_id:
            if random.random() < 0.7:
                rating = random.choices(
                    [1, 2, 3, 4, 5],
                    weights=[0.02, 0.05, 0.10, 0.33, 0.50]
                )[0]
                
                comment = random.choice(review_comments if rating >= 4 else negative_comments)
                
                review = Review(
                    booking_id=booking.id,
                    reviewer_id=booking.client_id,
                    therapist_id=booking.therapist_id,
                    rating=rating,
                    comment=comment,
                    is_anonymous=random.random() < 0.2,
                    professionalism=random.randint(3, 5),
                    quality=random.randint(3, 5),
                    punctuality=random.randint(3, 5),
                    cleanliness=random.randint(3, 5),
                    is_verified=True,
                    created_at=booking.actual_end_time or booking.scheduled_date + timedelta(hours=1)
                )
                session.add(review)
                reviews_data.append(review)
                
                if random.random() < 0.5:
                    review.response_from_therapist = random.choice([
                        "Merci pour votre retour !",
                        "Ravi que vous ayez apprécié !",
                        "Au plaisir de vous revoir !",
                        "Merci pour votre confiance.",
                        "Votre satisfaction est ma priorité."
                    ])
    
    session.commit()
    print(f"✅ {len(reviews_data)} avis créés")


# ============================================================
# 11. NOTIFICATIONS
# ============================================================

def create_notifications(users, bookings):
    """Crée les notifications"""
    print("📦 Création des notifications...")
    
    notifications_data = []
    notification_templates = [
        {"title": "Nouvelle offre reçue", "type": "offer"},
        {"title": "Réservation confirmée", "type": "booking"},
        {"title": "Votre paiement a été validé", "type": "payment"},
        {"title": "Nouveau message reçu", "type": "chat"},
        {"title": "Le thérapeute est en route", "type": "booking"},
        {"title": "Prestation terminée", "type": "booking"},
        {"title": "Promotion spéciale", "type": "promotion"}
    ]
    
    for user in users:
        for _ in range(random.randint(2, 5)):
            template = random.choice(notification_templates)
            is_read = random.random() < 0.6
            
            notification = Notification(
                user_id=user.id,
                booking_id=random.choice(bookings).id if random.random() < 0.3 else None,
                title=template["title"],
                body=random.choice([
                    f"{template['title']} concernant votre massage.",
                    f"Vous avez reçu une notification importante.",
                    f"Action requise pour votre prestation.",
                ]),
                type=template["type"],
                is_read=is_read,
                created_at=datetime.now() - timedelta(days=random.randint(0, 30))
            )
            session.add(notification)
            notifications_data.append(notification)
    
    session.commit()
    print(f"✅ {len(notifications_data)} notifications créées")


# ============================================================
# 12. CONTACTS D'URGENCE
# ============================================================

def create_emergency_contacts(users):
    """Crée les contacts d'urgence"""
    print("📦 Création des contacts d'urgence...")
    
    contacts_data = []
    target_users = random.sample(users, min(10, len(users)))
    
    for user in target_users:
        for _ in range(random.randint(1, 2)):
            contact = EmergencyContact(
                user_id=user.id,
                name=f"{random.choice(['Jean', 'Marie', 'Pierre', 'Sophie', 'Rakoto', 'Hery'])} {random.choice(['Rakoto', 'Randria', 'Rabe', 'Raharison'])}",
                phone=f"034{random.randint(100000, 999999)}",
                relation=random.choice(["conjoint", "conjointe", "parent", "enfant", "ami", "frère", "soeur"]),
                is_primary=random.random() < 0.3,
                is_active=True
            )
            session.add(contact)
            contacts_data.append(contact)
    
    session.commit()
    print(f"✅ {len(contacts_data)} contacts d'urgence créés")


# ============================================================
# 13. ANALYTIQUES
# ============================================================

def create_analytics(users, bookings):
    """Crée les données analytiques"""
    print("📦 Création des données analytiques...")
    
    for user in users:
        user_analytics = UserAnalytics(
            user_id=user.id,
            total_bookings=random.randint(0, 10),
            total_spent=Decimal(str(random.randint(0, 500000))),
            total_earnings=Decimal(str(random.randint(0, 300000))) if user.role == "THERAPIST" else 0,
            average_rating_given=Decimal(str(random.uniform(3.0, 5.0))).quantize(Decimal('0.01')),
            average_rating_received=Decimal(str(random.uniform(3.5, 4.9))).quantize(Decimal('0.01')) if user.role == "THERAPIST" else None,
            user_segment=random.choice(["premium", "regular", "new"]),
            engagement_score=Decimal(str(random.uniform(20, 95))).quantize(Decimal('0.01')),
            churn_risk=Decimal(str(random.uniform(5, 40))).quantize(Decimal('0.01')),
            last_active=datetime.now() - timedelta(days=random.randint(0, 30))
        )
        session.add(user_analytics)
    
    session.commit()
    print("✅ Données analytiques créées")


# ============================================================
# 14. GAINS DES THÉRAPEUTES
# ============================================================

def create_therapist_earnings(therapists, bookings):
    """Crée les données de gains pour les thérapeutes"""
    print("📦 Création des gains des thérapeutes...")
    
    for therapist in therapists:
        therapist_obj = therapist[0]
        
        completed = [b for b in bookings if b.therapist_id == therapist_obj.id and b.status == "completed"]
        total_earnings = Decimal("0")
        completed_count = 0
        
        for booking in completed:
            if booking.final_price:
                total_earnings += booking.final_price
                completed_count += 1
        
        commission_rate = Decimal("10.0")
        total_commission = (total_earnings * commission_rate / 100).quantize(Decimal('0.01'))
        
        earnings = TherapistEarnings(
            therapist_id=therapist_obj.id,
            total_earnings=total_earnings,
            pending_earnings=Decimal("0"),
            available_earnings=total_earnings - total_commission,
            total_commission=total_commission,
            pending_commission=Decimal("0"),
            total_bookings=len([b for b in bookings if b.therapist_id == therapist_obj.id]),
            completed_bookings=completed_count,
            cancelled_bookings=len([b for b in bookings if b.therapist_id == therapist_obj.id and b.status.startswith("cancelled")]),
            today_earnings=Decimal(str(random.uniform(20000, 80000))).quantize(Decimal('0.01')),
            week_earnings=Decimal(str(random.uniform(100000, 400000))).quantize(Decimal('0.01')),
            month_earnings=Decimal(str(random.uniform(300000, 1200000))).quantize(Decimal('0.01')),
            year_earnings=Decimal(str(random.uniform(1000000, 5000000))).quantize(Decimal('0.01'))
        )
        session.add(earnings)
    
    session.commit()
    print("✅ Gains des thérapeutes créés")


# ============================================================
# 15. CERTIFICATS DES THÉRAPEUTES
# ============================================================

def create_therapist_certificates(therapists, admin_id):
    """Crée les certificats des thérapeutes"""
    print("📦 Création des certificats des thérapeutes...")
    
    if admin_id is None:
        print("⚠️  Admin non trouvé, les certificats ne seront pas créés")
        return
    
    certificate_statuses = ["valid", "revoked"]
    
    for therapist in therapists:
        therapist_obj = therapist[0]
        
        certificate = TherapistCertificate(
            therapist_id=therapist_obj.id,
            certificate_number=generate_certificate_number(therapist_obj.id),
            certificate_path=f"/certificates/therapist_{therapist_obj.id}_cert.pdf",
            issued_at=datetime.now() - timedelta(days=random.randint(30, 365)),
            status=random.choices(certificate_statuses, weights=[0.95, 0.05])[0],
            verified_by=admin_id
        )
        session.add(certificate)
    
    session.commit()
    print("✅ Certificats des thérapeutes créés")


# ============================================================
# 16. SESSIONS DE MASSAGE
# ============================================================

def create_massage_sessions(bookings):
    """Crée les sessions de massage"""
    print("📦 Création des sessions de massage...")
    
    for booking in bookings:
        if booking.status == "completed":
            session_obj = MassageSession(
                booking_id=booking.id,
                actual_duration_minutes=booking.scheduled_duration_minutes + random.randint(-10, 10),
                notes=random.choice([
                    "Séance terminée avec succès",
                    "Client satisfait",
                    "Massage bien réalisé",
                    "Zones tendues traitées",
                    None
                ]),
                therapist_notes=random.choice([
                    "Le client présente des tensions au niveau du dos",
                    "Bonne réceptivité du client",
                    "Massage adapté aux besoins du client",
                    None
                ]),
                client_satisfaction=random.randint(3, 5),
                therapist_satisfaction=random.randint(3, 5),
                pressure_level=random.choice(["light", "medium", "firm"]),
                client_relaxation=random.randint(3, 5),
                client_pain_relief=random.randint(3, 5),
                is_completed=True,
                is_verified=True,
                completed_at=booking.actual_end_time or booking.scheduled_date + timedelta(hours=2)
            )
            session.add(session_obj)
    
    session.commit()
    print("✅ Sessions de massage créées")


# ============================================================
# 17. DONNÉES ANALYTIQUES DE PLATEFORME
# ============================================================

def create_platform_analytics():
    """Crée les données analytiques de la plateforme"""
    print("📦 Création des données analytiques de la plateforme...")
    
    for i in range(30):
        date = datetime.now() - timedelta(days=i)
        
        platform_analytics = PlatformAnalytics(
            date=date,
            total_users=random.randint(30, 60),
            new_users=random.randint(1, 5),
            active_users=random.randint(15, 35),
            total_therapists=random.randint(15, 25),
            active_therapists=random.randint(5, 15),
            online_therapists=random.randint(3, 10),
            total_bookings=random.randint(30, 80),
            completed_bookings=random.randint(20, 60),
            cancelled_bookings=random.randint(2, 10),
            total_revenue=Decimal(str(random.randint(500000, 2000000))),
            total_commission=Decimal(str(random.randint(50000, 200000))),
            net_revenue=Decimal(str(random.randint(450000, 1800000))),
            total_payments=random.randint(20, 50),
            payment_amount=Decimal(str(random.randint(400000, 1500000))),
            total_reviews=random.randint(10, 30),
            average_rating=Decimal(str(random.uniform(4.0, 4.8))).quantize(Decimal('0.01')),
            sos_alerts=random.randint(0, 2),
            resolved_sos=random.randint(0, 2),
            predicted_revenue=Decimal(str(random.randint(600000, 2500000))),
            growth_rate=Decimal(str(random.uniform(2.0, 15.0))).quantize(Decimal('0.01')),
            churn_rate=Decimal(str(random.uniform(2.0, 8.0))).quantize(Decimal('0.01'))
        )
        session.add(platform_analytics)
    
    session.commit()
    print("✅ Données analytiques de la plateforme créées")


# ============================================================
# 18. PRÉDICTIONS IA
# ============================================================

def create_ai_predictions(bookings):
    """Crée les prédictions IA"""
    print("📦 Création des prédictions IA...")
    
    for booking in bookings[:30]:
        if booking.final_price:
            prediction = AIPrediction(
                booking_id=booking.id,
                user_id=booking.client_id,
                prediction_type=random.choice(["price_prediction", "therapist_recommendation", "acceptance_probability"]),
                predicted_price=booking.final_price + Decimal(str(random.uniform(-5000, 5000))),
                recommended_price=booking.final_price + Decimal(str(random.uniform(-3000, 3000))),
                acceptance_probability=Decimal(str(random.uniform(0.6, 0.95))).quantize(Decimal('0.01')),
                confidence_score=Decimal(str(random.uniform(0.7, 0.95))).quantize(Decimal('0.01')),
                factors={
                    "distance": random.randint(1, 10),
                    "demand": random.choice(["low", "medium", "high"]),
                    "time_of_day": random.choice(["morning", "afternoon", "evening"]),
                    "client_history": random.randint(1, 10)
                },
                model_version="v1.0",
                model_used="random_forest_v1",
                is_validated=random.random() < 0.6,
                created_at=booking.created_at,
                validated_at=booking.created_at + timedelta(hours=1) if random.random() < 0.5 else None
            )
            session.add(prediction)
    
    session.commit()
    print("✅ Prédictions IA créées")


# ============================================================
# 19. EXÉCUTION PRINCIPALE
# ============================================================

def main():
    """Exécute le script de seeding"""
    print("\n" + "="*60)
    print("   🌿 SEEDING DE LA BASE DE DONNÉES - MADA BIEN-ÊTRE")
    print("="*60 + "\n")
    
    try:
        clear_database()
        
        therapists, admin_id = create_users()
        massage_types = create_massage_types()
        create_therapist_specialties(therapists, massage_types)
        create_availabilities(therapists)
        bookings = create_bookings(therapists, massage_types)
        create_negotiations(bookings)
        create_payments(bookings)
        create_reviews(bookings)
        
        users = session.query(User).all()
        
        create_notifications(users, bookings)
        create_emergency_contacts(users)
        create_analytics(users, bookings)
        create_therapist_earnings(therapists, bookings)
        create_therapist_certificates(therapists, admin_id)
        create_massage_sessions(bookings)
        create_platform_analytics()
        create_ai_predictions(bookings)
        
        print("\n" + "="*60)
        print("   ✅ SEEDING TERMINÉ AVEC SUCCÈS !")
        print("="*60)
        
        print("\n📊 STATISTIQUES FINALES:")
        print(f"   - Utilisateurs: {session.query(User).count()}")
        print(f"   - Massages: {session.query(MassageType).count()}")
        print(f"   - Réservations: {session.query(Booking).count()}")
        print(f"   - Paiements: {session.query(Payment).count()}")
        print(f"   - Avis: {session.query(Review).count()}")
        
    except Exception as e:
        print(f"\n❌ ERREUR: {str(e)}")
        session.rollback()
        raise
    finally:
        session.close()


if __name__ == "__main__":
    main()