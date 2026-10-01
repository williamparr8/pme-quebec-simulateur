import { describe, expect, it } from 'vitest';
import { totalBalance } from '../src/engine/accounting';
import { bilan, etatFlux } from '../src/engine/statements';
import { jouerAleatoirement } from './helpers';

describe('le bilan est toujours équilibré', () => {
  it('après 60 mois de décisions aléatoires, pour 100 graines', () => {
    for (let graine = 1; graine <= 100; graine++) {
      const etat = jouerAleatoirement(graine, 60);
      const ent = etat.entreprises[0];
      expect(ent.archives.length).toBeGreaterThan(0);
      let encaissePrecedente = 0;
      for (const a of ent.archives) {
        // Balance de vérification : somme des soldes = 0 (en cents, donc exact).
        expect(totalBalance(a.soldesFin)).toBe(0);
        const b = bilan(a.soldesFin, a.portionCouranteDette);
        expect(b.ecart).toBe(0);
        // Les flux de trésorerie expliquent exactement la variation de l'encaisse.
        const variation = etatFlux(a.flux).variationNette;
        expect(Math.round((encaissePrecedente + variation) * 100)).toBe(a.soldesFin.encaisse);
        encaissePrecedente = a.soldesFin.encaisse / 100;
        // Aucun stock négatif.
        expect(a.soldesFin.stocks).toBeGreaterThanOrEqual(0);
      }
      expect(totalBalance(ent.livre.soldes)).toBe(0);
    }
  });
});
