import os
import shutil
from typing import Optional, Dict, Any, BinaryIO
import uuid
import logging
from datetime import datetime
from ..core.config import settings

logger = logging.getLogger(__name__)

class LocalStorage:
    """Service de stockage local (fallback)"""
    
    def __init__(self):
        self.base_path = "uploads"
        self._ensure_base_dir()
    
    def _ensure_base_dir(self):
        """S'assurer que le dossier de base existe"""
        os.makedirs(self.base_path, exist_ok=True)
    
    def _get_file_path(self, folder: str, filename: str) -> str:
        """Obtenir le chemin complet d'un fichier"""
        folder_path = os.path.join(self.base_path, folder)
        os.makedirs(folder_path, exist_ok=True)
        return os.path.join(folder_path, filename)
    
    def _generate_filename(self, original_filename: str) -> str:
        """Générer un nom de fichier unique"""
        extension = original_filename.split(".")[-1] if "." in original_filename else "bin"
        return f"{uuid.uuid4()}_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.{extension}"
    
    def upload(
        self,
        file: BinaryIO,
        folder: str = "general",
        filename: Optional[str] = None
    ) -> Dict[str, Any]:
        """Uploader un fichier en local"""
        try:
            if not filename:
                filename = self._generate_filename(file.name if hasattr(file, "name") else "file")
            
            file_path = self._get_file_path(folder, filename)
            
            # Sauvegarder le fichier
            with open(file_path, "wb") as f:
                shutil.copyfileobj(file, f)
            
            file_size = os.path.getsize(file_path)
            
            return {
                "url": f"/{file_path}",
                "filename": filename,
                "path": file_path,
                "size": file_size,
                "created_at": datetime.utcnow().isoformat()
            }
            
        except Exception as e:
            logger.error(f"Local storage upload error: {e}")
            return {"error": str(e)}
    
    def delete(self, file_path: str) -> bool:
        """Supprimer un fichier local"""
        try:
            if os.path.exists(file_path):
                os.remove(file_path)
                return True
            return False
        except Exception as e:
            logger.error(f"Local storage delete error: {e}")
            return False
    
    def get_url(self, file_path: str) -> str:
        """Obtenir l'URL d'un fichier local"""
        return f"/{file_path}"
    
    def exists(self, file_path: str) -> bool:
        """Vérifier si un fichier existe"""
        return os.path.exists(file_path)
    
    def get_file_info(self, file_path: str) -> Optional[Dict[str, Any]]:
        """Obtenir les informations d'un fichier"""
        if os.path.exists(file_path):
            stat = os.stat(file_path)
            return {
                "path": file_path,
                "size": stat.st_size,
                "created": datetime.fromtimestamp(stat.st_ctime).isoformat(),
                "modified": datetime.fromtimestamp(stat.st_mtime).isoformat()
            }
        return None

# Instance globale
local_storage = LocalStorage()