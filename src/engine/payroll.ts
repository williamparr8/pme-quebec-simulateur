/**
 * Paie : cotisations de l'employeur au Québec.
 * Les plafonds annuels (MGA, maximum assurable) sont respectés grâce au
 * cumul du salaire brut de l'employé depuis le 1er janvier.
 *
 * Jalon 1 : charges de l'employeur. Les retenues de l'employé (impôts, RRQ,
 * RQAP, AE) seront ajoutées au Jalon 2.
 */
import { COTISATIONS_2026 } from '../data/fiscalite';
import { SEMAINES_PAR_MOIS } from './util';

export interface CotisationsEmployeur {
  rrq: number;
  rqap: number;
  assuranceEmploi: number;
  fss: number;
  cnt: number;
  cnesst: number;
  total: number;
}

const arrondi = (x: number): number => Math.round(x * 100) / 100;

/** Partie du salaire du mois qui est sous un plafond annuel, compte tenu du cumul. */
function partieSousPlafond(brut: number, cumulAvant: number, plafond: number): number {
  return Math.max(0, Math.min(brut, plafond - cumulAvant));
}

/**
 * Cotisations de l'employeur sur le salaire brut d'un mois.
 * @param brut salaire brut du mois (incluant l'indemnité de vacances)
 * @param cumulAvant salaire brut cumulé depuis le début de l'année, avant ce mois
 * @param tauxCnesst taux de cotisation CNESST du secteur (ex. 0.0175)
 * @param masseSalarialeAnnuelle masse salariale annuelle estimée (pour le FSS)
 */
export function cotisationsEmployeur(
  brut: number,
  cumulAvant: number,
  tauxCnesst: number,
  masseSalarialeAnnuelle: number,
): CotisationsEmployeur {
  const c = COTISATIONS_2026;
  if (brut <= 0) {
    return { rrq: 0, rqap: 0, assuranceEmploi: 0, fss: 0, cnt: 0, cnesst: 0, total: 0 };
  }

  // RRQ : exemption de 3 500 $ répartie sur les 12 périodes de paie mensuelles.
  const admissibleRrq = partieSousPlafond(brut, cumulAvant, c.rrq.maximumGainsAdmissibles);
  const baseRrq = Math.max(0, admissibleRrq - c.rrq.exemptionGenerale / 12);
  // 2e cotisation supplémentaire : gains entre le MGA et le MSGA.
  const cumulApres = cumulAvant + brut;
  const supp =
    Math.max(
      0,
      Math.min(cumulApres, c.rrq2.maximumSupplementaireGainsAdmissibles) -
        Math.max(cumulAvant, c.rrq.maximumGainsAdmissibles),
    ) * c.rrq2.taux;
  const rrq = arrondi(baseRrq * c.rrq.tauxEmployeur + supp);

  const rqap = arrondi(
    partieSousPlafond(brut, cumulAvant, c.rqap.maximumRevenuAssurable) * c.rqap.tauxEmployeur,
  );
  const assuranceEmploi = arrondi(
    partieSousPlafond(brut, cumulAvant, c.assuranceEmploi.maximumRemunerationAssurable) *
      c.assuranceEmploi.tauxEmployeur,
  );
  // FSS : taux réduit pour une masse salariale de 1 M$ ou moins (le taux progressif viendra au Jalon 2).
  const tauxFss =
    masseSalarialeAnnuelle <= c.fss.seuilPetiteMasseSalariale
      ? c.fss.tauxPetiteMasseSalariale
      : c.fss.tauxPetiteMasseSalariale * 1.5; // À VÉRIFIER : approximation au-delà du seuil
  const fss = arrondi(brut * tauxFss);
  const cnt = arrondi(
    partieSousPlafond(brut, cumulAvant, c.cnt.maximumRemunerationAssujettie) * c.cnt.taux,
  );
  const cnesst = arrondi(
    partieSousPlafond(brut, cumulAvant, c.cnesst.salaireMaximumAssurable) * tauxCnesst,
  );
  const total = arrondi(rrq + rqap + assuranceEmploi + fss + cnt + cnesst);
  return { rrq, rqap, assuranceEmploi, fss, cnt, cnesst, total };
}

/** Taux de l'indemnité de vacances (4 % la 1re année et jusqu'à 3 ans de service continu). */
export const TAUX_VACANCES = 0.04;

export interface CoutEmploye {
  salaireAnnuel: number;
  vacances: number;
  cotisations: CotisationsEmployeur;
  coutTotal: number;
  /** Coût total divisé par le salaire de base : ex. 1,16 = 16 % de plus que le salaire. */
  facteur: number;
  coutHoraireReel: number;
}

/** « Le vrai coût d'un employé » sur une année complète. */
export function coutAnnuelEmploye(
  salaireHoraire: number,
  heuresSemaine: number,
  tauxCnesst: number,
): CoutEmploye {
  const salaireAnnuel = arrondi(salaireHoraire * heuresPayees(heuresSemaine) * 52);
  const vacances = arrondi(salaireAnnuel * TAUX_VACANCES);
  const brutMensuel = (salaireAnnuel + vacances) / 12;
  const totaux = { rrq: 0, rqap: 0, assuranceEmploi: 0, fss: 0, cnt: 0, cnesst: 0, total: 0 };
  let cumul = 0;
  for (let m = 0; m < 12; m++) {
    const c = cotisationsEmployeur(brutMensuel, cumul, tauxCnesst, 0);
    cumul += brutMensuel;
    totaux.rrq += c.rrq;
    totaux.rqap += c.rqap;
    totaux.assuranceEmploi += c.assuranceEmploi;
    totaux.fss += c.fss;
    totaux.cnt += c.cnt;
    totaux.cnesst += c.cnesst;
    totaux.total += c.total;
  }
  const cotisations: CotisationsEmployeur = {
    rrq: arrondi(totaux.rrq),
    rqap: arrondi(totaux.rqap),
    assuranceEmploi: arrondi(totaux.assuranceEmploi),
    fss: arrondi(totaux.fss),
    cnt: arrondi(totaux.cnt),
    cnesst: arrondi(totaux.cnesst),
    total: arrondi(totaux.total),
  };
  const coutTotal = arrondi(salaireAnnuel + vacances + cotisations.total);
  const heuresAnnuelles = heuresSemaine * 52;
  return {
    salaireAnnuel,
    vacances,
    cotisations,
    coutTotal,
    facteur: salaireAnnuel > 0 ? coutTotal / salaireAnnuel : 0,
    coutHoraireReel: heuresAnnuelles > 0 ? coutTotal / heuresAnnuelles : 0,
  };
}

/** Semaine normale de travail au Québec; les heures en sus sont majorées de 50 %. */
export const SEMAINE_NORMALE = 40;
export const MAJORATION_HEURES_SUPP = 1.5;

/** Heures payées dans une semaine, en tenant compte des heures supplémentaires à 150 %. */
export function heuresPayees(heuresSemaine: number): number {
  const normales = Math.min(heuresSemaine, SEMAINE_NORMALE);
  const supplementaires = Math.max(0, heuresSemaine - SEMAINE_NORMALE);
  return normales + supplementaires * MAJORATION_HEURES_SUPP;
}

/** Salaire brut d'un mois pour un horaire hebdomadaire. */
export function salaireMensuel(salaireHoraire: number, heuresSemaine: number): number {
  return arrondi(salaireHoraire * heuresPayees(heuresSemaine) * SEMAINES_PAR_MOIS);
}
