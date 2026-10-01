/**
 * Conjoncture économique : taux directeur de la Banque du Canada, inflation,
 * indice des prix des fournisseurs et confiance des consommateurs.
 */
import { TAUX_CHANGE, TAUX_INTERET } from '../data/fiscalite';
import type { Rng } from './rng';
import { borner, lisser } from './util';

export type PhaseEconomique = 'expansion' | 'stable' | 'ralentissement';

export interface Conjoncture {
  tauxDirecteur: number;
  /** Inflation annuelle (IPC), ex. 0.022. */
  inflationAnnuelle: number;
  /** Indice cumulatif du coût des fournisseurs (1 au début de la partie). */
  indiceCouts: number;
  /** Indice cumulatif des prix à la consommation (1 au début). */
  indicePrix: number;
  /** Confiance des consommateurs : multiplie la demande (≈ 0,9 à 1,1). */
  confiance: number;
  phase: PhaseEconomique;
  /** Variation du taux directeur annoncée ce mois-ci (0 si aucune). */
  derniereVariation: number;
  /** Dollars canadiens pour 1 $ US. */
  tauxChange: number;
}

export function conjonctureInitiale(): Conjoncture {
  return {
    tauxDirecteur: TAUX_INTERET.tauxDirecteurInitial,
    inflationAnnuelle: 0.022,
    indiceCouts: 1,
    indicePrix: 1,
    confiance: 1,
    phase: 'stable',
    derniereVariation: 0,
    tauxChange: TAUX_CHANGE.usdCadInitial,
  };
}

export function tauxPreferentiel(c: Conjoncture): number {
  return c.tauxDirecteur + TAUX_INTERET.ecartTauxPreferentiel;
}

/** Fait évoluer la conjoncture d'un mois. `mois` est le mois civil (1-12) qui commence. */
export function evoluerConjoncture(c: Conjoncture, mois: number, rng: Rng): Conjoncture {
  // Inflation : processus qui revient lentement vers la cible de 2 % de la Banque du Canada.
  const inflation = borner(
    lisser(c.inflationAnnuelle, 0.021, 0.08) + rng.normal(0, 0.0015),
    -0.005,
    0.06,
  );
  const indicePrix = c.indicePrix * (1 + inflation / 12);
  // Les coûts des fournisseurs suivent l'inflation avec leur propre bruit.
  const indiceCouts = c.indiceCouts * (1 + inflation / 12 + rng.normal(0, 0.0015));

  // Confiance des consommateurs : marche aléatoire qui revient vers 1.
  const confiance = borner(lisser(c.confiance, 1, 0.1) + rng.normal(0, 0.012), 0.85, 1.12);

  // Taux directeur : décisions aux dates d'annonce seulement, par tranches de 0,25 point.
  let tauxDirecteur = c.tauxDirecteur;
  let derniereVariation = 0;
  if ((TAUX_INTERET.moisAnnonces as readonly number[]).includes(mois)) {
    const ecart = inflation - 0.02;
    const pHausse = borner(0.08 + ecart * 25, 0, 0.7);
    const pBaisse = borner(0.08 - ecart * 25 + (confiance < 0.95 ? 0.2 : 0), 0, 0.7);
    const tirage = rng.next();
    if (tirage < pHausse) derniereVariation = 0.0025;
    else if (tirage < pHausse + pBaisse) derniereVariation = -0.0025;
    tauxDirecteur = borner(
      tauxDirecteur + derniereVariation,
      TAUX_INTERET.bornes.min,
      TAUX_INTERET.bornes.max,
    );
    derniereVariation = Math.round((tauxDirecteur - c.tauxDirecteur) * 10000) / 10000;
  }

  const phase: PhaseEconomique =
    confiance > 1.03 ? 'expansion' : confiance < 0.96 ? 'ralentissement' : 'stable';

  // Taux de change : marche aléatoire qui revient lentement vers le taux de référence.
  const tauxChange = borner(
    lisser(c.tauxChange ?? TAUX_CHANGE.usdCadInitial, TAUX_CHANGE.reference, 0.05) +
      rng.normal(0, 0.012),
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
    derniereVariation,
    tauxChange: Math.round(tauxChange * 10000) / 10000,
  };
}
