/**
 * Budget et prévisions : estimation des ventes et du bénéfice du prochain mois à partir
 * du dernier mois et de la saisonnalité, et écarts entre le prévu et le réel.
 */
import type { Secteur } from './data-types';
import type { Entreprise, MoisArchive } from './types';

export interface Prevision {
  ventes: number;
  benefice: number;
}

/** Estimation simple : ventes du dernier mois ajustées selon la saison. */
export function estimerMois(
  ent: Entreprise,
  secteur: Secteur,
  moisCible: number,
): Prevision | null {
  const derniere = ent.archives.at(-1);
  if (!derniere) return null;
  const i = derniere.indicateurs;
  const saison = secteur.saisonnalite[moisCible - 1] / secteur.saisonnalite[derniere.mois - 1];
  const ventes = Math.round(i.chiffreAffaires * saison);
  const benefice = Math.round(i.beneficeNet + (ventes - i.chiffreAffaires) * i.tauxMargeBrute);
  return { ventes, benefice };
}

export interface EcartPrevision {
  index: number;
  annee: number;
  mois: number;
  prevu: Prevision;
  reel: Prevision;
  /** Écart relatif des ventes : (réel − prévu) / prévu. */
  ecartVentes: number;
  ecartBenefice: number;
}

export function ecartsPrevisions(archives: readonly MoisArchive[]): EcartPrevision[] {
  return archives
    .filter((a): a is MoisArchive & { prevision: Prevision } => a.prevision !== null)
    .map((a) => ({
      index: a.index,
      annee: a.annee,
      mois: a.mois,
      prevu: a.prevision,
      reel: { ventes: a.indicateurs.chiffreAffaires, benefice: a.indicateurs.beneficeNet },
      ecartVentes:
        a.prevision.ventes > 0 ? a.indicateurs.chiffreAffaires / a.prevision.ventes - 1 : 0,
      ecartBenefice: a.indicateurs.beneficeNet - a.prevision.benefice,
    }));
}

/** Erreur moyenne absolue des prévisions de ventes (en proportion). */
export function precisionPrevisions(ecarts: readonly EcartPrevision[]): number | null {
  if (ecarts.length === 0) return null;
  return ecarts.reduce((a, e) => a + Math.abs(e.ecartVentes), 0) / ecarts.length;
}
