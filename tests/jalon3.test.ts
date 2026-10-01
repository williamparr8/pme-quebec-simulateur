import { describe, expect, it } from 'vitest';
import { CANAUX, canalParId, fournisseurParId, secteurParId, villeParId } from '../src/data';
import { totalBalance } from '../src/engine/accounting';
import { margeErreur } from '../src/engine/etudes';
import { evaluerPlan, partAnge, validerSources, ventesReference } from '../src/engine/financement';
import { indemniteJourFerie, probabiliteAcceptation, semainesPreavis, tauxVacances } from '../src/engine/hr';
import {
  politiqueRecommandee,
  quantiteEconomique,
  simulerStockLigne,
  stockInitial,
  unitesEnStock,
  valeurStock,
} from '../src/engine/inventory';
import { ajusterTauxVariable, comparerTaux, creerPret, effectuerVersement, tableauAmortissement } from '../src/engine/loans';
import { combinerGains, gainCanal, netPromoterScore, porteeCanal, retentionClients } from '../src/engine/marketing';
import { etatsFinanciers } from '../src/engine/rapports';
import { Rng } from '../src/engine/rng';
import {
  afficherPoste,
  commanderEtude,
  creerPartie,
  emplacementDe,
  embaucherCandidat,
  investir,
  lancerProduit,
  placer,
  repondreDilemme,
  simulerMois,
  soumettre,
  validerDemarrage,
} from '../src/engine/simulation';
import type { EtatPartie, ParametresDemarrage } from '../src/engine/types';
import { DEMARRAGE_TEST, configTest, jouerMois, nouvellePartie, planRealiste } from './helpers';

const cafe = secteurParId('cafe');
const mtl = villeParId('montreal');

describe('stocks et approvisionnement', () => {
  const fournisseur = fournisseurParId('distributeurAlimentaire');

  it('la quantité économique suit la formule de Wilson', () => {
    expect(quantiteEconomique(3600, 50, 1)).toBeCloseTo(Math.sqrt(2 * 3600 * 50), 6);
    expect(quantiteEconomique(0, 50, 1)).toBe(0);
  });

  it('la politique recommandée respecte la péremption et la commande minimale', () => {
    const p = politiqueRecommandee(600, 4.4, fournisseur, 4);
    expect(p.pointCommande).toBeGreaterThanOrEqual(Math.round(p.demandeJour * fournisseur.delaiJours));
    expect(p.quantite).toBeGreaterThanOrEqual(p.quantiteMinFournisseur);
    const boulangerie = fournisseurParId('boulangerieQuartier');
    const v = politiqueRecommandee(900, 1.6, boulangerie, 2);
    expect(v.quantite).toBeLessThanOrEqual(Math.max(v.quantiteMinFournisseur, v.quantiteMaxPeremption));
  });

  it('conservation des unités : début + reçues − sorties − périmées = fin', () => {
    for (const methode of ['peps', 'coutMoyen'] as const) {
      const stock = stockInitial(800, 4.4, 4, 600);
      const debut = unitesEnStock(stock);
      const r = simulerStockLigne(
        stock,
        {
          demande: 700,
          capacitePreparation: Infinity,
          tauxDefauts: 0.03,
          coutUnitaire: 4.4,
          fournisseur,
          conservationJours: 4,
          pointCommande: 60,
          quantite: 120,
          methode,
          auto: { precision: 1 },
        },
        new Rng(3),
      );
      const recues = r.receptions.reduce((a, x) => a + x.quantite, 0);
      expect(debut + recues - r.vendues - r.refaites - r.perimees).toBe(unitesEnStock(stock));
      expect(r.vendues + r.perdues).toBe(700);
      expect(r.valeurFin).toBeCloseTo(valeurStock(stock, methode), 6);
    }
  });

  it('commander trop de produits périssables fait jeter de la marchandise', () => {
    const stock = stockInitial(0, 1.6, 2, 900);
    const r = simulerStockLigne(
      stock,
      {
        demande: 900,
        capacitePreparation: Infinity,
        tauxDefauts: 0,
        coutUnitaire: 1.6,
        fournisseur: fournisseurParId('boulangerieQuartier'),
        conservationJours: 2,
        pointCommande: 200,
        quantite: 400,
        methode: 'peps',
      },
      new Rng(5),
    );
    expect(r.perimees).toBeGreaterThan(0);
    expect(r.coutPerimees).toBeGreaterThan(0);
  });

  it('la cuisine limite les ventes de repas', () => {
    const stock = stockInitial(5000, 4.4, 4, 600);
    const r = simulerStockLigne(
      stock,
      {
        demande: 600,
        capacitePreparation: 300,
        tauxDefauts: 0,
        coutUnitaire: 4.4,
        fournisseur,
        conservationJours: 4,
        pointCommande: 100,
        quantite: 200,
        methode: 'peps',
      },
      new Rng(1),
    );
    expect(r.perduesPreparation).toBe(300);
    expect(r.vendues).toBeLessThanOrEqual(300);
  });
});

describe('prêts à taux fixe ou variable', () => {
  it('le report ne rembourse que les intérêts, puis le prêt est soldé', () => {
    const p = creerPret('p', 'test', 1_000_000, 0.06, 48, { differeMois: 12 });
    const v = effectuerVersement(p);
    expect(v.capital).toBe(0);
    expect(v.interets).toBe(5000);
    const reste = tableauAmortissement(p);
    expect(reste).toHaveLength(11 + 48);
    expect(reste.at(-1)?.solde).toBe(0);
  });

  it('un taux variable change le versement quand le taux préférentiel bouge', () => {
    const p = creerPret('p', 'test', 5_000_000, 0.065, 60, { type: 'variable', ecartTaux: 0.02 });
    const avant = p.versementMensuel;
    expect(ajusterTauxVariable(p, 0.05)).toBe(true);
    expect(p.tauxAnnuel).toBeCloseTo(0.07, 6);
    expect(p.versementMensuel).toBeGreaterThan(avant);
    expect(ajusterTauxVariable(p, 0.05)).toBe(false);
    const fixe = creerPret('f', 'fixe', 5_000_000, 0.065, 60);
    expect(ajusterTauxVariable(fixe, 0.08)).toBe(false);
    expect(tableauAmortissement(p).at(-1)?.solde).toBe(0);
  });

  it('comparaison fixe et variable selon le scénario de taux', () => {
    const baisse = comparerTaux(5_000_000, 60, 0.07, 0.065, -0.01);
    const hausse = comparerTaux(5_000_000, 60, 0.07, 0.065, 0.02);
    expect(baisse.interetsVariable).toBeLessThan(baisse.interetsFixe);
    expect(hausse.interetsVariable).toBeGreaterThan(hausse.interetsFixe);
  });
});

describe('marketing', () => {
  it('portée avec rendements décroissants et achat minimal', () => {
    const meta = canalParId('meta');
    expect(porteeCanal(meta, 0)).toBe(0);
    expect(porteeCanal(canalParId('radio'), 1000)).toBe(0); // sous l'achat minimal
    const p1 = porteeCanal(meta, 1000);
    const p2 = porteeCanal(meta, 2000);
    expect(p2).toBeGreaterThan(p1);
    expect(p2 - p1).toBeLessThan(p1);
    expect(p2).toBeLessThan(1);
  });

  it('les affinités des canaux varient selon les personas', () => {
    const tiktok = canalParId('tiktok');
    expect(gainCanal(tiktok, 1500, 'etudiants')).toBeGreaterThan(gainCanal(tiktok, 1500, 'retraites'));
    const journal = canalParId('journal');
    expect(gainCanal(journal, 1500, 'retraites')).toBeGreaterThan(gainCanal(journal, 1500, 'etudiants'));
    expect(combinerGains([0.1, 0.1])).toBeCloseTo(0.19, 6);
    for (const c of CANAUX) expect(gainCanal(c, 15_000, 'familles')).toBeLessThanOrEqual(0.6);
  });

  it('NPS et rétention augmentent avec la satisfaction', () => {
    expect(netPromoterScore(0.85)).toBeGreaterThan(netPromoterScore(0.6));
    expect(netPromoterScore(0.2)).toBeLessThan(0);
    expect(netPromoterScore(1)).toBeLessThanOrEqual(100);
    const r1 = retentionClients({ satisfaction: 0.5, note: 3.5, adhesion: 0, tauxRupture: 0 });
    const r2 = retentionClients({ satisfaction: 0.8, note: 4.5, adhesion: 0.35, tauxRupture: 0 });
    expect(r2).toBeGreaterThan(r1);
    expect(r2).toBeLessThanOrEqual(0.92);
  });

  it('la marge d’erreur diminue avec la taille de l’échantillon', () => {
    expect(margeErreur(0.5, 100)).toBeCloseTo(0.098, 3);
    expect(margeErreur(0.5, 400)).toBeCloseTo(0.049, 3);
  });

  it('une étude de marché est payée et révèle des estimations', () => {
    let e = jouerMois(nouvellePartie(31, 12), 2);
    const id = e.entreprises[0].id;
    const avant = e.entreprises[0].livre.soldes.encaisse;
    e = commanderEtude(e, id, 'sondageComplet');
    e = commanderEtude(e, id, 'analyseConcurrence');
    e = commanderEtude(e, id, 'groupeDiscussion');
    e = commanderEtude(e, id, 'donneesSecondaires');
    const ent = e.entreprises[0];
    expect(ent.livre.soldes.encaisse).toBeLessThan(avant);
    const sondage = ent.marketing.etudes.find((x) => x.typeId === 'sondageComplet');
    expect(sondage?.notorieteSegments?.etudiants.marge).toBeGreaterThan(0);
    expect(sondage?.prixAcceptable?.boissons.valeur).toBeGreaterThan(0);
    expect(ent.marketing.etudes.find((x) => x.typeId === 'analyseConcurrence')?.concurrents).toHaveLength(2);
    expect(ent.marketing.etudes.find((x) => x.typeId === 'groupeDiscussion')?.produitsPrometteurs?.length).toBeGreaterThan(0);
    expect(ent.marketing.etudes.find((x) => x.typeId === 'donneesSecondaires')?.potentiel?.valeur).toBeGreaterThan(0);
  });
});

describe('ressources humaines', () => {
  it('normes du travail : vacances, jours fériés, préavis', () => {
    expect(tauxVacances(35)).toBe(0.04);
    expect(tauxVacances(36)).toBe(0.06);
    expect(indemniteJourFerie(20, 40)).toBe(160);
    expect(semainesPreavis(70)).toBe(4);
    expect(probabiliteAcceptation(20, 19)).toBe(1);
    expect(probabiliteAcceptation(17, 20)).toBeLessThan(1);
  });

  it('recrutement : affichage, candidats et embauche au salaire demandé', () => {
    let e = nouvellePartie(41, 12);
    const id = e.entreprises[0].id;
    e = afficherPoste(e, id, 'cuisinier', 'agence');
    let candidats = e.entreprises[0].rh.candidats;
    for (let k = 0; candidats.length === 0 && k < 5; k++) {
      e = afficherPoste(e, id, 'cuisinier', 'sitePrive');
      candidats = e.entreprises[0].rh.candidats;
    }
    expect(candidats.length).toBeGreaterThan(0);
    const c = candidats[0];
    expect(c.posteId).toBe('cuisinier');
    expect(c.attentes).toBeGreaterThanOrEqual(e.salaireMinimum);
    const avant = e.entreprises[0].employes.length;
    e = embaucherCandidat(e, id, c.id, c.attentes, 32);
    expect(e.entreprises[0].employes).toHaveLength(avant + 1);
    expect(e.entreprises[0].employes.at(-1)?.salaireHoraire).toBe(c.attentes);
    // Les candidats d'un affichage en différé arrivent le mois suivant.
    e = afficherPoste(e, id, 'barista', 'guichetEmplois');
    expect(e.entreprises[0].rh.affichages).toHaveLength(1);
    e = simulerMois(e);
    expect(e.entreprises[0].rh.affichages).toHaveLength(0);
  });

  it('un dilemme non tranché applique le choix par défaut le mois suivant', () => {
    let e = nouvellePartie(51, 36);
    let trouve = false;
    for (let k = 0; k < 30 && !trouve; k++) {
      e = simulerMois(e);
      if (e.entreprises[0].dilemmes.length > 0) trouve = true;
    }
    expect(trouve).toBe(true);
    const sansReponse = simulerMois(e);
    expect(sansReponse.entreprises[0].archives.at(-1)?.messages.some((m) => m.code === 'dilemmeNonTranche')).toBe(true);
    const d = e.entreprises[0].dilemmes[0];
    const avecReponse = repondreDilemme(e, e.entreprises[0].id, d.id, 'inexistant');
    expect(avecReponse.entreprises[0].dilemmes).toHaveLength(1);
  });
});

describe('ventes aux entreprises et comptes clients', () => {
  it('le traiteur génère des appels d’offres, des contrats et des comptes clients', () => {
    let e = nouvellePartie(61, 36);
    const id = e.entreprises[0].id;
    e = lancerProduit(e, id, 'traiteur');
    let factures = 0;
    for (let k = 0; k < 18; k++) {
      for (const a of e.entreprises[0].b2b.appels) e = soumettre(e, id, a.id, a.prixCible * 0.85);
      e = simulerMois(e);
      factures = Math.max(factures, e.entreprises[0].b2b.factures.length);
    }
    const ent = e.entreprises[0];
    expect(factures).toBeGreaterThan(0);
    expect(ent.archives.some((a) => a.indicateurs.ventesB2B > 0)).toBe(true);
    const ouvertes = ent.b2b.factures
      .filter((f) => f.statut === 'ouverte')
      .reduce((a, f) => a + f.ht + f.tps + f.tvq, 0);
    expect(ent.livre.soldes.comptesClients).toBe(ouvertes);
    expect(totalBalance(ent.livre.soldes)).toBe(0);
  });
});

describe('investissements, financement et placements', () => {
  it('un investissement au comptant est inscrit au registre, amorti et ajouté à sa catégorie de DPA', () => {
    let e = nouvellePartie(71, 24);
    const id = e.entreprises[0].id;
    e = investir(e, id, 'logicielCaisse', 'comptant');
    const ent = e.entreprises[0];
    const v = ent.immobilisations.find((i) => i.investissementId === 'logicielCaisse');
    expect(v?.classeDpa).toBe('12');
    expect(ent.fiscal.ajoutsAnnee['12']).toBeGreaterThan(0);
    expect(ent.livre.soldes.informatique).toBeGreaterThan(0);
    e = investir(e, id, 'logicielCaisse', 'comptant');
    expect(e.entreprises[0].immobilisations.filter((i) => i.investissementId === 'logicielCaisse')).toHaveLength(1);
    e = jouerMois(e, 13);
    const fin = e.entreprises[0];
    expect(fin.livre.soldes.amortCumInformatique).toBeLessThan(0);
    // Catégorie 12 : 100 % déductible dès la première année (plafonné à la FNACC).
    expect(fin.fiscal.declarations[0].dpaParClasse['12']).toBeCloseTo(v?.cout ?? 0, 2);
  });

  it('un véhicule acheté avec un prêt d’équipement est refusé sans historique, puis accepté', () => {
    let e = nouvellePartie(72, 24);
    const id = e.entreprises[0].id;
    e = investir(e, id, 'vehicule', 'pretFixe');
    expect(e.entreprises[0].immobilisations.some((i) => i.investissementId === 'vehicule')).toBe(false);
    e = jouerMois(e, 8);
    const prets = e.entreprises[0].prets.length;
    e = investir(e, id, 'vehicule', 'pretVariable');
    const ent = e.entreprises[0];
    if (ent.immobilisations.some((i) => i.investissementId === 'vehicule')) {
      expect(ent.prets).toHaveLength(prets + 1);
      expect(ent.prets.at(-1)?.type).toBe('variable');
    }
    expect(totalBalance(ent.livre.soldes)).toBe(0);
  });

  it('les placements rapportent des intérêts et les CPG reviennent à l’échéance', () => {
    let e = nouvellePartie(81, 24);
    const id = e.entreprises[0].id;
    e = placer(e, id, 'cpg6', 2000);
    expect(e.entreprises[0].livre.soldes.placements).toBe(200_000);
    e = jouerMois(e, 7);
    const ent = e.entreprises[0];
    expect(ent.finance.placements).toHaveLength(0);
    expect(ent.livre.soldes.placements).toBe(0);
    expect(etatsFinanciers(ent, { type: 'cumul' }).resultats.autresProduits).toBeGreaterThan(0);
  });

  it('le plan d’affaires trop optimiste est pénalisé', () => {
    const ref = ventesReference(cafe, mtl, emplacementDe(mtl, 'rue'));
    const base = { secteur: cafe, ville: mtl, emplacement: emplacementDe(mtl, 'rue'), apports: 45_000, coutProjet: 110_000, chargesFixesMensuelles: 15_000 };
    const realiste = evaluerPlan(planRealiste(), base);
    const optimiste = evaluerPlan({ ...planRealiste(), ventesMensuelles: ref * 2 }, base);
    expect(realiste.score).toBeGreaterThan(optimiste.score);
    expect(optimiste.commentaires).toContain('tropOptimiste');
  });

  it('sources de démarrage : âge, forme juridique et plan d’affaires sont vérifiés', () => {
    const p = (changements: Partial<ParametresDemarrage>): ParametresDemarrage => ({ ...DEMARRAGE_TEST, ...changements });
    const codes = (x: ParametresDemarrage) => validerSources(x, { apports: 45_000, coutProjet: 110_000, scorePlan: 80 }).map((e) => e.code);
    expect(codes(p({ ageProprietaire: 45, financements: { futurpreneur: 20_000 } }))).toContain('age');
    expect(codes(p({ financements: { ange: 30_000 } }))).toContain('forme');
    expect(validerSources(p({ financements: { bdc: 30_000 } }), { apports: 45_000, coutProjet: 110_000, scorePlan: null }).map((e) => e.code)).toContain('planRequis');
    expect(partAnge(30_000, 45_000, 80)).toBeLessThan(0.49);
    expect(validerDemarrage(p({ financements: { futurpreneur: 20_000 }, planAffaires: planRealiste() }), cafe, mtl)).toEqual([]);
  });

  it('création avec plusieurs sources : prêts, subvention et investisseur providentiel', () => {
    const params: ParametresDemarrage = {
      ...DEMARRAGE_TEST,
      formeJuridique: 'inc-qc',
      financements: { loveMoney: 10_000, creavenir: 10_000, ange: 30_000 },
      planAffaires: planRealiste(),
      typeTauxPret: 'variable',
    };
    expect(validerDemarrage(params, cafe, mtl)).toEqual([]);
    const e: EtatPartie = creerPartie(configTest(91, 12), params);
    const ent = e.entreprises[0];
    expect(ent.prets).toHaveLength(3);
    expect(ent.prets.find((x) => x.preteur === 'Famille et amis')?.tauxAnnuel).toBe(0);
    expect(ent.livre.soldes.subventions).toBe(-500_000);
    expect(ent.finance.actionnaires).toHaveLength(2);
    expect(ent.finance.actionnaires.reduce((a, x) => a + x.part, 0)).toBeCloseTo(1, 3);
    expect(totalBalance(ent.livre.soldes)).toBe(0);
    const fin = jouerMois(e, 12);
    expect(etatsFinanciers(fin.entreprises[0], { type: 'cumul' }).bilan.ecart).toBe(0);
  });
});
