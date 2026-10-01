/**
 * Concurrents gérés par l'IA. Chacun a une personnalité stratégique (le Géant, le Local
 * branché, l'Agressif, le Prudent et le Nouveau joueur) et réagit aux décisions des
 * joueurs avec un délai (comme dans la vraie vie : il faut le temps de remarquer le
 * changement, puis de décider). Les concurrents ont leur propre trésorerie : ils
 * peuvent faire faillite, être rachetés par le Géant ou arriver en cours de partie.
 */
import type { PersonnaliteConcurrent, Secteur, Ville } from './data-types';
import type { Conjoncture } from './economy';
import { satisfactionClients, noteCible, nouvelleNote } from './customers';
import {
  evoluerNotoriete,
  indicePrixOffre,
  prixReference,
  simulerMarche,
  type Offre,
  type OptionsMarche,
  type ResultatOffre,
} from './market';
import type { Rng } from './rng';
import type { Message } from './types';
import { borner, lisser } from './util';

export type TypeReaction = 'prix' | 'publicite' | 'qualite' | 'idee';
export type IdeeCopiee = 'livraison' | 'fidelite' | 'eco' | 'produits';

export interface ReactionPlanifiee {
  moisApplication: number;
  type: TypeReaction;
  /** Nouvelle valeur visée (indice de prix, budget ou qualité). */
  valeur: number;
  idee?: IdeeCopiee;
}

export type StatutConcurrent = 'actif' | 'aVenir' | 'faillite' | 'rachete';

export interface Concurrent {
  id: string;
  personnaliteId: string;
  nom: string;
  surnom: string;
  description: string;
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
  /** Valeur mensuelle du marché au départ (potentiel × panier moyen) : échelle de la publicité. */
  valeurMarche: number;
  tauxCoutMarchandises: number;
  fraisFixesMensuels: number;
  tresorerie: number;
  ventesMois: number;
  profitMois: number;
  partMarche: number;
  historiquePart: number[];
  actif: boolean;
  statut: StatutConcurrent;
  /** Index du mois d'arrivée (Nouveau joueur) ou de sortie du marché. */
  arrivee: number | null;
  sortie: number | null;
  /** Mois consécutifs avec une trésorerie négative. */
  moisDifficulte: number;
  /** Idées copiées aux joueurs et bonus d'attrait qu'elles procurent. */
  idees: IdeeCopiee[];
  bonusIdees: number;
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
  /** Bonnes idées visibles des joueurs. */
  livraison?: boolean;
  fidelite?: boolean;
  eco?: number;
  produitsReussis?: number;
}

/** Arrondit un prix à 0,05 $ près, comme sur un vrai menu (au dollar près au-delà de 100 $). */
export function arrondirPrix(prix: number): number {
  if (prix >= 100) return Math.round(prix);
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

/** Panier moyen de référence d'une visite dans le secteur ($). */
export function panierReference(secteur: Secteur): number {
  return secteur.lignes.reduce((a, l) => {
    const saison = l.saisonnalite ? l.saisonnalite.reduce((x, y) => x + y, 0) / 12 : 1;
    return a + l.tauxAchat * l.prixReference * saison;
  }, 0);
}

/** Proportion du chiffre d'affaires d'un concurrent qui va au coût des marchandises. */
export function tauxCoutConcurrent(p: PersonnaliteConcurrent, secteur: Secteur): number {
  const [min, max] = secteur.margeBruteCible;
  const cmv = 1 - (min + max) / 2;
  return borner((cmv * (0.75 + 0.45 * p.qualite)) / p.indicePrix, 0.05, 0.85);
}

export interface ContexteCreation {
  secteur: Secteur;
  ville: Ville;
  /** Potentiel moyen du marché (visites par mois). */
  potentiel: number;
  agressivite: number;
  rng: Rng;
  /** Durée de la partie (pour tirer le mois d'arrivée du Nouveau joueur). */
  dureeMois: number;
}

export function creerConcurrent(p: PersonnaliteConcurrent, ctx: ContexteCreation): Concurrent {
  const { secteur, ville } = ctx;
  const identite = secteur.concurrents[p.id] ?? { nom: p.surnom, description: '' };
  const valeurMarche = Math.round(ctx.potentiel * panierReference(secteur));
  const budget = Math.round(p.partPublicite * valeurMarche * ctx.agressivite);
  let arrivee: number | null = null;
  if (p.arrivee) {
    const [min, max] = p.arrivee;
    const tire = ctx.rng.int(min, max);
    // Plus agressif en mode Expert : il arrive plus tôt.
    arrivee = Math.max(2, Math.round(tire / Math.max(0.6, ctx.agressivite)));
    if (arrivee >= ctx.dureeMois) arrivee = null;
  }
  const aVenir = p.arrivee !== undefined;
  return {
    id: `ia-${p.id}`,
    personnaliteId: p.id,
    nom: identite.nom,
    surnom: p.surnom,
    description: identite.description,
    couleur: p.couleur,
    indicePrixCible: p.indicePrix,
    prix: prixSelonIndice(secteur, p.indicePrix, 1),
    qualite: p.qualite,
    service: p.service,
    ambiance: p.ambiance,
    eco: p.eco,
    local: p.local,
    livraison: p.livraison && secteur.partLivraison > 0,
    notoriete: borner(p.notorieteInitiale * Math.sqrt(ville.concurrence), 0.03, 0.95),
    note: p.noteInitiale,
    nbAvis: aVenir ? 20 : 180,
    budgetPublicite: budget,
    budgetPubliciteBase: budget,
    heuresOuverture: Math.round(secteur.heuresOuvertureReference * p.facteurHeures),
    capaciteMensuelle: Math.round(p.partCapacite * ctx.potentiel * ville.concurrence),
    valeurMarche,
    tauxCoutMarchandises: tauxCoutConcurrent(p, secteur),
    fraisFixesMensuels: 0,
    tresorerie: 0,
    ventesMois: 0,
    profitMois: 0,
    partMarche: 0,
    historiquePart: [],
    actif: !aVenir,
    statut: aVenir ? 'aVenir' : 'actif',
    arrivee,
    sortie: null,
    moisDifficulte: 0,
    idees: [],
    bonusIdees: 0,
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
    bonusUtilite: c.bonusIdees,
    image: Math.min(1, 0.4 * c.qualite + 0.3 * c.notoriete + 0.3 * ((c.note - 1) / 4)),
  };
}

/**
 * Estime les frais fixes de chaque concurrent pour que, dans un marché moyen avec un
 * nouvel entrant (le joueur), il obtienne sa marge nette visée. Ainsi, un concurrent
 * qui perd des clients au profit du joueur perd de l'argent, et peut faire faillite.
 */
export function calibrerConcurrents(
  concurrents: Concurrent[],
  personnalite: (id: string) => PersonnaliteConcurrent,
  secteur: Secteur,
  potentiel: number,
  offreJoueur: Offre,
  options: OptionsMarche,
): void {
  // Les frais fixes sont estimés pour un marché où le Nouveau joueur est déjà installé
  // (avant son arrivée, les concurrents font un peu plus de profit), en moyenne sur les
  // 12 mois de l'année (certaines lignes ne se vendent qu'en saison).
  const offres = [
    offreJoueur,
    ...concurrents.map((c) =>
      c.statut === 'aVenir' ? { ...offreConcurrent(c), notoriete: 0.35 } : offreConcurrent(c),
    ),
  ];
  const saisonMoyenne = secteur.saisonnalite.reduce((a, x) => a + x, 0) / 12;
  const caMoyen = new Map<string, number>();
  for (let mois = 1; mois <= 12; mois++) {
    const potentielMois = (potentiel * secteur.saisonnalite[mois - 1]) / saisonMoyenne;
    const marche = simulerMarche(offres, secteur, potentielMois, 1, { ...options, mois });
    for (const c of concurrents)
      caMoyen.set(
        c.id,
        (caMoyen.get(c.id) ?? 0) + (marche.resultats[c.id]?.chiffreAffaires ?? 0) / 12,
      );
  }
  for (const c of concurrents) {
    const p = personnalite(c.personnaliteId);
    const ca = caMoyen.get(c.id) ?? 0;
    const frais = ca * (1 - c.tauxCoutMarchandises - p.margeCible) - c.budgetPubliciteBase;
    c.fraisFixesMensuels = Math.round(Math.max(0.12 * ca, frais, 1500));
    c.tresorerie = Math.round(c.fraisFixesMensuels * p.moisTresorerie);
  }
}

function planifier(c: Concurrent, reaction: ReactionPlanifiee): void {
  // Une seule réaction en attente par type (et par idée).
  if (c.reactions.some((r) => r.type === reaction.type && r.idee === reaction.idee)) return;
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
  secteur?: Secteur,
): ReactionPlanifiee[] {
  if (!c.actif) return [];

  // 1. Appliquer les réactions dont le délai est écoulé.
  const appliquees = c.reactions.filter((r) => r.moisApplication <= moisIndex);
  c.reactions = c.reactions.filter((r) => r.moisApplication > moisIndex);
  for (const r of appliquees) {
    if (r.type === 'prix') c.indicePrixCible = r.valeur;
    else if (r.type === 'publicite') c.budgetPublicite = Math.round(r.valeur);
    else if (r.type === 'qualite') c.qualite = r.valeur;
    else if (r.idee) {
      c.idees.push(r.idee);
      if (r.idee === 'livraison') c.livraison = true;
      else if (r.idee === 'eco') c.eco = Math.min(0.9, c.eco + 0.12);
      else c.bonusIdees = Math.min(0.15, c.bonusIdees + 0.05);
    }
  }

  const delai = Math.max(1, p.delaiReactionMois + (rng.chance(0.3) ? 1 : 0));
  const reactivite = p.reactivite * agressivite;

  // 2. Observer les joueurs et planifier des réactions.
  const ecartPrix = obs.indicePrixJoueurs - c.indicePrixCible;
  const tendancePart = partTendance(c);

  if (p.reagitAuxPrix && ecartPrix < -0.04 && rng.chance(borner(reactivite + 0.2, 0, 0.95))) {
    // Un joueur vend moins cher : on réduit une partie de l'écart (l'Agressif va plus loin).
    const plancher = p.indicePrix * (p.copieIdees ? 0.78 : 0.82);
    const cible = borner(c.indicePrixCible + ecartPrix * reactivite, plancher, p.indicePrix);
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

  if (c.tresorerie > 0 && (tendancePart < -0.12 || obs.partJoueurs > 0.3)) {
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

  // 3. L'Agressif et le Nouveau joueur copient les bonnes idées des joueurs.
  if (p.copieIdees && rng.chance(0.5)) {
    const copier = (idee: IdeeCopiee) => {
      if (!c.idees.includes(idee))
        planifier(c, { moisApplication: moisIndex + delai + 1, type: 'idee', valeur: 0, idee });
    };
    if (obs.livraison && !c.livraison && (secteur?.partLivraison ?? 0) > 0) copier('livraison');
    if (obs.fidelite) copier('fidelite');
    if ((obs.eco ?? 0) > c.eco + 0.1) copier('eco');
    if ((obs.produitsReussis ?? 0) > 0) copier('produits');
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
  const coutMarchandises = ventes * c.tauxCoutMarchandises * conj.indiceCouts;
  const fraisFixes = c.fraisFixesMensuels * conj.indicePrix;
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
  // La publicité est mesurée par rapport à la taille du marché (un budget de 3 000 $
  // n'a pas le même poids dans un petit et dans un grand marché).
  const echelle = Math.max(1000, (c.valeurMarche || 185_000) * 0.016);
  c.notoriete = evoluerNotoriete(
    c.notoriete,
    (c.budgetPublicite * 3000) / echelle,
    0.04,
    potentiel > 0 ? resultat.servies / potentiel : 0,
    satisfaction,
  );
  c.service = borner(p.service + rng.normal(0, 0.02), 0.2, 0.95);
}

/**
 * Arrivées, difficultés financières, rachats et faillites des concurrents (mutation).
 * Retourne les messages pour les joueurs.
 */
export function evoluerStatutsConcurrents(
  concurrents: Concurrent[],
  index: number,
  rng: Rng,
): Message[] {
  const m: Message[] = [];
  const geant = concurrents.find((c) => c.personnaliteId === 'geant' && c.actif);
  for (const c of concurrents) {
    if (c.statut === 'aVenir') {
      if (c.arrivee !== null && c.arrivee <= index) {
        c.statut = 'actif';
        c.actif = true;
        c.arrivee = index;
        m.push({ code: 'concurrentArrive', niveau: 'alerte', params: { nom: c.nom } });
      }
      continue;
    }
    if (!c.actif) continue;
    c.moisDifficulte = c.tresorerie < 0 ? c.moisDifficulte + 1 : 0;
    if (c.moisDifficulte === 0) continue;
    // En difficulté : il réduit sa publicité.
    c.budgetPublicite = Math.round(c.budgetPublicite * 0.85);
    if (c.personnaliteId === 'geant') {
      // Le siège social d'une grande chaîne renfloue un magasin… pendant un temps.
      if (c.moisDifficulte >= 6) {
        c.tresorerie = c.fraisFixesMensuels * 6;
        c.moisDifficulte = 0;
        c.capaciteMensuelle = Math.round(c.capaciteMensuelle * 0.85);
      }
      continue;
    }
    const enDefaut = c.tresorerie < -2 * c.fraisFixesMensuels || c.moisDifficulte >= 8;
    if (geant && c.moisDifficulte >= 3 && rng.chance(0.12)) {
      c.statut = 'rachete';
      c.actif = false;
      c.sortie = index;
      geant.notoriete = borner(geant.notoriete + 0.25 * c.notoriete, 0.03, 0.97);
      geant.capaciteMensuelle = Math.round(geant.capaciteMensuelle + 0.5 * c.capaciteMensuelle);
      m.push({
        code: 'concurrentRachete',
        niveau: 'info',
        params: { nom: c.nom, acheteur: geant.nom },
      });
    } else if (enDefaut) {
      c.statut = 'faillite';
      c.actif = false;
      c.sortie = index;
      m.push({ code: 'concurrentFaillite', niveau: 'info', params: { nom: c.nom } });
    }
  }
  return m;
}

/** Concurrent qui ferme parce que le joueur a racheté sa clientèle. */
export function fermerConcurrent(c: Concurrent, index: number): void {
  c.statut = 'rachete';
  c.actif = false;
  c.sortie = index;
}
