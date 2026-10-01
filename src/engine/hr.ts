/**
 * Ressources humaines (Jalon 1) : génération d'employés, moral, productivité et départs.
 * Le recrutement détaillé (candidats, entrevues) arrivera au Jalon 3.
 */
import { NOMS_FAMILLE, PRENOMS } from '../data';
import type { Poste } from './data-types';
import type { Rng } from './rng';
import type { Employe } from './types';
import { borner, lisser } from './util';

/** Coût d'un affichage de poste et de l'intégration d'un nouvel employé ($). */
export const COUT_RECRUTEMENT = 350;

export function genererEmploye(id: number, poste: Poste, heuresSemaine: number, rng: Rng): Employe {
  return {
    id: `emp-${id}`,
    prenom: rng.pick(PRENOMS),
    nom: rng.pick(NOMS_FAMILLE),
    posteId: poste.id,
    heuresSemaine,
    moral: rng.int(60, 75),
    competence: Math.round(rng.range(0.78, 1.12) * 100) / 100,
    moisAnciennete: 0,
    cumulBrutAnnee: 0,
  };
}

/** Productivité selon le moral : 0,8 à 1,1 environ. */
export function facteurMoral(moral: number): number {
  return 0.75 + (0.5 * borner(moral, 0, 100)) / 100;
}

/**
 * Moral visé : un salaire au-dessus du marché motive, la surcharge de travail
 * (clients qui attendent) épuise, et la nouveauté aide au début.
 */
export function moralCible(
  salaireHoraire: number,
  salaireMarche: number,
  utilisation: number,
  heuresSemaine: number,
): number {
  const effetSalaire = 300 * (salaireHoraire / salaireMarche - 1);
  const surcharge = utilisation > 0.85 ? Math.min(35, (utilisation - 0.85) * 100) : 0;
  const heures = heuresSemaine > 40 ? (heuresSemaine - 40) * 1.5 : 0;
  return borner(62 + effetSalaire - surcharge - heures, 5, 95);
}

export function evoluerMoral(e: Employe, cible: number, rng: Rng): number {
  return Math.round(borner(lisser(e.moral, cible, 0.3) + rng.normal(0, 2), 0, 100));
}

/** Probabilité mensuelle qu'un employé démissionne. */
export function probabiliteDepart(moral: number, penurie: number): number {
  return borner(0.012 + Math.max(0, (50 - moral) / 100) * 0.25 + penurie * 0.01, 0, 0.5);
}

/**
 * Indemnité de préavis (Loi sur les normes du travail, art. 82-83) si l'employeur
 * met fin à l'emploi sans donner de préavis écrit : 1 semaine de salaire de 3 mois à
 * 1 an de service, 2 semaines de 1 à 5 ans, 4 semaines de 5 à 10 ans, 8 semaines ensuite.
 */
export function semainesPreavis(moisService: number): number {
  if (moisService < 3) return 0;
  if (moisService < 12) return 1;
  if (moisService < 60) return 2;
  if (moisService < 120) return 4;
  return 8;
}
