import { secteurParId } from '../src/data';
import { Rng } from '../src/engine/rng';
import {
  congedier,
  creerPartie,
  embaucher,
  modifierDecisions,
  modifierHeuresEmploye,
  simulerMois,
} from '../src/engine/simulation';
import type {
  ConfigPartie,
  DureePartie,
  EtatPartie,
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
  return simulerMois(e);
}

export function jouerAleatoirement(graine: number, mois: DureePartie): EtatPartie {
  const rng = new Rng(graine * 7919 + 13);
  let etat = nouvellePartie(graine, mois);
  while (!etat.terminee) etat = tourAleatoire(etat, rng);
  return etat;
}

/** Joue toute la partie avec les décisions par défaut. */
export function jouerParDefaut(etat: EtatPartie): EtatPartie {
  let e = etat;
  while (!e.terminee) e = simulerMois(e);
  return e;
}
