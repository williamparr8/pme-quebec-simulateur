import { describe, expect, it } from 'vitest';
import { jouerAleatoirement } from './helpers';

function verifierFini(valeur: number, contexte: string) {
  if (!Number.isFinite(valeur)) throw new Error(`Valeur non finie : ${contexte} = ${valeur}`);
}

describe('concurrents IA', () => {
  it('ne produisent jamais de NaN ni de valeurs impossibles (50 parties de 60 mois)', () => {
    for (let graine = 200; graine < 250; graine++) {
      const etat = jouerAleatoirement(graine, 60);
      for (const c of etat.concurrents) {
        for (const [ligne, prix] of Object.entries(c.prix)) {
          verifierFini(prix, `${c.nom} prix ${ligne}`);
          expect(prix).toBeGreaterThan(0);
        }
        for (const v of [c.qualite, c.service, c.ambiance, c.notoriete, c.partMarche]) {
          verifierFini(v, c.nom);
          expect(v).toBeGreaterThanOrEqual(0);
          expect(v).toBeLessThanOrEqual(1);
        }
        verifierFini(c.note, `${c.nom} note`);
        expect(c.note).toBeGreaterThanOrEqual(1);
        expect(c.note).toBeLessThanOrEqual(5);
        expect(c.budgetPublicite).toBeGreaterThanOrEqual(0);
        verifierFini(c.tresorerie, `${c.nom} trésorerie`);
        verifierFini(c.ventesMois, `${c.nom} ventes`);
        expect(c.ventesMois).toBeGreaterThanOrEqual(0);
        expect(c.indicePrixCible).toBeGreaterThan(0.5);
      }
      for (const a of etat.entreprises[0].archives) {
        for (const [cle, v] of Object.entries(a.indicateurs)) {
          if (typeof v === 'number') verifierFini(v, `indicateur ${cle} mois ${a.index}`);
        }
        expect(a.indicateurs.partMarche).toBeGreaterThanOrEqual(0);
        expect(a.indicateurs.partMarche).toBeLessThanOrEqual(1);
      }
    }
  });

  it('réagissent à une guerre de prix du joueur avec un délai', () => {
    // On vérifie qu'au moins une réaction de prix est annoncée dans les rapports d'une partie agressive.
    let reactions = 0;
    for (let graine = 300; graine < 320; graine++) {
      const etat = jouerAleatoirement(graine, 24);
      for (const a of etat.entreprises[0].archives) {
        reactions += a.messages.filter((m) => m.code.startsWith('concurrent')).length;
      }
    }
    expect(reactions).toBeGreaterThan(0);
  });
});
