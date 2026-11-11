"""Négociation : 9 tests (Tableau 51)."""
import pytest

from app.rules import negotiation as n
from app.rules.negotiation import CLIENT, THERAPIST, NegotiationError


def test_floor_price_on_creation():
    with pytest.raises(NegotiationError):
        n.create(20000, min_price=30000)
    assert n.create(30000, min_price=30000).status == n.NEGOTIATING


def test_therapist_accepts_initial_price():
    neg = n.accept(n.create(40000, 30000), THERAPIST)
    assert neg.status == n.CONFIRMED and neg.final_price == 40000


def test_cannot_accept_own_price():
    neg = n.create(40000, 30000)
    with pytest.raises(NegotiationError):
        n.accept(neg, CLIENT)


def test_counter_offer_scenario():
    neg = n.create(40000, 30000)
    n.counter(neg, THERAPIST, 50000)
    n.counter(neg, CLIENT, 45000)
    n.accept(neg, THERAPIST)
    assert neg.status == n.CONFIRMED and neg.final_price == 45000


def test_turn_alternation():
    neg = n.create(40000, 30000)
    with pytest.raises(NegotiationError):
        n.counter(neg, CLIENT, 42000)  # le client ne répond pas à sa propre offre
    n.counter(neg, THERAPIST, 50000)
    with pytest.raises(NegotiationError):
        n.counter(neg, THERAPIST, 48000)


def test_limit_of_five_rounds():
    neg = n.create(40000, 30000)
    party = THERAPIST
    for i in range(n.MAX_ROUNDS):
        n.counter(neg, party, 45000 + i * 500)
        party = CLIENT if party == THERAPIST else THERAPIST
    with pytest.raises(NegotiationError):
        n.counter(neg, party, 46000)


def test_blocked_after_confirmation():
    neg = n.accept(n.create(40000, 30000), THERAPIST)
    with pytest.raises(NegotiationError):
        n.counter(neg, THERAPIST, 45000)
    with pytest.raises(NegotiationError):
        n.refuse(neg, THERAPIST)


def test_confirmed_state_kept_on_expiry():
    neg = n.accept(n.create(40000, 30000), THERAPIST)
    assert n.expire(neg).status == n.CONFIRMED
    assert n.expire(n.create(40000, 30000)).status == n.EXPIRED


def test_blocked_after_refusal():
    neg = n.refuse(n.create(40000, 30000), THERAPIST)
    assert neg.status == n.REFUSED
    with pytest.raises(NegotiationError):
        n.accept(neg, THERAPIST)
