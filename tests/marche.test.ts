import { describe, expect, it } from 'vitest';
import { secteurParId } from '../src/data';
import {
  evoluerNotoriete,
  indicePrixOffre,
  simulerMarche,
  tauxAchatLigne,
  type Offre,
} from '../src/engine/market';
import { noteCible, nouvelleNote, satisfactionClients } from '../src/engine/customers';
import { reapprovisionner, tauxPerte, tauxRupture } from '../src/engine/inventory';

const cafe = secteurParId('cafe');

function offre(id: string, changements: Partial<Offre> = {}): Offre {
  const prix: Record<string, number> = {};
  for (const l of cafe.lignes) prix[l.id] = l.prixReference;
  return {
    id,
    prix,
    qualite: 0.55,
    service: 0.6,
    ambiance: 0.5,
    notoriete: 0.5,
    note: 4,
    heuresOuverture: 84,
    capaciteVisites: 1_000_000,
    ...changements,
  };
}

describe('modèle de marché', () => {
  it('les parts de marché totalisent 1 et la demande ne dépasse pas le potentiel', () => {
    const r = simulerMarche([offre('a'), offre('b'), offre('c')], cafe, 30_000);
    const parts = Object.values(r.resultats).reduce((a, x) => a + x.part, 0);
    expect(parts).toBeCloseTo(1, 6);
    const demande = Object.values(r.resultats).reduce((a, x) => a + x.demande, 0);
    expect(demande).toBeLessThanOrEqual(30_000);
    expect(r.partAlternative).toBeGreaterThan(0);
  });

  it('un prix plus élevé réduit la demande (élasticité-prix)', () => {
    const cher = offre('cher');
    for (const l of cafe.lignes) cher.prix[l.id] = l.prixReference * 1.3;
    const r = simulerMarche([offre('normal'), cher], cafe, 30_000);
    expect(r.resultats.cher.demande).toBeLessThan(r.resultats.normal.demande);
    expect(indicePrixOffre(cher.prix, cafe)).toBeCloseTo(1.3, 6);
  });

  it('la notoriété, la qualité et les avis augmentent la demande', () => {
    const r = simulerMarche(
      [
        offre('base'),
        offre('connu', { notoriete: 0.9 }),
        offre('qualite', { qualite: 0.85 }),
        offre('avis', { note: 4.8 }),
      ],
      cafe,
      30_000,
    );
    expect(r.resultats.connu.demande).toBeGreaterThan(r.resultats.base.demande);
    expect(r.resultats.qualite.demande).toBeGreaterThan(r.resultats.base.demande);
    expect(r.resultats.avis.demande).toBeGreaterThan(r.resultats.base.demande);
  });

  it('la capacité limite les visites servies et les ruptures font perdre des ventes', () => {
    const r = simulerMarche(
      [offre('petit', { capaciteVisites: 500, tauxRupture: 0.1 })],
      cafe,
      30_000,
    );
    const p = r.resultats.petit;
    expect(p.servies + p.perduesRupture).toBeLessThanOrEqual(500);
    expect(p.perduesCapacite).toBe(p.demande - 500);
    expect(p.perduesRupture).toBe(50);
    expect(p.ticketMoyen).toBeGreaterThan(0);
  });

  it('le taux d’achat baisse quand le prix d’une ligne augmente', () => {
    const ligne = cafe.lignes[2];
    expect(tauxAchatLigne(ligne, ligne.prixReference * 1.5, 0.5)).toBeLessThan(
      tauxAchatLigne(ligne, ligne.prixReference, 0.5),
    );
    expect(tauxAchatLigne(ligne, 0.01, 1)).toBeLessThanOrEqual(1);
  });

  it('la notoriété monte avec la publicité, avec des rendements décroissants', () => {
    const sans = evoluerNotoriete(0.2, 0, 0, 0, 0.7);
    const pub1 = evoluerNotoriete(0.2, 2000, 0, 0, 0.7);
    const pub2 = evoluerNotoriete(0.2, 4000, 0, 0, 0.7);
    expect(pub1).toBeGreaterThan(sans);
    expect(pub2 - pub1).toBeLessThan(pub1 - sans);
    expect(sans).toBeLessThan(0.2); // l'oubli
  });
});

describe('clientèle et stocks', () => {
  it('la satisfaction baisse avec le prix et l’attente', () => {
    const base = satisfactionClients(0.6, 0.6, 0.5, 1, 0);
    expect(satisfactionClients(0.6, 0.6, 0.5, 1.3, 0)).toBeLessThan(base);
    expect(satisfactionClients(0.6, 0.6, 0.5, 1, 0.3)).toBeLessThan(base);
    expect(noteCible(1)).toBeLessThanOrEqual(5);
  });

  it('les nouveaux avis font bouger la note', () => {
    expect(nouvelleNote(4, 0, 2, 5)).toBe(2);
    expect(nouvelleNote(4, 1000, 2, 5)).toBeGreaterThan(3.9);
    expect(nouvelleNote(4, 10, 5, 0)).toBe(4);
  });

  it('le réapprovisionnement respecte l’égalité stock début + achats − sorties = stock fin', () => {
    const r = reapprovisionner(2000, 9000, 4000, 7);
    expect(r.stockFin).toBeCloseTo(2000 + r.achats - 9000 - r.pertes, 2);
    expect(r.stockFin).toBeCloseTo((9000 / 30) * 7, 2);
    const surplus = reapprovisionner(50_000, 9000, 4000, 7);
    expect(surplus.achats).toBe(0);
    expect(surplus.stockFin).toBeGreaterThan(0);
    expect(tauxPerte(14)).toBeGreaterThan(tauxPerte(4));
    expect(tauxRupture(1)).toBeGreaterThan(0);
    expect(tauxRupture(7)).toBe(0);
  });
});
