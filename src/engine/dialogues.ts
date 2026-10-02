/**
 * Personnages récurrents (mentore, banquière, comptable, rival, fournisseure) : chaque mois,
 * jusqu'à 3 répliques selon la situation de l'entreprise. Fonction pure, sans hasard.
 */
import personnagesJson from '../data/personnages.json';
import { dateDuMois } from './creation';
import type { Entreprise, EtatPartie } from './types';

export type IdPersonnage = 'mentore' | 'banquiere' | 'comptable' | 'rival' | 'fournisseur';

export interface Personnage {
  id: IdPersonnage;
  nom: string;
  role: string;
  couleur: string;
  description: string;
}

export const PERSONNAGES = personnagesJson.personnages as Personnage[];

export function personnage(id: IdPersonnage): Personnage {
  return PERSONNAGES.find((p) => p.id === id) as Personnage;
}

export interface Replique {
  personnage: IdPersonnage;
  code: string;
  params?: Record<string, number | string>;
  /** Plus petit = plus important. */
  priorite: number;
}

/** Répliques du mois qui commence (au plus 3, une par personnage). */
export function dialoguesDuMois(etat: EtatPartie, ent: Entreprise): Replique[] {
  if (etat.terminee || ent.enFaillite || ent.vente) return [];
  const r: Replique[] = [];
  const archives = ent.archives;
  const derniere = archives.at(-1);
  const i = derniere?.indicateurs;
  const { mois } = dateDuMois(etat.config, Math.min(etat.moisCourant, etat.config.dureeMois - 1));
  const codes = new Set(derniere?.messages.map((m) => m.code) ?? []);
  const rivalConc = etat.concurrents.find((c) => c.personnaliteId === 'agressif');

  // Mentore
  if (etat.moisCourant === 0)
    r.push({ personnage: 'mentore', code: 'mentoreBienvenue', priorite: 0 });
  else if (etat.moisCourant % 12 === 0 && derniere) {
    const annee = archives.slice(-12);
    const benefice = annee.reduce((s, a) => s + a.indicateurs.beneficeNet, 0);
    r.push({
      personnage: 'mentore',
      code: benefice >= 0 ? 'mentoreAnniversaire' : 'mentoreAnniversairePerte',
      params: { annees: etat.moisCourant / 12, benefice },
      priorite: 1,
    });
  } else if (archives.length >= 3 && archives.slice(-3).every((a) => a.indicateurs.beneficeNet < 0))
    r.push({ personnage: 'mentore', code: 'mentorePertes', priorite: 2 });

  // Banquière
  if (i) {
    const limite = ent.margeCredit.limite / 100;
    const charges = Math.max(1, i.chiffreAffaires - i.beneficeNet);
    const profitables = archives.slice(-6);
    if (ent.moisEnDefaut > 0)
      r.push({ personnage: 'banquiere', code: 'banquiereDefaut', priorite: 0 });
    else if (limite > 0 && i.margeCreditUtilisee > 0.5 * limite)
      r.push({
        personnage: 'banquiere',
        code: 'banquiereMarge',
        params: { utilisee: i.margeCreditUtilisee, limite },
        priorite: 1,
      });
    else if (
      profitables.length === 6 &&
      profitables.every((a) => a.indicateurs.beneficeNet > 0) &&
      etat.moisCourant % 6 === 0
    )
      r.push({ personnage: 'banquiere', code: 'banquiereCroissance', priorite: 2 });
    else if (i.encaisse > 3 * charges && ent.finance.placements.length === 0)
      r.push({
        personnage: 'banquiere',
        code: 'banquierePlacement',
        params: { encaisse: i.encaisse },
        priorite: 3,
      });
  }

  // Comptable
  if (ent.fiscal.doitSInscrire && !ent.fiscal.inscritTaxes)
    r.push({ personnage: 'comptable', code: 'comptableTaxes', priorite: 0 });
  else if (mois === 1 && etat.moisCourant > 0)
    r.push({ personnage: 'comptable', code: 'comptableReleves', priorite: 2 });
  else if (mois === 4 && etat.moisCourant > 0)
    r.push({ personnage: 'comptable', code: 'comptableImpots', priorite: 2 });
  else if (
    ent.formeJuridique === 'individuelle' &&
    archives.length >= 12 &&
    archives.slice(-12).reduce((s, a) => s + a.indicateurs.beneficeNet, 0) > 70_000
  )
    r.push({ personnage: 'comptable', code: 'comptableIncorporation', priorite: 3 });

  // Rival (propriétaire du concurrent agressif)
  if (rivalConc && rivalConc.statut !== 'aVenir') {
    const nom = rivalConc.nom;
    const partRival = derniere?.concurrents.find((c) => c.id === rivalConc.id)?.part ?? 0;
    if (!rivalConc.actif && rivalConc.sortie === etat.moisCourant - 1)
      r.push({ personnage: 'rival', code: 'rivalFerme', params: { nom }, priorite: 1 });
    else if (rivalConc.actif && codes.has('concurrentCopie'))
      r.push({ personnage: 'rival', code: 'rivalCopie', params: { nom }, priorite: 2 });
    else if (rivalConc.actif && codes.has('concurrentPrix'))
      r.push({ personnage: 'rival', code: 'rivalPrix', params: { nom }, priorite: 2 });
    else if (rivalConc.actif && i && i.partMarche > partRival && etat.moisCourant % 4 === 2)
      r.push({ personnage: 'rival', code: 'rivalJaloux', params: { nom }, priorite: 3 });
  }

  // Fournisseure
  if (i && i.demande > 0 && i.perduesRupture / i.demande > 0.05)
    r.push({ personnage: 'fournisseur', code: 'fournisseurRupture', priorite: 2 });
  else if (
    archives.length >= 13 &&
    derniere &&
    derniere.indicateurs.chiffreAffaires >
      1.25 * (archives.at(-13)?.indicateurs.chiffreAffaires ?? Infinity)
  )
    r.push({ personnage: 'fournisseur', code: 'fournisseurVolume', priorite: 3 });

  return r.sort((a, b) => a.priorite - b.priorite).slice(0, 3);
}
