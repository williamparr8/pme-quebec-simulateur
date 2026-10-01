/**
 * Fiscalité : taxes de vente (TPS/TVQ), impôt des particuliers (fédéral et Québec),
 * impôt des sociétés (DPE et critère des heures rémunérées), retenues à la source
 * et comparaison salaire ou dividendes. Fonctions pures, montants en dollars.
 */
import {
  COTISATIONS_2026,
  IMPOT_PARTICULIERS_2026,
  IMPOT_SOCIETES,
  RETENUES_EMPLOYE_2026,
  TAXES_VENTE,
  type Palier,
} from '../data/fiscalite';
import { cotisationsEmployeur } from './payroll';

const arrondi = (x: number): number => Math.round(x * 100) / 100;

// ---------------------------------------------------------------------------
// TPS / TVQ
// ---------------------------------------------------------------------------

export interface TaxesVente {
  tps: number;
  tvq: number;
  total: number;
}

/** Taxes sur un montant avant taxes. La TVQ ne s'applique pas sur la TPS depuis 2013. */
export function taxesSur(montantAvantTaxes: number): TaxesVente {
  const tps = arrondi(montantAvantTaxes * TAXES_VENTE.tps);
  const tvq = arrondi(montantAvantTaxes * TAXES_VENTE.tvq);
  return { tps, tvq, total: arrondi(tps + tvq) };
}

/** Facteur prix affiché → prix payé (1,14975 au Québec). */
export const FACTEUR_TAXES = 1 + TAXES_VENTE.tps + TAXES_VENTE.tvq;

export interface DeclarationTaxes {
  tpsPercue: number;
  tvqPercue: number;
  /** Crédits de taxe sur les intrants (TPS payée sur les achats). */
  cti: number;
  /** Remboursements de taxe sur les intrants (TVQ payée sur les achats). */
  rti: number;
  tpsNette: number;
  tvqNette: number;
  /** Montant à remettre (positif) ou remboursement à recevoir (négatif). */
  solde: number;
}

export function declarationTaxes(tpsPercue: number, tvqPercue: number, cti: number, rti: number): DeclarationTaxes {
  const tpsNette = arrondi(tpsPercue - cti);
  const tvqNette = arrondi(tvqPercue - rti);
  return { tpsPercue, tvqPercue, cti, rti, tpsNette, tvqNette, solde: arrondi(tpsNette + tvqNette) };
}

/** L'inscription devient obligatoire si les ventes taxables des 4 derniers trimestres dépassent 30 000 $. */
export function depasseSeuilPetitFournisseur(ventesQuatreTrimestres: number): boolean {
  return ventesQuatreTrimestres > TAXES_VENTE.seuilPetitFournisseur;
}

// ---------------------------------------------------------------------------
// Impôt des particuliers
// ---------------------------------------------------------------------------

/** Impôt progressif selon des paliers. */
export function impotProgressif(revenu: number, paliers: readonly Palier[]): number {
  let impot = 0;
  let bas = 0;
  for (const p of paliers) {
    if (revenu <= bas) break;
    impot += (Math.min(revenu, p.jusqua) - bas) * p.taux;
    bas = p.jusqua;
  }
  return impot;
}

export function tauxMarginal(revenu: number, paliers: readonly Palier[]): number {
  let bas = 0;
  for (const p of paliers) {
    if (revenu <= p.jusqua) return p.taux;
    bas = p.jusqua;
  }
  return paliers[paliers.length - 1]?.taux ?? bas;
}

export interface RevenusPersonnels {
  emploi?: number;
  /** Revenu net d'entreprise (entreprise individuelle ou part d'une société de personnes). */
  entreprise?: number;
  dividendesNonDetermines?: number;
  dividendesDetermines?: number;
}

export interface ImpotPersonnel {
  revenuImposable: number;
  impotFederal: number;
  impotQuebec: number;
  /** RRQ et RQAP d'un travailleur autonome sur le revenu d'entreprise. */
  cotisationsAutonome: number;
  total: number;
  tauxMoyen: number;
  tauxMarginalCombine: number;
}

/**
 * Impôt personnel simplifié mais fidèle : paliers 2026, montants personnels de base,
 * abattement du Québec de 16,5 %, majoration et crédits pour dividendes.
 * Simplifications : pas d'autres crédits ni de déductions (REER, frais de garde, etc.).
 */
export function impotPersonnel(r: RevenusPersonnels): ImpotPersonnel {
  const I = IMPOT_PARTICULIERS_2026;
  const emploi = Math.max(0, r.emploi ?? 0);
  const entreprise = r.entreprise ?? 0;
  const divND = Math.max(0, r.dividendesNonDetermines ?? 0) * (1 + I.dividendes.nonDetermines.majoration);
  const divD = Math.max(0, r.dividendesDetermines ?? 0) * (1 + I.dividendes.determines.majoration);
  const revenuImposable = Math.max(0, emploi + entreprise + divND + divD);

  const fedBrut =
    impotProgressif(revenuImposable, I.federal.paliers) -
    I.federal.tauxCredits * I.federal.montantPersonnelBase -
    divND * I.dividendes.nonDetermines.creditFederal -
    divD * I.dividendes.determines.creditFederal;
  const impotFederal = arrondi(Math.max(0, fedBrut) * (1 - I.federal.abattementQuebec));

  const qcBrut =
    impotProgressif(revenuImposable, I.quebec.paliers) -
    I.quebec.tauxCredits * I.quebec.montantPersonnelBase -
    divND * I.dividendes.nonDetermines.creditQuebec -
    divD * I.dividendes.determines.creditQuebec;
  const impotQuebec = arrondi(Math.max(0, qcBrut));

  const c = COTISATIONS_2026;
  const baseRrq = Math.max(0, Math.min(entreprise, c.rrq.maximumGainsAdmissibles) - c.rrq.exemptionGenerale);
  const cotisationsAutonome = arrondi(
    baseRrq * I.travailleurAutonome.tauxRrq +
      Math.max(0, Math.min(entreprise, c.rqap.maximumRevenuAssurable)) * I.travailleurAutonome.tauxRqap,
  );

  const total = arrondi(impotFederal + impotQuebec + cotisationsAutonome);
  return {
    revenuImposable: arrondi(revenuImposable),
    impotFederal,
    impotQuebec,
    cotisationsAutonome,
    total,
    tauxMoyen: emploi + entreprise + (r.dividendesNonDetermines ?? 0) + (r.dividendesDetermines ?? 0) > 0
      ? total / (emploi + entreprise + (r.dividendesNonDetermines ?? 0) + (r.dividendesDetermines ?? 0))
      : 0,
    tauxMarginalCombine:
      tauxMarginal(revenuImposable, I.federal.paliers) * (1 - I.federal.abattementQuebec) +
      tauxMarginal(revenuImposable, I.quebec.paliers),
  };
}

// ---------------------------------------------------------------------------
// Retenues à la source d'un employé
// ---------------------------------------------------------------------------

export interface RetenuesEmploye {
  rrq: number;
  rqap: number;
  assuranceEmploi: number;
  impotFederal: number;
  impotQuebec: number;
  total: number;
  net: number;
}

/**
 * Retenues sur la paie d'un mois. L'impôt retenu est estimé par la méthode
 * d'annualisation (salaire du mois × 12), comme le font les tables de retenues.
 * @param assurable faux pour un actionnaire qui contrôle plus de 40 % des actions (exclu de l'AE)
 */
export function retenuesEmploye(brut: number, cumulAvant: number, assurable = true): RetenuesEmploye {
  const c = COTISATIONS_2026;
  const t = RETENUES_EMPLOYE_2026;
  if (brut <= 0) {
    return { rrq: 0, rqap: 0, assuranceEmploi: 0, impotFederal: 0, impotQuebec: 0, total: 0, net: 0 };
  }
  const sous = (plafond: number) => Math.max(0, Math.min(brut, plafond - cumulAvant));
  const rrq = arrondi(Math.max(0, sous(c.rrq.maximumGainsAdmissibles) - c.rrq.exemptionGenerale / 12) * t.rrq);
  const rqap = arrondi(sous(c.rqap.maximumRevenuAssurable) * t.rqap);
  const assuranceEmploi = assurable ? arrondi(sous(c.assuranceEmploi.maximumRemunerationAssurable) * t.assuranceEmploi) : 0;
  const annuel = impotPersonnel({ emploi: brut * 12 });
  const impotFederal = arrondi(annuel.impotFederal / 12);
  const impotQuebec = arrondi(annuel.impotQuebec / 12);
  const total = arrondi(rrq + rqap + assuranceEmploi + impotFederal + impotQuebec);
  return { rrq, rqap, assuranceEmploi, impotFederal, impotQuebec, total, net: arrondi(brut - total) };
}

// ---------------------------------------------------------------------------
// Impôt des sociétés
// ---------------------------------------------------------------------------

export interface ImpotSociete {
  revenuImposable: number;
  /** Proportion de la DPE du Québec accordée selon les heures rémunérées (0 à 1). */
  facteurDpeQuebec: number;
  impotFederal: number;
  impotQuebec: number;
  total: number;
  tauxEffectif: number;
}

/** Proportion de la déduction pour petite entreprise du Québec selon les heures rémunérées. */
export function facteurHeuresQuebec(heuresRemunerees: number): number {
  const q = IMPOT_SOCIETES.quebec;
  if (heuresRemunerees >= q.heuresCompletes) return 1;
  if (heuresRemunerees <= q.heuresMinimum) return 0;
  return (heuresRemunerees - q.heuresMinimum) / (q.heuresCompletes - q.heuresMinimum);
}

/**
 * Impôt d'une société privée sous contrôle canadien (SPCC).
 * @param dpe faux pour calculer l'impôt sans la déduction pour petite entreprise
 */
export function impotSociete(revenuImposable: number, heuresRemunerees: number, dpe = true): ImpotSociete {
  const s = IMPOT_SOCIETES;
  const revenu = Math.max(0, revenuImposable);
  const admissible = dpe ? Math.min(revenu, s.plafondAffaires) : 0;
  const reste = revenu - admissible;
  const impotFederal = arrondi(admissible * s.federal.tauxPetiteEntreprise + reste * s.federal.tauxGeneral);
  const facteur = dpe ? facteurHeuresQuebec(heuresRemunerees) : 0;
  const tauxQcPme = s.quebec.tauxGeneral - (s.quebec.tauxGeneral - s.quebec.tauxPetiteEntreprise) * facteur;
  const impotQuebec = arrondi(admissible * tauxQcPme + reste * s.quebec.tauxGeneral);
  const total = arrondi(impotFederal + impotQuebec);
  return {
    revenuImposable: arrondi(revenu),
    facteurDpeQuebec: facteur,
    impotFederal,
    impotQuebec,
    total,
    tauxEffectif: revenu > 0 ? total / revenu : 0,
  };
}

// ---------------------------------------------------------------------------
// Rémunération du propriétaire d'une société : salaire ou dividendes?
// ---------------------------------------------------------------------------

export interface ScenarioRemuneration {
  salaire: number;
  dividendes: number;
  /** Coût pour la société : salaire + cotisations de l'employeur. */
  coutSociete: number;
  impotSociete: number;
  impotPersonnel: number;
  /** Cotisations RRQ et RQAP (employé et employeur). */
  cotisationsTotales: number;
  /** Ce qui reste au propriétaire après tous les impôts et cotisations. */
  argentEnPoche: number;
  /** Droits de cotisation REER créés (18 % du salaire). */
  droitsReer: number;
  /** Le salaire donne droit à une rente du RRQ. */
  cotiseAuRrq: boolean;
}

/**
 * Compare la façon de retirer un bénéfice avant impôt de la société, avec une part
 * versée en salaire (le reste en dividendes non déterminés après impôt de la société).
 */
export function scenarioRemuneration(
  beneficeAvantRemuneration: number,
  partSalaire: number,
  heuresRemunereesAutres: number,
): ScenarioRemuneration {
  const benefice = Math.max(0, beneficeAvantRemuneration);
  // Le salaire et les cotisations de l'employeur sont déductibles : on cherche le salaire brut
  // dont le coût total (salaire + charges) égale la part choisie du bénéfice.
  const coutVise = benefice * Math.min(1, Math.max(0, partSalaire));
  let salaire = coutVise / 1.12;
  for (let i = 0; i < 6; i++) salaire = Math.max(0, coutVise - annuel(salaire));
  const charges = annuel(salaire);
  const coutSociete = arrondi(salaire + charges);
  const heures = heuresRemunereesAutres + (salaire > 0 ? 2080 : 0);
  const impotSoc = impotSociete(benefice - coutSociete, heures);
  const dividendes = arrondi(Math.max(0, benefice - coutSociete - impotSoc.total));
  const retenues = Array.from({ length: 12 }, (_, m) => retenuesEmploye(salaire / 12, (salaire / 12) * m, false));
  const cotisationsEmploye = retenues.reduce((a, r) => a + r.rrq + r.rqap, 0);
  const perso = impotPersonnel({ emploi: salaire, dividendesNonDetermines: dividendes });
  const argentEnPoche = arrondi(salaire - cotisationsEmploye + dividendes - perso.impotFederal - perso.impotQuebec);
  return {
    salaire: arrondi(salaire),
    dividendes,
    coutSociete,
    impotSociete: impotSoc.total,
    impotPersonnel: arrondi(perso.impotFederal + perso.impotQuebec),
    cotisationsTotales: arrondi(cotisationsEmploye + charges),
    argentEnPoche,
    droitsReer: arrondi(Math.min(salaire * 0.18, 33_810)),
    cotiseAuRrq: salaire > 3_500,

  };

  /** Cotisations annuelles de l'employeur pour un actionnaire (exclu de l'AE). */
  function annuel(s: number): number {
    let total = 0;
    for (let m = 0; m < 12; m++) {
      const c = cotisationsEmployeur(s / 12, (s / 12) * m, 0, 0);
      total += c.total - c.assuranceEmploi;
    }
    return total;
  }
}
