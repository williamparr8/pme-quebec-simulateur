/** Textes du mode chef de département. */
import type { DepartementChef } from '../engine/mandats-types';

export const NOMS_DEPARTEMENTS: Record<DepartementChef, string> = {
  finance: 'Finance et comptabilité',
  fiscalite: 'Fiscalité et juridique',
  ventes: 'Ventes',
  operations: 'Opérations',
  rh: 'Ressources humaines',
  marketing: 'Marketing',
};

export const DESCRIPTIONS_DEPARTEMENTS: Record<DepartementChef, string> = {
  finance:
    'Marge brute, seuil de rentabilité, liquidité, prêts, rapprochement bancaire, amortissement.',
  fiscalite: 'TPS et TVQ, retenues à la source, impôts, amortissement fiscal, obligations.',
  ventes: 'Ticket moyen, part de marché, soumissions, comptes clients, prévisions.',
  operations: 'Quantité économique, point de commande, capacité, coût des pertes.',
  rh: 'Paie, coût d’un employé, vacances, roulement, absentéisme.',
  marketing: 'Coût d’acquisition, valeur à vie, marge d’erreur d’un sondage, rendement.',
};

export const TITRES_CHEF = {
  commis: 'Commis',
  analyste: 'Analyste',
  chef: 'Chef de département',
  directeur: 'Directeur',
} as const;
