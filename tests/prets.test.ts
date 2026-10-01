import { describe, expect, it } from 'vitest';
import {
  creerPret,
  effectuerVersement,
  portionCourante,
  prochainVersement,
  rembourserPartiellement,
  tableauAmortissement,
  versementMensuel,
} from '../src/engine/loans';

describe('prêts et tableau d’amortissement', () => {
  it('calcule le versement mensuel d’une annuité (100 000 $ à 6 % sur 5 ans = 1 933,28 $)', () => {
    expect(versementMensuel(10_000_000, 0.06, 60)).toBe(193_328);
  });

  it('gère un taux nul et un capital nul', () => {
    expect(versementMensuel(120_000, 0, 12)).toBe(10_000);
    expect(versementMensuel(0, 0.05, 12)).toBe(0);
    expect(() => versementMensuel(1000, 0.05, 0)).toThrow();
  });

  it('le solde final du tableau d’amortissement est exactement 0', () => {
    for (const [capital, taux, duree] of [
      [8_500_000, 0.0695, 60],
      [2_345_678, 0.0425, 36],
      [15_000_000, 0.08, 120],
    ]) {
      const pret = creerPret('p', 'Prêt', capital, taux, duree);
      const tableau = tableauAmortissement(pret);
      expect(tableau).toHaveLength(duree);
      expect(tableau.at(-1)?.solde).toBe(0);
      const totalCapital = tableau.reduce((a, l) => a + l.capital, 0);
      expect(totalCapital).toBe(capital);
      // Les intérêts diminuent à chaque versement.
      expect(tableau[0].interets).toBeGreaterThan(tableau[duree - 1].interets);
    }
  });

  it('la portion courante correspond au capital des 12 prochains versements', () => {
    const pret = creerPret('p', 'Prêt', 6_000_000, 0.07, 60);
    const attendu = tableauAmortissement(pret)
      .slice(0, 12)
      .reduce((a, l) => a + l.capital, 0);
    expect(portionCourante(pret)).toBe(attendu);
    expect(portionCourante(pret)).toBeLessThan(pret.solde);
  });

  it('un remboursement anticipé réduit le solde et le versement', () => {
    const pret = creerPret('p', 'Prêt', 5_000_000, 0.07, 60);
    effectuerVersement(pret);
    const versementAvant = pret.versementMensuel;
    const rembourse = rembourserPartiellement(pret, 1_000_000);
    expect(rembourse).toBe(1_000_000);
    expect(pret.versementMensuel).toBeLessThan(versementAvant);
    expect(tableauAmortissement(pret).at(-1)?.solde).toBe(0);
    // On ne peut pas rembourser plus que le solde.
    expect(rembourserPartiellement(pret, 999_999_999)).toBeLessThan(999_999_999);
    expect(pret.solde).toBe(0);
    expect(prochainVersement(pret)).toEqual({ interets: 0, capital: 0 });
  });
});
