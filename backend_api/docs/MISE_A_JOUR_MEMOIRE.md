# Mise à jour du mémoire avec les valeurs du CSV actuel

Le générateur d'origine (graine 42) n'est pas fourni : c'est donc l'option « mettre à jour les tableaux » qui est appliquée. Toutes les valeurs ci-dessous sont calculées par `scripts/train_models.py` sur `data/dataset_reservations_simule.csv` (6 000 lignes, 13 types) ; elles sont reproductibles.

## Tableau 39 — statistiques descriptives

| Variable | Moyenne | Écart-type | Minimum | Maximum |
|---|---|---|---|---|
| Durée (min) | 80,75 | 22,94 | 60,00 | 120,00 |
| Distance (km) | 4,45 | 2,55 | 0,30 | 15,00 |
| Heure | 16,32 | 2,83 | 8,00 | 20,00 |
| Jour | 4,32 | 1,98 | 1,00 | 7,00 |
| Expérience (années) | 5,53 | 2,87 | 1,00 | 10,00 |
| Indice de demande | 0,53 | 0,22 | 0,05 | 1,00 |
| Prix (Ar) | 52 797 | 20 897 | 21 500 | 147 000 |

Texte : prix moyen 52 797 Ar (écart-type 20 897 Ar), de 21 500 à 147 000 Ar ; durées : 49 % / 32 % / 19 % (60 / 90 / 120 min) ; distance moyenne 4,45 km.
Prix médian : 38 500 Ar (60 min), 54 500 (90 min), 69 000 (120 min). Corrélations avec le prix : durée 0,60, demande 0,18, heure 0,16. Massage relaxant 60 min : médiane 31 000 Ar, minimum 25 000 Ar.

## Tableau 50 — cinq meilleures combinaisons (MAE de validation croisée, 3 plis)

| Arbres | Taux | Profondeur | MAE (Ar) |
|---|---|---|---|
| 400 | 0,1 | 3 | 2 652 |
| 400 | 0,05 | 3 | 2 668 |
| 200 | 0,1 | 3 | 2 673 |
| 200 | 0,1 | 4 | 2 684 |
| 400 | 0,03 | 4 | 2 686 |

Configuration retenue : 400 arbres, taux 0,05, profondeur 3 → MAE de validation croisée 2 668 Ar (la meilleure de la grille, 400 / 0,1 / 3, est à moins de 1 % : écart de 0,6 %).

## Tableau 54 — modèles de prix sur le jeu de test (1 200 lignes)

| Modèle | MAE (Ar) | RMSE (Ar) | R² | MAPE |
|---|---|---|---|---|
| Règle métier (référence) | 4 277 | 5 485 | 0,929 | 8,47 % |
| Régression linéaire | 4 104 | 5 431 | 0,931 | 8,36 % |
| Forêt aléatoire | 2 887 | 3 896 | 0,964 | 5,49 % |
| Gradient Boosting (paramètres par défaut) | 2 924 | 4 016 | 0,962 | 5,54 % |
| Gradient Boosting (optimisé) | 2 738 | 3 702 | 0,968 | 5,25 % |

GB optimisé : MAE −36 % vs règle métier, −33 % vs régression linéaire. Validation croisée 5 plis : R² moyen 0,970 (écart-type 0,001). La règle métier de référence prend, comme base, la médiane 60 min par type du jeu d'apprentissage.

## Figure 58 — importance des variables

type 56,7 %, durée 38,1 %, heure 3,4 %, demande 0,8 %, expérience 0,6 %, distance 0,4 %, jour 0,0 %  (le texte du §9.3.1 « durée 58,1 % / type 27,3 % » doit être réécrit : sur ce CSV, le type domine)


## Tableau 55 — classifieurs d'acceptation (test : 1200 cas)

| Modèle | Exactitude | Précision | Rappel | F1 | AUC |
|---|---|---|---|---|---|
| Régression logistique | 0,937 | 0,937 | 0,946 | 0,942 | 0,983 |
| Forêt aléatoire | 0,930 | 0,930 | 0,941 | 0,936 | 0,977 |
| Gradient Boosting | 0,938 | 0,939 | 0,946 | 0,942 | 0,979 |

Taux d'acceptation moyen : 54,1 % (jeu d'acceptation simulé, graine 42). Matrice de confusion (régression logistique) : 510 refus et 614 acceptations bien prédits, 41 fausses acceptations, 35 faux refus.

## Figures à régénérer
17 (extrait `df.head()`, dimensions 6000 × 9), 18 (distribution des prix / prix par durée), 50 (courbe d'apprentissage : données dans `learning_curve` du rapport JSON), 56, 57, 58, 59, 60. Les tableaux 56–58 (recommandation simulée, temps de calcul) ne dépendent pas du CSV : inchangés.

## Autres valeurs à corriger dans le texte
Section 6.2.2.2 (« minimum 31 500 Ar », « médian 40 000 Ar ») et 8.4.1 (moyenne 65 392 Ar, min 31 500, max 161 500) : utiliser les valeurs ci-dessus. Chapitre 9.3.1 : « R² de 0,965 » → 0,968.