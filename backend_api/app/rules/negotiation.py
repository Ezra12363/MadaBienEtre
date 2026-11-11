"""Règles de négociation du prix, en logique pure (sans base ni FastAPI).

Reprend les règles du cahier des charges, vérifiées par les tests unitaires
(mémoire §9.1.1) :

  * prix plancher : le prix du client ne peut être inférieur au prix minimum
    du type de massage ;
  * le masseur peut accepter le prix initial du client ;
  * on ne peut pas accepter son propre prix ;
  * les contre-offres alternent (le masseur répond en premier, puis le client…) ;
  * 5 tours de contre-offres au maximum ;
  * après confirmation ou refus, plus aucune action n'est possible ;
  * à l'expiration, une négociation déjà confirmée reste confirmée.

Les routes (app/api/offers.py) appliquent ces mêmes règles sur la base ; ce module
sert de référence testable.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import List, Optional

CLIENT = "client"
THERAPIST = "therapist"

NEGOTIATING = "negotiating"
CONFIRMED = "confirmed"
REFUSED = "refused"
EXPIRED = "expired"

MAX_ROUNDS = 5


class NegotiationError(Exception):
    """Action interdite par les règles de négociation."""


@dataclass(frozen=True)
class Offer:
    party: str  # CLIENT ou THERAPIST
    price: float


@dataclass
class Negotiation:
    min_price: float
    status: str = NEGOTIATING
    offers: List[Offer] = field(default_factory=list)
    final_price: Optional[float] = None

    @property
    def last_offer(self) -> Offer:
        return self.offers[-1]

    @property
    def rounds(self) -> int:
        """Nombre de contre-offres (le prix initial du client n'en fait pas partie)."""
        return max(len(self.offers) - 1, 0)

    @property
    def is_closed(self) -> bool:
        return self.status in (CONFIRMED, REFUSED, EXPIRED)


def _other(party: str) -> str:
    return THERAPIST if party == CLIENT else CLIENT


def _ensure_open(neg: Negotiation) -> None:
    if neg.status == CONFIRMED:
        raise NegotiationError("La réservation est déjà confirmée.")
    if neg.status == REFUSED:
        raise NegotiationError("La négociation a été refusée.")
    if neg.status == EXPIRED:
        raise NegotiationError("La négociation a expiré.")


def create(client_price: float, min_price: float) -> Negotiation:
    """Ouvre une négociation avec le prix initial du client (plancher vérifié)."""
    if client_price < min_price:
        raise NegotiationError(f"Le prix doit être d'au moins {min_price:,.0f} Ar.".replace(",", " "))
    return Negotiation(min_price=min_price, offers=[Offer(CLIENT, float(client_price))])


def accept(neg: Negotiation, party: str) -> Negotiation:
    """`party` accepte l'offre en cours. Interdit d'accepter son propre prix."""
    _ensure_open(neg)
    if neg.last_offer.party == party:
        raise NegotiationError("Vous ne pouvez pas accepter votre propre offre.")
    neg.status = CONFIRMED
    neg.final_price = neg.last_offer.price
    return neg


def counter(neg: Negotiation, party: str, price: float) -> Negotiation:
    """`party` répond par une contre-offre (tour de parole, plancher, 5 tours max)."""
    _ensure_open(neg)
    if neg.last_offer.party == party:
        raise NegotiationError("Vous ne pouvez pas faire une contre-offre à votre propre offre.")
    if neg.rounds >= MAX_ROUNDS:
        raise NegotiationError(f"Limite de {MAX_ROUNDS} tours de contre-offres atteinte.")
    if price < neg.min_price:
        raise NegotiationError(f"Le prix doit être d'au moins {neg.min_price:,.0f} Ar.".replace(",", " "))
    neg.offers.append(Offer(party, float(price)))
    return neg


def refuse(neg: Negotiation, party: str) -> Negotiation:
    """`party` refuse l'offre en cours (jamais sa propre offre)."""
    _ensure_open(neg)
    if neg.last_offer.party == party:
        raise NegotiationError("Vous ne pouvez pas rejeter votre propre offre.")
    neg.status = REFUSED
    return neg


def expire(neg: Negotiation) -> Negotiation:
    """Expiration : une négociation confirmée (ou déjà refusée) garde son état."""
    if neg.status in (CONFIRMED, REFUSED):
        return neg
    neg.status = EXPIRED
    return neg
