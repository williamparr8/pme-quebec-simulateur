import { describe, expect, it } from 'vitest';
import {
  FACTEUR_TAXES,
  declarationTaxes,
  depasseSeuilPetitFournisseur,
  facteurHeuresQuebec,
  impotPersonnel,
  impotProgressif,
  impotSociete,
  retenuesEmploye,
  scenarioRemuneration,
  taxesSur,
  tauxMarginal,
} from '../src/engine/tax';

function auCentPres(obtenu: number, attendu: number) {
  expect(Math.abs(obtenu - attendu)).toBeLessThanOrEqual(0.011);
}

describe('TPS et TVQ', () => {
  it('calcule les taxes sur des cas connus', () => {
    expect(taxesSur(100)).toEqual({ tps: 5, tvq: 9.98, total: 14.98 });
    expect(taxesSur(1234.56)).toEqual({ tps: 61.73, tvq: 123.15, total: 184.88 });
    expect(taxesSur(0).total).toBe(0);
    expect(FACTEUR_TAXES).toBeCloseTo(1.14975, 6);
  });

  it('les CTI et RTI réduisent les taxes à remettre', () => {
    // Ventes de 10 000 $ et achats taxables de 4 000 $
    const ventes = taxesSur(10_000);
    const achats = taxesSur(4_000);
    const d = declarationTaxes(ventes.tps, ventes.tvq, achats.tps, achats.tvq);
    expect(d.tpsNette).toBe(300);
    expect(d.tvqNette).toBeCloseTo(598.5, 2);
    expect(d.solde).toBeCloseTo(898.5, 2);
    // Plus d'achats que de ventes : remboursement
    expect(declarationTaxes(50, 99.75, 200, 399).solde).toBeLessThan(0);
  });

  it('applique le seuil du petit fournisseur de 30 000 $', () => {
    expect(depasseSeuilPetitFournisseur(29_999)).toBe(false);
    expect(depasseSeuilPetitFournisseur(30_001)).toBe(true);
  });
});

describe('impôt des particuliers 2026', () => {
  it('impôt progressif par paliers', () => {
    const paliers = [
      { jusqua: 10_000, taux: 0.1 },
      { jusqua: Infinity, taux: 0.2 },
    ];
    expect(impotProgressif(5_000, paliers)).toBe(500);
    expect(impotProgressif(15_000, paliers)).toBe(2_000);
    expect(tauxMarginal(15_000, paliers)).toBe(0.2);
  });

  it('salaire de 50 000 $ : impôt fédéral (avec abattement) et du Québec', () => {
    const i = impotPersonnel({ emploi: 50_000 });
    auCentPres(i.impotFederal, (50_000 * 0.14 - 0.14 * 16_452) * 0.835);
    auCentPres(i.impotQuebec, 50_000 * 0.14 - 0.14 * 18_952);
    expect(i.cotisationsAutonome).toBe(0);
    expect(i.tauxMoyen).toBeGreaterThan(0.1);
    expect(i.tauxMoyen).toBeLessThan(0.25);
  });

  it('aucun impôt sous les montants personnels de base', () => {
    expect(impotPersonnel({ emploi: 15_000 }).total).toBe(0);
  });

  it('un travailleur autonome paie les deux parts du RRQ', () => {
    const i = impotPersonnel({ entreprise: 50_000 });
    expect(i.cotisationsAutonome).toBeGreaterThan((50_000 - 3_500) * 0.126);
  });

  it('les dividendes non déterminés sont majorés de 15 % et donnent droit à un crédit', () => {
    const i = impotPersonnel({ dividendesNonDetermines: 40_000 });
    expect(i.revenuImposable).toBe(46_000);
    const sansCredit = impotPersonnel({ emploi: 46_000 });
    expect(i.impotFederal + i.impotQuebec).toBeLessThan(sansCredit.impotFederal + sansCredit.impotQuebec);
  });
});

describe('retenues à la source', () => {
  it('retient RRQ, RQAP, AE et impôts; le net est cohérent', () => {
    const r = retenuesEmploye(3_000, 0);
    auCentPres(r.rrq, (3_000 - 3_500 / 12) * 0.063);
    auCentPres(r.rqap, 3_000 * 0.0043);
    auCentPres(r.assuranceEmploi, 3_000 * 0.013);
    expect(r.impotFederal).toBeGreaterThan(0);
    expect(r.impotQuebec).toBeGreaterThan(0);
    auCentPres(r.net, 3_000 - r.total);
    expect(retenuesEmploye(0, 0).total).toBe(0);
  });

  it('un actionnaire de contrôle n’est pas assurable à l’AE', () => {
    expect(retenuesEmploye(4_000, 0, false).assuranceEmploi).toBe(0);
  });
});

describe('impôt des sociétés', () => {
  it('avec la déduction pour petite entreprise : 9 % fédéral + 2,2 % Québec', () => {
    const i = impotSociete(100_000, 6_000);
    expect(i.impotFederal).toBe(9_000);
    expect(i.impotQuebec).toBe(2_200);
    expect(i.tauxEffectif).toBeCloseTo(0.112, 6);
  });

  it('sans la déduction pour petite entreprise : 15 % + 11,5 %', () => {
    const i = impotSociete(100_000, 6_000, false);
    expect(i.total).toBe(26_500);
  });

  it('moins de 5 000 heures rémunérées : pas de DPE du Québec', () => {
    const i = impotSociete(100_000, 4_368);
    expect(i.impotFederal).toBe(9_000);
    expect(i.impotQuebec).toBe(11_500);
    expect(facteurHeuresQuebec(5_250)).toBeCloseTo(0.5, 6);
  });

  it('au-delà du plafond des affaires de 500 000 $, le taux général s’applique', () => {
    const i = impotSociete(600_000, 10_000);
    expect(i.impotFederal).toBe(500_000 * 0.09 + 100_000 * 0.15);
    expect(impotSociete(-5_000, 0).total).toBe(0);
  });
});

describe('salaire ou dividendes', () => {
  it('les deux scénarios sont cohérents et le salaire crée des droits REER', () => {
    const salaire = scenarioRemuneration(80_000, 1, 4_000);
    const dividendes = scenarioRemuneration(80_000, 0, 4_000);
    expect(salaire.salaire).toBeGreaterThan(60_000);
    expect(salaire.droitsReer).toBeGreaterThan(0);
    expect(salaire.cotiseAuRrq).toBe(true);
    expect(dividendes.salaire).toBe(0);
    expect(dividendes.droitsReer).toBe(0);
    expect(dividendes.dividendes).toBeGreaterThan(0);
    for (const s of [salaire, dividendes]) {
      expect(s.argentEnPoche).toBeGreaterThan(0);
      expect(s.argentEnPoche).toBeLessThan(80_000);
    }
  });
});
