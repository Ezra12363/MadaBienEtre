import cloudinary
import cloudinary.uploader
import cloudinary.api
from typing import Optional, Dict, Any, BinaryIO
import logging
from ..core.config import settings

logger = logging.getLogger(__name__)

# Configuration Cloudinary
cloudinary.config(
    cloud_name=settings.CLOUDINARY_CLOUD_NAME,
    api_key=settings.CLOUDINARY_API_KEY,
    api_secret=settings.CLOUDINARY_API_SECRET
)

class CloudinaryStorage:
    """Service de stockage Cloudinary"""
    
    def __init__(self):
        self.cloud_name = settings.CLOUDINARY_CLOUD_NAME
    
    def upload(
        self,
        file: BinaryIO,
        folder: str = "general",
        public_id: Optional[str] = None,
        transformation: Optional[Dict[str, Any]] = None,
        tags: Optional[list] = None
    ) -> Dict[str, Any]:
        """Uploader un fichier sur Cloudinary"""
        try:
            upload_options = {
                "folder": f"mada_bienetre/{folder}",
                "use_filename": True,
                "unique_filename": True,
                "overwrite": True,
                "resource_type": "auto"
            }
            
            if public_id:
                upload_options["public_id"] = public_id
            
            if transformation:
                upload_options["transformation"] = transformation
            
            if tags:
                upload_options["tags"] = tags
            
            result = cloudinary.uploader.upload(file, **upload_options)
            
            return {
                "url": result.get("secure_url"),
                "public_id": result.get("public_id"),
                "format": result.get("format"),
                "size": result.get("bytes"),
                "created_at": result.get("created_at"),
                "width": result.get("width"),
                "height": result.get("height")
            }
            
        except Exception as e:
            logger.error(f"Cloudinary upload error: {e}")
            return {"error": str(e)}
    
    def upload_image(
        self,
        file: BinaryIO,
        folder: str = "images",
        public_id: Optional[str] = None,
        width: Optional[int] = None,
        height: Optional[int] = None,
        quality: int = 85
    ) -> Dict[str, Any]:
        """Uploader une image avec optimisation"""
        transformation = {
            "quality": quality,
            "fetch_format": "auto"
        }
        
        if width and height:
            transformation["width"] = width
            transformation["height"] = height
            transformation["crop"] = "fill"
        
        return self.upload(file, folder, public_id, transformation)
    
    def upload_document(
        self,
        file: BinaryIO,
        folder: str = "documents",
        public_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """Uploader un document"""
        return self.upload(file, folder, public_id, {"format": "auto"})
    
    def delete(self, public_id: str) -> bool:
        """Supprimer un fichier de Cloudinary"""
        try:
            result = cloudinary.uploader.destroy(public_id)
            return result.get("result") == "ok"
        except Exception as e:
            logger.error(f"Cloudinary delete error: {e}")
            return False
    
    def get_url(self, public_id: str, transformation: Optional[Dict[str, Any]] = None) -> str:
        """Obtenir l'URL d'un fichier"""
        try:
            if transformation:
                url = cloudinary.utils.cloudinary_url(
                    public_id,
                    **transformation
                )
                return url[0]
            else:
                return cloudinary.utils.cloudinary_url(public_id)[0]
        except Exception as e:
            logger.error(f"Cloudinary URL error: {e}")
            return ""

# Instance globale
cloudinary_storage = CloudinaryStorage()