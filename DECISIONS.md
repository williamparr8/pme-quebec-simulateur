# Décisions de conception

Ce document explique les choix faits pendant le développement, les hypothèses du modèle et les valeurs qui restent à
confirmer. Il est mis à jour à chaque jalon.

## Valeurs à vérifier (`// À VÉRIFIER` dans le code)

| Valeur                                                      | Fichier                  | Valeur utilisée                 | Pourquoi elle est incertaine                                                                                  |
| ----------------------------------------------------------- | ------------------------ | ------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Cotisation CNT (normes du travail) 2026                     | `src/data/fiscalite.ts`  | 0,06 %                          | Taux reconduit depuis plusieurs années, non confirmé pour 2026                                                |
| Taux CNESST de l’unité « restaurants » 2026                 | `src/data/secteurs.json` | 1,75 $ par 100 $                | Seul le taux moyen 2026 (1,54 $) a été trouvé; le taux de l’unité reste à confirmer                           |
| FSS au-delà de 1 M$ de masse salariale                      | `src/engine/payroll.ts`  | 1,5 × le taux de base           | Approximation; le taux progressif officiel sera codé au Jalon 2 (sans effet pour une PME de la taille du jeu) |
| Frais de traitement des cartes                              | `src/data/fiscalite.ts`  | 2,2 % sur 85 % des ventes       | Varie selon le fournisseur (débit, crédit, Interac)                                                           |
| Salaire médian d’un barista à Montréal                      | `src/data/salaires.json` | 17,25 $/h                       | Estimé à partir des médianes de Guichet-Emplois d’autres régions (Toronto 17,60 $, Halifax 16,75 $)           |
| Loyers commerciaux à Montréal                               | `src/data/villes.json`   | 24 $ à 46 $/pi² + frais communs | Estimations cohérentes avec les loyers bruts de 40 à 60 $/pi² rapportés pour les rues prisées                 |
| Frais fixes d’un café (électricité, assurances, comptable…) | `src/data/secteurs.json` | ≈ 1 970 $/mois                  | Estimations pour un local de 1 200 pi²                                                                        |

## Hypothèses du modèle

### Calendrier et taux

- La partie commence le **1er janvier 2027** pour que les exercices financiers correspondent aux années civiles
  (obligatoire pour une entreprise individuelle). Les **taux de 2026** sont utilisés, faute de taux 2027 publiés.
- Le salaire minimum est révisé **chaque 1er mai**, comme au Québec. Après 2026, le jeu simule une hausse de 3 % par
  année (hypothèse), arrondie à 0,05 $.
- Le taux directeur suit un calendrier de 8 annonces par année; il varie par tranches de 0,25 point selon l’écart
  entre l’inflation simulée et la cible de 2 %. Le taux préférentiel = taux directeur + 2,20 points.

### Comptabilité

- La comptabilité est tenue **en cents entiers** : la balance de vérification est exactement nulle et le bilan est
  toujours équilibré (testé sur 100 parties de 60 mois).
- L’état des flux de trésorerie utilise la **méthode directe** (plus parlante pour des étudiants). Chaque mouvement
  d’encaisse est obligatoirement classé (exploitation, investissement, financement); les intérêts payés sont classés
  en exploitation (choix permis par les NCECF).
- La clôture de l’exercice (31 décembre) vire les produits, les charges et les prélèvements au compte Capital.
- Amortissement comptable linéaire : équipement sur sa durée de vie (4 à 7 ans), améliorations locatives sur la durée
  du bail (5 ans). La DPA fiscale arrive au Jalon 2.
- Les fournisseurs sont payés **30 jours** plus tard (comptes fournisseurs); les cotisations de l’employeur sont
  remises le mois suivant (remises mensuelles).

### Jalon 1 : simplifications temporaires

- **Pas encore de TPS/TVQ ni d’impôt** : les prix sont « avant taxes ». En entreprise individuelle, l’impôt est de toute
  façon payé personnellement par le propriétaire et n’apparaît pas aux états financiers de l’entreprise.
- **Paie** : les salaires bruts sont versés en entier; les retenues à la source de l’employé (impôts, RRQ, RQAP, AE)
  arrivent au Jalon 2. Les charges de l’employeur, l’indemnité de vacances (4 %) et les heures supplémentaires
  (150 % au-delà de 40 h) sont déjà calculées. L’indemnité de préavis n’entraîne pas de cotisations dans ce jalon.
- **Stocks** : réapprovisionnement automatique vers un stock cible en jours. Point de commande, QEC, fournisseurs
  multiples et taux de change : Jalon 3.
- **Scène 2D** en SVG plutôt qu’en PixiJS (plus léger, suffisant pour ce jalon). PixiJS est prévu au Jalon 6.
- La forme juridique est fixée à l’**entreprise individuelle**; les autres formes arrivent au Jalon 2.

### Modèle de marché

- **Logit multinomial avec option « ailleurs »** : chaque commerce a une utilité (prix, qualité perçue, service,
  ambiance, note en ligne, heures d’ouverture, emplacement). Seuls les clients qui le connaissent le considèrent
  (attrait = notoriété × e^utilité). L’option « ailleurs » rend la demande totale sensible au niveau général des prix.
- **Capacité** : clients servis = heures travaillées × 6,5 clients par heure (moyenne sur la journée, pointes
  comprises) × productivité selon le moral. 60 % des clients refoulés par un commerce plein essaient un concurrent.
- **Notoriété** : publicité à rendements décroissants (1 − e^(−budget/3000)), visibilité de l’emplacement,
  bouche-à-oreille selon les clients satisfaits, oubli de 7 % par mois.
- **Avis en ligne** : 0,8 % des clients laissent un avis; les premiers avis font beaucoup bouger la note, puis elle se
  stabilise (poids des anciens avis plafonné à 250).
- **Saisonnalité du café** : creux en juillet (vacances de la construction, départ des étudiants), sommet à l’automne
  et en décembre.
- Les sensibilités (prix 2,5; qualité 1,6; service 1,0; note 0,5; ambiance 0,6; heures 0,6) et le marché potentiel de
  Montréal (21 000 visites par mois dans la zone) sont des **paramètres de conception** calibrés pour obtenir des
  résultats plausibles (voir ci-dessous). Ils sont dans `src/data/` et peuvent être ajustés.

### Concurrents IA

- **Le Géant** riposte aux baisses de prix importantes (joueur plus de 4 % sous son prix) avec 2 à 3 mois de délai.
- **Le Local branché** ne fait pas de guerre de prix : il répond par la qualité et la publicité quand sa part baisse.
- Les concurrents ont une capacité limitée et des finances simplifiées (ventes, coût des marchandises, frais fixes).
- Les joueurs ne voient que l’information publique : prix, notes, et part de marché estimée à 5 points près.

## Calibration (Jalon 1)

Simulations de 36 mois, 10 graines par stratégie, difficulté « Réaliste » (`CALIBRATION=1 npx vitest run tests/calibration.test.ts --silent=false`) :

| Stratégie                                      | Bénéfice cumulé moyen (3 ans) | Faillites |
| ---------------------------------------------- | ----------------------------- | --------- |
| Aucune gestion du personnel                    | ≈ 5 000 $                     | 4 / 10    |
| Gestionnaire actif (embauche selon la demande) | ≈ 180 000 $                   | 0 / 10    |
| Actif, qualité supérieure, prix +8 %           | ≈ 210 000 $                   | 0 / 10    |
| Actif, prix +15 %                              | ≈ 102 000 $                   | 0 / 10    |
| Actif, pub 4 000 $/mois                        | ≈ 101 000 $                   | 0 / 10    |

À maturité, un café bien géré fait de 40 000 $ à 55 000 $ de ventes par mois, avec une marge brute de 66 à 68 % et une
main-d’œuvre de 25 à 30 % des ventes, ce qui correspond aux repères de l’industrie. Le bénéfice d’une entreprise
individuelle inclut la rémunération du travail du propriétaire (50 h par semaine par défaut).

## Accessibilité

- Toutes les actions sont accessibles au clavier; le focus est toujours visible (anneau orange foncé en mode clair,
  ambre en mode sombre, contraste ≥ 3:1) et distinct de la couleur d’accent.
- Les statuts (danger, attention, succès) sont toujours accompagnés d’une icône et d’un libellé, jamais de la couleur seule.
- Les graphiques utilisent une palette validée pour le daltonisme, une légende et un tableau de données.
- Les animations respectent `prefers-reduced-motion`.
- La barre d’espace termine le mois seulement si aucun bouton n’a le focus (sinon, elle active le bouton, comme le
  veut la norme d’accessibilité); une fenêtre de confirmation évite les fins de mois accidentelles.
