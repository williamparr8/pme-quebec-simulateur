/**
 * Accès typé aux données statiques du jeu.
 * Les fichiers JSON peuvent être modifiés par un enseignant sans toucher au code.
 */
import type {
  Avantage,
  CanalPublicite,
  Formation,
  Fournisseur,
  InitiativeEco,
  ParametresMarketing,
  Persona,
  PersonnaliteConcurrent,
  PlateformeRecrutement,
  Poste,
  QuestionQuiz,
  Scenario,
  Secteur,
  SourceFinancement,
  TraitPersonnalite,
  TypeEtude,
  Ville,
} from '../engine/data-types';
import type { DefinitionDilemme } from '../engine/events';
import concurrentsJson from './concurrents.json';
import evenementsJson from './evenements.json';
import financementJson from './financement.json';
import fournisseursJson from './fournisseurs.json';
import marketingJson from './marketing.json';
import nomsJson from './noms.json';
import personasJson from './personas.json';
import quizJson from './quiz.json';
import rhJson from './rh.json';
import salairesJson from './salaires.json';
import scenariosJson from './scenarios.json';
import secteursJson from './secteurs.json';
import villesJson from './villes.json';

// Les JSON sont convertis vers leurs interfaces; leur structure est vérifiée par tests/donnees.test.ts.
export const SECTEURS: readonly Secteur[] = secteursJson.secteurs as unknown as Secteur[];
export const VILLES: readonly Ville[] = villesJson.villes as Ville[];
export const POSTES: readonly Poste[] = salairesJson.postes as Poste[];
export const PERSONNALITES: readonly PersonnaliteConcurrent[] =
  concurrentsJson.personnalites as unknown as PersonnaliteConcurrent[];
export const PRENOMS: readonly string[] = nomsJson.prenoms;
export const NOMS_FAMILLE: readonly string[] = nomsJson.noms;
export const CLIENTS_AFFAIRES: readonly { nom: string; type: string }[] = nomsJson.clientsAffaires;

export const PERSONAS: readonly Persona[] = personasJson.personas as Persona[];
export const CANAUX: readonly CanalPublicite[] = marketingJson.canaux as CanalPublicite[];
export const TYPES_ETUDES: readonly TypeEtude[] = marketingJson.etudes as TypeEtude[];
export const PARAMETRES_MARKETING: ParametresMarketing = marketingJson.parametres;
export const INITIATIVES_ECO: readonly InitiativeEco[] =
  marketingJson.initiativesEco as InitiativeEco[];
export const FOURNISSEURS: readonly Fournisseur[] = fournisseursJson.fournisseurs as Fournisseur[];
export const PLATEFORMES: readonly PlateformeRecrutement[] =
  rhJson.plateformes as PlateformeRecrutement[];
export const FORMATIONS: readonly Formation[] = rhJson.formations as Formation[];
export const FORMATION_GESTIONNAIRE_HYGIENE = rhJson.formationGestionnaireHygiene;
export const AVANTAGES: readonly Avantage[] = rhJson.avantages as Avantage[];
export const TRAITS: readonly TraitPersonnalite[] = rhJson.traits as TraitPersonnalite[];
export const SOURCES_FINANCEMENT: readonly SourceFinancement[] =
  financementJson.sources as SourceFinancement[];
export const TYPES_PLACEMENTS: readonly {
  id: string;
  nom: string;
  description: string;
  ecart: number;
  dureeMois: number;
}[] = financementJson.placements;
/** Événements et dilemmes (au moins 60), tous départements confondus. */
export const DILEMMES: readonly DefinitionDilemme[] =
  evenementsJson.evenements as unknown as DefinitionDilemme[];
/** Scénarios du mode Prof (mises en situation avec objectifs). */
export const SCENARIOS: readonly Scenario[] = scenariosJson.scenarios as Scenario[];
/** Questions des quiz offerts entre les trimestres. */
export const QUESTIONS_QUIZ: readonly QuestionQuiz[] = quizJson.questions;

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
export const personaParId = (id: string): Persona => trouver(PERSONAS, id, 'Persona');
export const canalParId = (id: string): CanalPublicite => trouver(CANAUX, id, 'Canal');
export const fournisseurParId = (id: string): Fournisseur =>
  trouver(FOURNISSEURS, id, 'Fournisseur');
export const plateformeParId = (id: string): PlateformeRecrutement =>
  trouver(PLATEFORMES, id, 'Plateforme');
export const formationParId = (id: string): Formation => trouver(FORMATIONS, id, 'Formation');
export const avantageParId = (id: string): Avantage => trouver(AVANTAGES, id, 'Avantage');
export const traitParId = (id: string): TraitPersonnalite => trouver(TRAITS, id, 'Trait');
export const typeEtudeParId = (id: string): TypeEtude => trouver(TYPES_ETUDES, id, 'Étude');
export const sourceFinancementParId = (id: string): SourceFinancement =>
  trouver(SOURCES_FINANCEMENT, id, 'Source de financement');
export const scenarioParId = (id: string): Scenario => trouver(SCENARIOS, id, 'Scénario');
export const dilemmeParId = (id: string): DefinitionDilemme => trouver(DILEMMES, id, 'Dilemme');

/** Postes offerts dans un secteur. */
export function postesSecteur(secteur: Secteur): Poste[] {
  return secteur.postes.map(posteParId);
}

/** Formations offertes dans un secteur (postes du secteur; hygiène seulement en alimentation). */
export function formationsSecteur(secteur: Secteur): Formation[] {
  return FORMATIONS.filter(
    (f) =>
      (!f.hygiene || secteur.alimentation) &&
      (f.postes === null || f.postes.some((p) => secteur.postes.includes(p))),
  );
}

/** Initiatives écoresponsables offertes dans un secteur. */
export function initiativesSecteur(secteur: Secteur): InitiativeEco[] {
  return INITIATIVES_ECO.filter((i) => secteur.initiativesEco.includes(i.id));
}

/** Fournisseurs possibles pour une catégorie d'approvisionnement. */
export function fournisseursCategorie(categorie: string): Fournisseur[] {
  return FOURNISSEURS.filter((f) => f.categorie === categorie);
}
