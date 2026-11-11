#!/usr/bin/env python
"""Répare les photos de profil enregistrées sous forme de simple nom de fichier.

Symptôme : le journal montre « GET /therapist_17_profile.jpg 404 ». La colonne
users.profile_image contient « therapist_17_profile.jpg » au lieu de
« /uploads/profiles/therapist_17_profile.jpg ».

Pour chaque utilisateur concerné, le script cherche le fichier dans
backend/uploads/profiles (sous-dossiers compris) :
  * trouvé  -> profile_image = chemin relatif /uploads/profiles/...
  * absent  -> profile_image = NULL (l'app affiche alors l'avatar par défaut,
               au lieu de chercher une image inexistante)

Usage (depuis backend/) :
    python scripts/fix_profile_images.py            # simulation (n'écrit rien)
    python scripts/fix_profile_images.py --apply    # applique
"""
import argparse
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

BARE = re.compile(r"^[^/\\:?#\s]+\.(?:jpe?g|png|gif|webp|heic)$", re.I)
PROFILES = ROOT / "uploads" / "profiles"


def find_file(name: str):
    if not PROFILES.exists():
        return None
    for p in PROFILES.rglob(name):
        if p.is_file():
            return "/uploads/profiles/" + p.relative_to(PROFILES).as_posix()
    return None


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--apply", action="store_true")
    args = parser.parse_args()

    from app.core.database import SessionLocal
    from app.models.user import User

    db = SessionLocal()
    try:
        users = db.query(User).filter(User.profile_image.isnot(None)).all()
        fixed = cleared = 0
        for u in users:
            value = (u.profile_image or "").strip()
            if not BARE.match(value):
                continue
            target = find_file(value)
            if target:
                print(f"user {u.id}: {value} -> {target}")
                fixed += 1
            else:
                print(f"user {u.id}: {value} -> fichier introuvable, mis à NULL")
                cleared += 1
            if args.apply:
                u.profile_image = target
        if args.apply:
            db.commit()
        print(f"\n{fixed} corrigé(s), {cleared} mis à NULL "
              f"({'APPLIQUÉ' if args.apply else 'simulation : relancez avec --apply'})")
    finally:
        db.close()


if __name__ == "__main__":
    main()
