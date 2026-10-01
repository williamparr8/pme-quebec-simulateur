/**
 * Quiz optionnels entre les trimestres : 3 questions tirées de la banque. Chaque bonne
 * réponse donne 10 % de rabais (maximum 50 %) sur la prochaine formation ou étude de marché.
 */
import { QUESTIONS_QUIZ } from '../data';
import type { QuestionQuiz } from './data-types';
import { Rng, graineDepuisTexte } from './rng';
import type { Entreprise, EtatPartie } from './types';

export const QUESTIONS_PAR_QUIZ = 3;
export const RABAIS_PAR_BONNE_REPONSE = 0.1;
export const RABAIS_MAXIMUM = 0.5;

/** Un quiz est offert au début de chaque trimestre (après les mois 3, 6, 9…). */
export function quizDisponible(etat: EtatPartie, ent: Entreprise): boolean {
  if (etat.terminee || ent.enFaillite || ent.vente) return false;
  if (etat.moisCourant === 0 || etat.moisCourant % 3 !== 0) return false;
  return !(ent.pedagogie?.quiz ?? []).some((q) => q.index === etat.moisCourant);
}

/**
 * Questions du quiz courant : toujours les mêmes pour une partie, un mois et une équipe
 * donnés (reproductible), en évitant celles déjà posées.
 */
export function questionsQuiz(etat: EtatPartie, ent: Entreprise): QuestionQuiz[] {
  const dejaPosees = new Set((ent.pedagogie?.quiz ?? []).flatMap((q) => q.questions));
  const restantes = QUESTIONS_QUIZ.filter((q) => !dejaPosees.has(q.id));
  const banque = restantes.length >= QUESTIONS_PAR_QUIZ ? restantes : [...QUESTIONS_QUIZ];
  const rng = new Rng(
    (etat.config.graine ^ graineDepuisTexte(`${ent.id}-${etat.moisCourant}`)) >>> 0,
  );
  const choisies: QuestionQuiz[] = [];
  const pool = [...banque];
  while (choisies.length < QUESTIONS_PAR_QUIZ && pool.length > 0)
    choisies.push(pool.splice(rng.int(0, pool.length - 1), 1)[0]);
  return choisies;
}

/** Rabais pédagogique disponible (0 à 0,5). */
export function rabaisPedagogique(ent: Entreprise): number {
  return ent.pedagogie?.rabais ?? 0;
}

/** Applique le rabais pédagogique à un coût, puis le consomme. Retourne le coût réduit. */
export function utiliserRabais(ent: Entreprise, cout: number): number {
  const rabais = rabaisPedagogique(ent);
  if (rabais <= 0 || !ent.pedagogie) return cout;
  ent.pedagogie.rabais = 0;
  return Math.round(cout * (1 - rabais) * 100) / 100;
}

/**
 * Corrige le quiz (modifie l'entreprise) et retourne le nombre de bonnes réponses.
 * `reponses` associe l'identifiant de chaque question à l'index du choix.
 */
export function corrigerQuiz(
  etat: EtatPartie,
  ent: Entreprise,
  reponses: Record<string, number>,
): number {
  if (!quizDisponible(etat, ent)) return 0;
  const questions = questionsQuiz(etat, ent);
  const bonnes = questions.filter((q) => reponses[q.id] === q.bonne).length;
  ent.pedagogie ??= { quiz: [], rabais: 0 };
  ent.pedagogie.quiz.push({
    index: etat.moisCourant,
    questions: questions.map((q) => q.id),
    bonnes,
  });
  ent.pedagogie.rabais = Math.min(
    RABAIS_MAXIMUM,
    Math.round((ent.pedagogie.rabais + bonnes * RABAIS_PAR_BONNE_REPONSE) * 100) / 100,
  );
  return bonnes;
}
