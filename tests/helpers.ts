import { secteurParId } from '../src/data';
import { Rng } from '../src/engine/rng';
import { IDS_DEMARCHES } from '../src/engine/conformite';
import {
  changerFrequenceTaxes,
  congedier,
  creerPartie,
  embaucher,
  inscrireTaxes,
  modifierDecisions,
  modifierHeuresEmploye,
  planifierIncorporation,
  produireMiseAJourAnnuelle,
  regulariserDemarche,
  simulerMois,
} from '../src/engine/simulation';
import type {
  ConfigPartie,
  DureePartie,
  EtatPartie,
  FormeJuridique,
  ParametresDemarrage,
} from '../src/engine/types';

export function configTest(
  graine: number,
  dureeMois: DureePartie = 36,
  secteurId = 'cafe',
): ConfigPartie {
  return {
    graine,
    difficulte: 'realiste',
    dureeMois,
    secteurId,
    villeId: 'montreal',
    anneeDepart: 2027,
  };
}

export const DEMARRAGE_TEST: ParametresDemarrage = {
  nomEntreprise: 'Café Test',
  nomProprietaire: 'Alex',
  couleur: '#3b82f6',
  emplacementId: 'rue',
  equipementId: 'neuf',
  amenagementId: 'chaleureux',
  apportPersonnel: 45_000,
  montantPret: 85_000,
  formeJuridique: 'individuelle',
  nomAssocie: '',
  apportAssocie: 0,
  demarches: ['req', 'retenues', 'cnesst', 'permisMunicipal', 'mapaq', 'assurances', 'compteBancaire', 'francisation'],
  inscritTaxes: true,
};

export function nouvellePartie(
  graine: number,
  dureeMois: DureePartie = 36,
  secteurId = 'cafe',
): EtatPartie {
  return creerPartie(configTest(graine, dureeMois, secteurId), DEMARRAGE_TEST);
}

/** Joue des décisions aléatoires (même absurdes) pour éprouver le moteur. */
export function tourAleatoire(etat: EtatPartie, rng: Rng): EtatPartie {
  const ent = etat.entreprises[0];
  const secteur = secteurParId(etat.config.secteurId);
  const prix: Record<string, number> = {};
  for (const ligne of secteur.lignes) prix[ligne.id] = ligne.prixReference * rng.range(0.5, 1.8);
  let e = modifierDecisions(etat, ent.id, {
    prix,
    qualiteId: rng.pick(secteur.qualites).id,
    budgetPublicite: rng.int(0, 9000),
    heuresOuverture: rng.int(30, 112),
    heuresProprietaire: rng.int(0, 70),
    salaireHoraire: rng.range(15, 24),
    stockJoursCible: rng.int(1, 21),
    prelevements: rng.int(0, 6000),
    remboursementAutoMarge: rng.chance(0.7),
    apportPonctuel: rng.chance(0.05) ? rng.int(1000, 20000) : 0,
    remboursementAnticipe: rng.chance(0.05) ? rng.int(1000, 30000) : 0,
  });
  if (rng.chance(0.25)) e = embaucher(e, ent.id, rng.int(8, 45));
  if (e.entreprises[0].employes.length > 0 && rng.chance(0.15)) {
    e = congedier(e, ent.id, rng.pick(e.entreprises[0].employes).id);
  }
  if (e.entreprises[0].employes.length > 0 && rng.chance(0.2)) {
    e = modifierHeuresEmploye(e, ent.id, rng.pick(e.entreprises[0].employes).id, rng.int(5, 50));
  }
  // Jalon 2 : rémunération d'une société, taxes, démarches et obligations
  e = modifierDecisions(e, ent.id, {
    salaireDirigeant: rng.chance(0.7) ? rng.int(0, 6000) : 0,
    dividendePonctuel: rng.chance(0.08) ? rng.int(500, 15000) : 0,
  });
  if (rng.chance(0.05)) e = inscrireTaxes(e, ent.id);
  if (rng.chance(0.05)) e = changerFrequenceTaxes(e, ent.id, rng.pick(['mensuelle', 'trimestrielle', 'annuelle'] as const));
  if (rng.chance(0.05)) e = regulariserDemarche(e, ent.id, rng.pick(IDS_DEMARCHES));
  if (rng.chance(0.1)) e = produireMiseAJourAnnuelle(e, ent.id);
  if (rng.chance(0.03)) e = planifierIncorporation(e, ent.id, rng.pick(['inc-qc', 'inc-federal'] as const));
  return simulerMois(e);
}

const FORMES: FormeJuridique[] = ['individuelle', 'senc', 'sec', 'inc-qc', 'inc-federal'];

/** Paramètres de démarrage variés selon la graine (forme juridique, démarches, inscription aux taxes). */
export function demarrageVarie(graine: number): ParametresDemarrage {
  const forme = FORMES[graine % FORMES.length];
  return {
    ...DEMARRAGE_TEST,
    formeJuridique: forme,
    nomAssocie: 'Sam Roy',
    apportAssocie: forme === 'senc' || forme === 'sec' ? 20_000 : 0,
    demarches: IDS_DEMARCHES.filter((_, i) => (graine >> i) % 2 === 0 || graine % 4 === 0),
    inscritTaxes: graine % 3 !== 0,
  };
}

export function jouerAleatoirement(graine: number, mois: DureePartie): EtatPartie {
  const rng = new Rng(graine * 7919 + 13);
  let etat = creerPartie(configTest(graine, mois), demarrageVarie(graine));
  while (!etat.terminee) etat = tourAleatoire(etat, rng);
  return etat;
}

/** Joue toute la partie avec les décisions par défaut. */
export function jouerParDefaut(etat: EtatPartie): EtatPartie {
  let e = etat;
  while (!e.terminee) e = simulerMois(e);
  return e;
}
