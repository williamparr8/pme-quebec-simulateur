import { describe, expect, it } from 'vitest';
import { SECTEURS, secteurParId, villeParId } from '../src/data';
import {
  etatsFinanciers,
  exercicesJoues,
  ratios,
  seuilRentabilite,
  bilanPartie,
} from '../src/engine/rapports';
import {
  DIFFICULTES,
  congedier,
  coutsDemarrage,
  creerPartie,
  dateDuMois,
  embaucher,
  modifierDecisions,
  modifierSalaireEmploye,
  pretMaximum,
  prixMarche,
  salaireMarche,
  simulerMois,
  validerDemarrage,
} from '../src/engine/simulation';
import { DEMARRAGE_TEST, configTest, jouerParDefaut, nouvellePartie } from './helpers';

describe('simulation complète', () => {
  it('36 mois sans erreur pour chaque secteur', () => {
    for (const secteur of SECTEURS) {
      const etat = jouerParDefaut(nouvellePartie(11, 36, secteur.id));
      expect(etat.terminee).toBe(true);
      expect(etat.entreprises[0].archives.length).toBeGreaterThan(0);
    }
  });

  it('chaque niveau de difficulté peut être joué', () => {
    for (const difficulte of Object.keys(DIFFICULTES) as (keyof typeof DIFFICULTES)[]) {
      const etat = jouerParDefaut(
        creerPartie({ ...configTest(3, 12), difficulte }, DEMARRAGE_TEST),
      );
      expect(etat.moisCourant).toBeGreaterThan(0);
    }
  });

  it('les dates avancent d’un mois par tour et l’exercice est clôturé en décembre', () => {
    const config = configTest(1);
    expect(dateDuMois(config, 0)).toEqual({ annee: 2027, mois: 1 });
    expect(dateDuMois(config, 13)).toEqual({ annee: 2028, mois: 2 });
    let etat = nouvellePartie(5, 24);
    for (let i = 0; i < 13; i++) etat = simulerMois(etat);
    const ent = etat.entreprises[0];
    expect(ent.archives[11].messages.some((m) => m.code === 'finExercice')).toBe(true);
    expect(ent.livre.soldes.ventes).not.toBe(0); // janvier de la 2e année
    expect(exercicesJoues(ent)).toEqual([2027, 2028]);
  });

  it('valide les paramètres de démarrage', () => {
    const cafe = secteurParId('cafe');
    const mtl = villeParId('montreal');
    expect(validerDemarrage(DEMARRAGE_TEST, cafe, mtl)).toEqual([]);
    const erreurs = validerDemarrage(
      { ...DEMARRAGE_TEST, nomEntreprise: ' ', apportPersonnel: 1000, montantPret: 50_000 },
      cafe,
      mtl,
    );
    expect(erreurs).toContain('nomVide');
    expect(erreurs).toContain('apportInsuffisant');
    expect(erreurs).toContain('pretTropEleve');
    expect(erreurs).toContain('financementInsuffisant');
    expect(() => creerPartie(configTest(1), { ...DEMARRAGE_TEST, nomEntreprise: '' })).toThrow();
    expect(pretMaximum(40_000)).toBe(120_000);
    expect(pretMaximum(100_000)).toBe(150_000);
    expect(coutsDemarrage(DEMARRAGE_TEST, cafe, mtl).total).toBeGreaterThan(80_000);
  });

  it('le bilan d’ouverture reflète les investissements de départ', () => {
    const etat = nouvellePartie(8);
    const ent = etat.entreprises[0];
    const etats = etatsFinanciers(ent, { type: 'cumul' });
    expect(etats.nbMois).toBe(0);
    expect(etats.bilan.ecart).toBe(0);
    expect(etats.bilan.capitaux.capital).toBe(DEMARRAGE_TEST.apportPersonnel);
    expect(etats.bilan.totalPassif).toBe(DEMARRAGE_TEST.montantPret);
  });

  it('embauche, congédiement avec indemnité de préavis et décisions bornées', () => {
    let etat = nouvellePartie(9);
    const id = etat.entreprises[0].id;
    etat = embaucher(etat, id, 99);
    expect(etat.entreprises[0].employes).toHaveLength(4);
    expect(etat.entreprises[0].employes[3].heuresSemaine).toBe(45);
    for (let i = 0; i < 4; i++) etat = simulerMois(etat);
    const ancien = etat.entreprises[0].employes[0];
    etat = congedier(etat, id, ancien.id);
    expect(etat.entreprises[0].enAttente.indemnites).toBeGreaterThan(0);
    etat = modifierDecisions(etat, id, {
      publicite: { meta: 1e9, tiktok: -50 },
      promotion: 0.9,
      heuresOuverture: Number.NaN,
    });
    const d = etat.entreprises[0].decisions;
    expect(d.publicite.meta).toBe(15_000);
    expect(d.publicite.tiktok).toBeUndefined();
    expect(d.promotion).toBe(0.3);
    expect(d.heuresOuverture).toBe(60);
    const employe = etat.entreprises[0].employes[0];
    etat = modifierSalaireEmploye(etat, id, employe.id, 1);
    expect(etat.entreprises[0].employes[0].salaireHoraire).toBe(etat.salaireMinimum);
    etat = simulerMois(etat);
    expect(
      etat.entreprises[0].archives.at(-1)?.messages.some((m) => m.code === 'indemnitesPreavis'),
    ).toBe(true);
    expect(prixMarche(etat, 'boissons')).toBeGreaterThan(4);
    expect(salaireMarche(etat)).toBeGreaterThan(16);
  });

  it('une entreprise qui ne vend rien finit en faillite après 3 mois à découvert', () => {
    let etat = nouvellePartie(10, 36);
    const id = etat.entreprises[0].id;
    const prix: Record<string, number> = {};
    for (const l of secteurParId('cafe').lignes) prix[l.id] = l.prixReference * 4;
    etat = modifierDecisions(etat, id, {
      prix,
      publicite: { radio: 15_000, affichage: 15_000 },
      prelevements: 15_000,
    });
    while (!etat.terminee) etat = simulerMois(etat);
    expect(etat.raisonFin).toBe('faillite');
    const ent = etat.entreprises[0];
    expect(ent.enFaillite).toBe(true);
    const codes = ent.archives.flatMap((a) => a.messages.map((m) => m.code));
    expect(codes).toContain('decouvert1');
    expect(codes).toContain('decouvert2');
    expect(codes).toContain('faillite');
    expect(simulerMois(etat)).toBe(etat);
    expect(bilanPartie(ent).note).toBeLessThanOrEqual(35);
  });

  it('les rapports (ratios, seuil de rentabilité, bilan de partie) sont calculables', () => {
    const etat = jouerParDefaut(nouvellePartie(12, 24));
    const ent = etat.entreprises[0];
    const cafe = secteurParId('cafe');
    const etats = etatsFinanciers(ent, { type: 'exercice', annee: 2028 });
    expect(etats.nbMois).toBe(12);
    const r = ratios(etats, cafe.margeBruteCible, cafe.margeNetteCible);
    expect(r).toHaveLength(11);
    const mois = etatsFinanciers(ent, { type: 'mois', index: 5 });
    expect(mois.nbMois).toBe(1);
    const seuil = seuilRentabilite(ent.archives[5].mouvements);
    expect(seuil.tauxMargeContribution).toBeGreaterThan(0.5);
    expect(seuil.seuil).not.toBeNull();
    const bilan = bilanPartie(ent);
    expect(bilan.note).toBeGreaterThanOrEqual(0);
    expect(bilan.note).toBeLessThanOrEqual(100);
    expect(seuilRentabilite({}).seuil).toBeNull();
  });
});
