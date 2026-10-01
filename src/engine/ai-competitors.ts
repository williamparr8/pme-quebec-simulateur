/**
 * Concurrents gérés par l'IA. Chacun a une personnalité stratégique et réagit
 * aux décisions des joueurs avec un délai (comme dans la vraie vie : il faut
 * le temps de remarquer le changement, puis de décider).
 */
import type { PersonnaliteConcurrent, Secteur } from './data-types';
import type { Conjoncture } from './economy';
import { satisfactionClients, noteCible, nouvelleNote } from './customers';
import {
  evoluerNotoriete,
  indicePrixOffre,
  prixReference,
  type Offre,
  type ResultatOffre,
} from './market';
import type { Rng } from './rng';
import { borner, lisser } from './util';

export type TypeReaction = 'prix' | 'publicite' | 'qualite';

export interface ReactionPlanifiee {
  moisApplication: number;
  type: TypeReaction;
  /** Nouvelle valeur visée (indice de prix, budget ou qualité). */
  valeur: number;
}

export interface Concurrent {
  id: string;
  personnaliteId: string;
  nom: string;
  surnom: string;
  couleur: string;
  /** Prix visé par rapport au prix du marché (1 = prix du marché). */
  indicePrixCible: number;
  prix: Record<string, number>;
  qualite: number;
  service: number;
  ambiance: number;
  eco: number;
  local: number;
  livraison: boolean;
  notoriete: number;
  note: number;
  nbAvis: number;
  budgetPublicite: number;
  budgetPubliciteBase: number;
  heuresOuverture: number;
  capaciteMensuelle: number;
  tresorerie: number;
  ventesMois: number;
  profitMois: number;
  partMarche: number;
  historiquePart: number[];
  actif: boolean;
  reactions: ReactionPlanifiee[];
}

/** Ce que les concurrents peuvent observer des joueurs (information publique). */
export interface ObservationMarche {
  /** Indice de prix moyen des joueurs (prix affichés, donc publics). */
  indicePrixJoueurs: number;
  /** Qualité moyenne perçue des joueurs (visible dans les avis). */
  qualiteJoueurs: number;
  /** Part de marché totale des joueurs le mois dernier. */
  partJoueurs: number;
}

/** Arrondit un prix à 0,05 $ près, comme sur un vrai menu. */
export function arrondirPrix(prix: number): number {
  return Math.max(0.05, Math.round(prix * 20) / 20);
}

export function prixSelonIndice(
  secteur: Secteur,
  indice: number,
  indicePrix: number,
): Record<string, number> {
  const prix: Record<string, number> = {};
  for (const ligne of secteur.lignes) {
    prix[ligne.id] = arrondirPrix(prixReference(ligne, indicePrix) * indice);
  }
  return prix;
}

export function creerConcurrent(
  p: PersonnaliteConcurrent,
  secteur: Secteur,
  agressivite: number,
): Concurrent {
  return {
    id: `ia-${p.id}`,
    personnaliteId: p.id,
    nom: p.nom,
    surnom: p.surnom,
    couleur: p.couleur,
    indicePrixCible: p.indicePrix,
    prix: prixSelonIndice(secteur, p.indicePrix, 1),
    qualite: p.qualite,
    service: p.service,
    ambiance: p.ambiance,
    eco: p.eco,
    local: p.local,
    livraison: p.livraison,
    notoriete: p.notorieteInitiale,
    note: p.noteInitiale,
    nbAvis: 180,
    budgetPublicite: Math.round(p.budgetMarketing * agressivite),
    budgetPubliciteBase: Math.round(p.budgetMarketing * agressivite),
    heuresOuverture: p.heuresOuverture,
    capaciteMensuelle: p.capaciteMensuelle,
    tresorerie: p.tresorerieInitiale,
    ventesMois: 0,
    profitMois: 0,
    partMarche: 0,
    historiquePart: [],
    actif: true,
    reactions: [],
  };
}

export function offreConcurrent(c: Concurrent): Offre {
  return {
    id: c.id,
    prix: c.prix,
    qualite: c.qualite,
    service: c.service,
    ambiance: c.ambiance,
    eco: c.eco,
    local: c.local,
    livraison: c.livraison,
    notoriete: c.notoriete,
    note: c.note,
    heuresOuverture: c.heuresOuverture,
    capaciteVisites: c.capaciteMensuelle,
    image: Math.min(1, 0.4 * c.qualite + 0.3 * c.notoriete + 0.3 * ((c.note - 1) / 4)),
  };
}

function planifier(c: Concurrent, reaction: ReactionPlanifiee): void {
  // Une seule réaction en attente par type.
  if (c.reactions.some((r) => r.type === reaction.type)) return;
  c.reactions.push(reaction);
}

/**
 * Décisions mensuelles d'un concurrent (mutation de l'objet).
 * Retourne les réactions appliquées ce mois-ci (pour informer les joueurs).
 */
export function deciderConcurrent(
  c: Concurrent,
  p: PersonnaliteConcurrent,
  obs: ObservationMarche,
  moisIndex: number,
  agressivite: number,
  rng: Rng,
): ReactionPlanifiee[] {
  if (!c.actif) return [];

  // 1. Appliquer les réactions dont le délai est écoulé.
  const appliquees = c.reactions.filter((r) => r.moisApplication <= moisIndex);
  c.reactions = c.reactions.filter((r) => r.moisApplication > moisIndex);
  for (const r of appliquees) {
    if (r.type === 'prix') c.indicePrixCible = r.valeur;
    else if (r.type === 'publicite') c.budgetPublicite = Math.round(r.valeur);
    else c.qualite = r.valeur;
  }

  const delai = Math.max(1, p.delaiReactionMois + (rng.chance(0.3) ? 1 : 0));
  const reactivite = p.reactivite * agressivite;

  // 2. Observer les joueurs et planifier des réactions.
  const ecartPrix = obs.indicePrixJoueurs - c.indicePrixCible;
  const tendancePart = partTendance(c);

  if (p.reagitAuxPrix && ecartPrix < -0.04 && rng.chance(borner(reactivite + 0.2, 0, 0.95))) {
    // Un joueur vend moins cher : on réduit une partie de l'écart.
    const cible = borner(
      c.indicePrixCible + ecartPrix * reactivite,
      p.indicePrix * 0.82,
      p.indicePrix,
    );
    if (cible < c.indicePrixCible - 0.005) {
      planifier(c, { moisApplication: moisIndex + delai, type: 'prix', valeur: cible });
    }
  } else if (ecartPrix > 0.08 && c.indicePrixCible < p.indicePrix - 0.01 && tendancePart >= -0.02) {
    // La pression a disparu : on remonte lentement vers le prix habituel.
    planifier(c, {
      moisApplication: moisIndex + delai,
      type: 'prix',
      valeur: Math.min(p.indicePrix, c.indicePrixCible + 0.03),
    });
  }

  if (tendancePart < -0.12 || obs.partJoueurs > 0.3) {
    const cible = Math.min(
      c.budgetPubliciteBase * 2.5,
      c.budgetPublicite * (1 + 0.3 * reactivite + 0.1),
    );
    if (cible > c.budgetPublicite * 1.05) {
      planifier(c, { moisApplication: moisIndex + delai, type: 'publicite', valeur: cible });
    }
  } else if (c.budgetPublicite > c.budgetPubliciteBase) {
    c.budgetPublicite = Math.round(lisser(c.budgetPublicite, c.budgetPubliciteBase, 0.1));
  }

  if (obs.qualiteJoueurs > c.qualite - 0.04 && p.qualite >= 0.7 && c.qualite < 0.93) {
    planifier(c, {
      moisApplication: moisIndex + delai + 1,
      type: 'qualite',
      valeur: Math.min(0.93, c.qualite + 0.03),
    });
  }

  return appliquees;
}

/** Variation relative de la part de marché sur 3 mois (ex. -0,15 = baisse de 15 %). */
function partTendance(c: Concurrent): number {
  const h = c.historiquePart;
  if (h.length < 4) return 0;
  const avant = h[h.length - 4];
  const maintenant = h[h.length - 1];
  return avant > 0 ? maintenant / avant - 1 : 0;
}

/** Met à jour les prix d'un concurrent selon l'inflation (avant le calcul du marché). */
export function ajusterPrixConcurrent(c: Concurrent, secteur: Secteur, conj: Conjoncture): void {
  c.prix = prixSelonIndice(secteur, c.indicePrixCible, conj.indicePrix);
}

/** Résultats financiers et image du concurrent après le mois. */
export function majConcurrentApresMarche(
  c: Concurrent,
  p: PersonnaliteConcurrent,
  resultat: ResultatOffre | undefined,
  secteur: Secteur,
  conj: Conjoncture,
  potentiel: number,
  rng: Rng,
): void {
  if (!c.actif || !resultat) return;
  const ventes = resultat.chiffreAffaires;
  const coutMarchandises = ventes * p.tauxCoutMarchandises * conj.indiceCouts;
  const fraisFixes = p.fraisFixesMensuels * conj.indicePrix;
  c.ventesMois = Math.round(ventes);
  c.profitMois = Math.round(ventes - coutMarchandises - fraisFixes - c.budgetPublicite);
  c.tresorerie = Math.round(c.tresorerie + c.profitMois);
  c.partMarche = resultat.part;
  c.historiquePart = [...c.historiquePart.slice(-11), resultat.part];

  const ip = indicePrixOffre(c.prix, secteur, conj.indicePrix);
  const satisfaction = satisfactionClients(c.qualite, c.service, c.ambiance, ip, 0);
  const nouveaux = Math.max(1, Math.round(resultat.servies * 0.008));
  const noteMois = borner(noteCible(satisfaction) + rng.normal(0, 0.15), 1, 5);
  c.note = nouvelleNote(c.note, c.nbAvis, noteMois, nouveaux);
  c.nbAvis += nouveaux;
  c.notoriete = evoluerNotoriete(
    c.notoriete,
    c.budgetPublicite,
    0.04,
    potentiel > 0 ? resultat.servies / potentiel : 0,
    satisfaction,
  );
  c.service = borner(p.service + rng.normal(0, 0.02), 0.2, 0.95);
}
