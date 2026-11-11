"""Recommandation de masseurs : 11 tests (Tableau 51)."""
import pytest

from app.ai.recommender import (
    WEIGHTS, Candidate, haversine_km, rank_candidates, smoothed_rating, suggest_when_empty,
)


def cand(i, d=2.0, price=40000, rating=4.5, n=20, exp=5, avail=0, offers=None):
    return Candidate(i, d, price, rating, n, exp, avail, offers)


def test_weights_sum_to_one():
    assert sum(WEIGHTS.values()) == pytest.approx(1.0)
    assert WEIGHTS == {"distance": .25, "price": .20, "availability": .20,
                       "rating": .20, "experience": .10, "massage_type": .05}


def test_haversine_zero():
    assert haversine_km(-18.88, 47.51, -18.88, 47.51) == pytest.approx(0.0, abs=1e-9)


def test_haversine_antananarivo_fianarantsoa():
    d = haversine_km(-18.8792, 47.5079, -21.4536, 47.0858)
    assert 285 < d < 295


def test_filter_by_budget_and_distance():
    cs = [cand(1, d=2, price=40000), cand(2, d=2, price=60000), cand(3, d=12, price=40000)]
    ids = [s.candidate.therapist_id for s in rank_candidates(cs, budget=50000, max_distance_km=10)]
    assert ids == [1]


def test_closest_first_on_equal_criteria():
    a, b = cand(1, d=5.0), cand(2, d=5.0)
    # mêmes critères hors distance : distances égales -> départage par identifiant
    assert [s.candidate.therapist_id for s in rank_candidates([b, a])] == [1, 2]
    near, far = cand(3, d=1.0), cand(4, d=3.0)
    assert rank_candidates([far, near], max_distance_km=10)[0].candidate.therapist_id == 3


def test_unavailable_therapist_is_demoted():
    ok, ko = cand(1, avail=0), cand(2, avail=None)
    ranked = rank_candidates([ko, ok])
    assert ranked[0].candidate.therapist_id == 1
    assert ranked[1].sub_scores["availability"] == 0.0


def test_massage_type_bonus():
    yes, no = cand(1, offers=True), cand(2, offers=False)
    ranked = rank_candidates([no, yes], type_requested=True)
    assert ranked[0].candidate.therapist_id == 1
    assert ranked[0].score - ranked[1].score == pytest.approx(0.05)


def test_bayesian_rating_smoothing():
    assert smoothed_rating(5.0, 1) < smoothed_rating(4.8, 100)
    ranked = rank_candidates([cand(1, rating=5.0, n=1), cand(2, rating=4.8, n=100)])
    assert ranked[0].candidate.therapist_id == 2


def test_empty_list_and_suggestion():
    assert rank_candidates([]) == []
    far = [cand(1, d=15, price=40000)]
    assert rank_candidates(far, max_distance_km=10) == []
    sug = suggest_when_empty(far, budget=50000, max_distance_km=10)
    assert sug.suggested_max_distance_km == 15
    assert "rayon" in sug.message


def test_score_bounds():
    best = cand(1, d=0, price=1, rating=5, n=1000, exp=10, avail=0, offers=True)
    worst = cand(2, d=10, price=50000, rating=0, n=0, exp=0, avail=None, offers=False)
    for s in rank_candidates([best, worst], budget=50000, max_distance_km=10, type_requested=True):
        assert 0.0 <= s.score <= 1.0


def test_top_k_limit():
    cs = [cand(i, d=i * 0.1) for i in range(1, 30)]
    assert len(rank_candidates(cs, top_k=10)) == 10
    assert len(rank_candidates(cs, top_k=3)) == 3
