/**
 * Accès typé aux données statiques du jeu.
 * Les fichiers JSON peuvent être modifiés par un enseignant sans toucher au code.
 */
import type { PersonnaliteConcurrent, Poste, Secteur, Ville } from '../engine/data-types';
import secteursJson from './secteurs.json';
import villesJson from './villes.json';
import salairesJson from './salaires.json';
import concurrentsJson from './concurrents.json';
import nomsJson from './noms.json';

// Les JSON sont convertis vers leurs interfaces; leur structure est vérifiée par tests/donnees.test.ts.
export const SECTEURS: readonly Secteur[] = secteursJson.secteurs as unknown as Secteur[];
export const VILLES: readonly Ville[] = villesJson.villes as Ville[];
export const POSTES: readonly Poste[] = salairesJson.postes as Poste[];
export const PERSONNALITES: readonly PersonnaliteConcurrent[] =
  concurrentsJson.personnalites as PersonnaliteConcurrent[];
export const PRENOMS: readonly string[] = nomsJson.prenoms;
export const NOMS_FAMILLE: readonly string[] = nomsJson.noms;

function trouver<T extends { id: string }>(liste: readonly T[], id: string, type: string): T {
  const element = liste.find((e) => e.id === id);
  if (!element) throw new Error(`${type} introuvable : ${id}`);
  return element;
}

export const secteurParId = (id: string): Secteur => trouver(SECTEURS, id, 'Secteur');
export const villeParId = (id: string): Ville => trouver(VILLES, id, 'Ville');
export const posteParId = (id: string): Poste => trouver(POSTES, id, 'Poste');
export const personnaliteParId = (id: string): PersonnaliteConcurrent =>
  trouver(PERSONNALITES, id, 'Personnalité');
