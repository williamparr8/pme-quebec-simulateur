/**
 * Ventes aux entreprises (B2B) : appels d'offres, soumissions, contrats, factures à
 * 30, 45 ou 60 jours, comptes clients, retards de paiement et mauvaises créances.
 */
import { CLIENTS_AFFAIRES } from '../data';
import type { Rng } from './rng';
import type { AppelOffres, Contrat, Entreprise, Facture } from './types';
import { borner } from './util';

/** Probabilité mensuelle de défaut de paiement d'un client selon sa cote de crédit. */
export const RISQUE_DEFAUT: Record<'A' | 'B' | 'C', number> = { A: 0.004, B: 0.02, C: 0.06 };
/** Probabilité qu'un client paie à l'échéance (sinon : il paie en retard). */
export const PONCTUALITE: Record<'A' | 'B' | 'C', number> = { A: 0.95, B: 0.8, C: 0.6 };
/** Coût d'un coursier en proportion des ventes livrées, sans véhicule. */
export const FRAIS_COURSIER = 0.06;

/** Nombre de mois avant l'échéance d'une facture. */
export function moisEcheance(delaiJours: 30 | 45 | 60): number {
  return delaiJours === 30 ? 1 : 2;
}

/** Saisonnalité des appels d'offres (rentrée et Fêtes plus occupées). */
const SAISON_B2B = [0.8, 0.9, 1, 1, 1, 0.9, 0.5, 0.6, 1.3, 1.2, 1.2, 1.4];

/** Génère les appels d'offres du mois (0 à 2). */
export function genererAppels(
  ent: Entreprise,
  prixReference: number,
  index: number,
  mois: number,
  nouvelId: () => string,
  rng: Rng,
): AppelOffres[] {
  const attendus = 0.75 * SAISON_B2B[mois - 1];
  const n = Math.min(2, (rng.chance(attendus) ? 1 : 0) + (rng.chance(attendus * 0.3) ? 1 : 0));
  const appels: AppelOffres[] = [];
  for (let i = 0; i < n; i++) {
    const client = rng.pick(CLIENTS_AFFAIRES);
    if (ent.b2b.contrats.some((c) => c.client === client.nom)) continue;
    const coteTirage = rng.next();
    const cote: 'A' | 'B' | 'C' = coteTirage < 0.5 ? 'A' : coteTirage < 0.85 ? 'B' : 'C';
    const delai = rng.pick([30, 30, 45, 60] as const);
    appels.push({
      id: nouvelId(),
      client: client.nom,
      typeClient: client.type,
      repasParMois: Math.round(rng.range(40, 320) / 10) * 10,
      dureeMois: rng.pick([3, 6, 6, 12]),
      delaiPaiementJours: delai,
      cote,
      // Les clients qui paient plus tard ou au crédit faible acceptent un prix un peu plus élevé.
      prixCible:
        Math.round(
          prixReference * (0.92 + rng.range(0, 0.25) + (delai - 30) * 0.002 + (cote === 'C' ? 0.05 : 0)) * 20,
        ) / 20,
      nbConcurrents: rng.int(1, 4),
      expire: index,
      soumission: null,
    });
  }
  return appels;
}

/** Probabilité de gagner un appel d'offres selon le prix soumis et la réputation. */
export function probabiliteGain(appel: AppelOffres, prix: number, note: number): number {
  const ecart = prix / appel.prixCible - 1;
  const base = 1 / (1 + Math.exp(10 * ecart));
  const concurrence = 1 / (1 + 0.25 * (appel.nbConcurrents - 1));
  return borner(base * concurrence * (0.8 + 0.1 * (note - 3.5)) * 1.6, 0, 0.95);
}

/** Résout les soumissions déposées : retourne les contrats gagnés. */
export function resoudreSoumissions(ent: Entreprise, nouvelId: () => string, rng: Rng): Contrat[] {
  const gagnes: Contrat[] = [];
  ent.b2b.resultats = [];
  for (const a of ent.b2b.appels) {
    if (a.soumission === null) continue;
    const gagne = rng.chance(probabiliteGain(a, a.soumission, ent.clientele.note));
    ent.b2b.resultats.push({ client: a.client, gagne, prix: a.soumission });
    if (gagne) {
      gagnes.push({
        id: nouvelId(),
        client: a.client,
        cote: a.cote,
        repasParMois: a.repasParMois,
        prixUnitaire: a.soumission,
        moisRestants: a.dureeMois,
        delaiPaiementJours: a.delaiPaiementJours,
        satisfaction: 0.8,
      });
    }
  }
  ent.b2b.appels = [];
  return gagnes;
}

/** Solde des comptes clients (cents). */
export function soldeComptesClients(factures: readonly Facture[]): number {
  return factures
    .filter((f) => f.statut === 'ouverte')
    .reduce((a, f) => a + f.ht + f.tps + f.tvq, 0);
}

/** Classement chronologique des comptes clients (courant, 1 à 30 jours de retard, plus). */
export function ageComptesClients(
  factures: readonly Facture[],
  index: number,
): { courant: number; retard1: number; retard2: number } {
  const r = { courant: 0, retard1: 0, retard2: 0 };
  for (const f of factures) {
    if (f.statut !== 'ouverte') continue;
    const montant = (f.ht + f.tps + f.tvq) / 100;
    const retard = index - f.echeance;
    if (retard < 0) r.courant += montant;
    else if (retard < 1) r.retard1 += montant;
    else r.retard2 += montant;
  }
  return r;
}
