#!/usr/bin/env python
"""Entraîne et sérialise les modèles IA de Mada Bien-être.

Usage (depuis backend/) :
    python scripts/train_models.py              # grille complète (27 combinaisons)
    python scripts/train_models.py --fast       # sans grille ni comparaisons
    python scripts/train_models.py --csv data/dataset_reservations_simule.csv

Produit dans backend/models/ :
    price_gradient_boosting_v1.joblib      modèle de prix conseillé
    acceptance_logistic_v1.joblib          modèle de probabilité d'acceptation
    price_training_report.json             métriques (Tableaux 50, 54 ; figures 56–58)
    acceptance_training_report.json        métriques (Tableau 55 ; figures 59–60)
"""

import argparse
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from app.ai import ml_models as ml  # noqa: E402


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--csv", default=str(ml.DATASET_PATH))
    parser.add_argument("--fast", action="store_true", help="sans grille ni comparaisons")
    args = parser.parse_args()

    df = ml.load_dataset(Path(args.csv))
    print(f"Jeu de données : {len(df)} réservations, {df['type'].nunique()} types")

    price = ml.train_price_model(df, run_grid=not args.fast, full_report=not args.fast)
    path = ml.save_artifact(price, ml.PRICE_MODEL_FILE)
    ml.save_report(price["report"], "price_training_report.json")
    m = price["report"]["metrics_test"]
    print(f"[prix] {path.name}  MAE={m['mae']:.0f} Ar  RMSE={m['rmse']:.0f}  R²={m['r2']:.3f}  MAPE={m['mape']:.2f} %")

    acc = ml.train_acceptance_model(df, full_report=not args.fast)
    path = ml.save_artifact(acc, ml.ACCEPTANCE_MODEL_FILE)
    ml.save_report(acc["report"], "acceptance_training_report.json")
    a = acc["report"]["metrics_test"]
    print(f"[acceptation] {path.name}  accuracy={a['accuracy']:.3f}  AUC={a['auc']:.3f}  taux={acc['report']['acceptance_rate']:.1%}")


if __name__ == "__main__":
    main()
