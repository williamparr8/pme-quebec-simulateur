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

### Valeurs ajoutées au Jalon 2

| Valeur                                        | Fichier                   | Valeur utilisée | Pourquoi elle est incertaine                                                       |
| --------------------------------------------- | ------------------------- | --------------- | ---------------------------------------------------------------------------------- |
| Montant personnel de base du Québec 2026      | `src/data/fiscalite.ts`   | 18 952 $        | 18 571 $ (2025) indexé de 2,05 %; une source secondaire indiquait un autre montant |
| Taux RQAP des travailleurs autonomes 2026     | `src/data/fiscalite.ts`   | 0,764 %         | Estimé à partir du taux 2025 et de la baisse des taux salariés de 2026             |
| Constitution fédérale (Corporations Canada)   | `src/data/fiscalite.ts`   | 200 $           | Frais de dépôt en ligne habituels, non revérifiés                                  |
| Immatriculation au REQ d’une société fédérale | `src/data/fiscalite.ts`   | 397 $           | Assimilée au tarif de constitution d’une société du Québec                         |
| Taux d’intérêt sur les soldes fiscaux dus     | `src/data/fiscalite.ts`   | 7 % par an      | Taux prescrits de Revenu Québec et de l’ARC non revérifiés                         |
| Coûts des permis et montants des amendes      | `src/data/demarches.json` | 380 $ à 3 000 $ | Varient selon la municipalité et la gravité; ordres de grandeur pédagogiques       |
| Part taxable des achats d’un café             | `src/data/secteurs.json`  | 25 %            | Aliments de base détaxés; emballages et fournitures taxables                       |

### Valeurs ajoutées au Jalon 3

| Valeur                                                        | Fichier                      | Valeur utilisée                              | Pourquoi elle est incertaine                                                              |
| ------------------------------------------------------------- | ---------------------------- | -------------------------------------------- | ----------------------------------------------------------------------------------------- |
| CPM, audiences, couverture et conversion des 10 canaux        | `src/data/marketing.json`    | CPM de 6 $ (affichage) à 180 $ (circulaires) | Ordres de grandeur pour une zone urbaine; varient beaucoup selon le ciblage               |
| Commission des plateformes de livraison                       | `src/data/marketing.json`    | 30 % des ventes livrées                      | Taux courant des grandes plateformes; négociable                                          |
| Sensibilités et paniers des 4 personas                        | `src/data/personas.json`     | multiplicateurs de 0,4 à 1,8                 | Estimations de conception, à valider par des études locales                               |
| Salaires : aide-cuisinier, commis comptable, resp. marketing  | `src/data/salaires.json`     | 16,90 $, 25 $ et 30 $/h                      | Estimations; seuls le cuisinier (20 $) et le gérant (24,50 $) viennent de Guichet-Emplois |
| Prix relatifs, délais, fiabilité et minimums des fournisseurs | `src/data/fournisseurs.json` | indices de 0,78 à 1,15                       | Fournisseurs fictifs, ordres de grandeur                                                  |
| Frais de petite commande sous le minimum                      | `src/engine/inventory.ts`    | 15 % du minimum                              | Pratique courante, montant variable                                                       |
| Taux Futurpreneur, BDC, fonds locaux, Créavenir               | `src/data/financement.json`  | pref. + 3 %, pref. + 4 %, 7 %, pref. + 1,5 % | Taux selon le dossier et la région; conditions simplifiées                                |
| Montants maximaux du financement de démarrage                 | `src/data/financement.json`  | 30 000 $ à 150 000 $ selon la source         | Plafonds simplifiés pour un projet de café                                                |
| Coûts des formations et des avantages sociaux                 | `src/data/rh.json`           | 110 $ à 900 $; 15 $ à 160 $/employé/mois     | Prix fixés par les formateurs et les assureurs                                            |
| Amende du MAPAQ sans personne formée en hygiène               | `src/engine/simulation.ts`   | 1 500 $                                      | Le montant dépend de l’infraction                                                         |
| Règlements des plaintes (normes du travail, harcèlement)      | `src/data/evenements.json`   | 1 500 $ à 5 000 $                            | Ordres de grandeur pédagogiques                                                           |
| Valeur accordée par un investisseur providentiel              | `src/engine/financement.ts`  | 2 × la mise de fonds × (0,6 + score du plan) | Règle simplifiée; en réalité négociée au cas par cas                                      |

### Valeurs ajoutées au Jalon 4

| Valeur                                                           | Fichier                      | Valeur utilisée                                     | Pourquoi elle est incertaine                                                         |
| ---------------------------------------------------------------- | ---------------------------- | --------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Taux CNESST des 6 nouveaux secteurs                              | `src/data/secteurs.json`     | de 1,05 % (coiffure) à 3,4 % (paysagement)          | Estimations autour du taux moyen de 1,54 $ par 100 $; le vrai taux dépend de l’unité |
| Prix, coûts, taux d’achat et temps de production des produits    | `src/data/secteurs.json`     | ex. coupe 48 $ et 60 min, table 2 250 $ et 24 h     | Ordres de grandeur pour une PME québécoise, calibrés pour des résultats plausibles   |
| Potentiel des marchés par secteur et par ville                   | `src/data/villes.json`       | de 1 650 (paysagement) à 28 600 visites (café, MTL) | Paramètres de conception, ajustés par la calibration                                 |
| Loyers hors de Montréal                                          | `src/data/villes.json`       | rue : de 18 $ (Rimouski) à 30 $/pi² (Laval)         | Estimations; seul le loyer industriel de Québec (13,41 $) vient d’un rapport (CBRE)  |
| Revenu médian des ménages (6 villes)                             | `src/data/villes.json`       | de 60 000 $ à 80 000 $                              | Seuls le Québec (72 500 $) et Montréal (66 500 $) sont confirmés (Recensement 2021)  |
| Indice des salaires et intensité de la concurrence des villes    | `src/data/villes.json`       | indices de 0,94 à 1,03 et de 0,8 à 1,1              | Estimations de conception                                                            |
| Salaires des nouveaux postes (vendeur, coiffeur, paysagiste…)    | `src/data/salaires.json`     | de 17 $ à 26 $/h                                    | Estimations inspirées de Guichet-Emplois; les pourboires des coiffeurs sont ignorés  |
| 36 nouveaux fournisseurs                                         | `src/data/fournisseurs.json` | indices de 0,72 à 1,18                              | Fournisseurs fictifs, ordres de grandeur                                             |
| Frais d’expédition (commerce en ligne) et carburant (paysagiste) | `src/data/secteurs.json`     | 6,50 $ par commande; 12 $ par client par mois       | Moyennes nettes des frais facturés aux clients                                       |
| Coût des permis RACJ, pesticides et Loi 25                       | `src/data/demarches.json`    | 450 $, 400 $ et 600 $                               | Les tarifs varient (catégorie de permis, ville, honoraires d’un avocat)              |
| Paramètres des 5 personnalités de concurrents                    | `src/data/concurrents.json`  | parts de capacité et de publicité, marge visée      | Paramètres de conception                                                             |
| Montants et probabilités des 63 nouveaux événements              | `src/data/evenements.json`   | dépenses de 200 $ à 9 000 $                         | Ordres de grandeur pédagogiques                                                      |
| Phases du cycle économique et probabilités de transition         | `src/engine/economy.ts`      | récession : chômage 7,8 %, confiance 0,89           | Modèle simplifié; une récession dure environ 9 mois en moyenne                       |

## Hypothèses du modèle

### Monde vivant (Jalon 4)

**Secteurs**

- Les 7 secteurs partagent le même moteur; tout ce qui les distingue est dans `src/data/secteurs.json` : produits
  (prix, coût, taux d’achat, élasticité, conservation, saisonnalité propre, taxable ou détaxé), temps de production,
  postes et équipe de départ, emplacements permis, importance de l’achalandage, fournisseurs, nouveaux produits,
  produit vendu aux entreprises, investissements, initiatives écoresponsables, efficacité des canaux de publicité,
  permis, cyclicité et croissance tendancielle du marché.
- Une « visite » est un client servi (café, boutique, salon, épicerie), une commande (commerce en ligne) ou un compte
  client actif ce mois-ci (paysagement, avec des forfaits mensuels d’entretien l’été et de déneigement l’hiver).
- **Production** : chaque produit fabriqué ou service rendu exige des minutes de travail (ex. 60 min pour une coupe,
  24 h pour une table). La capacité vient des heures des employés de production (× compétence × moral) et d’une part
  des heures du propriétaire (60 % pour un coiffeur ou un ébéniste, 0 % au café). Les heures non utilisées un jour
  servent les jours suivants du même mois. Tous les professionnels d’un salon partagent le même temps (un coiffeur
  peut faire un soin) : simplification assumée.
- **Taxes par produit** : les produits détaxés (fromages, épicerie de base, café en grains) ne portent pas de TPS ni
  de TVQ, mais donnent droit aux CTI et RTI; les rabais sont répartis entre les ventes taxables et détaxées. Les
  fournitures exonérées n’existent pas dans les secteurs du jeu.
- **Frais variables** : frais d’expédition nets par commande (en ligne) et carburant par client (paysagement).
- **Emplacement** : l’effet de l’achalandage et de la visibilité est multiplié par l’importance de l’emplacement du
  secteur (1,2 pour une boutique, 0,1 pour un paysagiste, 0 en ligne). Un commerce en ligne a seulement un entrepôt.
- **Ventes aux entreprises** : chaque secteur (sauf le salon) a un produit B2B avec ses quantités, ses clients types,
  sa saisonnalité des appels d’offres et un coursier ou non (traiteur, uniformes brodés, cadeaux d’entreprise,
  contrats d’entretien et de déneigement, ventes aux détaillants, paniers-cadeaux).

**Villes**

- 8 villes avec leur population, leur revenu médian, le chômage de leur région (août 2026), un indice des salaires,
  l’intensité de la concurrence, le potentiel de chaque marché et 5 emplacements (rue, centre commercial, quartier
  résidentiel, local industriel, 100 % en ligne).
- Revenu médian : la sensibilité au prix est multipliée par √(72 500 $ ÷ revenu médian de la ville).
- Chômage : la pénurie de main-d’œuvre vaut 0,95 − 7 × chômage (bornée), réduite de 25 % l’été (étudiants). Moins de
  candidats, des attentes plus élevées et plus de départs quand le chômage est bas.

**Conjoncture**

- Chaîne de Markov à 5 phases (expansion, croissance stable, ralentissement, récession, reprise). Chaque mois, la
  confiance des consommateurs, le chômage et l’inflation se rapprochent des valeurs typiques de la phase. En
  récession, la Banque du Canada baisse plus souvent son taux et le dollar canadien s’affaiblit un peu.
- Effet sur la demande : 1 + cyclicité × (confiance − 1); la cyclicité va de 0,6 (coiffure) à 1,5 (meubles). Les
  clients deviennent aussi plus sensibles au prix quand la confiance baisse.
- Le risque de récession est réduit en mode Facile (× 0,6) et augmenté en mode Expert (× 1,5).

**Concurrents**

- 5 personnalités : le Géant (prix bas, gros budget publicitaire, renfloué par son siège social), le Local branché
  (qualité et image, ne fait pas de guerre de prix), l’Agressif (riposte vite aux baisses de prix et copie les bonnes
  idées des joueurs : livraison, fidélité, écoresponsabilité, nouveaux produits), le Prudent (réagit lentement) et le
  Nouveau joueur (arrive entre le 6e et le 18e mois, plus tôt en mode Expert, financé par du capital de risque).
- Les frais fixes de chaque concurrent sont estimés à la création pour qu’il atteigne sa marge visée dans un marché
  moyen (moyenne des 12 mois, avec un nouvel entrant typique et le Nouveau joueur installé). Un concurrent qui perd
  des clients perd donc de l’argent : après 3 mois de trésorerie négative, il peut être racheté par le Géant
  (12 % par mois) et il fait faillite s’il perd plus de 2 mois de frais fixes ou reste 8 mois dans le rouge.
- Les noms et les descriptions des concurrents dépendent du secteur; ils sont fictifs.

**Événements**

- 73 événements (dont les 10 dilemmes RH du Jalon 3) dans 8 catégories, avec une condition d’apparition, parfois des
  secteurs et des mois, un poids, 2 à 4 choix et une leçon d’affaires. Au plus un événement à la fois; le même
  événement ne revient pas avant 12 mois.
- Probabilité mensuelle : 35 % (Facile), 45 % (Réaliste), 55 % (Expert). Le poids des événements négatifs est
  multiplié par 0,5 en Facile et 1,4 en Expert; celui des vérifications fiscales par 2,5 en Expert.
- Nouveaux effets : demande, coûts des marchandises, capacité, frais par client, pénurie et délais de livraison
  temporaires; fermeture; perte de stock; note et image; encaissements (subvention, assurance, cachet); revenus
  récurrents; hausse de loyer; changement de prix ou de publicité; faillite d’un fournisseur; embauche; recouvrement
  ou radiation d’une créance; arrivée ou fermeture d’un concurrent; vente de l’entreprise (fin de la partie);
  effets conditionnels (« si l’entreprise est assurée »).
- Offre de rachat : à partir du 18e mois, si l’entreprise est rentable; prix ≈ 1,1 × la valeur utilisée pour un
  investisseur (le plus élevé des capitaux propres et de 4 × le bénéfice des 12 derniers mois).

### Départements complets (Jalon 3)

**Marketing**

- **Canaux** : impressions = budget ÷ CPM × 1 000; portée = 1 − e^(−impressions ÷ (fréquence efficace × audience));
  gain de notoriété dans un segment = portée × couverture × conversion × affinité du segment. Les gains de plusieurs
  canaux se combinent (1 − Π(1 − gain)) : diversifier rapporte plus que tout mettre dans un canal. Sous l’achat
  minimal, un canal n’a aucun effet. Certains canaux agissent avec un délai (radio, commandites) ou sur plusieurs mois.
  Un responsable marketing augmente la conversion de 25 % au plus.
- **Personas** : le marché est découpé en 4 segments (étudiants, familles, professionnels, retraités) qui ont leurs
  propres sensibilités (prix, qualité, service, ambiance, heures, écoresponsabilité, achat local), leur panier et
  leur notoriété du commerce. Un bassin séparé (8 % du marché) représente les commandes livrées par plateforme
  (prix majoré de 20 % pour le client, commission de 30 % pour le commerce).
- **Image de marque** : moyenne lissée de la qualité, de l’ambiance, de la note, de l’écoresponsabilité, de l’achat
  local et de la satisfaction; une image forte réduit la sensibilité au prix (jusqu’à 15 %).
- **Promotions** : le rabais baisse le prix vu par les clients et fait connaître le commerce, mais après 3 promotions
  en 6 mois, les clients attendent les rabais (malus d’utilité sans promotion).
- **Fidélité** : 5 % de récompenses aux membres (jusqu’à 35 % de la clientèle); les membres viennent 25 % plus
  souvent et la rétention augmente.
- **Indicateurs** : clients actifs = visites ÷ 4 visites par mois; rétention selon la satisfaction, la note, la
  fidélité et les ruptures; CAC = dépenses de marketing ÷ nouveaux clients; CLV = marge mensuelle par client ÷
  (1 − rétention); NPS calculé à partir d’une loi normale des recommandations centrée sur 3,8 + 7 × satisfaction.
- **Études de marché** : estimations bruitées selon la taille de l’échantillon (marge d’erreur de 1,96 × √(p(1 − p)/n));
  les données secondaires et l’analyse de la concurrence ont une erreur fixe; le groupe de discussion classe les
  critères et les nouveaux produits sans prétendre être représentatif.
- **Nouveaux produits** : coût de développement, délai, probabilité de succès selon la qualité et l’image; un échec
  garde environ 30 % de la demande. Chaque succès ajoute un petit bonus de variété.

**Ressources humaines**

- **Recrutement** : chaque plateforme a un coût, un délai et un nombre moyen de candidats (réduit par la pénurie de
  main-d’œuvre, plus forte en période d’expansion et plus faible l’été). Les candidats ont une compétence, une
  expérience, une personnalité et des attentes salariales; une offre sous les attentes peut être refusée.
- **Productivité** : heures × (1 − absentéisme) × compétence × facteur de moral × intégration (75 % le premier mois).
- **Moral visé** : salaire par rapport au marché du poste, surcharge (selon la personnalité), heures supplémentaires,
  avantages sociaux, présence d’un gérant, syndicat, reconnaissance (évaluation dans les 12 derniers mois) et
  ambition (sans augmentation depuis 12 mois).
- **Normes du travail** : 8 jours fériés (indemnité d’environ une journée), vacances de 4 % puis 6 % après 3 ans,
  préavis doublé en cas de syndicat (grief). Les absences ne sont pas payées (les 2 journées rémunérées pour
  obligations familiales sont négligées).
- **Syndicalisation** : après 6 mois de moral moyen sous 40 avec au moins 4 employés, 25 % de risque par mois;
  la première convention collective hausse les salaires de 5 % et améliore le moral.
- **Dilemmes** : au plus un par mois (15 %, 25 % ou 35 % de chance selon la difficulté), jamais le même avant 12 mois.
  Sans réponse, le choix par défaut s’applique. Certains choix ont des conséquences différées et aléatoires (plaintes).

**Opérations**

- **Stocks au jour le jour** pour chaque ligne : ventes limitées par la cuisine puis par le stock, produits refaits
  (défauts), péremption des lots, commandes au point de commande avec le délai du fournisseur (plus 1 à 3 jours si la
  livraison est en retard). En mode automatique, le point de commande (demande pendant le délai + stock de sécurité à
  95 %) et la quantité (QEC bornée par la péremption) sont recalculés chaque semaine. Un point de commande de 0 arrête
  les commandes.
- **Évaluation** : PEPS ou coût moyen pondéré; le coût des ventes est calculé par inventaire périodique (stock
  d’ouverture + achats − pertes − stock de clôture), ce qui garde le bilan exact au cent près.
- **Fournisseurs** : un fournisseur par ligne; le prix des fournisseurs américains suit le taux de change (marche
  aléatoire autour de 1,38 $). Les frais de livraison sont ajoutés au coût des marchandises. Les achats payés en 10
  jours (2/10 net 30) donnent un escompte de 2 %, présenté en réduction du coût des ventes.
- **Cuisine** : un cuisinier prépare 12 plats par heure; sans cuisinier, l’équipe du comptoir en prépare peu et la
  qualité des repas baisse.
- **Défauts** : de 0,5 % à 15 % selon la compétence, la surcharge et l’usure de l’équipement; ils coûtent des
  marchandises et créent des plaintes (moins avec la satisfaction garantie).

**Ventes aux entreprises**

- Appels d’offres (0 à 2 par mois, plus nombreux à la rentrée et avant les Fêtes) avec un prix visé caché, un délai de
  paiement et une cote de crédit. La probabilité de gagner baisse avec le prix soumis et le nombre de concurrents et
  augmente avec la note en ligne. Les livraisons sont facturées à la fin du mois (TPS et TVQ dues à la facturation);
  le client paie à l’échéance (ou en retard selon sa cote) ou fait défaut : les factures sont radiées et les taxes
  récupérées. Un contrat mal servi peut être annulé.

**Finance**

- **Financement de départ** : la banque prête au plus 3 fois la mise de fonds (la love money compte à moitié,
  l’investisseur et la subvention en entier). Les autres sources vérifient l’âge, la forme juridique, la mise de fonds
  minimale et le score du plan d’affaires. Le plan est comparé aux ventes d’un commerce comparable (16 % du marché
  potentiel moyen × achalandage × panier de référence) : trop optimiste ou trop prudent, il perd des points.
- **Crédit en cours de partie** : 3 mois d’historique, ratio de couverture du service de la dette d’au moins 1,25 et
  endettement d’au plus 75 %. Taux fixe : préférentiel + 2,5 %; variable : + 2 % (+ 1 % si l’endettement dépasse 60 %).
- **Prêts** : report possible (intérêts seulement); un taux variable est rajusté à chaque changement du taux
  préférentiel, avec un versement recalculé sur la durée restante.
- **Placements** : compte d’épargne (taux directeur − 0,5 %) ou CPG de 6 et 12 mois (taux directeur + 0,25 % ou
  - 0,5 %), intérêts versés chaque mois et classés en exploitation; les placements nets sont en investissement.
- **Investissements** : registre des immobilisations (amortissement linéaire bien par bien) et DPA par catégorie (8, 10,
  12, 13 et 50). Incitatif à l’investissement accéléré : DPA de 1,5 fois le taux normal l’année d’acquisition pour les
  biens mis en service avant 2030 (1 fois de 2030 à 2033, demi-année ensuite).
- **Subventions** (Créavenir) : comptabilisées comme un produit (autres produits) et imposables.
- **Investisseur providentiel** : reçoit des actions (au plus 49 %); il reçoit sa part des dividendes, et la note de fin
  de partie tient compte de la part de l’entreprise qui reste au joueur.
- **Prévisions** : le joueur entre une prévision de ventes et de bénéfice; l’écart prévu-réel est analysé chaque mois.

**Simplifications** : un fournisseur par ligne, pas de limite d’entreposage, une part fixe d’achats taxables (25 %),
pas de commandes en ligne pour emporter sans le site Web, pas de mise à pied temporaire, revenus de placement imposés
comme le revenu d’entreprise. Les sauvegardes du Jalon 2 ne peuvent pas être chargées (format version 2).

### Fiscalité et juridique (Jalon 2)

- **Exercice financier = année civile** pour toutes les formes juridiques (une société pourrait choisir une autre date).
- **Impôt des particuliers simplifié** : paliers 2026, montants personnels de base, abattement du Québec de 16,5 %,
  majoration et crédits pour dividendes; les autres crédits et déductions (RRQ, REER, etc.) sont ignorés.
- **Retenues à la source** estimées par annualisation du salaire du mois (comme les tables de retenues).
- **Société par actions** : SPCC admissible à la DPE (9 % au fédéral, 2,2 % au Québec pour les années commençant après
  le 29 avril 2026). La DPE du Québec dépend des heures rémunérées (employés + dirigeant salarié, 40 h par semaine
  au plus) : complète à 5 500 h, nulle sous 5 000 h. Les dividendes versés sont non déterminés.
- **DPA** : catégorie 8 (20 % dégressif) pour l’équipement et catégorie 13 (linéaire sur la durée du bail) pour les
  améliorations locatives (catégories 10, 12 et 50 ajoutées au Jalon 3; voir l’incitatif à l’investissement accéléré
  plus haut). Les amendes ne sont pas déductibles. Les pertes fiscales d’une société sont reportées.
- **Acomptes provisionnels** mensuels si l’impôt de l’année précédente dépasse 3 000 $; solde payé en mars.
- **Société de personnes** : un seul associé, part des bénéfices proportionnelle à sa mise de fonds, prélèvements
  proportionnels à ceux du joueur; chaque associé est imposé personnellement sur sa part.
- **Incorporation en cours de partie** : seulement pour une entreprise individuelle, effective le 1er janvier; le
  capital du propriétaire est converti en capital-actions (roulement simplifié).
- **TPS/TVQ** : les clients comparent les prix taxes comprises; un petit fournisseur non inscrit paraît donc environ
  13 % moins cher. Les taxes payées sur les achats de démarrage sont remboursées avec la première déclaration.
  Si l’inscription devient obligatoire et n’est pas faite, Revenu Québec peut le découvrir (15 % par mois) :
  taxes non perçues + pénalité de 15 % + intérêts.
- **Démarches oubliées** : chaque mois, une probabilité de détection propre à chaque démarche; amende, parfois
  fermeture temporaire (moins de capacité), puis régularisation forcée. Sans assurance : 2 % de risque mensuel de
  sinistre non couvert. Sans compte bancaire distinct : frais comptables plus élevés.
- **Déclaration de mise à jour annuelle du REQ** : exigée dès la 2e année, à produire avant la fin de juin; en retard,
  elle est produite d’office en juillet avec une pénalité de 50 % des droits.
- Les **impôts personnels** du propriétaire d’une entreprise individuelle sont calculés et affichés (T1 et TP-1), mais
  payés hors de l’entreprise : ils n’apparaissent pas aux états financiers de l’entreprise.

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
- **Stocks** : réapprovisionnement automatique vers un stock cible en jours (remplacé au Jalon 3 par la gestion au
  jour le jour avec point de commande, QEC, fournisseurs et taux de change).
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
  Montréal (28 600 visites par mois dans la zone au Jalon 4) sont des **paramètres de conception** calibrés pour obtenir des
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

## Calibration (Jalon 3)

Mêmes conditions (36 mois, 10 graines, « Réaliste »). « Actif » embauche des baristas quand des clients sont perdus,
un cuisinier quand la cuisine déborde, et réduit l’équipe quand elle est sous-utilisée. Pub par défaut : 1 500 $/mois.

| Stratégie                                    | Bénéfice cumulé moyen (3 ans) | Faillites |
| -------------------------------------------- | ----------------------------- | --------- |
| Aucune gestion (ni embauche ni remplacement) | ≈ −18 000 $                   | 9 / 10    |
| Gestionnaire actif                           | ≈ 128 000 $                   | 0 / 10    |
| Actif, qualité supérieure, prix +8 %         | ≈ 197 000 $                   | 0 / 10    |
| Actif, programme de fidélité                 | ≈ 150 000 $                   | 0 / 10    |
| Actif, écoresponsabilité et Panier Bleu      | ≈ 143 000 $                   | 0 / 10    |
| Actif, salaires +10 %                        | ≈ 137 000 $                   | 0 / 10    |
| Actif, traiteur (soumissions au prix visé)   | ≈ 132 000 $                   | 0 / 10    |
| Actif, sans publicité                        | ≈ 128 000 $                   | 0 / 10    |
| Actif, prix +15 %                            | ≈ 102 000 $                   | 0 / 10    |
| Actif, livraison par plateforme              | ≈ 73 000 $                    | 0 / 10    |
| Actif, qualité économique, prix −10 %        | ≈ 45 000 $                    | 0 / 10    |
| Actif, publicité de 5 000 $/mois             | ≈ 17 000 $                    | 0 / 10    |
| Actif, prix −15 %                            | ≈ −62 000 $                   | 9 / 10    |
| Actif, promotion de 20 % chaque mois         | ≈ −91 000 $                   | 10 / 10   |

Lecture : la qualité et la fidélisation paient; la livraison rapporte peu quand le café est déjà plein (elle prend la
place de clients en magasin plus rentables); les rabais permanents et la pénétration à −15 % détruisent la marge;
au-delà de 1 500 $ par mois, la publicité a des rendements décroissants. Un joueur passif (qui ne remplace pas les
employés qui partent) finit débordé, puis en faillite : le jeu récompense la gestion active.

## Calibration (Jalon 4)

36 mois, 10 graines, « Réaliste », emplacement typique du secteur à Montréal. « Actif » embauche du personnel de
service quand des clients sont perdus, du personnel de production quand la production déborde (jusqu’à 4 à la fois
en haute saison), met à pied en saison creuse et tranche les événements avec le choix par défaut.

| Secteur               | Gestionnaire actif | Faillites | Aucune gestion | Faillites |
| --------------------- | ------------------ | --------- | -------------- | --------- |
| Café-bistro           | ≈ 67 000 $         | 0 / 10    | ≈ −20 000 $    | 9 / 10    |
| Boutique de vêtements | ≈ 64 000 $         | 0 / 10    | ≈ 47 000 $     | 1 / 10    |
| Boutique en ligne     | ≈ 74 000 $         | 0 / 10    | ≈ 86 000 $     | 0 / 10    |
| Salon de coiffure     | ≈ 65 000 $         | 0 / 10    | ≈ 50 000 $     | 2 / 10    |
| Paysagement           | ≈ 123 000 $        | 0 / 10    | ≈ 10 000 $     | 4 / 10    |
| Atelier d’ébénisterie | ≈ 102 000 $        | 0 / 10    | ≈ 40 000 $     | 3 / 10    |
| Épicerie fine         | ≈ 43 000 $         | 1 / 10    | ≈ 61 000 $     | 1 / 10    |

Stratégies du café (gestionnaire actif) avec 4 concurrents au départ et un Nouveau joueur en cours de partie :

| Stratégie                                  | Bénéfice cumulé moyen (3 ans) | Faillites |
| ------------------------------------------ | ----------------------------- | --------- |
| Actif, qualité supérieure, prix +8 %       | ≈ 115 000 $                   | 0 / 10    |
| Actif, salaires +10 %                      | ≈ 97 000 $                    | 0 / 10    |
| Actif, écoresponsabilité et Panier Bleu    | ≈ 96 000 $                    | 0 / 10    |
| Actif, traiteur (soumissions au prix visé) | ≈ 85 000 $                    | 0 / 10    |
| Actif, programme de fidélité               | ≈ 79 000 $                    | 0 / 10    |
| Gestionnaire actif                         | ≈ 67 000 $                    | 0 / 10    |
| Actif, sans publicité                      | ≈ 47 000 $                    | 1 / 10    |
| Actif, livraison par plateforme            | ≈ 29 000 $                    | 0 / 10    |
| Actif, prix +15 %                          | ≈ −6 000 $                    | 6 / 10    |
| Actif, publicité de 5 000 $/mois           | ≈ −32 000 $                   | 6 / 10    |
| Actif, qualité économique, prix −10 %      | ≈ −36 000 $                   | 10 / 10   |
| Actif, prix −15 %                          | ≈ −75 000 $                   | 10 / 10   |
| Actif, promotion de 20 % chaque mois       | ≈ −90 000 $                   | 10 / 10   |

Lecture : avec plus de concurrents, le marché pardonne moins les écarts de prix (dans les deux sens) et la publicité
excessive. La qualité, la rétention des employés, l’écoresponsabilité et la fidélisation restent les stratégies
gagnantes; se battre contre le Géant avec des prix bas et une qualité économique mène à la faillite. Le paysagement
et l’atelier récompensent particulièrement la gestion de la capacité (embaucher au printemps, mettre à pied à
l’automne). Ces résultats d’un robot simple ne sont pas un plafond : un joueur attentif fait mieux.

## Accessibilité

- Toutes les actions sont accessibles au clavier; le focus est toujours visible (anneau orange foncé en mode clair,
  ambre en mode sombre, contraste ≥ 3:1) et distinct de la couleur d’accent.
- Les statuts (danger, attention, succès) sont toujours accompagnés d’une icône et d’un libellé, jamais de la couleur seule.
- Les graphiques utilisent une palette validée pour le daltonisme, une légende et un tableau de données.
- Les animations respectent `prefers-reduced-motion`.
- La barre d’espace termine le mois seulement si aucun bouton n’a le focus (sinon, elle active le bouton, comme le
  veut la norme d’accessibilité); une fenêtre de confirmation évite les fins de mois accidentelles.
