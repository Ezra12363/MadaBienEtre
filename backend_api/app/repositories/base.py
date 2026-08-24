from sqlalchemy.orm import Session
from typing import Type, TypeVar, Generic, Optional, List, Dict, Any
from ..core.database import Base

ModelType = TypeVar("ModelType", bound=Base)

class BaseRepository(Generic[ModelType]):
    """Repository de base avec CRUD"""
    
    def __init__(self, model: Type[ModelType], db: Session):
        self.model = model
        self.db = db
    
    def create(self, **kwargs) -> ModelType:
        """Créer une nouvelle instance"""
        instance = self.model(**kwargs)
        self.db.add(instance)
        self.db.commit()
        self.db.refresh(instance)
        return instance
    
    def get(self, id: int) -> Optional[ModelType]:
        """Obtenir une instance par ID"""
        return self.db.query(self.model).filter(self.model.id == id).first()
    
    def get_all(self, skip: int = 0, limit: int = 100, **filters) -> List[ModelType]:
        """Obtenir toutes les instances avec filtres"""
        query = self.db.query(self.model)
        for key, value in filters.items():
            if hasattr(self.model, key):
                query = query.filter(getattr(self.model, key) == value)
        return query.offset(skip).limit(limit).all()
    
    def update(self, id: int, **kwargs) -> Optional[ModelType]:
        """Mettre à jour une instance"""
        instance = self.get(id)
        if instance:
            for key, value in kwargs.items():
                if hasattr(instance, key):
                    setattr(instance, key, value)
            self.db.commit()
            self.db.refresh(instance)
        return instance
    
    def delete(self, id: int) -> bool:
        """Supprimer une instance"""
        instance = self.get(id)
        if instance:
            self.db.delete(instance)
            self.db.commit()
            return True
        return False
    
    def count(self, **filters) -> int:
        """Compter les instances avec filtres"""
        query = self.db.query(self.model)
        for key, value in filters.items():
            if hasattr(self.model, key):
                query = query.filter(getattr(self.model, key) == value)
        return query.count()
    
    def exists(self, **filters) -> bool:
        """Vérifier si une instance existe avec les filtres"""
        return self.count(**filters) > 0