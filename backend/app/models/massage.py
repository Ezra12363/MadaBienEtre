# app/models/massage.py
from sqlalchemy import Column, Integer, String, Text, DECIMAL, Boolean, TIMESTAMP, ForeignKey, Enum, Index
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from ..core.database import Base

class MassageType(Base):
    """Types de massage"""
    __tablename__ = "massage_types"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False, unique=True)
    description = Column(Text, nullable=True)
    
    # Durée
    duration_min = Column(Integer, default=60)
    duration_max = Column(Integer, default=120)
    
    # Prix
    min_price = Column(DECIMAL(10,2), default=30000)
    recommended_price = Column(DECIMAL(10,2), nullable=True)
    
    # Catégorie - ✅ Enum est maintenant importé
    category = Column(
        Enum('relaxant', 'therapeutique', 'sportif', 'reflexologie', 'prenatal', 'personnalise', name='massage_category'),
        default='relaxant'
    )
    
    icon_url = Column(String(255), nullable=True)
    image_url = Column(String(255), nullable=True)
    is_active = Column(Boolean, default=True)
    
    # Ordre d'affichage
    display_order = Column(Integer, default=0)
    
    created_at = Column(TIMESTAMP, server_default=func.now())
    updated_at = Column(TIMESTAMP, server_default=func.now(), onupdate=func.now())
    
    # Relations
    bookings = relationship("Booking", back_populates="massage_type")
    specialties = relationship("TherapistSpecialty", back_populates="massage_type")
    
    def __repr__(self):
        return f"<MassageType(id={self.id}, name={self.name})>"
    
    @property
    def is_popular(self):
        return len(self.bookings) > 10
    
    def get_min_price(self):
        return float(self.min_price) if self.min_price else 0

class MassageCategory(Base):
    """Catégories de massage"""
    __tablename__ = "massage_categories"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False, unique=True)
    description = Column(Text, nullable=True)
    icon_url = Column(String(255), nullable=True)
    display_order = Column(Integer, default=0)
    is_active = Column(Boolean, default=True)
    
    created_at = Column(TIMESTAMP, server_default=func.now())
    updated_at = Column(TIMESTAMP, server_default=func.now(), onupdate=func.now())

class MassageAddon(Base):
    """Options supplémentaires pour les massages"""
    __tablename__ = "massage_addons"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    description = Column(Text, nullable=True)
    price = Column(DECIMAL(10,2), nullable=False)
    duration_minutes = Column(Integer, default=0)
    is_active = Column(Boolean, default=True)
    
    created_at = Column(TIMESTAMP, server_default=func.now())
    updated_at = Column(TIMESTAMP, server_default=func.now(), onupdate=func.now())
    
    # Relations
    bookings = relationship("BookingAddon", back_populates="addon")

class BookingAddon(Base):
    """Options choisies pour une réservation"""
    __tablename__ = "booking_addons"
    
    id = Column(Integer, primary_key=True, index=True)
    booking_id = Column(Integer, ForeignKey("bookings.id"), nullable=False)
    addon_id = Column(Integer, ForeignKey("massage_addons.id"), nullable=False)
    quantity = Column(Integer, default=1)
    price = Column(DECIMAL(10,2), nullable=False)
    
    created_at = Column(TIMESTAMP, server_default=func.now())
    
    # Relations
    booking = relationship("Booking")
    addon = relationship("MassageAddon", back_populates="bookings")