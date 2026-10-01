import { describe, expect, it } from 'vitest';
import {
  PERSONNALITES,
  POSTES,
  SECTEURS,
  VILLES,
  personnaliteParId,
  posteParId,
  secteurParId,
  villeParId,
} from '../src/data';
import { COTISATIONS_2026, SALAIRE_MINIMUM, TAUX_INTERET } from '../src/data/fiscalite';

describe('intégrité des données', () => {
  it('chaque secteur est complet et cohérent', () => {
    for (const s of SECTEURS) {
      expect(s.saisonnalite).toHaveLength(12);
      expect(s.margeBruteCible).toHaveLength(2);
      expect(s.margeBruteCible[0]).toBeLessThan(s.margeBruteCible[1]);
      expect(s.lignes.length).toBeGreaterThan(0);
      expect(s.qualites.some((q) => q.id === 'standard')).toBe(true);
      expect(s.equipements.length).toBeGreaterThan(0);
      expect(s.amenagements.length).toBeGreaterThan(0);
      for (const l of s.lignes) {
        expect(l.prixReference).toBeGreaterThan(l.coutUnitaire);
        expect(l.tauxAchat).toBeGreaterThan(0);
        expect(l.tauxAchat).toBeLessThanOrEqual(1);
      }
      for (const p of s.postes) expect(() => posteParId(p)).not.toThrow();
      for (const v of VILLES) expect(v.marchePotentielMensuel[s.id]).toBeGreaterThan(0);
    }
  });

  it('les villes, postes et concurrents sont valides', () => {
    for (const v of VILLES) {
      expect(v.emplacements.length).toBeGreaterThan(0);
      for (const e of v.emplacements) expect(e.achalandage).toBeGreaterThan(0);
    }
    for (const p of POSTES) {
      expect(p.salaireMedian).toBeGreaterThanOrEqual(SALAIRE_MINIMUM.general);
    }
    expect(PERSONNALITES.length).toBeGreaterThanOrEqual(2);
    expect(personnaliteParId('geant').indicePrix).toBeLessThan(1);
    expect(() => secteurParId('inexistant')).toThrow();
    expect(() => villeParId('inexistant')).toThrow();
  });

  it('les taux fiscaux 2026 sont dans des bornes plausibles et sourcés', () => {
    expect(SALAIRE_MINIMUM.general).toBe(16.6);
    expect(COTISATIONS_2026.rrq.tauxEmployeur).toBe(0.063);
    expect(COTISATIONS_2026.assuranceEmploi.tauxEmployeur).toBeCloseTo(
      COTISATIONS_2026.assuranceEmploi.tauxEmploye * 1.4,
      6,
    );
    expect(TAUX_INTERET.tauxDirecteurInitial).toBe(0.0225);
    for (const c of Object.values(COTISATIONS_2026)) {
      if ('source' in c) expect(c.source.url).toMatch(/^https:\/\//);
    }
  });
});
