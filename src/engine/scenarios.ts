/**
 * Mode Prof / Scénario : mises en situation prédéfinies (situation de départ particulière)
 * avec des objectifs mesurables et une note finale.
 */
import { SCENARIOS, scenarioParId } from '../data';
import type { ObjectifScenario, Scenario } from './data-types';
import { PHASES } from './economy';
import { bilanPartie } from './rapports';
import type { ConfigPartie, Entreprise, EtatPartie } from './types';
import { borner } from './util';

export { SCENARIOS, scenarioParId };

/** Configuration de la partie imposée par un scénario. */
export function configScenario(scenario: Scenario, graine: number): ConfigPartie {
  return {
    graine,
    difficulte: scenario.difficulte,
    dureeMois: scenario.dureeMois,
    secteurId: scenario.secteurId,
    villeId: scenario.villeId,
    anneeDepart: 2027,
    scenarioId: scenario.id,
  };
}

/** Applique la situation de départ du scénario (réputation, conjoncture, concurrents). */
export function appliquerScenario(etat: EtatPartie, scenario: Scenario): void {
  const d = scenario.depart;
  for (const ent of etat.entreprises) {
    if (d.notoriete !== undefined) {
      ent.clientele.notoriete = d.notoriete;
      for (const k of Object.keys(ent.marketing.notorieteSegments))
        ent.marketing.notorieteSegments[k] = d.notoriete;
    }
    if (d.note !== undefined) ent.clientele.note = d.note;
    if (d.nbAvis !== undefined) ent.clientele.nbAvis = d.nbAvis;
  }
  if (d.phase) {
    const cible = PHASES[d.phase];
    etat.conjoncture.phase = d.phase;
    etat.conjoncture.moisPhase = 0;
    etat.conjoncture.confiance = cible.confiance;
    etat.conjoncture.chomage = cible.chomage;
  }
  for (const [personnalite, notoriete] of Object.entries(d.concurrents ?? {})) {
    for (const c of etat.concurrents)
      if (c.personnaliteId === personnalite) c.notoriete = notoriete;
  }
}

export interface ResultatObjectif extends ObjectifScenario {
  valeur: number;
  atteint: boolean;
  /** Progression vers la cible (0 à 1), pour une note partielle. */
  progression: number;
}

export interface EvaluationScenario {
  objectifs: ResultatObjectif[];
  atteints: number;
  /** Note sur 100 : 70 points pour les objectifs, 30 pour la note de gestion. */
  note: number;
}

/** Valeur actuelle d'un indicateur d'objectif pour une entreprise. */
export function valeurObjectif(ent: Entreprise, type: ObjectifScenario['type']): number {
  const b = bilanPartie(ent);
  const archives = ent.archives;
  const fin = archives.at(-1);
  switch (type) {
    case 'survie':
      return ent.enFaillite ? 0 : 1;
    case 'beneficeCumule':
      return b.beneficeCumule;
    case 'ventesCumulees':
      return b.ventesCumulees;
    case 'encaisseFinale':
      return fin ? fin.indicateurs.encaisse : 0;
    case 'partMarche': {
      // Moyenne des 3 derniers mois (moins sensible à la saison et au hasard).
      const derniers = archives.slice(-3);
      return derniers.length
        ? derniers.reduce((s, a) => s + a.indicateurs.partMarche, 0) / derniers.length
        : 0;
    }
    case 'noteClients':
      return fin ? fin.indicateurs.note : ent.clientele.note;
    case 'satisfaction':
      return b.satisfactionMoyenne;
    case 'moral':
      return b.moralMoyen;
    case 'valeurEntreprise':
      return b.valeurEntreprise;
  }
}

function progression(o: ObjectifScenario, valeur: number): number {
  if (o.type === 'survie') return valeur >= 1 ? 1 : 0;
  if (valeur >= o.cible) return 1;
  // Cible nulle (ex. bénéfice cumulé positif) : une perte donne une progression partielle.
  if (o.cible <= 0) return valeur < 0 ? borner(1 + valeur / 20_000, 0, 0.9) : 1;
  return borner(valeur / o.cible, 0, 0.99);
}

export function evaluerScenario(ent: Entreprise, scenario: Scenario): EvaluationScenario {
  const objectifs = scenario.objectifs.map((o) => {
    const valeur = valeurObjectif(ent, o.type);
    const p = progression(o, valeur);
    return { ...o, valeur, atteint: p >= 1, progression: p };
  });
  const atteints = objectifs.filter((o) => o.atteint).length;
  const partObjectifs =
    objectifs.reduce((s, o) => s + (o.atteint ? 1 : o.progression * 0.5), 0) /
    Math.max(1, objectifs.length);
  const note = Math.round(70 * partObjectifs + 0.3 * bilanPartie(ent).note);
  return { objectifs, atteints, note };
}
