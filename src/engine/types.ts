/** Types de l'état d'une partie. Tout l'état est sérialisable en JSON (sauvegarde). */
import type { GrandLivre, Ecriture, Mouvements, MouvementsFlux, Soldes } from './accounting';
import type { Concurrent } from './ai-competitors';
import type { Conjoncture } from './economy';
import type { Pret } from './loans';
import type { VenteLigne } from './market';
import type { Cents } from './util';

export type Difficulte = 'facile' | 'realiste' | 'expert';
export const DUREES_PARTIE = [12, 24, 36, 60] as const;
export type DureePartie = (typeof DUREES_PARTIE)[number];

export interface ConfigPartie {
  graine: number;
  difficulte: Difficulte;
  dureeMois: DureePartie;
  secteurId: string;
  villeId: string;
  /** Première année de la partie (l'exercice financier suit l'année civile). */
  anneeDepart: number;
}

/** Choix faits à la création de l'entreprise. */
export interface ParametresDemarrage {
  nomEntreprise: string;
  nomProprietaire: string;
  couleur: string;
  emplacementId: string;
  equipementId: string;
  amenagementId: string;
  /** Mise de fonds personnelle du propriétaire ($). */
  apportPersonnel: number;
  /** Prêt bancaire de démarrage demandé ($). */
  montantPret: number;
}

/** Décisions modifiables à chaque tour. Elles restent en vigueur d'un mois à l'autre. */
export interface Decisions {
  /** Prix de vente par ligne de produits, avant taxes ($). */
  prix: Record<string, number>;
  qualiteId: string;
  /** Budget de publicité du mois ($). */
  budgetPublicite: number;
  /** Heures d'ouverture par semaine. */
  heuresOuverture: number;
  /** Heures travaillées par le propriétaire par semaine (non payées : il se paie par ses prélèvements). */
  heuresProprietaire: number;
  /** Salaire horaire des employés ($). */
  salaireHoraire: number;
  /** Stock cible, en jours de consommation. */
  stockJoursCible: number;
  /** Prélèvements mensuels du propriétaire pour vivre ($). */
  prelevements: number;
  /** Rembourser automatiquement la marge de crédit quand l'encaisse le permet. */
  remboursementAutoMarge: boolean;
  /** Apport ponctuel du propriétaire ce mois-ci ($, remis à 0 après le mois). */
  apportPonctuel: number;
  /** Remboursement anticipé de l'emprunt ce mois-ci ($, remis à 0 après le mois). */
  remboursementAnticipe: number;
}

export interface Employe {
  id: string;
  prenom: string;
  nom: string;
  posteId: string;
  heuresSemaine: number;
  /** Moral de 0 à 100. */
  moral: number;
  /** Compétence : 1 = employé moyen. */
  competence: number;
  moisAnciennete: number;
  /** Salaire brut cumulé depuis le 1er janvier (pour les plafonds de cotisation). */
  cumulBrutAnnee: number;
}

export interface EtatClientele {
  notoriete: number;
  qualitePercue: number;
  service: number;
  satisfaction: number;
  note: number;
  nbAvis: number;
}

export interface Indicateurs {
  potentiel: number;
  demande: number;
  servies: number;
  perduesCapacite: number;
  perduesRupture: number;
  partMarche: number;
  ventesParLigne: VenteLigne[];
  chiffreAffaires: number;
  ticketMoyen: number;
  beneficeNet: number;
  tauxMargeBrute: number;
  /** Salaires et charges sociales / ventes. */
  tauxMainOeuvre: number;
  encaisse: number;
  margeCreditUtilisee: number;
  notoriete: number;
  qualitePercue: number;
  service: number;
  satisfaction: number;
  note: number;
  nbAvis: number;
  moral: number;
  nbEmployes: number;
  heuresOuvertureEffectives: number;
  capacite: number;
  utilisation: number;
  tauxDirecteur: number;
  tauxPreferentiel: number;
  inflation: number;
  salaireMinimum: number;
  /** Indice de prix de l'entreprise par rapport au marché (1 = prix du marché). */
  indicePrixOffre: number;
  /** Salaires, vacances et charges sociales du mois ($). */
  coutMainOeuvre: number;
}

export type NiveauMessage = 'succes' | 'info' | 'alerte' | 'danger';

/** Message du rapport mensuel. Le texte est produit par l'interface (i18n) à partir du code. */
export interface Message {
  code: string;
  niveau: NiveauMessage;
  params?: Record<string, number | string>;
}

export interface MoisArchive {
  /** Index du mois dans la partie (0 = premier mois). */
  index: number;
  annee: number;
  mois: number;
  mouvements: Mouvements;
  soldesFin: Soldes;
  flux: MouvementsFlux;
  ecritures: Ecriture[];
  /** Portion à court terme de la dette à la fin du mois (cents). */
  portionCouranteDette: Cents;
  indicateurs: Indicateurs;
  messages: Message[];
  /** Concurrents : ventes et parts publiques estimées. */
  concurrents: { id: string; part: number; prixIndice: number; note: number; notoriete: number }[];
}

export interface Bail {
  loyerMensuel: Cents;
  dureeMois: number;
  /** Hausse annuelle du loyer à chaque anniversaire du bail. */
  indexation: number;
}

export interface MargeCredit {
  limite: Cents;
  /** Écart au-dessus du taux préférentiel. */
  ecartTaux: number;
}

export interface Entreprise {
  id: string;
  nom: string;
  proprietaire: string;
  couleur: string;
  formeJuridique: 'individuelle';
  emplacementId: string;
  equipementId: string;
  amenagementId: string;
  decisions: Decisions;
  employes: Employe[];
  clientele: EtatClientele;
  livre: GrandLivre;
  prets: Pret[];
  margeCredit: MargeCredit;
  bail: Bail;
  /** Durée d'amortissement des améliorations locatives (durée du bail). */
  dureeAmortAmeliorations: number;
  dureeAmortEquipement: number;
  /** Coûts ponctuels à payer au prochain mois (recrutement, indemnités de départ). */
  enAttente: { recrutement: number; indemnites: number; embauches: number };
  archives: MoisArchive[];
  /** Nombre de mois consécutifs à découvert au-delà de la marge de crédit. */
  moisEnDefaut: number;
  enFaillite: boolean;
  prochainIdEmploye: number;
}

export interface EtatPartie {
  version: 1;
  config: ConfigPartie;
  /** Index du prochain mois à jouer (0 = le premier mois n'est pas encore joué). */
  moisCourant: number;
  rngState: number;
  conjoncture: Conjoncture;
  salaireMinimum: number;
  entreprises: Entreprise[];
  concurrents: Concurrent[];
  terminee: boolean;
  raisonFin?: 'duree' | 'faillite';
}
