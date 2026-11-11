"""Tarification : 5 tests (Tableau 51)."""
from app.ai.pricing_rules import commission_split, rule_based_price, round_to_step


def test_price_grows_with_duration():
    p60, p90, p120 = (rule_based_price(30000, d, 4, 14) for d in (60, 90, 120))
    assert p60 < p90 < p120


def test_peak_hour_surcharge():
    assert rule_based_price(30000, 60, 4, 18) > rule_based_price(30000, 60, 4, 11)


def test_rounding_to_500():
    for v in (30123, 45249, 45251, 99999):
        assert round_to_step(v) % 500 == 0
    assert round_to_step(45249) == 45000 and round_to_step(45251) == 45500
    assert rule_based_price(33333, 75, 3.3, 15) % 500 == 0


def test_commission_10_percent():
    assert commission_split(50000, 10) == (5000, 45000)


def test_commission_12_percent():
    assert commission_split(50000, 12) == (6000, 44000)
