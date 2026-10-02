/**
 * Paliers de croissance : petite entreprise → PME → grande entreprise.
 *
 * Les seuils sont à l'échelle du jeu (un commerce y atteint quelques millions de dollars de
 * ventes au plus) : dans la réalité, Statistique Canada parle de PME jusqu'à 499 employés.
 * Chaque palier change les règles : rabais de volume chez les fournisseurs, marge de crédit
 * plus grande, mais examen ou audit des états financiers exigé par les prêteurs. Les
 * obligations légales liées au nombre d'employés (équité salariale, comité de santé et de
 * sécurité, francisation) sont dans les démarches (conformite.ts). Voir DECISIONS.md.
 */
import type { Entreprise, Message } from './types';

export type Palier = 'petite' | 'pme' | 'grande';
export const PALIERS: readonly Palier[] = ['petite', 'pme', 'grande'];

export const SEUILS_PALIERS = {
  pme: { ventes: 750_000, employes: 15 },
  grande: { ventes: 2_500_000, etablissements: 3, employes: 50 },
} as const;

/** Rabais de volume sur les achats de marchandises. */
export const RABAIS_VOLUME: Record<Palier, number> = { petite: 0, pme: 0.03, grande: 0.06 };
/** Honoraires mensuels d'examen (PME) ou d'audit (grande entreprise) des états financiers. */
export const HONORAIRES_PALIER: Record<Palier, number> = { petite: 0, pme: 400, grande: 1500 };
/** Multiplicateur de la limite de la marge de crédit en atteignant le palier. */
const MARGE_PALIER: Record<Palier, number> = { petite: 1, pme: 2, grande: 2 };

export function palier(ent: Entreprise): Palier {
  return ent.croissance?.palier ?? 'petite';
}

/** Ventes des 12 derniers mois (annualisées s'il y a moins de 12 mois). */
export function ventesDouzeMois(ent: Entreprise): number {
  const a = ent.archives.slice(-12);
  if (a.length === 0) return 0;
  return (a.reduce((s, x) => s + x.indicateurs.chiffreAffaires, 0) * 12) / a.length;
}

/** Nombre d'établissements : le premier commerce et les succursales ouvertes. */
export function nbEtablissements(ent: Entreprise): number {
  return 1 + (ent.succursales?.length ?? 0);
}

/** Palier que l'entreprise remplit aujourd'hui. */
export function palierAtteignable(ent: Entreprise): Palier {
  const ventes = ventesDouzeMois(ent);
  const employes = ent.employes.length;
  const g = SEUILS_PALIERS.grande;
  if ((ventes >= g.ventes && nbEtablissements(ent) >= g.etablissements) || employes >= g.employes)
    return 'grande';
  const p = SEUILS_PALIERS.pme;
  if (ventes >= p.ventes || employes >= p.employes) return 'pme';
  return 'petite';
}

/**
 * Fait monter l'entreprise de palier (on ne redescend pas : la structure, la réputation et
 * les obligations restent). Retourne le message à afficher, s'il y a lieu.
 */
export function evoluerPalier(ent: Entreprise, index: number): Message | null {
  const actuel = PALIERS.indexOf(palier(ent));
  const vise = PALIERS.indexOf(palierAtteignable(ent));
  if (vise <= actuel) return null;
  for (let k = actuel + 1; k <= vise; k++)
    ent.margeCredit.limite = Math.round(ent.margeCredit.limite * MARGE_PALIER[PALIERS[k]]);
  ent.croissance = { palier: PALIERS[vise], depuis: index };
  return { code: 'palierAtteint', niveau: 'succes', params: { palier: PALIERS[vise] } };
}

export const facteurAchatsPalier = (ent: Entreprise): number => 1 - RABAIS_VOLUME[palier(ent)];
export const honorairesPalier = (ent: Entreprise): number => HONORAIRES_PALIER[palier(ent)];
