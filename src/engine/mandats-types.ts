/** Types du mode « chef de département » (voir PLAN-DEPARTEMENTS.md). */
import type { Entreprise, EtatPartie, MoisArchive } from './types';

export type DepartementChef =
  'finance' | 'fiscalite' | 'ventes' | 'operations' | 'rh' | 'marketing';
export type UniteMandat = 'dollars' | 'pourcent' | 'ratio' | 'nombre';
/** Enjeu d'une erreur : faible (confiance seulement), moyen ou élevé (frais dans les livres). */
export type EnjeuMandat = 'faible' | 'moyen' | 'eleve';

export interface LigneDocument {
  libelle: string;
  valeur: string;
  /** Ligne sans rapport avec le calcul : affichée seulement au niveau Expert. */
  inutile?: boolean;
}

/** Document source : d'où vient l'information et ce qu'elle contient. */
export interface DocumentSource {
  titre: string;
  /** Comment l'information a été obtenue (et sa fiabilité, s'il y a lieu). */
  provenance: string;
  lignes: LigneDocument[];
}

export interface DonneesMandat {
  question: string;
  documents: DocumentSource[];
  /** Bonne réponse, dans l'unité du mandat (un pourcentage vaut 65,2 et non 0,652). */
  attendu: number;
  /** Corrigé étape par étape. */
  corrige: string[];
}

export interface ContexteMandat {
  etat: EtatPartie;
  ent: Entreprise;
  derniere?: MoisArchive;
  precedente?: MoisArchive;
}

export interface DefinitionMandat {
  id: string;
  departement: DepartementChef;
  titre: string;
  unite: UniteMandat;
  enjeu: EnjeuMandat;
  formule: string;
  indices: string[];
  /** Produit le mandat à partir de la partie, ou null s'il ne s'applique pas ce mois-ci. */
  generer: (c: ContexteMandat) => DonneesMandat | null;
}

/** Mandat remis au joueur pour le mois courant. */
export interface MandatDuMois extends DonneesMandat {
  id: string;
  titre: string;
  unite: UniteMandat;
  enjeu: EnjeuMandat;
  formule: string;
  indices: string[];
  reponse: number | null;
}

export interface ResultatMandat {
  /** Mois (index) où le mandat a été remis. */
  index: number;
  id: string;
  titre: string;
  question: string;
  unite: UniteMandat;
  reponse: number | null;
  attendu: number;
  correct: boolean;
  /** Frais causés par l'erreur ($). */
  cout: number;
  corrige: string[];
}

export interface EtatChef {
  departement: DepartementChef;
  /** Confiance de la direction (0 à 100). */
  confiance: number;
  mandats: MandatDuMois[];
  historique: ResultatMandat[];
  /** Mois (index) du dernier rapport d'évaluation lu. */
  dernierRapport: number;
}

export const arrondir = (x: number, decimales: number): number => {
  const f = Math.pow(10, decimales);
  return Math.round(x * f) / f;
};
