import { describe, expect, it } from 'vitest';
import { totalBalance } from '../src/engine/accounting';
import { calculerDpa } from '../src/engine/annuel';
import { coutDemarche, fraisImmatriculation, fraisMiseAJourAnnuelle } from '../src/engine/conformite';
import { etatsFinanciers } from '../src/engine/rapports';
import {
  creerPartie,
  modifierDecisions,
  planifierIncorporation,
  produireMiseAJourAnnuelle,
  simulerMois,
} from '../src/engine/simulation';
import type { EtatPartie, ParametresDemarrage } from '../src/engine/types';
import { DEMARRAGE_TEST, configTest } from './helpers';

function partie(changements: Partial<ParametresDemarrage>, graine = 21, duree: 12 | 24 | 36 = 24): EtatPartie {
  return creerPartie(configTest(graine, duree), { ...DEMARRAGE_TEST, ...changements });
}

function jouer(etat: EtatPartie, mois: number): EtatPartie {
  let e = etat;
  for (let i = 0; i < mois && !e.terminee; i++) e = simulerMois(e);
  return e;
}

const codes = (e: EtatPartie) => e.entreprises[0].archives.flatMap((a) => a.messages.map((m) => m.code));

describe('formes juridiques', () => {
  it('société par actions : impôt des sociétés en fin d’exercice, BNR et déclarations T2/CO-17', () => {
    const e = jouer(partie({ formeJuridique: 'inc-qc' }), 13);
    const ent = e.entreprises[0];
    expect(ent.livre.soldes.capitalActions).toBe(-4_500_000);
    const decl = ent.fiscal.declarations[0];
    expect(decl.annee).toBe(2027);
    expect(decl.societe).toBeDefined();
    expect(decl.dpa).toBeGreaterThan(0);
    // Le revenu fiscal remplace l'amortissement comptable par la DPA.
    expect(decl.revenuFiscal).toBeCloseTo(decl.beneficeComptable + decl.amortissementComptable + decl.nonDeductibles - decl.dpa, 1);
    const annee = etatsFinanciers(ent, { type: 'exercice', annee: 2027 });
    expect(annee.resultats.impots).toBeCloseTo(decl.societe?.total ?? -1, 1);
    expect(annee.bilan.ecart).toBe(0);
    // Après la clôture, le résultat est dans les bénéfices non répartis.
    expect(ent.livre.soldes.ventes).not.toBe(0); // janvier 2028 est commencé
    expect(etatsFinanciers(ent, { type: 'cumul' }).bilan.capitaux.lignes.some((l) => l.libelle.startsWith('Bénéfices non répartis'))).toBe(true);
    expect(ent.decisions.prelevements).toBe(0);
    expect(decl.feuillets.some((f) => f.nom.includes('dirigeant'))).toBe(true);
  });

  it('société en nom collectif : le bénéfice est réparti entre les associés à la clôture', () => {
    const e = jouer(partie({ formeJuridique: 'senc', apportAssocie: 15_000, nomAssocie: 'Sam' }), 12);
    const ent = e.entreprises[0];
    expect(ent.associe?.part).toBeCloseTo(15_000 / 60_000, 6);
    expect(ent.livre.soldes.capitalAssocie).not.toBe(0);
    expect(totalBalance(ent.livre.soldes)).toBe(0);
    expect(ent.fiscal.declarations[0].personnel.revenuEntreprise).toBeCloseTo(ent.fiscal.declarations[0].revenuFiscal * 0.75, 0);
  });

  it('une société de personnes exige un associé', () => {
    expect(() => partie({ formeJuridique: 'sec', apportAssocie: 0 })).toThrow();
  });

  it('incorporation en cours de partie : effective le 1er janvier, capital converti en actions', () => {
    let e = jouer(partie({}), 6);
    e = planifierIncorporation(e, e.entreprises[0].id, 'inc-federal');
    e = jouer(e, 7); // jusqu'à janvier 2028 inclus
    const ent = e.entreprises[0];
    expect(ent.formeJuridique).toBe('inc-federal');
    expect(ent.livre.soldes.capital).toBe(0);
    expect(ent.livre.soldes.capitalActions).toBeLessThan(0);
    expect(codes(e)).toContain('incorporationEffectuee');
    expect(totalBalance(ent.livre.soldes)).toBe(0);
  });
});

describe('TPS et TVQ dans la simulation', () => {
  it('une entreprise inscrite perçoit les taxes, récupère les CTI/RTI et fait ses remises', () => {
    const e = jouer(partie({ inscritTaxes: true }), 5);
    const ent = e.entreprises[0];
    expect(ent.archives[0].flux.remisesTaxes ?? 0).toBe(0);
    // Remise (ou remboursement) en avril pour le 1er trimestre.
    expect(ent.archives[3].flux.remisesTaxes ?? 0).not.toBe(0);
    expect(ent.fiscal.taxesAnnee.tpsPercue).toBeGreaterThan(0);
    expect(ent.fiscal.taxesAnnee.cti).toBeGreaterThan(0);
  });

  it('un petit fournisseur qui dépasse 30 000 $ sans s’inscrire finit par recevoir un avis de cotisation', () => {
    let trouve = false;
    for (let g = 1; g <= 10 && !trouve; g++) {
      const e = jouer(partie({ inscritTaxes: false }, g), 24);
      const c = codes(e);
      expect(c).toContain('seuilTaxesDepasse');
      if (c.includes('cotisationTaxes')) {
        trouve = true;
        expect(e.entreprises[0].fiscal.inscritTaxes).toBe(true);
      }
    }
    expect(trouve).toBe(true);
  });
});

describe('paie complète', () => {
  it('les retenues à la source sont retenues puis remises le mois suivant', () => {
    const e = jouer(partie({}), 2);
    const [janvier, fevrier] = e.entreprises[0].archives;
    expect(janvier.soldesFin.retenuesAPayer).toBeLessThan(0);
    expect(janvier.soldesFin.cotisationsAPayer).toBeLessThan(0);
    expect(fevrier.flux.remisesGouvernementales ?? 0).toBeLessThan(0);
    const net = -(janvier.flux.salairesVerses ?? 0);
    const brut = ((janvier.mouvements.salaires ?? 0) + (janvier.mouvements.vacances ?? 0));
    expect(net).toBeLessThan(brut);
  });
});

describe('conformité et démarches', () => {
  it('les démarches oubliées finissent par être découvertes (amende)', () => {
    let trouve = false;
    for (let g = 1; g <= 10 && !trouve; g++) {
      const e = jouer(partie({ demarches: [] }, g), 24);
      if (codes(e).includes('demarcheDecouverte')) {
        trouve = true;
        expect(etatsFinanciers(e.entreprises[0], { type: 'cumul' }).resultats.chargesExploitation.some((c) => c.compte === 'amendes')).toBe(true);
      }
    }
    expect(trouve).toBe(true);
  });

  it('la déclaration de mise à jour annuelle du REQ en retard entraîne une pénalité', () => {
    const e = jouer(partie({ formeJuridique: 'inc-qc' }), 19);
    expect(codes(e)).toContain('majAnnuelleEnRetard');
  });

  it('produire la déclaration à temps évite la pénalité', () => {
    let e = jouer(partie({ formeJuridique: 'inc-qc' }), 13);
    e = produireMiseAJourAnnuelle(e, e.entreprises[0].id);
    e = jouer(e, 6);
    expect(codes(e)).not.toContain('majAnnuelleEnRetard');
  });

  it('frais du REQ selon la forme juridique', () => {
    expect(fraisImmatriculation('individuelle')).toBe(41);
    expect(fraisImmatriculation('senc')).toBe(63);
    expect(fraisImmatriculation('inc-qc')).toBe(397);
    expect(fraisImmatriculation('inc-federal')).toBeGreaterThan(397);
    expect(fraisMiseAJourAnnuelle('inc-federal')).toBe(106);
    expect(coutDemarche('mapaq', 'individuelle')).toBeGreaterThan(0);
  });
});

describe('DPA et décisions', () => {
  it('DPA : 20 % de la FNACC pour l’équipement, linéaire pour les améliorations locatives', () => {
    const dpa = calculerDpa(45_000, 38_000, 38_000, 5);
    expect(dpa.equipement).toBe(9_000);
    expect(dpa.ameliorations).toBe(7_600);
    expect(calculerDpa(0, 1_000, 38_000, 5).ameliorations).toBe(1_000);
  });

  it('une société ne fait pas de prélèvements; une entreprise individuelle n’a pas de salaire de dirigeant', () => {
    let e = partie({ formeJuridique: 'inc-qc' });
    e = modifierDecisions(e, e.entreprises[0].id, { prelevements: 5_000, salaireDirigeant: 4_000 });
    expect(e.entreprises[0].decisions.prelevements).toBe(0);
    expect(e.entreprises[0].decisions.salaireDirigeant).toBe(4_000);
    let i = partie({});
    i = modifierDecisions(i, i.entreprises[0].id, { salaireDirigeant: 4_000, dividendePonctuel: 1_000 });
    expect(i.entreprises[0].decisions.salaireDirigeant).toBe(0);
    expect(i.entreprises[0].decisions.dividendePonctuel).toBe(0);
  });
});
