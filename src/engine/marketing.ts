/**
 * Marketing : canaux de promotion (coût par mille, portée, conversion, délai d'effet),
 * notoriété par segment, image de marque, écoresponsabilité et achat local,
 * programme de fidélité, promotions, rétention, NPS, CAC et valeur à vie d'un client.
 */
import {
  CANAUX,
  INITIATIVES_ECO,
  PARAMETRES_MARKETING,
  fournisseurParId,
  personaParId,
} from '../data';
import type { CanalPublicite, Secteur } from './data-types';
import type { SegmentMarche } from './market';
import type { Decisions, EtatMarketing } from './types';
import { borner, lisser } from './util';

// ---------------------------------------------------------------------------
// Segments
// ---------------------------------------------------------------------------

/** Ramène des multiplicateurs par segment à une moyenne pondérée de 1. */
export function normaliserParSegment(
  secteur: Secteur,
  valeurs: Record<string, number>,
): Record<string, number> {
  const moyenne = secteur.segments.reduce((a, s) => a + s.part * (valeurs[s.personaId] ?? 1), 0);
  const r: Record<string, number> = {};
  for (const s of secteur.segments) r[s.personaId] = (valeurs[s.personaId] ?? 1) / (moyenne || 1);
  return r;
}

/** Segments du marché d'un secteur, avec des paniers normalisés (moyenne de 1 par ligne). */
export function segmentsMarche(secteur: Secteur): SegmentMarche[] {
  const paniers: Record<string, Record<string, number>> = {};
  for (const s of secteur.segments) paniers[s.personaId] = {};
  for (const ligne of secteur.lignes) {
    const valeurs: Record<string, number> = {};
    for (const s of secteur.segments) valeurs[s.personaId] = s.panier[ligne.id] ?? 1;
    const norm = normaliserParSegment(secteur, valeurs);
    for (const s of secteur.segments) paniers[s.personaId][ligne.id] = norm[s.personaId];
  }
  return secteur.segments.map((s) => {
    const p = personaParId(s.personaId);
    return {
      id: s.personaId,
      part: s.part,
      sensibilites: p.sensibilites,
      panier: paniers[s.personaId],
    };
  });
}

export function notorieteMoyenne(secteur: Secteur, parSegment: Record<string, number>): number {
  return secteur.segments.reduce((a, s) => a + s.part * (parSegment[s.personaId] ?? 0), 0);
}

// ---------------------------------------------------------------------------
// Canaux de promotion
// ---------------------------------------------------------------------------

/** Portée : proportion de l'audience du canal exposée assez souvent pour retenir le message. */
export function porteeCanal(canal: CanalPublicite, budget: number): number {
  if (budget < canal.budgetMinimum || budget <= 0) return 0;
  const impressions = (budget / canal.cpm) * 1000;
  return 1 - Math.exp(-impressions / (canal.frequenceEfficace * canal.audience));
}

/** Gain de notoriété d'un canal dans un segment (avant le délai d'effet). */
export function gainCanal(
  canal: CanalPublicite,
  budget: number,
  segmentId: string,
  bonusConversion = 0,
): number {
  return borner(
    porteeCanal(canal, budget) *
      canal.couverture *
      canal.conversion *
      (1 + bonusConversion) *
      (canal.affinites[segmentId] ?? 1),
    0,
    0.6,
  );
}

/** Combine des gains indépendants : 1 − Π(1 − g). */
export function combinerGains(gains: number[]): number {
  return 1 - gains.reduce((a, g) => a * (1 - borner(g, 0, 1)), 1);
}

export interface ResumeCanal {
  canal: CanalPublicite;
  budget: number;
  impressions: number;
  portee: number;
  /** Gain de notoriété moyen sur l'ensemble du marché. */
  gainMoyen: number;
}

/** Résumé de l'effet prévu de chaque canal (pour l'interface). */
export function resumeCanaux(
  secteur: Secteur,
  publicite: Record<string, number>,
  bonusConversion = 0,
): ResumeCanal[] {
  return CANAUX.map((canal) => {
    const budget = publicite[canal.id] ?? 0;
    const gainMoyen = secteur.segments.reduce(
      (a, s) => a + s.part * gainCanal(canal, budget, s.personaId, bonusConversion),
      0,
    );
    return {
      canal,
      budget,
      impressions: budget >= canal.budgetMinimum ? (budget / canal.cpm) * 1000 : 0,
      portee: porteeCanal(canal, budget),
      gainMoyen,
    };
  });
}

/**
 * Inscrit les effets de la publicité du mois dans la file des effets différés :
 * l'effet d'un canal commence après son délai et se répartit sur sa durée.
 */
export function planifierEffetsPublicite(
  m: EtatMarketing,
  secteur: Secteur,
  publicite: Record<string, number>,
  index: number,
  bonusConversion: number,
): void {
  for (const canal of CANAUX) {
    const budget = publicite[canal.id] ?? 0;
    if (budget < canal.budgetMinimum || budget <= 0) continue;
    for (let k = 0; k < canal.dureeEffetMois; k++) {
      const mois = index + canal.delaiMois + k;
      let entree = m.effetsDifferes.find((e) => e.mois === mois);
      if (!entree) {
        entree = { mois, gains: {} };
        m.effetsDifferes.push(entree);
      }
      for (const s of secteur.segments) {
        const g = gainCanal(canal, budget, s.personaId, bonusConversion) / canal.dureeEffetMois;
        entree.gains[s.personaId] = combinerGains([entree.gains[s.personaId] ?? 0, g]);
      }
    }
  }
}

/** Retire de la file les effets de publicité du mois et les retourne. */
export function effetsPubliciteDuMois(m: EtatMarketing, index: number): Record<string, number> {
  const entree = m.effetsDifferes.find((e) => e.mois === index);
  m.effetsDifferes = m.effetsDifferes.filter((e) => e.mois > index);
  return entree ? entree.gains : {};
}

export function totalPublicite(publicite: Record<string, number>): number {
  return Object.values(publicite).reduce((a, x) => a + Math.max(0, x), 0);
}

// ---------------------------------------------------------------------------
// Positionnement : écoresponsabilité, achat local, image
// ---------------------------------------------------------------------------

/** Écoresponsabilité perçue (0 à 1). */
export function scoreEco(d: Pick<Decisions, 'initiativesEco' | 'qualiteId'>): number {
  const initiatives = INITIATIVES_ECO.filter((i) => d.initiativesEco.includes(i.id)).reduce(
    (a, i) => a + i.score,
    0,
  );
  return borner(0.25 + initiatives + (d.qualiteId === 'artisanale' ? 0.1 : 0), 0, 1);
}

/** Achat local perçu (0 à 1) selon les fournisseurs des lignes de base et le Panier Bleu. */
export function scoreLocal(
  d: Pick<Decisions, 'approvisionnement' | 'panierBleu'>,
  secteur: Secteur,
): number {
  let poids = 0;
  let local = 0;
  for (const ligne of secteur.lignes) {
    const w = ligne.tauxAchat * ligne.prixReference;
    poids += w;
    const id = d.approvisionnement[ligne.id]?.fournisseurId;
    if (id && fournisseurParId(id).local) local += w;
  }
  const part = poids > 0 ? local / poids : 0;
  return borner(0.2 + 0.45 * part + (d.panierBleu ? 0.08 : 0), 0, 1);
}

/** Image de marque visée (0 à 1). */
export function imageCible(p: {
  qualite: number;
  ambiance: number;
  note: number;
  eco: number;
  local: number;
  satisfaction: number;
  bonusCommandites: number;
}): number {
  return borner(
    0.3 * p.qualite +
      0.15 * p.ambiance +
      (0.2 * (p.note - 1)) / 4 +
      0.15 * p.eco +
      0.1 * p.local +
      0.1 * p.satisfaction +
      p.bonusCommandites,
    0,
    1,
  );
}

export function evoluerImage(image: number, cible: number): number {
  return borner(lisser(image, cible, 0.15), 0, 1);
}

// ---------------------------------------------------------------------------
// Fidélité, promotions et rétention
// ---------------------------------------------------------------------------

export function evoluerAdhesion(adhesion: number, programme: boolean): number {
  const f = PARAMETRES_MARKETING.fidelite;
  return programme
    ? Math.min(f.adhesionMax, adhesion + f.adhesionMensuelle)
    : Math.max(0, adhesion * 0.5 - 0.01);
}

/** Nombre de promotions dans les 6 derniers mois. */
export function promotionsRecentes(m: EtatMarketing, index: number): number {
  return m.historiquePromos.filter((i) => i >= index - 6 && i < index).length;
}

/**
 * Les clients s'habituent aux promotions trop fréquentes : ils attendent la prochaine.
 * Retourne le malus d'utilité quand il n'y a pas de promotion.
 */
export function malusFatiguePromo(nbRecentes: number): number {
  const seuil = PARAMETRES_MARKETING.promotion.moisFatigue;
  return nbRecentes >= seuil ? -0.08 * (nbRecentes - seuil + 1) : 0;
}

/** Rétention mensuelle des clients (0 à 1). */
export function retentionClients(p: {
  satisfaction: number;
  note: number;
  adhesion: number;
  tauxRupture: number;
}): number {
  const f = PARAMETRES_MARKETING.fidelite;
  return borner(
    0.5 +
      0.45 * (p.satisfaction - 0.55) +
      (p.note - 4) * 0.04 +
      (f.bonusRetention * p.adhesion) / f.adhesionMax -
      0.15 * p.tauxRupture,
    0.3,
    0.92,
  );
}

/** Fonction de répartition de la loi normale (approximation d'Abramowitz et Stegun). */
export function repartitionNormale(z: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.3989423 * Math.exp((-z * z) / 2);
  const p =
    d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return z > 0 ? 1 - p : p;
}

/**
 * Net Promoter Score : % de promoteurs (note de 9 ou 10 sur 10) moins % de détracteurs
 * (0 à 6). Les notes des clients suivent une loi normale dont la moyenne dépend de la
 * satisfaction (un client « satisfait à 70 % » recommande environ à 8,7 sur 10).
 */
export function netPromoterScore(satisfaction: number): number {
  const moyenne = 3.8 + 7 * satisfaction;
  const ecart = 1.8;
  const promoteurs = 1 - repartitionNormale((8.5 - moyenne) / ecart);
  const detracteurs = repartitionNormale((6.5 - moyenne) / ecart);
  return Math.round(100 * (promoteurs - detracteurs));
}

/** Valeur à vie d'un client : marge mensuelle × durée de vie moyenne (1 / (1 − rétention)). */
export function valeurVieClient(margeParClientMois: number, retention: number): number {
  return margeParClientMois / Math.max(0.05, 1 - retention);
}

export function etatMarketingInitial(secteur: Secteur, notoriete: number): EtatMarketing {
  const notorieteSegments: Record<string, number> = {};
  for (const s of secteur.segments) notorieteSegments[s.personaId] = notoriete;
  return {
    notorieteSegments,
    effetsDifferes: [],
    image: 0.45,
    adhesionFidelite: 0,
    clientsActifs: 0,
    retention: 0.5,
    historiquePromos: [],
    initiativesPayees: [],
    tauxRupturePercu: 0,
    etudes: [],
    produits: [],
  };
}

/** Répartition par défaut du budget de publicité. */
export function publiciteParDefaut(): Record<string, number> {
  return { meta: 800, google: 500, flyers: 200 };
}
