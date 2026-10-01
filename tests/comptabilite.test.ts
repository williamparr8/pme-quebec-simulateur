import { describe, expect, it } from 'vitest';
import {
  ErreurComptable,
  cloturerExercice,
  creerGrandLivre,
  ecritureSimple,
  passerEcriture,
  totalBalance,
} from '../src/engine/accounting';
import { bilan, etatFlux, etatResultats } from '../src/engine/statements';

describe('comptabilité en partie double', () => {
  it('refuse une écriture déséquilibrée', () => {
    const livre = creerGrandLivre();
    expect(() =>
      passerEcriture(livre, {
        libelle: 'erreur',
        flux: 'encaissementsClients',
        lignes: [
          { compte: 'encaisse', debit: 1000 },
          { compte: 'ventes', credit: 999 },
        ],
      }),
    ).toThrow(ErreurComptable);
  });

  it('refuse un mouvement d’encaisse sans catégorie de flux', () => {
    const livre = creerGrandLivre();
    expect(() => ecritureSimple(livre, 'vente', 'encaisse', 'ventes', 1000)).toThrow(
      ErreurComptable,
    );
  });

  it('refuse les montants négatifs, fractionnaires ou au débit et au crédit à la fois', () => {
    const livre = creerGrandLivre();
    const essai = (debit: number, credit: number) =>
      passerEcriture(livre, {
        libelle: 'x',
        lignes: [
          { compte: 'stocks', debit, credit },
          { compte: 'comptesFournisseurs', credit: debit },
        ],
      });
    expect(() => essai(10.5, 0)).toThrow(ErreurComptable);
    expect(() => essai(-10, 0)).toThrow(ErreurComptable);
    expect(() => essai(10, 10)).toThrow(ErreurComptable);
  });

  it('ignore une écriture nulle et inverse une écriture simple négative', () => {
    const livre = creerGrandLivre();
    ecritureSimple(livre, 'rien', 'stocks', 'comptesFournisseurs', 0);
    expect(livre.ecrituresMois).toHaveLength(0);
    ecritureSimple(livre, 'retour', 'stocks', 'comptesFournisseurs', -500);
    expect(livre.soldes.stocks).toBe(-500);
    expect(livre.soldes.comptesFournisseurs).toBe(500);
  });

  it('produit des états financiers cohérents pour un petit scénario', () => {
    const livre = creerGrandLivre();
    ecritureSimple(livre, 'Apport', 'encaisse', 'capital', 1_000_000, 'apportsProprietaire');
    ecritureSimple(livre, 'Emprunt', 'encaisse', 'empruntBancaire', 500_000, 'empruntsRecus');
    ecritureSimple(
      livre,
      'Équipement',
      'equipement',
      'encaisse',
      600_000,
      'acquisitionImmobilisations',
    );
    ecritureSimple(livre, 'Achats', 'stocks', 'comptesFournisseurs', 200_000);
    ecritureSimple(livre, 'Ventes', 'encaisse', 'ventes', 900_000, 'encaissementsClients');
    ecritureSimple(livre, 'CMV', 'coutMarchandises', 'stocks', 300_000);
    ecritureSimple(livre, 'Loyer', 'loyer', 'encaisse', 150_000, 'loyerEtFrais');
    ecritureSimple(livre, 'Amortissement', 'amortissement', 'amortCumEquipement', 10_000);
    ecritureSimple(livre, 'Intérêts', 'interets', 'encaisse', 3_000, 'interetsPayes');
    ecritureSimple(
      livre,
      'Prélèvements',
      'prelevements',
      'encaisse',
      100_000,
      'prelevementsProprietaire',
    );

    expect(totalBalance(livre.soldes)).toBe(0);
    const r = etatResultats(livre.mouvementsMois);
    expect(r.ventes).toBe(9000);
    expect(r.coutMarchandises).toBe(3000);
    expect(r.margeBrute).toBe(6000);
    expect(r.baiia).toBe(4500);
    expect(r.beneficeNet).toBe(4500 - 100 - 30);

    const b = bilan(livre.soldes, 100_000);
    expect(b.ecart).toBe(0);
    expect(b.totalActif).toBe(b.totalPassifEtCapitaux);
    expect(b.passifCourt.some((l) => l.libelle.startsWith('Portion'))).toBe(true);
    expect(b.capitaux.prelevements).toBe(1000);

    const f = etatFlux(livre.fluxMois);
    expect(f.variationNette).toBe(livre.soldes.encaisse / 100);
    const total = f.sections.reduce((a, s) => a + s.total, 0);
    expect(total).toBeCloseTo(f.variationNette, 6);
  });

  it('présente un découvert bancaire au passif', () => {
    const livre = creerGrandLivre();
    ecritureSimple(livre, 'Loyer', 'loyer', 'encaisse', 50_000, 'loyerEtFrais');
    const b = bilan(livre.soldes);
    expect(b.passifCourt[0].libelle).toBe('Découvert bancaire');
    expect(b.ecart).toBe(0);
  });

  it('la clôture de l’exercice vire le résultat au capital sans déséquilibrer', () => {
    const livre = creerGrandLivre();
    ecritureSimple(livre, 'Apport', 'encaisse', 'capital', 100_000, 'apportsProprietaire');
    ecritureSimple(livre, 'Ventes', 'encaisse', 'ventes', 80_000, 'encaissementsClients');
    ecritureSimple(livre, 'Loyer', 'loyer', 'encaisse', 30_000, 'loyerEtFrais');
    ecritureSimple(
      livre,
      'Prélèvements',
      'prelevements',
      'encaisse',
      20_000,
      'prelevementsProprietaire',
    );
    const avant = bilan(livre.soldes);
    const resultat = cloturerExercice(livre);
    expect(resultat).toBe(50_000);
    expect(totalBalance(livre.soldes)).toBe(0);
    expect(livre.soldes.ventes).toBe(0);
    expect(livre.soldes.prelevements).toBe(0);
    // Capital : 1 000 $ + 500 $ de bénéfice − 200 $ de prélèvements
    expect(livre.soldes.capital).toBe(-130_000);
    expect(bilan(livre.soldes).capitaux.total).toBe(avant.capitaux.total);
  });
});
