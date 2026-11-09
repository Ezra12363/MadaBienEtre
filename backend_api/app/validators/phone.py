# app/validators/phone.py
"""
Validation / normalisation des numéros de téléphone.

Acceptés :
  - numéros malgaches, formats historiques conservés : 0341234567 ou +261341234567
  - numéros internationaux au format E.164 : +33612345678, +14155552671 ...
    (le + est obligatoire, 8 à 15 chiffres au total, le premier chiffre n'est pas 0)

Les espaces, tirets, points et parenthèses sont ignorés (« 034 12 345 67 »,
« +33 6 12 34 56 78 »). Les « 00 » initiaux sont convertis en « + ».
"""
import re
from typing import List, Optional

# Regex pour les `Field(pattern=...)` pydantic (valeur déjà nettoyée)
PHONE_REGEX = r"^(0[0-9]{9}|\+[1-9][0-9]{7,14})$"
_PHONE_RE = re.compile(PHONE_REGEX)

PHONE_ERROR = (
    "Numéro de téléphone invalide : utilisez le format malgache (034 12 345 67) "
    "ou international (+33 6 12 34 56 78)."
)


def clean_phone(value: Optional[str]) -> str:
    """Retire espaces/tirets/points/parenthèses et convertit « 00… » en « +… »."""
    p = re.sub(r"[\s\-.()]", "", str(value or ""))
    if p.startswith("00"):
        p = "+" + p[2:]
    return p


def is_valid_phone(value: Optional[str]) -> bool:
    return bool(_PHONE_RE.match(clean_phone(value)))


def normalize_phone_input(value: Optional[str]) -> Optional[str]:
    """Nettoie + valide ; lève ValueError si le numéro est invalide (pour les validators pydantic)."""
    if value is None or str(value).strip() == "":
        return value
    cleaned = clean_phone(value)
    if not _PHONE_RE.match(cleaned):
        raise ValueError(PHONE_ERROR)
    return cleaned


def phone_variants(value: Optional[str]) -> List[str]:
    """Écritures équivalentes d'un même numéro (0341234567 <-> +261341234567).

    Sert aux contrôles d'unicité : un numéro malgache saisi « 034… » et le même
    saisi « +261 34… » ne doivent pas pouvoir créer deux comptes.
    """
    p = clean_phone(value)
    if not p:
        return []
    variants = {p}
    if re.fullmatch(r"0[0-9]{9}", p):
        variants.add("+261" + p[1:])
    elif re.fullmatch(r"\+261[0-9]{9}", p):
        variants.add("0" + p[4:])
    return sorted(variants)
