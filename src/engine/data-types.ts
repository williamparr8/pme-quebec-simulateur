/** Types des données statiques (src/data). Le moteur ne dépend que de ces interfaces. */

export interface LigneProduit {
  id: string;
  nom: string;
  detail: string;
  /** Prix moyen du marché, avant taxes ($). */
  prixReference: number;
  /** Coût unitaire en qualité « standard » avec un fournisseur moyen ($). */
  coutUnitaire: number;
  /** Proportion des visites qui achètent cette ligne au prix de référence. */
  tauxAchat: number;
  /** Sensibilité du taux d'achat au prix de la ligne. */
  elasticite: number;
  perissable: boolean;
  /** Durée de conservation des marchandises (jours). */
  conservationJours: number;
  /**
   * La ligne exige du temps de production (cuisine, atelier, coiffure, équipes sur le
   * terrain) : elle est limitée par la capacité de production de l'équipe.
   */
  production: boolean;
  /** Minutes de travail de production par unité vendue. */
  minutesProduction?: number;
  /**
   * Vente taxable (TPS et TVQ). Faux : produit détaxé (taux de 0 %, ex. produits
   * alimentaires de base), qui donne quand même droit aux CTI et RTI sur les achats.
   * Par défaut : taxable.
   */
  taxable?: boolean;
  /** Saisonnalité propre à la ligne (multiplicateur du taux d'achat de janvier à décembre). */
  saisonnalite?: number[];
  /** Unité de vente (affichage). */
  unite: string;
  /** Catégorie d'approvisionnement : détermine les fournisseurs possibles. */
  categorieAppro: string;
}

export interface NiveauQualite {
  id: string;
  nom: string;
  description: string;
  multiplicateurCout: number;
  /** Qualité objective, de 0 à 1. */
  score: number;
}

export interface Equipement {
  id: string;
  nom: string;
  description: string;
  cout: number;
  dureeVieMois: number;
  bonusQualite: number;
  /** Hausse de la capacité de production (ex. 0,1 = +10 %). */
  bonusProduction?: number;
  /** Catégorie d'immobilisation (par défaut : équipement, DPA catégorie 8). */
  type?: TypeImmobilisation;
  classeDpa?: ClasseDpa;
}

export interface Amenagement {
  id: string;
  nom: string;
  description: string;
  cout: number;
  /** Ambiance perçue (ou attrait du site Web), de 0 à 1. */
  ambiance: number;
  /** Catégorie d'immobilisation (par défaut : améliorations locatives, catégorie 13). */
  type?: TypeImmobilisation;
  classeDpa?: ClasseDpa;
  /** Durée de vie (mois) si ce n'est pas une amélioration locative amortie sur le bail. */
  dureeVieMois?: number;
}

export interface Sensibilites {
  prix: number;
  qualite: number;
  service: number;
  note: number;
  ambiance: number;
  heures: number;
  /** Écoresponsabilité (emballages, compost, certification). */
  eco: number;
  /** Achat local (fournisseurs québécois, Panier Bleu). */
  local: number;
}

export interface FraisFixesMensuels {
  electricite: number;
  assurances: number;
  comptable: number;
  entretien: number;
  logiciels: number;
  telecom: number;
}

/** Part d'un persona dans le marché d'un secteur et son panier d'achat. */
export interface SegmentSecteur {
  personaId: string;
  /** Part des visites potentielles du marché (la somme des parts vaut 1). */
  part: number;
  /** Multiplicateur du taux d'achat par ligne (1 = moyenne). */
  panier: Record<string, number>;
}

/** Paramètres des ventes aux entreprises d'un produit B2B. */
export interface InfoB2B {
  /** Quantité mensuelle demandée par un client (bornes). */
  quantiteMin: number;
  quantiteMax: number;
  /** Les livraisons se font par coursier (sinon : par l'équipe de l'entreprise). */
  coursier: boolean;
  /** Saisonnalité des appels d'offres (janvier à décembre). */
  saisonnalite?: number[];
  /** Clients possibles (sinon : la liste générale des clients d'affaires). */
  clients?: { nom: string; type: string }[];
}

/** Nouveau produit qu'une entreprise peut développer et lancer. */
export interface NouveauProduit extends LigneProduit {
  description: string;
  /** Coût de développement (recettes, essais, emballages, étiquetage) ($). */
  coutDeveloppement: number;
  delaiMois: number;
  /** Probabilité de succès avec une qualité standard. */
  probabiliteSucces: number;
  /** Multiplicateur d'achat par persona. */
  segments: Record<string, number>;
  /** Produit vendu aux entreprises (soumissions et contrats) plutôt qu'en magasin. */
  b2b?: InfoB2B;
}

export type TypeImmobilisation = 'equipement' | 'ameliorations' | 'vehicule' | 'informatique';
/** Catégories de biens amortissables (DPA) utilisées dans le jeu. */
export type ClasseDpa = '8' | '10' | '12' | '13' | '50';

export interface EffetsInvestissement {
  /** Hausse de la capacité de service (ex. 0,1 = +10 %). */
  capaciteService?: number;
  /** Hausse de la capacité de production (ex. 0,1 = +10 %). */
  capaciteProduction?: number;
  /** Gain d'écoresponsabilité perçue (0 à 1). */
  eco?: number;
  /** Multiplicateur des frais variables par client (expédition, carburant). */
  fraisParVisite?: number;
  ambiance?: number;
  qualiteLignes?: Record<string, number>;
  /** Multiplicateur du coût unitaire de certaines lignes. */
  coutLignes?: Record<string, number>;
  /** Hausse de la demande de mai à septembre (terrasse). */
  demandeEte?: number;
  /** Multiplicateur des pertes par péremption. */
  pertesStocks?: number;
  /** Bonus d'utilité de la commande en ligne (clients branchés). */
  commandeEnLigne?: number;
  /** L'entreprise livre elle-même (pas de coursier pour le traiteur). */
  livraisonPropre?: boolean;
}

export interface Investissement {
  id: string;
  nom: string;
  description: string;
  cout: number;
  type: TypeImmobilisation;
  /** Durée de vie utile pour l'amortissement comptable (mois). */
  dureeVieMois: number;
  classeDpa: ClasseDpa;
  /** Peut-on l'acheter une seule fois? */
  unique: boolean;
  effets: EffetsInvestissement;
  /** Frais d'utilisation mensuels (abonnement, assurance, essence) ($). */
  fraisMensuels?: number;
  /** Mois civils où les frais s'appliquent (sinon : toute l'année). */
  moisActifs?: number[];
}

/** Nom et description d'un concurrent dans un secteur (selon sa personnalité). */
export interface IdentiteConcurrent {
  nom: string;
  description: string;
}

export interface Secteur {
  id: string;
  nom: string;
  description: string;
  /** Nom commun du commerce, avec article (ex. « le café », « la boutique »). */
  commerce: string;
  tauxCnesst: number;
  margeBruteCible: [number, number];
  margeNetteCible: [number, number];
  coutMainOeuvreCible: [number, number];
  lignes: LigneProduit[];
  qualites: NiveauQualite[];
  saisonnalite: number[];
  /** Croissance annuelle tendancielle du marché (ex. 0,06 = +6 % par année). */
  croissanceAnnuelle: number;
  /** Sensibilité de la demande à la conjoncture (1 = moyenne; 1,5 = très cyclique). */
  cyclicite: number;
  transactionsParHeureEmploye: number;
  /** Nom de la production dans ce secteur (ex. « Cuisine », « Atelier »). */
  libelleProduction: string;
  /** Minutes de production par unité si la ligne ne le précise pas. */
  minutesProductionDefaut: number;
  /** Part des heures du propriétaire consacrée à la production (coiffeur, ébéniste…). */
  productionProprietaire: number;
  /** Sans employé de production, part du temps de service qui peut servir à produire. */
  productionSansPersonnel: number;
  /** Ce qu'on appelle les pertes de stock dans ce secteur (périmés, invendus démodés…). */
  libellePertes: string;
  heuresOuvertureReference: number;
  sensibilites: Sensibilites;
  utiliteAlternative: number;
  /** Nombre moyen de visites d'un client fidèle par mois. */
  visitesParClientMois: number;
  /** Taille du marché de la livraison (proportion du potentiel en magasin). */
  partLivraison: number;
  /** Panier des commandes livrées (multiplicateur par ligne). */
  panierLivraison: Record<string, number>;
  segments: SegmentSecteur[];
  /** Emplacements permis (identifiants des emplacements des villes). */
  emplacements: string[];
  /** Importance de l'achalandage et de la visibilité de l'emplacement (0 à 1,3). */
  importanceEmplacement: number;
  superficiePi2: number;
  equipements: Equipement[];
  amenagements: Amenagement[];
  /** Valeur du stock acheté avant l'ouverture ($). */
  stockInitial: number;
  /** Proportion des achats de marchandises qui sont taxables (le reste est détaxé). */
  partAchatsTaxables: number;
  /** Secteur alimentaire : permis du MAPAQ et formation en hygiène obligatoires. */
  alimentation: boolean;
  /** Démarches et permis propres au secteur (ex. permis d'épicerie de la RACJ). */
  permis: string[];
  fraisDemarrage: number;
  fraisFixesMensuels: FraisFixesMensuels;
  /** Frais variables par client servi (expédition, carburant) ($). */
  fraisParVisite?: { montant: number; libelle: string };
  /** Proportion des ventes payées par carte et taux des frais de paiement (sinon : valeurs générales). */
  paiements?: { partCartes: number; taux: number };
  /** Postes offerts dans ce secteur (le premier est le poste de base). */
  postes: string[];
  /** Équipe embauchée avant l'ouverture. */
  equipeDepart: { posteId: string; nombre: number }[];
  /** Fournisseur choisi par défaut pour chaque catégorie d'approvisionnement. */
  fournisseursDefaut: Record<string, string>;
  nouveauxProduits: NouveauProduit[];
  investissements: Investissement[];
  /** Initiatives écoresponsables offertes dans ce secteur. */
  initiativesEco: string[];
  /** Efficacité relative des canaux de publicité dans ce secteur (1 = moyenne). */
  canaux: Record<string, number>;
  /** Budget de publicité par défaut. */
  publiciteDefaut: Record<string, number>;
  /** Nom et description des concurrents selon leur personnalité. */
  concurrents: Record<string, IdentiteConcurrent>;
}

export interface Emplacement {
  id: string;
  nom: string;
  description: string;
  loyerNetPi2: number;
  fraisCommunsPi2: number;
  achalandage: number;
  visibilite: number;
}

export interface Ville {
  id: string;
  nom: string;
  region: string;
  description: string;
  population: number;
  /** Revenu total médian des ménages ($). */
  revenuMedian: number;
  /** Taux de chômage de la région au début de la partie. */
  chomage: number;
  indiceSalaires: number;
  /** Intensité de la concurrence (1 = moyenne) : notoriété et capacité des concurrents. */
  concurrence: number;
  marchePotentielMensuel: Record<string, number>;
  /** Organisme qui gère les fonds locaux (FLI et FLS) de la ville. */
  fondsLocal: string;
  emplacements: Emplacement[];
}

export type RolePoste = 'service' | 'production' | 'gestion' | 'administration' | 'marketing';

export interface Poste {
  id: string;
  nom: string;
  cnp: string;
  description: string;
  salaireMedian: number;
  salaireMin: number;
  salaireMax: number;
  heuresSemaineDefaut: number;
  role: RolePoste;
  /** Contribution au service à la clientèle (1 = employé de service à temps plein). */
  productiviteService: number;
  /** Contribution à la production (1 = cuisinier, coiffeur, ébéniste, paysagiste). */
  productiviteProduction: number;
}

/**
 * Personnalité stratégique d'un concurrent. Les valeurs sont relatives au marché du
 * secteur et de la ville; le nom vient du secteur (Secteur.concurrents).
 */
export interface PersonnaliteConcurrent {
  id: string;
  surnom: string;
  couleur: string;
  indicePrix: number;
  qualite: number;
  service: number;
  ambiance: number;
  /** Écoresponsabilité et achat local perçus (0 à 1). */
  eco: number;
  local: number;
  /** Offert sur les plateformes de livraison. */
  livraison: boolean;
  notorieteInitiale: number;
  noteInitiale: number;
  /** Budget de publicité mensuel en proportion de la valeur du marché. */
  partPublicite: number;
  /** Capacité (visites par mois) en proportion du potentiel du marché. */
  partCapacite: number;
  /** Marge nette visée au départ (sert à estimer ses frais fixes). */
  margeCible: number;
  /** Trésorerie de départ en mois de frais fixes. */
  moisTresorerie: number;
  /** Heures d'ouverture par rapport à la référence du secteur. */
  facteurHeures: number;
  /** Riposte-t-il aux baisses de prix des joueurs (sinon : qualité et publicité) ? */
  reagitAuxPrix: boolean;
  reactivite: number;
  delaiReactionMois: number;
  /** Copie les bonnes idées des joueurs (livraison, fidélité, écoresponsabilité). */
  copieIdees: boolean;
  /** Arrive en cours de partie (mois minimal et maximal), financé par du capital de risque. */
  arrivee?: [number, number];
}

// ---------------------------------------------------------------------------
// Marketing
// ---------------------------------------------------------------------------

export interface Persona {
  id: string;
  nom: string;
  description: string;
  /** Multiplicateurs des sensibilités du secteur (1 = moyenne). */
  sensibilites: Omit<Sensibilites, 'note'>;
  /** Attrait de la commande en ligne (multiplicateur). */
  numerique: number;
}

export interface CanalPublicite {
  id: string;
  nom: string;
  description: string;
  /** Coût par mille impressions ($). */
  cpm: number;
  /** Personnes rejointes par le canal dans la zone. */
  audience: number;
  /** Nombre d'expositions nécessaires pour qu'une personne retienne le message. */
  frequenceEfficace: number;
  /** Part des clients potentiels du marché que le canal peut rejoindre. */
  couverture: number;
  /** Part des personnes rejointes qui retiennent le commerce et le considèrent. */
  conversion: number;
  /** Nombre de mois avant l'effet. */
  delaiMois: number;
  /** Nombre de mois sur lesquels l'effet se répartit. */
  dureeEffetMois: number;
  /** Achat minimal ($) : sous ce montant, le canal n'a aucun effet. */
  budgetMinimum: number;
  affinites: Record<string, number>;
}

export interface InitiativeEco {
  id: string;
  nom: string;
  description: string;
  /** Remise accordée au client par visite plutôt qu'une dépense (ex. tasse réutilisable). */
  rabaisClient?: boolean;
  /** Gain d'écoresponsabilité perçue (0 à 1). */
  score: number;
  coutMensuel: number;
  /** Coût par client servi ($). */
  coutParVisite: number;
  coutInitial: number;
}

export type IdTypeEtude =
  | 'sondageEclair'
  | 'sondageComplet'
  | 'groupeDiscussion'
  | 'analyseConcurrence'
  | 'donneesSecondaires';

export interface TypeEtude {
  id: IdTypeEtude;
  nom: string;
  description: string;
  cout: number;
  /** Taille de l'échantillon (null : étude qualitative ou secondaire). */
  taille: number | null;
}

export interface ParametresMarketing {
  fidelite: {
    coutLogicielMensuel: number;
    rabais: number;
    adhesionMax: number;
    adhesionMensuelle: number;
    bonusRetention: number;
  };
  livraison: { commission: number; majorationClient: number };
  promotion: { rabaisMax: number; moisFatigue: number };
}

// ---------------------------------------------------------------------------
// Opérations
// ---------------------------------------------------------------------------

export type ConditionsPaiement = 'comptant' | 'net30' | '2/10 net 30';

export interface Fournisseur {
  id: string;
  nom: string;
  description: string;
  categorie: string;
  /** Multiplicateur du coût des marchandises (1 = coût moyen). */
  indicePrix: number;
  bonusQualite: number;
  /** Délai de livraison (jours). */
  delaiJours: number;
  /** Probabilité qu'une commande arrive à temps. */
  fiabilite: number;
  local: boolean;
  devise: 'CAD' | 'USD';
  /** Remplace la durée de conservation de la ligne (ex. produits surgelés). */
  conservationJours?: number;
  /** Commande minimale ($). */
  minimumCommande: number;
  /** Frais de livraison ou de courtage par commande ($). */
  fraisCommande: number;
  conditions: ConditionsPaiement;
}

// ---------------------------------------------------------------------------
// Ressources humaines
// ---------------------------------------------------------------------------

export interface PlateformeRecrutement {
  id: string;
  nom: string;
  description: string;
  cout: number;
  /** Frais de placement en proportion du salaire annuel (agence). */
  pourcentageSalaire: number;
  /** 0 : candidats tout de suite; 1 : candidats le mois prochain. */
  delaiMois: number;
  candidatsMoyens: number;
  bonusCompetence: number;
}

export interface Formation {
  id: string;
  nom: string;
  description: string;
  cout: number;
  /** Postes admissibles (null : tous). */
  postes: string[] | null;
  gainCompetence: number;
  gainMoral: number;
  /** Certification en hygiène et salubrité alimentaires du MAPAQ. */
  hygiene?: boolean;
  /** Lignes dont la qualité s'améliore quand des employés sont formés (+0,02 chacun, max +0,04). */
  qualite?: { categories?: string[]; lignes?: string[]; production?: boolean };
}

export interface Avantage {
  id: string;
  nom: string;
  description: string;
  coutMensuelParEmploye: number;
  gainMoral: number;
  /** Réduction de la probabilité mensuelle de départ. */
  reductionDepart: number;
  /** Effet sur la capacité (ex. -0,03). */
  effetCapacite: number;
  /** Heures minimales par semaine pour y avoir droit. */
  heuresMin: number;
}

export interface TraitPersonnalite {
  id: string;
  nom: string;
  description: string;
  absenteisme: number;
  depart: number;
  volatilite: number;
  /** Bonus de qualité du service. */
  service: number;
  /** Multiplicateur de l'effet de la surcharge sur le moral. */
  surcharge: number;
  /** Multiplicateur de la progression de la compétence. */
  apprentissage: number;
  /** Probabilité (sur 100) d'être tiré. */
  frequence: number;
}

// ---------------------------------------------------------------------------
// Financement
// ---------------------------------------------------------------------------

export type IdSourceFinancement =
  'loveMoney' | 'bdc' | 'futurpreneur' | 'fondsLocal' | 'creavenir' | 'ange';

export interface SourceFinancement {
  id: IdSourceFinancement | 'banque' | 'investissementQuebec';
  nom: string;
  organisme: string;
  description: string;
  type: 'pret' | 'capital' | 'pretEtSubvention' | 'nonAdmissible';
  montantMin: number;
  montantMax: number;
  /** Écart au-dessus du taux préférentiel (null : taux fixe donné par tauxFixe). */
  ecartTaux: number | null;
  tauxFixe?: number;
  tauxVariable: boolean;
  dureeMois: number;
  /** Mois de report du remboursement du capital (intérêts seulement). */
  differeMois: number;
  ageMin?: number;
  ageMax?: number;
  /** Score minimal du plan d'affaires (null : aucun plan exigé). */
  scorePlanMin: number | null;
  /** Mise de fonds minimale en proportion du coût du projet. */
  apportMinPct: number;
  /** Proportion maximale du coût du projet. */
  partProjetMax?: number;
  /** Subvention non remboursable versée avec le prêt ($). */
  subvention?: number;
  formes?: string[];
  secteurs?: string[];
  conditions: string;
}
