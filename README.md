# PME Québec : Le Simulateur d’affaires

Un jeu de simulation d’affaires réaliste, jouable dans le navigateur, pour apprendre à créer et à gérer une **PME au
Québec**. Conçu pour les étudiants de cégep en **Gestion de commerce** : marketing, ressources humaines, opérations,
finance, comptabilité et fiscalité québécoise et canadienne.

**▶ Jouer en ligne : https://UTILISATEUR.github.io/pme-quebec-simulateur/**

Aucune installation, aucun compte : le jeu est 100 % statique et les parties sont sauvegardées dans le navigateur.

---

## Ce que le jeu permet (Jalon 1)

- **Créer son entreprise** : nom, emplacement (rue commerciale, centre commercial, quartier résidentiel), équipement,
  aménagement et financement (mise de fonds et prêt bancaire, avec le ratio exigé par la banque).
- **1 tour = 1 mois**, parties de 12, 24, 36 ou 60 mois, 3 niveaux de difficulté.
- **Marketing** : prix par ligne de produits, qualité, publicité (rendements décroissants), notoriété, avis en ligne.
- **Ressources humaines** : embauche, fin d’emploi avec indemnité de préavis, salaire, heures, moral, démissions et
  le _vrai coût d’un employé_ (RRQ, RQAP, AE, FSS, CNT, CNESST, vacances 4 %, heures supplémentaires à 150 %).
- **Opérations** : heures d’ouverture, capacité de service, stock cible (ruptures ou produits périmés).
- **Ventes** : demande, clients perdus, panier moyen et veille concurrentielle (information partielle).
- **Finance** : états financiers produits par une **comptabilité en partie double** (état des résultats, bilan
  toujours équilibré, flux de trésorerie, journal général), ratios, seuil de rentabilité, prêt avec tableau
  d’amortissement, marge de crédit et prélèvements.
- **Concurrents IA** : « Le Géant » (chaîne à bas prix) et « Le Local branché » (café de spécialité), qui réagissent
  avec un délai.
- **Conjoncture** : taux directeur de la Banque du Canada, inflation, salaire minimum révisé chaque 1er mai.
- **Rapport mensuel pédagogique** : ce qui a fonctionné, ce qui n’a pas fonctionné, et **pourquoi**.
- **Glossaire** et infobulles (touche `I`), thème clair ou sombre, sauvegarde automatique et 3 emplacements,
  export/import de la partie en fichier `.json` (pratique pour la remettre à l’enseignant).

## Jouer au clavier

Le jeu est entièrement jouable sans souris.

| Touche                      | Action                                                                 |
| --------------------------- | ---------------------------------------------------------------------- |
| `T` `M` `R` `O` `V` `F` `J` | Tableau de bord, Marketing, RH, Opérations, Ventes, Finance, Juridique |
| `Espace`                    | Terminer le mois                                                       |
| `?`                         | Aide et liste des raccourcis                                           |
| `I`                         | Définition du terme ou de l’indicateur sélectionné                     |
| `Échap`                     | Fermer une fenêtre, revenir au tableau de bord                         |
| `Tab` / `Maj+Tab`           | Naviguer                                                               |
| `←` `→`                     | Ajuster un curseur de 1 % (`Maj` : 10 %)                               |

## Pour les enseignants

- Les **taux et paramètres réalistes** (fiscalité, cotisations, salaires, loyers, secteurs) sont dans `src/data/`,
  avec leur source officielle et leur date de vérification. On peut les mettre à jour sans toucher au code.
- La **graine** de la partie rend la simulation reproductible : deux équipes avec la même graine et les mêmes
  décisions obtiennent exactement les mêmes résultats.
- Les hypothèses de conception et les valeurs à confirmer sont dans [DECISIONS.md](DECISIONS.md); les sources sont
  dans [SOURCES.md](SOURCES.md).

## Développement

Prérequis : Node.js 22 ou plus récent.

```bash
npm install
npm run dev        # serveur de développement : http://localhost:5173/pme-quebec-simulateur/
npm test           # tests du moteur (Vitest)
npm run coverage   # tests + couverture (minimum 80 % sur src/engine)
npm run lint       # ESLint
npm run build      # typage + construction pour la production (dossier dist/)
```

Chaque push sur `main` lance le lint, les tests et la construction, puis publie le jeu sur GitHub Pages
(`.github/workflows/deploy.yml`). Le déploiement échoue si un test échoue.

### Architecture

```
src/
├─ engine/   moteur de simulation en TypeScript pur, sans React, déterministe (graine) et testé
│            accounting, statements, market, ai-competitors, payroll, loans, inventory, hr,
│            economy, customers, analyse, rapports, simulation, rng
├─ data/     données réalistes sourcées (fiscalite.ts, secteurs, villes, salaires, concurrents, glossaire)
├─ store/    état de l’interface (Zustand) et sauvegardes (localStorage)
├─ ui/       composants React par écran et par département
├─ scene/    scène 2D du commerce (SVG en blocs; PixiJS prévu au Jalon 6)
└─ i18n/     textes en français québécois et formatage (1 234,56 $, JJ/MM/AAAA)
tests/       tests Vitest (bilan équilibré sur 100 parties de 60 mois, paie, prêts, déterminisme…)
```

Stack : Vite, React 18, TypeScript (strict), Zustand, Tailwind CSS, Recharts, Vitest, ESLint et Prettier.

## Feuille de route

1. ✅ **Fondations** : moteur, café à Montréal, 2 concurrents, états financiers, sauvegarde, clavier, mise en ligne.
2. **Fiscalité et juridique** : formes juridiques, REQ, TPS/TVQ, impôts, paie complète, checklist de démarrage.
3. **Départements complets** : marketing détaillé, RH, opérations et stocks, financement.
4. **Monde vivant** : 7 secteurs, 8 villes, 5 concurrents, 60+ événements, conjoncture économique.
5. **Multijoueur local et pédagogie** : équipes en alternance, glossaire complet, conseiller, tutoriel, quiz.
6. **Finition** : scène animée, sons, équilibrage sur 1 000 parties, accessibilité et performance.

## Avertissement

Ce jeu est un outil pédagogique. Les taux sont ceux de 2026 et certaines valeurs sont des estimations (voir
DECISIONS.md). Il ne constitue pas un avis fiscal, comptable ou juridique. Tous les noms d’entreprises du jeu sont
fictifs.
