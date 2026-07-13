from typing import Optional, Dict, Any, BinaryIO
import logging
from .cloudinary_storage import cloudinary_storage
from .local_storage import local_storage
from ..core.config import settings

logger = logging.getLogger(__name__)

class StorageFactory:
    """Factory pour les services de stockage"""
    
    @staticmethod
    def get_storage(provider: str = "cloudinary"):
        """Obtenir un service de stockage"""
        if provider == "cloudinary" and settings.CLOUDINARY_CLOUD_NAME:
            return cloudinary_storage
        else:
            return local_storage
    
    @staticmethod
    async def upload_file(
        file: BinaryIO,
        folder: str = "general",
        filename: Optional[str] = None,
        provider: str = "cloudinary",
        **kwargs
    ) -> Dict[str, Any]:
        """Uploader un fichier avec le provider spécifié"""
        storage = StorageFactory.get_storage(provider)
        return storage.upload(file, folder, filename, **kwargs)
    
    @staticmethod
    async def upload_image(
        file: BinaryIO,
        folder: str = "images",
        filename: Optional[str] = None,
        width: Optional[int] = None,
        height: Optional[int] = None,
        quality: int = 85,
        provider: str = "cloudinary"
    ) -> Dict[str, Any]:
        """Uploader une image optimisée"""
        storage = StorageFactory.get_storage(provider)
        if provider == "cloudinary" and hasattr(storage, "upload_image"):
            return storage.upload_image(file, folder, filename, width, height, quality)
        else:
            return storage.upload(file, folder, filename)
    
    @staticmethod
    async def delete_file(file_path: str, provider: str = "cloudinary") -> bool:
        """Supprimer un fichier"""
        storage = StorageFactory.get_storage(provider)
        return storage.delete(file_path)

# Instance globale
storage_factory = StorageFactory()