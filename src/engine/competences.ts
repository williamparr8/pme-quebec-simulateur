/**
 * Compétences du propriétaire (mode histoire et croissance) : 5 domaines de 0 à 100 qui
 * progressent avec l'expérience, les formations et les quiz, et qui changent les résultats.
 * Les effets restent modérés : une bonne décision compte plus qu'une compétence élevée.
 */
import competencesJson from '../data/competences.json';
import type { Entreprise, MoisArchive } from './types';
import { borner } from './util';

export type DomaineCompetence = 'gestion' | 'finance' | 'marketing' | 'rh' | 'fiscalite';
export const DOMAINES: readonly DomaineCompetence[] = [
  'gestion',
  'finance',
  'marketing',
  'rh',
  'fiscalite',
];

export interface InfoDomaine {
  id: DomaineCompetence;
  nom: string;
  description: string;
  effet: string;
}
export interface ProfilProprietaire {
  id: DomaineCompetence;
  nom: string;
  description: string;
  niveaux: Record<DomaineCompetence, number>;
}
export interface FormationProprietaire {
  id: string;
  domaine: DomaineCompetence;
  nom: string;
  cout: number;
  gain: number;
  niveauRequis: number;
}

export const INFOS_DOMAINES = competencesJson.domaines as InfoDomaine[];
export const PROFILS_PROPRIETAIRE = competencesJson.profils as ProfilProprietaire[];
export const FORMATIONS_PROPRIETAIRE = competencesJson.formations as FormationProprietaire[];

/** Niveaux de départ selon le parcours choisi à la création. */
export function competencesInitiales(
  profil: DomaineCompetence = 'gestion',
): Record<DomaineCompetence, number> {
  const p = PROFILS_PROPRIETAIRE.find((x) => x.id === profil) ?? PROFILS_PROPRIETAIRE[0];
  return { ...p.niveaux };
}

/** Niveau actuel (30 pour une partie sauvegardée avant l'ajout des compétences). */
export function niveauCompetence(ent: Entreprise, d: DomaineCompetence): number {
  return ent.competences?.[d] ?? 30;
}

/** Maîtrise de 0 (niveau 20 ou moins) à 1 (niveau 100). */
export function maitrise(ent: Entreprise, d: DomaineCompetence): number {
  return borner((niveauCompetence(ent, d) - 20) / 80, 0, 1);
}

/** Ajoute de l'expérience : les gains ralentissent à mesure qu'on approche de 100. */
export function gagnerCompetence(ent: Entreprise, d: DomaineCompetence, points: number): void {
  ent.competences ??= competencesInitiales();
  const actuel = ent.competences[d];
  const gain = points * Math.max(0.05, 1 - actuel / 110);
  ent.competences[d] = Math.round(borner(actuel + gain, 0, 100) * 10) / 10;
}

// Effets sur la simulation
export const bonusConversionMarketing = (ent: Entreprise): number =>
  0.2 * maitrise(ent, 'marketing') - 0.03;
export const bonusCapaciteGestion = (ent: Entreprise): number =>
  0.06 * maitrise(ent, 'gestion') - 0.01;
export const bonusMoralRh = (ent: Entreprise): number => 10 * maitrise(ent, 'rh') - 2;
export const rabaisTauxFinance = (ent: Entreprise): number =>
  Math.round(0.0075 * maitrise(ent, 'finance') * 10000) / 10000;
export const facteurFraisComptables = (ent: Entreprise): number =>
  1 - 0.25 * maitrise(ent, 'fiscalite');
export const facteurRisqueFiscal = (ent: Entreprise): number =>
  1.15 - 0.5 * maitrise(ent, 'fiscalite');

/** Domaine associé à une catégorie de quiz ou d'événement. */
export function domaineDeCategorie(categorie: string): DomaineCompetence {
  const c = categorie.toLowerCase();
  if (c.startsWith('fiscal') || c.startsWith('juridique')) return 'fiscalite';
  if (c.startsWith('finance') || c.startsWith('comptab')) return 'finance';
  if (c.startsWith('marketing') || c.startsWith('marche')) return 'marketing';
  if (c.startsWith('ressources') || c === 'rh') return 'rh';
  return 'gestion';
}

/**
 * Progression mensuelle : on apprend en faisant. Gestion à chaque mois (davantage s'il est
 * rentable), marketing en investissant et en étudiant son marché, RH selon la taille de
 * l'équipe, finance en faisant un budget et en gardant une trésorerie saine, fiscalité en
 * respectant ses obligations. Chaque choix devant un événement fait aussi apprendre.
 */
export function progresserCompetences(
  ent: Entreprise,
  archive: MoisArchive,
  categorieChoix: (defId: string) => string,
): void {
  const i = archive.indicateurs;
  gagnerCompetence(ent, 'gestion', 1 + (i.beneficeNet > 0 ? 0.6 : 0));
  const etudes = ent.marketing.etudes.filter((e) => e.index === archive.index).length;
  gagnerCompetence(ent, 'marketing', (i.depensesMarketing > 0 ? 0.5 : 0) + 2 * etudes);
  gagnerCompetence(ent, 'rh', 0.25 * Math.min(8, i.nbEmployes));
  gagnerCompetence(
    ent,
    'finance',
    (archive.prevision ? 0.8 : 0) + (i.encaisse > 0 && i.margeCreditUtilisee === 0 ? 0.6 : 0),
  );
  gagnerCompetence(
    ent,
    'fiscalite',
    0.4 + (ent.fiscal.inscritTaxes && (archive.mouvements.amendes ?? 0) === 0 ? 0.8 : 0),
  );
  for (const j of ent.journalChoix ?? [])
    if (j.index === archive.index)
      gagnerCompetence(ent, domaineDeCategorie(categorieChoix(j.defId)), 1.5);
}
