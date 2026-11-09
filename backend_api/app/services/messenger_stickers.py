# app/services/messenger_stickers.py
# Catalogue de stickers (statiques et animés). Un sticker = un id stable ;
# l'application affiche le grand emoji (et l'anime si `animated` est vrai).
# Ajouter un pack = ajouter une entrée ici (aucune migration).
from typing import Dict, List, Optional

STICKER_PACKS: List[Dict] = [
    {
        "id": "mada",
        "name": "Mada",
        "animated": False,
        "items": [
            ("mada_hello", "👋", "Salama"),
            ("mada_thanks", "🙏", "Misaotra"),
            ("mada_ok", "👌", "D'accord"),
            ("mada_love", "🥰", "J'adore"),
            ("mada_smile", "😊", "Sourire"),
            ("mada_palm", "🌴", "Ravinala"),
            ("mada_lemur", "🐒", "Gidro"),
            ("mada_sun", "☀️", "Soleil"),
        ],
    },
    {
        "id": "bienetre",
        "name": "Bien-être",
        "animated": False,
        "items": [
            ("be_massage", "💆", "Massage"),
            ("be_relax", "😌", "Détente"),
            ("be_candle", "🕯️", "Bougie"),
            ("be_lotus", "🪷", "Lotus"),
            ("be_tea", "🍵", "Thé"),
            ("be_spa", "🧖", "Spa"),
            ("be_heart", "💚", "Bien-être"),
            ("be_sleep", "😴", "Repos"),
        ],
    },
    {
        "id": "service",
        "name": "Service",
        "animated": False,
        "items": [
            ("sv_onway", "🚗", "En route"),
            ("sv_arrived", "📍", "Arrivé(e)"),
            ("sv_late", "⏰", "En retard"),
            ("sv_done", "✅", "Terminé"),
            ("sv_pay", "💰", "Paiement"),
            ("sv_star", "⭐", "5 étoiles"),
            ("sv_wait", "⏳", "Un instant"),
            ("sv_sorry", "🙇", "Désolé(e)"),
        ],
    },
    {
        "id": "anime",
        "name": "Animés",
        "animated": True,
        "items": [
            ("an_heart", "❤️", "Cœur"),
            ("an_clap", "👏", "Bravo"),
            ("an_party", "🎉", "Fête"),
            ("an_laugh", "😂", "Rire"),
            ("an_fire", "🔥", "Feu"),
            ("an_wow", "😮", "Wow"),
            ("an_thumb", "👍", "Super"),
            ("an_sparkle", "✨", "Magique"),
        ],
    },
]

_INDEX: Dict[str, Dict] = {}
for _pack in STICKER_PACKS:
    for _sid, _emoji, _label in _pack["items"]:
        _INDEX[_sid] = {
            "id": _sid,
            "emoji": _emoji,
            "label": _label,
            "pack_id": _pack["id"],
            "animated": bool(_pack["animated"]),
        }


def get_sticker(sticker_id: str) -> Optional[Dict]:
    return _INDEX.get(sticker_id)


def catalog() -> List[Dict]:
    return [
        {
            "id": p["id"],
            "name": p["name"],
            "animated": p["animated"],
            "items": [_INDEX[i[0]] for i in p["items"]],
        }
        for p in STICKER_PACKS
    ]
