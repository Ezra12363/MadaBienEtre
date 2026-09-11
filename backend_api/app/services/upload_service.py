# app/services/upload_service.py
import cloudinary
import cloudinary.uploader
from fastapi import UploadFile, HTTPException, status
from typing import Optional, Dict, Any
import uuid
import os
import re
from ..core.config import settings

# ✅ Configuration Cloudinary — ampiasaina raha vonona tanteraka izy
# (cloud_name, api_key, api_secret rehetra tsy banga)
CLOUDINARY_CONFIGURED = bool(
    getattr(settings, "CLOUDINARY_CLOUD_NAME", None)
    and getattr(settings, "CLOUDINARY_API_KEY", None)
    and getattr(settings, "CLOUDINARY_API_SECRET", None)
)

if CLOUDINARY_CONFIGURED:
    cloudinary.config(
        cloud_name=settings.CLOUDINARY_CLOUD_NAME,
        api_key=settings.CLOUDINARY_API_KEY,
        api_secret=settings.CLOUDINARY_API_SECRET,
    )
else:
    print("ℹ️ Cloudinary non configuré (clés manquantes) — stockage local uniquement.")

# ✅ Taille minimale acceptable (1 KB) — raha latsaka noho izany dia
# azo antoka fa "vide/corrompu" ilay fichier (io no tena antony
# nahatonga ny sary "manjavona" amin'ny web: fichier 0 octet nefa
# nisy URL/anarana efa voarakitra tao amin'ny DB)
MIN_VALID_FILE_SIZE = 1024  # 1 KB — image miaraka amin'ny compression matetika mihoatra izany


def save_locally_from_bytes(
    content: bytes,
    folder: str,
    filename: str,
    base_url: Optional[str] = None,
) -> str:
    """
    Sauvegarder un fichier à partir d'un contenu bytes et retourner
    son URL COMPLÈTE (ex: "http://10.78.77.30:8000/uploads/profiles/
    3a9925f0-....jpeg"), enregistrée telle quelle en base de données.

    ✅ FIXÉ (BUG "photo de profil cassée après changement d'IP") :
    -----------------------------------------------------------------
    🐛 AVANT : l'URL était construite avec `settings.BASE_URL`, une
    valeur FIXE lue une seule fois depuis le fichier .env au
    démarrage du serveur. Si l'IP locale de la machine de
    développement changeait (autre réseau Wi-Fi, autre PC...) sans
    modifier le .env, toutes les nouvelles URLs enregistrées
    pointaient vers un hôte mort.

    ✅ APRÈS : la fonction accepte un paramètre `base_url` optionnel,
    calculé dynamiquement à partir de la requête HTTP RÉELLE reçue
    par FastAPI (`str(request.base_url)`, voir app/api/users.py).
    Cet hôte correspond TOUJOURS à l'adresse que le téléphone/client
    vient d'utiliser pour joindre le serveur à l'instant précis de
    l'upload — donc forcément la bonne IP actuelle, sans dépendre
    du .env.

    Si `base_url` n'est pas fourni (appel depuis un contexte sans
    requête HTTP, ex: script/tâche de fond), on retombe sur
    `settings.BASE_URL` comme avant, pour ne rien casser ailleurs.
    -----------------------------------------------------------------

    ✅ Sauvegarde dans uploads/{folder}/
    ✅ Vérifie que le fichier écrit sur disque a bien une taille non
       nulle après écriture (détection d'un enregistrement corrompu/vide).
    """
    try:
        upload_dir = f"uploads/{folder}"
        os.makedirs(upload_dir, exist_ok=True)

        file_extension = filename.split(".")[-1] if filename and "." in filename else "jpg"
        # ✅ FIXÉ : normalise l'extension (certains navigateurs envoient
        # des noms de fichier bizarres, ex: "blob", "image", sans point)
        if file_extension.lower() not in ("jpg", "jpeg", "png", "webp", "gif"):
            file_extension = "jpg"

        unique_name = f"{uuid.uuid4()}.{file_extension}"
        file_path = os.path.join(upload_dir, unique_name)

        with open(file_path, "wb") as f:
            f.write(content)

        # ✅ FIXÉ : vérification post-écriture — si le fichier écrit
        # est vide (0 octet), on le supprime immédiatement et on lève
        # une erreur explicite au lieu de renvoyer une URL "morte".
        written_size = os.path.getsize(file_path)
        if written_size == 0:
            os.remove(file_path)
            raise ValueError(
                f"Le fichier écrit est vide (0 octet) — le contenu envoyé par le client "
                f"ne contenait aucune donnée binaire (folder={folder})."
            )

        # ✅ Priorité au base_url dynamique (dérivé de la requête réelle),
        # fallback sur settings.BASE_URL si absent.
        resolved_base_url = (base_url or settings.BASE_URL).rstrip("/")
        relative_path = f"uploads/{folder}/{unique_name}".replace(os.sep, "/")
        file_url = f"{resolved_base_url}/{relative_path}"

        print(f"📸 Image sauvegardée localement ({written_size} octets): {file_url}")
        return file_url

    except ValueError:
        raise
    except Exception as e:
        print(f"❌ Local save failed: {e}")
        raise


def upload_image(
    file: UploadFile,
    folder: str = "general",
    public_id: Optional[str] = None,
    transformation: Optional[Dict[str, Any]] = None,
    base_url: Optional[str] = None,
) -> str:
    """
    Uploader une image (Cloudinary si configuré, sinon stockage local
    dans uploads/{folder}/).

    ✅ Nouveau paramètre `base_url` (optionnel) : hôte réel à utiliser
    pour construire l'URL du fichier local (voir save_locally_from_bytes
    pour l'explication complète du bug corrigé). Sans effet sur
    Cloudinary, qui a toujours sa propre URL absolue externe.

    ✅ FIXÉ (BUG PRINCIPAL — "sary manjavona amin'ny web") :
    - Vérifie la taille RÉELLE du contenu reçu AVANT toute tentative
      d'upload (Cloudinary ou local). Si le contenu est vide ou trop
      petit pour être une vraie image (< MIN_VALID_FILE_SIZE), on lève
      une HTTPException 400 claire IMMÉDIATEMENT.
    - Ne tente Cloudinary QUE s'il est réellement configuré.
    """
    contents = file.file.read()

    if not contents or len(contents) < MIN_VALID_FILE_SIZE:
        received_size = len(contents) if contents else 0
        print(
            f"❌ [upload_image] Contenu reçu invalide : {received_size} octet(s) "
            f"pour le fichier '{file.filename}' (content_type={file.content_type}). "
            f"Ceci indique généralement que le FormData envoyé par le client "
            f"(surtout sur le web) ne contenait pas le vrai binaire de l'image "
            f"— vérifiez que le frontend convertit bien l'URI en Blob réel "
            f"avant l'envoi (fetch(uri).then(r => r.blob()))."
        )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Fichier image invalide ou vide ({received_size} octet(s) reçu(s)). "
                "Veuillez réessayer l'envoi de la photo."
            ),
        )

    # 1️⃣ Cloudinary — uniquement s'il est réellement configuré
    if CLOUDINARY_CONFIGURED:
        try:
            upload_options = {
                "folder": f"mada_bienetre/{folder}",
                "use_filename": True,
                "unique_filename": True,
                "overwrite": True,
            }
            if public_id:
                upload_options["public_id"] = public_id
            if transformation:
                upload_options["transformation"] = transformation

            result = cloudinary.uploader.upload(contents, **upload_options)
            image_url = result.get("secure_url", "")
            if image_url:
                print(f"📸 Image uploadée sur Cloudinary: {image_url}")
                return image_url
            else:
                print("⚠️ Cloudinary n'a pas retourné d'URL, fallback local")
        except Exception as e:
            print(f"⚠️ Cloudinary upload failed: {e} — fallback local")

    # 2️⃣ Fallback (ou stockage principal si Cloudinary non configuré) : local
    print(f"🔄 Sauvegarde locale dans uploads/{folder}/ ({len(contents)} octets)")
    try:
        return save_locally_from_bytes(contents, folder, file.filename, base_url=base_url)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Impossible d'enregistrer l'image sur le serveur : {str(e)}",
        )


def upload_profile_image(file: UploadFile, user_id: int, base_url: Optional[str] = None) -> str:
    """Uploader une photo de profil — stockée dans uploads/profiles/{user_id}/"""
    return upload_image(file, f"profiles/{user_id}", base_url=base_url)


def upload_document(file: UploadFile, user_id: int, doc_type: str, base_url: Optional[str] = None) -> str:
    """Uploader un document d'identité ou certificat"""
    return upload_image(file, f"documents/{doc_type}/{user_id}", base_url=base_url)


def delete_image(url: str) -> bool:
    """
    Supprimer une image de Cloudinary ou locale.

    ✅ Extrait la partie "/uploads/..." peu importe l'hôte qui la
    précède (relative ou absolue, IP actuelle ou périmée), pour
    rester robuste même si l'URL enregistrée date d'avant un
    changement de réseau.
    """
    try:
        if not url:
            return True

        if "cloudinary" in url:
            parts = url.split("/")
            public_id = "/".join(parts[-2:]).split(".")[0]
            result = cloudinary.uploader.destroy(public_id)
            return result.get("result") == "ok"

        match = re.search(r"/uploads/.*$", url)
        if match:
            local_path = match.group(0).lstrip("/")
            if os.path.exists(local_path):
                os.remove(local_path)
                print(f"🗑️ Fichier local supprimé: {local_path}")
                return True
            print(f"ℹ️ Fichier déjà absent du disque: {local_path}")
            return True

        return True
    except Exception as e:
        print(f"❌ Delete failed: {e}")
        return False


def optimize_image(file: UploadFile) -> UploadFile:
    """Optimiser une image avant upload"""
    try:
        from PIL import Image
        import io

        contents = file.file.read()
        image = Image.open(io.BytesIO(contents))

        max_size = (1024, 1024)
        image.thumbnail(max_size, Image.Resampling.LANCZOS)

        output = io.BytesIO()
        image.save(output, format="JPEG", quality=85, optimize=True)
        output.seek(0)

        class BytesIOWrapper:
            def __init__(self, bytes_data):
                self.bytes_data = bytes_data
                self.position = 0

            def read(self, size=None):
                if size is None:
                    data = self.bytes_data[self.position:]
                    self.position = len(self.bytes_data)
                    return data
                data = self.bytes_data[self.position:self.position + size]
                self.position += len(data)
                return data

            def seek(self, offset, whence=0):
                if whence == 0:
                    self.position = offset
                elif whence == 1:
                    self.position += offset
                elif whence == 2:
                    self.position = len(self.bytes_data) + offset

        wrapper = BytesIOWrapper(output.getvalue())

        return UploadFile(
            filename=file.filename,
            file=wrapper,
            size=len(output.getvalue()),
        )
    except Exception as e:
        print(f"⚠️ Optimization failed: {e}")
        return file