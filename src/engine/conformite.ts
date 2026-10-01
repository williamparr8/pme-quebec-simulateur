/**
 * Conformité : démarches de démarrage, frais du Registraire des entreprises selon la
 * forme juridique et obligations qui découlent d'une démarche oubliée.
 */
import demarchesJson from '../data/demarches.json';
import { FRAIS_REQ_2026 } from '../data/fiscalite';
import type { Secteur } from './data-types';
import type { FormeJuridique, IdDemarche } from './types';
import { FORMES_SOCIETE_ACTIONS, FORMES_SOCIETE_PERSONNES } from './types';

export type Obligation = 'toujours' | 'employes' | 'alimentation' | 'facultative';

export interface Demarche {
  id: IdDemarche;
  nom: string;
  description: string;
  cout: number;
  coutSelonForme?: boolean;
  obligation: Obligation;
  probabiliteDetection: number;
  amende: number;
  joursFermeture: number;
  organisme: string;
  sinistre?: [number, number];
  fraisComptablesSupplementaires?: number;
}

export const DEMARCHES: readonly Demarche[] = demarchesJson.demarches as Demarche[];

export const IDS_DEMARCHES: readonly IdDemarche[] = DEMARCHES.map((d) => d.id);

export function demarche(id: IdDemarche): Demarche {
  const d = DEMARCHES.find((x) => x.id === id);
  if (!d) throw new Error(`Démarche inconnue : ${id}`);
  return d;
}

export const estSocieteActions = (f: FormeJuridique): boolean => FORMES_SOCIETE_ACTIONS.includes(f);
export const estSocietePersonnes = (f: FormeJuridique): boolean => FORMES_SOCIETE_PERSONNES.includes(f);

/** Frais de constitution ou d'immatriculation au démarrage selon la forme juridique. */
export function fraisImmatriculation(forme: FormeJuridique): number {
  switch (forme) {
    case 'individuelle':
      return FRAIS_REQ_2026.individuelle.immatriculation;
    case 'senc':
    case 'sec':
      return FRAIS_REQ_2026.societePersonnes.immatriculation;
    case 'inc-qc':
      return FRAIS_REQ_2026.societeActionsQc.constitution;
    case 'inc-federal':
      return (
        FRAIS_REQ_2026.societeActionsFederale.constitutionCorporationsCanada +
        FRAIS_REQ_2026.societeActionsFederale.immatriculationReq
      );
  }
}

/** Droits de la déclaration de mise à jour annuelle au REQ. */
export function fraisMiseAJourAnnuelle(forme: FormeJuridique): number {
  if (forme === 'individuelle') return FRAIS_REQ_2026.individuelle.miseAJourAnnuelle;
  if (estSocietePersonnes(forme)) return FRAIS_REQ_2026.societePersonnes.miseAJourAnnuelle;
  return FRAIS_REQ_2026.societeActionsQc.miseAJourAnnuelle;
}

/** Une société (de personnes ou par actions) doit obligatoirement être immatriculée ou constituée. */
export function immatriculationObligatoire(forme: FormeJuridique): boolean {
  return forme !== 'individuelle';
}

/** Coût d'une démarche (l'immatriculation dépend de la forme juridique). */
export function coutDemarche(id: IdDemarche, forme: FormeJuridique): number {
  const d = demarche(id);
  return d.coutSelonForme ? fraisImmatriculation(forme) : d.cout;
}

/** La démarche est-elle obligatoire maintenant? */
export function estObligatoire(id: IdDemarche, secteur: Secteur, nbEmployes: number): boolean {
  const d = demarche(id);
  switch (d.obligation) {
    case 'toujours':
      return true;
    case 'employes':
      return nbEmployes > 0;
    case 'alimentation':
      return secteur.alimentation;
    default:
      return false;
  }
}

/** Frais comptables mensuels supplémentaires selon la forme (états financiers, T2/CO-17, T5013/TP-600). */
export function fraisComptablesForme(forme: FormeJuridique): number {
  if (estSocieteActions(forme)) return 300;
  if (estSocietePersonnes(forme)) return 100;
  return 0;
}
