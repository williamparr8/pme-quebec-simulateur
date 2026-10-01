import { describe, expect, it } from 'vitest';
import { coutAnnuelEmploye, cotisationsEmployeur, salaireMensuel } from '../src/engine/payroll';

const TAUX_CNESST = 0.0175;
const exemptionMensuelle = 3500 / 12;

/** Vérifie un montant au cent près (l'arrondi d'un demi-cent peut varier). */
function auCentPres(obtenu: number, attendu: number) {
  expect(Math.abs(obtenu - attendu)).toBeLessThanOrEqual(0.011);
}

describe('paie : cotisations de l’employeur (taux 2026)', () => {
  it('salaire type 1 : barista, 2 000 $ par mois, début d’année', () => {
    const c = cotisationsEmployeur(2000, 0, TAUX_CNESST, 200_000);
    auCentPres(c.rrq, (2000 - exemptionMensuelle) * 0.063); // 107,63 $
    auCentPres(c.rqap, 2000 * 0.00602); // 12,04 $
    auCentPres(c.assuranceEmploi, 2000 * 0.0182); // 36,40 $
    auCentPres(c.fss, 2000 * 0.0165); // 33,00 $
    auCentPres(c.cnt, 2000 * 0.0006); // 1,20 $
    auCentPres(c.cnesst, 2000 * TAUX_CNESST); // 35,00 $
    auCentPres(c.total, c.rrq + c.rqap + c.assuranceEmploi + c.fss + c.cnt + c.cnesst);
  });

  it('salaire type 2 : gérant, 4 500 $ par mois, en milieu d’année', () => {
    const c = cotisationsEmployeur(4500, 27_000, TAUX_CNESST, 300_000);
    auCentPres(c.rrq, (4500 - exemptionMensuelle) * 0.063);
    auCentPres(c.rqap, 4500 * 0.00602);
    auCentPres(c.assuranceEmploi, 4500 * 0.0182);
    auCentPres(c.fss, 4500 * 0.0165);
  });

  it('salaire type 3 : cadre, 9 000 $ par mois, plafonds annuels atteints', () => {
    // Cumul de 72 000 $ : il reste 2 600 $ sous le MGA du RRQ (74 600 $), l'AE est déjà plafonnée (68 900 $).
    const c = cotisationsEmployeur(9000, 72_000, TAUX_CNESST, 500_000);
    const rrqBase = (2600 - exemptionMensuelle) * 0.063;
    const rrq2 = (81_000 - 74_600) * 0.04; // 2e cotisation supplémentaire
    auCentPres(c.rrq, rrqBase + rrq2);
    expect(c.assuranceEmploi).toBe(0);
    auCentPres(c.rqap, 9000 * 0.00602);
    auCentPres(c.cnesst, 9000 * TAUX_CNESST);
  });

  it('aucune cotisation sur un salaire nul; FSS plus élevé au-delà de 1 M$', () => {
    expect(cotisationsEmployeur(0, 0, TAUX_CNESST, 0).total).toBe(0);
    const petite = cotisationsEmployeur(3000, 0, TAUX_CNESST, 500_000).fss;
    const grande = cotisationsEmployeur(3000, 0, TAUX_CNESST, 2_000_000).fss;
    expect(grande).toBeGreaterThan(petite);
  });

  it('le vrai coût d’un employé dépasse son salaire d’environ 15 à 18 %', () => {
    const cout = coutAnnuelEmploye(17.25, 28, TAUX_CNESST);
    expect(cout.salaireAnnuel).toBeCloseTo(17.25 * 28 * 52, 2);
    expect(cout.vacances).toBeCloseTo(cout.salaireAnnuel * 0.04, 2);
    expect(cout.facteur).toBeGreaterThan(1.14);
    expect(cout.facteur).toBeLessThan(1.19);
    expect(cout.coutHoraireReel).toBeGreaterThan(17.25);
    expect(coutAnnuelEmploye(20, 0, TAUX_CNESST).facteur).toBe(0);
  });

  it('salaire mensuel = taux × heures × 52 / 12', () => {
    expect(salaireMensuel(18, 30)).toBeCloseTo((18 * 30 * 52) / 12, 2);
  });

  it('les heures au-delà de 40 h par semaine sont payées à 150 %', () => {
    // 44 h = 40 h normales + 4 h × 1,5 = 46 h payées
    expect(salaireMensuel(20, 44)).toBeCloseTo((20 * 46 * 52) / 12, 2);
  });
});
