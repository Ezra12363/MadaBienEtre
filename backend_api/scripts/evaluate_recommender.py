#!/usr/bin/env python
"""Évaluation de la recommandation sur des demandes simulées (mémoire §9.3.3).

Protocole : 134 demandes, 12 candidats chacune ; le « choix du client » est
l'utilité maximale selon un profil de sensibilité tiré parmi quatre (distance,
prix, qualité, disponibilité) + bruit ; les 45 dernières demandes forment le test.
Métriques : Hit@1, Hit@3, MRR, NDCG@3. Comparaison : aléatoire, plus proche,
meilleure note, moins cher, score pondéré 25/20/20/20/10/5, régression logistique apprise.

Usage (depuis backend/) :  python scripts/evaluate_recommender.py
Les valeurs obtenues dépendent du générateur ci-dessous : si elles diffèrent du
mémoire, c'est ce script qui fait foi (reproductible, graine 42).
"""
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app.ai import recommender as rec  # noqa: E402

SEED, N_REQ, N_CAND, N_TEST = 42, 134, 12, 45
CRITERIA = ["distance", "price", "availability", "rating", "experience", "massage_type"]
PROFILES = {"distance": 0, "price": 1, "quality": 3, "availability": 2}


def make_request(rng):
    cands = []
    for i in range(N_CAND):
        avail = None if rng.random() < 0.1 else (0.0 if rng.random() < 0.5 else float(rng.uniform(10, 240)))
        cands.append(rec.Candidate(
            i, float(rng.uniform(0.5, 10)), float(rng.uniform(25000, 60000)),
            float(rng.uniform(3.2, 5.0)), int(rng.integers(1, 150)), int(rng.integers(0, 15)),
            avail, bool(rng.random() < 0.6)))
    return cands


def subs(cands):
    ref = max(c.price for c in cands)
    return np.array([[v for v in rec.score_candidate(c, 10.0, ref, True).sub_scores.values()] for c in cands])


def metrics(ranks):  # rang (1 = premier) du choix du client
    r = np.array(ranks)
    return dict(hit1=np.mean(r == 1), hit3=np.mean(r <= 3), mrr=np.mean(1 / r),
                ndcg3=np.mean(np.where(r <= 3, 1 / np.log2(r + 1), 0.0)))


def main():
    rng = np.random.default_rng(SEED)
    reqs, S, choice = [], [], []
    for _ in range(N_REQ):
        c = make_request(rng); s = subs(c)
        w = np.full(6, 0.1); w[list(PROFILES.values())[rng.integers(0, 4)]] = 0.5
        u = s @ w + rng.normal(0, 0.1, N_CAND)
        reqs.append(c); S.append(s); choice.append(int(np.argmax(u)))
    train, test = range(N_REQ - N_TEST), range(N_REQ - N_TEST, N_REQ)

    from sklearn.linear_model import LogisticRegression
    X = np.vstack([S[i] for i in train]); y = np.concatenate([(np.arange(N_CAND) == choice[i]).astype(int) for i in train])
    lr = LogisticRegression(max_iter=1000).fit(X, y)

    def rank_of(order, i):
        return int(np.where(np.asarray(order) == choice[i])[0][0]) + 1

    w_cdc = np.array([rec.WEIGHTS[k] for k in CRITERIA])
    methods = {
        "Aléatoire": lambda i: rng.permutation(N_CAND),
        "Plus proche": lambda i: np.argsort([c.distance_km for c in reqs[i]]),
        "Meilleure note": lambda i: np.argsort([-rec.smoothed_rating(c.rating, c.review_count) for c in reqs[i]]),
        "Moins cher": lambda i: np.argsort([c.price for c in reqs[i]]),
        "Score pondéré (25/20/20/20/10/5)": lambda i: np.argsort(-(S[i] @ w_cdc)),
        "Régression logistique apprise": lambda i: np.argsort(-lr.predict_proba(S[i])[:, 1]),
    }
    print(f"n test = {len(test)} demandes")
    for name, f in methods.items():
        m = metrics([rank_of(f(i), i) for i in test])
        print(f"{name:36s} Hit@1={m['hit1']:.3f} Hit@3={m['hit3']:.3f} MRR={m['mrr']:.3f} NDCG@3={m['ndcg3']:.3f}")

    print("\nSensibilité aux pondérations")
    variants = {"Pondérations du cahier des charges": w_cdc}
    for label, idx in (("Distance + 10 points", 0), ("Prix + 10 points", 1), ("Note + 10 points", 3)):
        w = w_cdc.copy(); w[idx] += 0.10; variants[label] = w / w.sum()
    variants["Pondérations égales (1/6 chacune)"] = np.full(6, 1 / 6)
    for name, w in variants.items():
        m = metrics([rank_of(np.argsort(-(S[i] @ w)), i) for i in test])
        print(f"{name:36s} Hit@1={m['hit1']:.3f} Hit@3={m['hit3']:.3f} MRR={m['mrr']:.3f} NDCG@3={m['ndcg3']:.3f}")

    import time
    print("\nTemps de calcul du classement")
    for n in (50, 200, 1000):
        cs = [rec.Candidate(i, float(rng.uniform(.5, 10)), 40000, 4.5, 20, 5, 0.0, True) for i in range(n)]
        t = time.perf_counter()
        for _ in range(50):
            rec.rank_candidates(cs, max_distance_km=10, top_k=10)
        print(f"{n:5d} candidats : {(time.perf_counter() - t) / 50 * 1000:.2f} ms")


if __name__ == "__main__":
    main()
