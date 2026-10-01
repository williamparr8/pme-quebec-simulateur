/** Types des données statiques (src/data). Le moteur ne dépend que de ces interfaces. */

export interface LigneProduit {
  id: string;
  nom: string;
  detail: string;
  /** Prix moyen du marché, avant taxes ($). */
  prixReference: number;
  /** Coût unitaire en qualité « standard » ($). */
  coutUnitaire: number;
  /** Proportion des visites qui achètent cette ligne au prix de référence. */
  tauxAchat: number;
  /** Sensibilité du taux d'achat au prix de la ligne. */
  elasticite: number;
  perissable: boolean;
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
}

export interface FraisFixesMensuels {
  electricite: number;
  assurances: number;
  comptable: number;
  entretien: number;
  logiciels: number;
  telecom: number;
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
  heuresOuvertureReference: number;
  sensibilites: Sensibilites;
  utiliteAlternative: number;
  superficiePi2: number;
  equipements: Equipement[];
  amenagements: Amenagement[];
  stockCibleJoursDefaut: number;
  /** Valeur du stock acheté avant l'ouverture ($). */
  stockInitial: number;
  /** Proportion des achats de marchandises qui sont taxables (le reste est détaxé). */
  partAchatsTaxables: number;
  /** Secteur alimentaire : permis du MAPAQ obligatoire. */
  alimentation: boolean;
  fraisDemarrage: number;
  fraisFixesMensuels: FraisFixesMensuels;
  postes: string[];
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
  emplacements: Emplacement[];
}

export interface Poste {
  id: string;
  nom: string;
  cnp: string;
  salaireMedian: number;
  salaireMin: number;
  salaireMax: number;
  heuresSemaineDefaut: number;
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
