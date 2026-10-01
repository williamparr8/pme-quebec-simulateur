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
  /** La ligne est préparée en cuisine (exige du temps de cuisinier). */
  cuisine: boolean;
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
}

export interface Amenagement {
  id: string;
  nom: string;
  description: string;
  cout: number;
  /** Ambiance perçue, de 0 à 1. */
  ambiance: number;
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
  b2b?: boolean;
}

export type TypeImmobilisation = 'equipement' | 'ameliorations' | 'vehicule' | 'informatique';
/** Catégories de biens amortissables (DPA) utilisées dans le jeu. */
export type ClasseDpa = '8' | '10' | '12' | '13' | '50';

export interface EffetsInvestissement {
  /** Hausse de la capacité de service (ex. 0,1 = +10 %). */
  capaciteService?: number;
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

export interface Secteur {
  id: string;
  nom: string;
  description: string;
  tauxCnesst: number;
  margeBruteCible: [number, number];
  margeNetteCible: [number, number];
  coutMainOeuvreCible: [number, number];
  lignes: LigneProduit[];
  qualites: NiveauQualite[];
  saisonnalite: number[];
  transactionsParHeureEmploye: number;
  /** Unités de produits cuisinés qu'un cuisinier prépare par heure. */
  unitesCuisineParHeure: number;
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
  superficiePi2: number;
  equipements: Equipement[];
  amenagements: Amenagement[];
  /** Valeur du stock acheté avant l'ouverture ($). */
  stockInitial: number;
  /** Proportion des achats de marchandises qui sont taxables (le reste est détaxé). */
  partAchatsTaxables: number;
  /** Secteur alimentaire : permis du MAPAQ et formation en hygiène obligatoires. */
  alimentation: boolean;
  fraisDemarrage: number;
  fraisFixesMensuels: FraisFixesMensuels;
  /** Postes offerts dans ce secteur (le premier est le poste de base). */
  postes: string[];
  /** Fournisseur choisi par défaut pour chaque catégorie d'approvisionnement. */
  fournisseursDefaut: Record<string, string>;
  nouveauxProduits: NouveauProduit[];
  investissements: Investissement[];
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
  population: number;
  indiceSalaires: number;
  penurieMainOeuvre: number;
  marchePotentielMensuel: Record<string, number>;
  /** Organisme qui gère les fonds locaux (FLI et FLS) de la ville. */
  fondsLocal: string;
  emplacements: Emplacement[];
}

export type RolePoste = 'service' | 'cuisine' | 'gestion' | 'administration' | 'marketing';

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
  /** Contribution au service à la clientèle (1 = barista). */
  productiviteService: number;
  /** Contribution à la production en cuisine (1 = cuisinier). */
  productiviteCuisine: number;
}

export interface PersonnaliteConcurrent {
  id: string;
  nom: string;
  surnom: string;
  description: string;
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
  budgetMarketing: number;
  tauxCoutMarchandises: number;
  fraisFixesMensuels: number;
  /** Visites maximales servies par mois (personnel et superficie). */
  capaciteMensuelle: number;
  heuresOuverture: number;
  /** Riposte-t-il aux baisses de prix des joueurs (sinon : qualité et publicité) ? */
  reagitAuxPrix: boolean;
  reactivite: number;
  delaiReactionMois: number;
  tresorerieInitiale: number;
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
