/**
 * Ressources humaines : candidats générés, moral, absentéisme, productivité, départs,
 * normes du travail (vacances, jours fériés, préavis) et syndicalisation.
 */
import { AVANTAGES, NOMS_FAMILLE, PRENOMS, TRAITS, plateformeParId, traitParId } from '../data';
import type { PlateformeRecrutement, Poste, TraitPersonnalite } from './data-types';
import type { Rng } from './rng';
import type { Candidat, Employe } from './types';
import { borner, lisser } from './util';

/** Ancien coût fixe d'un affichage (référence pour l'embauche rapide des tests). */
export const COUT_RECRUTEMENT = 350;

/** Jours fériés au Québec par mois civil (Loi sur les normes du travail et Loi sur la fête nationale). */
export const JOURS_FERIES_PAR_MOIS = [1, 0, 0, 1, 1, 1, 1, 0, 1, 1, 0, 1] as const;
export const NOMS_JOURS_FERIES: Record<number, string> = {
  1: 'Jour de l’An',
  4: 'Vendredi saint ou lundi de Pâques',
  5: 'Journée nationale des patriotes',
  6: 'Fête nationale',
  7: 'Fête du Canada',
  9: 'Fête du Travail',
  10: 'Action de grâce',
  12: 'Noël',
};

/** Indemnité de vacances : 4 %, puis 6 % après 3 ans de service continu (3 semaines). */
export function tauxVacances(moisAnciennete: number): number {
  return moisAnciennete >= 36 ? 0.06 : 0.04;
}

/** Indemnité d'un jour férié : 1/20 du salaire des 4 semaines précédentes (≈ une journée). */
export function indemniteJourFerie(salaireHoraire: number, heuresSemaine: number): number {
  return Math.round(((salaireHoraire * Math.min(heuresSemaine, 40) * 4) / 20) * 100) / 100;
}

function tirerTrait(rng: Rng): TraitPersonnalite {
  const total = TRAITS.reduce((a, t) => a + t.frequence, 0);
  let x = rng.next() * total;
  for (const t of TRAITS) {
    x -= t.frequence;
    if (x <= 0) return t;
  }
  return TRAITS[TRAITS.length - 1];
}

/** Salaire de marché d'un poste ($/h), selon la ville et l'inflation. */
export function salaireMarchePoste(poste: Poste, indiceSalaires: number, indicePrix: number): number {
  return poste.salaireMedian * indiceSalaires * indicePrix;
}

export interface ContexteRecrutement {
  salaireMarche: number;
  salaireMinimum: number;
  /** Pénurie de main-d'œuvre du moment (0 à 1). */
  penurie: number;
}

/** Génère un candidat pour un poste. */
export function genererCandidat(
  id: string,
  poste: Poste,
  plateforme: PlateformeRecrutement,
  ctx: ContexteRecrutement,
  expire: number,
  rng: Rng,
): Candidat {
  const experience = Math.min(15, Math.floor(rng.next() ** 1.6 * 12));
  const competence = borner(
    0.74 + 0.035 * Math.min(experience, 8) + rng.normal(0, 0.07) + plateforme.bonusCompetence,
    0.6,
    1.4,
  );
  const attentes = Math.max(
    ctx.salaireMinimum,
    Math.round(
      ctx.salaireMarche *
        (0.9 + 0.35 * (competence - 1) + 0.008 * experience + 0.06 * ctx.penurie + rng.normal(0, 0.03)) *
        4,
    ) / 4,
  );
  const trait = tirerTrait(rng);
  return {
    id,
    prenom: rng.pick(PRENOMS),
    nom: rng.pick(NOMS_FAMILLE),
    posteId: poste.id,
    competence: Math.round(competence * 100) / 100,
    experience,
    attentes: Math.round(attentes * 100) / 100,
    trait: trait.id,
    heuresSouhaitees: Math.round(
      borner(poste.heuresSemaineDefaut + rng.int(-6, 8), 8, poste.role === 'gestion' ? 45 : 40),
    ),
    plateformeId: plateforme.id,
    expire,
    statut: 'disponible',
  };
}

/** Nombre de candidats reçus pour un affichage (plus faible en pénurie de main-d'œuvre). */
export function nombreCandidats(plateformeId: string, penurie: number, rng: Rng): number {
  const p = plateformeParId(plateformeId);
  const moyenne = p.candidatsMoyens * (1.15 - 0.6 * penurie);
  return Math.max(0, Math.round(moyenne + rng.normal(0, 0.8)));
}

/** Probabilité qu'un candidat accepte une offre sous ses attentes. */
export function probabiliteAcceptation(offre: number, attentes: number): number {
  if (offre >= attentes) return 1;
  return borner(1 - ((attentes - offre) / attentes) * 10, 0, 1);
}

/** Transforme un candidat embauché en employé. */
export function employeDepuisCandidat(c: Candidat, salaire: number, heures: number): Employe {
  return {
    id: c.id,
    prenom: c.prenom,
    nom: c.nom,
    posteId: c.posteId,
    heuresSemaine: heures,
    salaireHoraire: Math.round(salaire * 100) / 100,
    moral: Math.round(borner(66 + (salaire / c.attentes - 1) * 120, 40, 85)),
    competence: c.competence,
    experience: c.experience,
    trait: c.trait,
    formations: [],
    moisAnciennete: 0,
    cumulBrutAnnee: 0,
    derniereEvaluation: null,
    derniereAugmentation: null,
    absenteisme: 0,
  };
}

/** Employé de départ (équipe d'ouverture) généré au hasard. */
export function genererEmploye(
  id: string,
  poste: Poste,
  heuresSemaine: number,
  salaire: number,
  rng: Rng,
): Employe {
  const trait = tirerTrait(rng);
  return {
    id,
    prenom: rng.pick(PRENOMS),
    nom: rng.pick(NOMS_FAMILLE),
    posteId: poste.id,
    heuresSemaine,
    salaireHoraire: Math.round(salaire * 100) / 100,
    moral: rng.int(60, 75),
    competence: Math.round(rng.range(0.78, 1.12) * 100) / 100,
    experience: rng.int(0, 5),
    trait: trait.id,
    formations: [],
    moisAnciennete: 0,
    cumulBrutAnnee: 0,
    derniereEvaluation: null,
    derniereAugmentation: null,
    absenteisme: 0,
  };
}

/** Productivité selon le moral : 0,75 à 1,25. */
export function facteurMoral(moral: number): number {
  return 0.75 + (0.5 * borner(moral, 0, 100)) / 100;
}

/** Productivité d'un nouvel employé pendant son premier mois (apprentissage). */
export function facteurIntegration(moisAnciennete: number): number {
  return moisAnciennete < 1 ? 0.75 : 1;
}

export interface FacteursMoral {
  salaireHoraire: number;
  salaireMarche: number;
  utilisation: number;
  heuresSemaine: number;
  trait: TraitPersonnalite;
  /** Somme des gains de moral des avantages sociaux. */
  avantages: number;
  gerant: boolean;
  syndique: boolean;
  /** Mois depuis la dernière évaluation (null : jamais). */
  moisDepuisEvaluation: number | null;
  /** Mois depuis la dernière augmentation (ou l'embauche). */
  moisDepuisAugmentation: number;
  moisAnciennete: number;
}

/**
 * Moral visé : un salaire au-dessus du marché motive, la surcharge de travail
 * épuise, les avantages sociaux, la reconnaissance et un bon encadrement aident.
 */
export function moralCible(f: FacteursMoral): number {
  const effetSalaire = 300 * (f.salaireHoraire / f.salaireMarche - 1);
  const surcharge =
    f.utilisation > 0.85 ? Math.min(35, (f.utilisation - 0.85) * 100) * f.trait.surcharge : 0;
  const heures = f.heuresSemaine > 40 ? (f.heuresSemaine - 40) * 1.5 : 0;
  const reconnaissance =
    f.moisDepuisEvaluation !== null && f.moisDepuisEvaluation <= 12
      ? 3
      : f.moisAnciennete >= 18
        ? -2
        : 0;
  const ambition = f.trait.id === 'ambitieux' && f.moisDepuisAugmentation > 12 ? -6 : 0;
  return borner(
    62 +
      effetSalaire -
      surcharge -
      heures +
      f.avantages +
      (f.gerant ? 4 : 0) +
      (f.syndique ? 6 : 0) +
      reconnaissance +
      ambition,
    5,
    95,
  );
}

export function evoluerMoral(e: Employe, cible: number, rng: Rng): number {
  const t = traitParId(e.trait);
  return Math.round(borner(lisser(e.moral, cible, 0.3) + rng.normal(0, 2 * t.volatilite), 0, 100));
}

/** Absentéisme mensuel (proportion des heures prévues non travaillées). */
export function tauxAbsenteisme(moral: number, trait: TraitPersonnalite): number {
  return borner(0.02 + Math.max(0, (60 - moral) / 100) * 0.12 + trait.absenteisme, 0, 0.25);
}

/** Probabilité mensuelle qu'un employé démissionne. */
export function probabiliteDepart(
  moral: number,
  penurie: number,
  trait?: TraitPersonnalite,
  reductionAvantages = 0,
): number {
  return borner(
    0.012 +
      Math.max(0, (50 - moral) / 100) * 0.25 +
      penurie * 0.01 +
      (trait?.depart ?? 0) -
      reductionAvantages,
    0.002,
    0.5,
  );
}

/** Gain de moral et réduction des départs selon les avantages offerts à un employé. */
export function effetsAvantages(
  avantages: string[],
  heuresSemaine: number,
): { moral: number; depart: number; cout: number; capacite: number } {
  let moral = 0;
  let depart = 0;
  let cout = 0;
  let capacite = 0;
  for (const a of AVANTAGES) {
    if (!avantages.includes(a.id) || heuresSemaine < a.heuresMin) continue;
    moral += a.gainMoral;
    depart += a.reductionDepart;
    cout += a.coutMensuelParEmploye;
    capacite += a.effetCapacite;
  }
  return { moral, depart, cout, capacite };
}

/** Progression mensuelle de la compétence (apprentissage sur le tas, plafonnée). */
export function progressionCompetence(e: Employe): number {
  const t = traitParId(e.trait);
  return Math.min(1.35, Math.round((e.competence + 0.004 * t.apprentissage) * 1000) / 1000);
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

/** Pénurie de main-d'œuvre du moment : plus forte en période d'expansion, plus faible l'été (étudiants). */
export function penurieDuMois(base: number, phase: string, mois: number): number {
  const conj = phase === 'expansion' ? 1.2 : phase === 'ralentissement' ? 0.8 : 1;
  const saison = mois >= 5 && mois <= 8 ? 0.75 : 1;
  return borner(base * conj * saison, 0, 1);
}
