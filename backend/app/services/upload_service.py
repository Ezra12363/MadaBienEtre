import cloudinary
import cloudinary.uploader
from fastapi import UploadFile
from typing import Optional, Dict, Any
import uuid
import os
from ..core.config import settings

# Configuration Cloudinary
cloudinary.config(
    cloud_name=settings.CLOUDINARY_CLOUD_NAME,
    api_key=settings.CLOUDINARY_API_KEY,
    api_secret=settings.CLOUDINARY_API_SECRET
)

def upload_image(
    file: UploadFile,
    folder: str = "general",
    public_id: Optional[str] = None,
    transformation: Optional[Dict[str, Any]] = None
) -> str:
    """Uploader une image sur Cloudinary"""
    try:
        # Lire le contenu du fichier
        contents = file.file.read()
        
        # Upload vers Cloudinary
        upload_options = {
            "folder": f"mada_bienetre/{folder}",
            "use_filename": True,
            "unique_filename": True,
            "overwrite": True
        }
        
        if public_id:
            upload_options["public_id"] = public_id
        
        if transformation:
            upload_options["transformation"] = transformation
        
        # Upload
        result = cloudinary.uploader.upload(contents, **upload_options)
        
        return result.get("secure_url")
    except Exception as e:
        print(f"Upload failed: {e}")
        # Fallback: sauvegarde locale
        return save_locally(file, folder)

def save_locally(file: UploadFile, folder: str) -> str:
    """Sauvegarder un fichier localement (fallback)"""
    try:
        # Créer le dossier si nécessaire
        upload_dir = f"uploads/{folder}"
        os.makedirs(upload_dir, exist_ok=True)
        
        # Générer un nom unique
        file_extension = file.filename.split(".")[-1] if file.filename else "jpg"
        filename = f"{uuid.uuid4()}.{file_extension}"
        file_path = f"{upload_dir}/{filename}"
        
        # Sauvegarder le fichier
        with open(file_path, "wb") as f:
            contents = file.file.read()
            f.write(contents)
        
        return f"/{file_path}"
    except Exception as e:
        print(f"Local save failed: {e}")
        return ""

def upload_profile_image(file: UploadFile, user_id: int) -> str:
    """Uploader une photo de profil"""
    return upload_image(file, f"profiles/{user_id}")

def upload_document(file: UploadFile, user_id: int, doc_type: str) -> str:
    """Uploader un document d'identité ou certificat"""
    return upload_image(file, f"documents/{doc_type}/{user_id}")

def delete_image(url: str) -> bool:
    """Supprimer une image de Cloudinary"""
    try:
        if "cloudinary" in url:
            # Extraire le public_id de l'URL
            parts = url.split("/")
            public_id = "/".join(parts[-2:]).split(".")[0]
            result = cloudinary.uploader.destroy(public_id)
            return result.get("result") == "ok"
        return True
    except Exception as e:
        print(f"Delete failed: {e}")
        return False

def optimize_image(file: UploadFile) -> UploadFile:
    """Optimiser une image avant upload"""
    # Implémentation d'optimisation avec PIL
    try:
        from PIL import Image
        import io
        
        contents = file.file.read()
        image = Image.open(io.BytesIO(contents))
        
        # Redimensionner si trop grand
        max_size = (1024, 1024)
        image.thumbnail(max_size, Image.Resampling.LANCZOS)
        
        # Sauvegarder optimisé
        output = io.BytesIO()
        image.save(output, format="JPEG", quality=85, optimize=True)
        output.seek(0)
        
        # Créer un nouveau UploadFile
        from fastapi import UploadFile
        return UploadFile(
            filename=file.filename,
            file=output,
            size=len(output.getvalue())
        )
    except Exception as e:
        print(f"Optimization failed: {e}")
        return file