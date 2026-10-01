/**
 * Conjoncture économique : cycle économique (expansion, ralentissement, récession,
 * reprise), taux de chômage, inflation, taux directeur de la Banque du Canada,
 * indice des prix des fournisseurs, confiance des consommateurs et taux de change.
 *
 * Le cycle suit une chaîne de Markov : chaque mois, la phase peut changer selon des
 * probabilités de transition (une récession dure en moyenne environ 9 mois). La
 * confiance, le chômage et l'inflation se rapprochent graduellement des valeurs
 * typiques de la phase en cours.
 */
import { TAUX_CHANGE, TAUX_INTERET } from '../data/fiscalite';
import type { Rng } from './rng';
import { borner, lisser } from './util';

export type PhaseEconomique = 'expansion' | 'stable' | 'ralentissement' | 'recession' | 'reprise';

export interface Conjoncture {
  tauxDirecteur: number;
  /** Inflation annuelle (IPC), ex. 0.022. */
  inflationAnnuelle: number;
  /** Indice cumulatif du coût des fournisseurs (1 au début de la partie). */
  indiceCouts: number;
  /** Indice cumulatif des prix à la consommation (1 au début). */
  indicePrix: number;
  /** Confiance des consommateurs : multiplie la demande (≈ 0,85 à 1,1). */
  confiance: number;
  phase: PhaseEconomique;
  /** Nombre de mois depuis le début de la phase. */
  moisPhase: number;
  /** Taux de chômage moyen au Québec. */
  chomage: number;
  /** Variation du taux directeur annoncée ce mois-ci (0 si aucune). */
  derniereVariation: number;
  /** Dollars canadiens pour 1 $ US. */
  tauxChange: number;
}

/** Valeurs typiques de chaque phase du cycle. */
export const PHASES: Record<
  PhaseEconomique,
  { confiance: number; chomage: number; inflation: number }
> = {
  expansion: { confiance: 1.05, chomage: 0.05, inflation: 0.026 },
  stable: { confiance: 1.0, chomage: 0.056, inflation: 0.021 },
  ralentissement: { confiance: 0.96, chomage: 0.062, inflation: 0.018 },
  recession: { confiance: 0.89, chomage: 0.078, inflation: 0.012 },
  reprise: { confiance: 0.97, chomage: 0.066, inflation: 0.017 },
};

/** Probabilités mensuelles de passer à une autre phase. */
export const TRANSITIONS: Record<PhaseEconomique, Partial<Record<PhaseEconomique, number>>> = {
  stable: { expansion: 0.04, ralentissement: 0.035 },
  expansion: { stable: 0.05, ralentissement: 0.015 },
  ralentissement: { recession: 0.1, stable: 0.08 },
  recession: { reprise: 0.11 },
  reprise: { stable: 0.12, expansion: 0.03 },
};

/** Chômage moyen au Québec au début de la partie (Guichet-Emplois, août 2026). */
export const CHOMAGE_INITIAL = 0.056;

export function conjonctureInitiale(): Conjoncture {
  return {
    tauxDirecteur: TAUX_INTERET.tauxDirecteurInitial,
    inflationAnnuelle: 0.022,
    indiceCouts: 1,
    indicePrix: 1,
    confiance: 1,
    phase: 'stable',
    moisPhase: 0,
    chomage: CHOMAGE_INITIAL,
    derniereVariation: 0,
    tauxChange: TAUX_CHANGE.usdCadInitial,
  };
}

export function tauxPreferentiel(c: Conjoncture): number {
  return c.tauxDirecteur + TAUX_INTERET.ecartTauxPreferentiel;
}

/** Tire la phase du mois suivant. `risqueRecession` multiplie les transitions défavorables. */
export function prochainePhase(
  phase: PhaseEconomique,
  rng: Rng,
  risqueRecession = 1,
): PhaseEconomique {
  const tirage = rng.next();
  let cumul = 0;
  for (const [suivante, p] of Object.entries(TRANSITIONS[phase]) as [PhaseEconomique, number][]) {
    const defavorable = suivante === 'ralentissement' || suivante === 'recession';
    cumul += p * (defavorable ? risqueRecession : 1);
    if (tirage < cumul) return suivante;
  }
  return phase;
}

/**
 * Fait évoluer la conjoncture d'un mois. `mois` est le mois civil (1-12) qui commence.
 * @param risqueRecession multiplie les probabilités de ralentissement et de récession
 */
export function evoluerConjoncture(
  c: Conjoncture,
  mois: number,
  rng: Rng,
  risqueRecession = 1,
): Conjoncture {
  const ancienne = c.phase ?? 'stable';
  const phase = prochainePhase(ancienne, rng, risqueRecession);
  const cible = PHASES[phase];

  // Inflation : revient vers la valeur typique de la phase (la cible de la Banque du Canada est 2 %).
  const inflation = borner(
    lisser(c.inflationAnnuelle, cible.inflation, 0.08) + rng.normal(0, 0.0015),
    -0.005,
    0.07,
  );
  const indicePrix = c.indicePrix * (1 + inflation / 12);
  // Les coûts des fournisseurs suivent l'inflation avec leur propre bruit.
  const indiceCouts = c.indiceCouts * (1 + inflation / 12 + rng.normal(0, 0.0015));

  // Confiance des consommateurs et chômage : se rapprochent de la phase.
  const confiance = borner(
    lisser(c.confiance, cible.confiance, 0.18) + rng.normal(0, 0.01),
    0.8,
    1.12,
  );
  const chomage = borner(
    lisser(c.chomage ?? CHOMAGE_INITIAL, cible.chomage, 0.15) + rng.normal(0, 0.001),
    0.03,
    0.12,
  );

  // Taux directeur : décisions aux dates d'annonce seulement, par tranches de 0,25 point.
  let tauxDirecteur = c.tauxDirecteur;
  let derniereVariation = 0;
  if ((TAUX_INTERET.moisAnnonces as readonly number[]).includes(mois)) {
    const ecart = inflation - 0.02;
    const faible = phase === 'recession' || phase === 'ralentissement';
    const pHausse = borner(0.08 + ecart * 25 - (faible ? 0.1 : 0), 0, 0.7);
    const pBaisse = borner(0.08 - ecart * 25 + (faible ? 0.3 : 0), 0, 0.75);
    const tirage = rng.next();
    if (tirage < pHausse) derniereVariation = 0.0025;
    else if (tirage < pHausse + pBaisse)
      derniereVariation = phase === 'recession' ? -0.005 : -0.0025;
    tauxDirecteur = borner(
      tauxDirecteur + derniereVariation,
      TAUX_INTERET.bornes.min,
      TAUX_INTERET.bornes.max,
    );
    derniereVariation = Math.round((tauxDirecteur - c.tauxDirecteur) * 10000) / 10000;
  }

  // Taux de change : marche aléatoire qui revient lentement vers le taux de référence
  // (le dollar canadien s'affaiblit un peu en récession).
  const tauxChange = borner(
    lisser(
      c.tauxChange ?? TAUX_CHANGE.usdCadInitial,
      TAUX_CHANGE.reference * (phase === 'recession' ? 1.04 : 1),
      0.05,
    ) + rng.normal(0, 0.012),
    TAUX_CHANGE.bornes.min,
    TAUX_CHANGE.bornes.max,
  );

  return {
    tauxDirecteur: Math.round(tauxDirecteur * 10000) / 10000,
    inflationAnnuelle: inflation,
    indiceCouts,
    indicePrix,
    confiance,
    phase,
    moisPhase: phase === ancienne ? (c.moisPhase ?? 0) + 1 : 0,
    chomage: Math.round(chomage * 10000) / 10000,
    derniereVariation,
    tauxChange: Math.round(tauxChange * 10000) / 10000,
  };
}

/** Taux de chômage d'une ville : celui de sa région, décalé selon le cycle. */
export function chomageVille(chomageRegion: number, c: Conjoncture): number {
  return borner(chomageRegion + ((c.chomage ?? CHOMAGE_INITIAL) - CHOMAGE_INITIAL), 0.02, 0.15);
}

/**
 * Effet de la conjoncture sur la demande d'un secteur : un secteur cyclique (meubles,
 * vêtements) réagit plus fortement aux variations de la confiance qu'un secteur de
 * besoins courants (coiffure).
 */
export function facteurConjoncture(c: Conjoncture, cyclicite: number): number {
  return Math.max(0.6, 1 + cyclicite * (c.confiance - 1));
}

/** Les ménages sont plus sensibles aux prix quand l'économie ralentit. */
export function sensibilitePrixConjoncture(c: Conjoncture): number {
  return borner(1 + 1.2 * (1 - c.confiance), 0.9, 1.25);
}
