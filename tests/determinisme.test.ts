import { describe, expect, it } from 'vitest';
import { Rng, graineDepuisTexte } from '../src/engine/rng';
import { simulerMois } from '../src/engine/simulation';
import { jouerAleatoirement, nouvellePartie } from './helpers';

describe('déterminisme du moteur', () => {
  it('même graine + mêmes décisions = mêmes résultats', () => {
    const a = jouerAleatoirement(42, 36);
    const b = jouerAleatoirement(42, 36);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('une autre graine donne une autre partie', () => {
    const a = jouerAleatoirement(1, 12);
    const b = jouerAleatoirement(2, 12);
    expect(JSON.stringify(a)).not.toBe(JSON.stringify(b));
  });

  it('simulerMois ne modifie pas l’état reçu (fonction pure)', () => {
    const etat = nouvellePartie(7);
    const copie = JSON.stringify(etat);
    const suivant = simulerMois(etat);
    expect(JSON.stringify(etat)).toBe(copie);
    expect(suivant.moisCourant).toBe(1);
  });

  it('un état sauvegardé puis rechargé (JSON) continue exactement de la même façon', () => {
    let etat = nouvellePartie(99);
    for (let i = 0; i < 5; i++) etat = simulerMois(etat);
    const recharge = JSON.parse(JSON.stringify(etat));
    let a = etat;
    let b = recharge;
    for (let i = 0; i < 6; i++) {
      a = simulerMois(a);
      b = simulerMois(b);
    }
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('le générateur est reproductible et borné', () => {
    const r1 = new Rng(123);
    const r2 = new Rng(123);
    for (let i = 0; i < 1000; i++) {
      const x = r1.next();
      expect(x).toBe(r2.next());
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(1);
    }
    const r = new Rng(5);
    for (let i = 0; i < 200; i++) {
      const n = r.int(3, 6);
      expect(n).toBeGreaterThanOrEqual(3);
      expect(n).toBeLessThanOrEqual(6);
      expect(Math.abs(r.normal(0, 1))).toBeLessThanOrEqual(4);
    }
    expect(() => r.pick([])).toThrow();
    expect(graineDepuisTexte('boulangerie')).toBe(graineDepuisTexte('boulangerie'));
    expect(graineDepuisTexte('a')).not.toBe(graineDepuisTexte('b'));
  });
});
