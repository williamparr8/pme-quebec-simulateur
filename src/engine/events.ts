/**
 * Dilemmes : situations avec 2 à 4 choix, des conséquences (parfois différées ou
 * aléatoires) et une leçon d'affaires. Jalon 3 : dilemmes de ressources humaines;
 * le même mécanisme servira aux 60 événements du Jalon 4.
 *
 * Les effets sont décrits dans les données (src/data/evenements.json) avec un petit
 * langage d'effets interprété ici.
 */
import type { Rng } from './rng';
import type { DilemmeEnCours, Employe, Entreprise, Message, MoisArchive } from './types';
import { borner } from './util';

export type CibleEmploye = 'concerne' | 'tous' | 'autres';
export type CategorieDepense = 'formation' | 'entretien' | 'amendes' | 'recrutement' | 'sinistres';

export type EffetDilemme =
  | { type: 'moral'; cible: CibleEmploye; valeur: number }
  | { type: 'competence'; cible: CibleEmploye; valeur: number }
  | { type: 'salaire'; cible: CibleEmploye; pourcentage: number }
  | { type: 'prime'; montant: number; parEmploye?: boolean }
  | { type: 'depense'; categorie: CategorieDepense; montant: number; libelle: string }
  | { type: 'depart'; cible: 'concerne'; probabilite: number }
  | { type: 'congedier'; cible: 'concerne' }
  | { type: 'heuresProprietaire'; valeur: number }
  | { type: 'capacite'; facteur: number }
  | { type: 'notoriete'; valeur: number }
  | { type: 'satisfaction'; valeur: number }
  | { type: 'pertesRecurrentes'; montant: number; mois: number; libelle: string }
  | {
      type: 'risque';
      probabilite: number;
      delaiMois: number;
      code: string;
      effets: EffetDilemme[];
    }
  | { type: 'hasard'; probabilite: number; siOui: EffetDilemme[]; siNon: EffetDilemme[] };

export interface ChoixDilemme {
  id: string;
  libelle: string;
  explication: string;
  effets: EffetDilemme[];
}

export interface DefinitionDilemme {
  id: string;
  categorie: string;
  titre: string;
  description: string;
  condition: string;
  cible: 'aleatoire' | 'plusCompetent' | 'plusAncien' | 'moralBas';
  choixParDefaut: string;
  choix: ChoixDilemme[];
  lecon: string;
}

export interface ContexteEffets {
  ent: Entreprise;
  employeId: string | null;
  index: number;
  rng: Rng;
  /** Inscrit une dépense aux livres (fournie par le moteur). */
  depense: (categorie: CategorieDepense, montant: number, libelle: string) => void;
  /** Met fin à l'emploi d'un employé avec l'indemnité de préavis. */
  congedier: (employeId: string) => void;
  messages: Message[];
}

function cibles(ent: Entreprise, cible: CibleEmploye, employeId: string | null): Employe[] {
  if (cible === 'tous') return ent.employes;
  if (cible === 'autres') return ent.employes.filter((e) => e.id !== employeId);
  return ent.employes.filter((e) => e.id === employeId);
}

/** Applique une liste d'effets (mutation de l'entreprise). */
export function appliquerEffets(effets: readonly EffetDilemme[], c: ContexteEffets): void {
  const { ent } = c;
  for (const e of effets) {
    switch (e.type) {
      case 'moral':
        for (const x of cibles(ent, e.cible, c.employeId))
          x.moral = Math.round(borner(x.moral + e.valeur, 0, 100));
        break;
      case 'competence':
        for (const x of cibles(ent, e.cible, c.employeId))
          x.competence = Math.round(borner(x.competence + e.valeur, 0.5, 1.4) * 100) / 100;
        break;
      case 'salaire':
        for (const x of cibles(ent, e.cible, c.employeId)) {
          x.salaireHoraire = Math.round(x.salaireHoraire * (1 + e.pourcentage) * 100) / 100;
          x.derniereAugmentation = c.index;
        }
        break;
      case 'prime':
        ent.effetsMois.primes += e.parEmploye ? e.montant * ent.employes.length : e.montant;
        break;
      case 'depense':
        c.depense(e.categorie, e.montant, e.libelle);
        break;
      case 'depart': {
        const x = cibles(ent, 'concerne', c.employeId)[0];
        if (x && c.rng.chance(e.probabilite)) {
          ent.employes = ent.employes.filter((y) => y.id !== x.id);
          ent.rh.departs.push({ index: c.index, type: 'demission' });
          c.messages.push({
            code: 'demission',
            niveau: 'alerte',
            params: { nom: `${x.prenom} ${x.nom}`, moral: x.moral },
          });
        }
        break;
      }
      case 'congedier':
        if (c.employeId && ent.employes.some((x) => x.id === c.employeId)) c.congedier(c.employeId);
        break;
      case 'heuresProprietaire':
        ent.effetsMois.heuresProprietaire += e.valeur;
        break;
      case 'capacite':
        ent.effetsMois.capacite *= e.facteur;
        break;
      case 'notoriete':
        for (const k of Object.keys(ent.marketing.notorieteSegments))
          ent.marketing.notorieteSegments[k] = borner(
            ent.marketing.notorieteSegments[k] + e.valeur,
            0.01,
            0.98,
          );
        break;
      case 'satisfaction':
        ent.clientele.satisfaction = borner(ent.clientele.satisfaction + e.valeur, 0.05, 0.98);
        break;
      case 'pertesRecurrentes':
        ent.effetsMois.pertesRecurrentes.push({
          montant: e.montant,
          moisRestants: e.mois,
          libelle: e.libelle,
        });
        break;
      case 'risque':
        ent.risques.push({
          code: e.code,
          echeance: c.index + e.delaiMois,
          probabilite: e.probabilite,
          effets: e.effets,
        });
        break;
      case 'hasard':
        appliquerEffets(c.rng.chance(e.probabilite) ? e.siOui : e.siNon, c);
        break;
    }
  }
}

/** Total des dépenses directes d'une liste d'effets (pour annoncer le montant d'un risque). */
export function montantEffets(effets: readonly EffetDilemme[], nbEmployes: number): number {
  return effets.reduce((a, e) => {
    if (e.type === 'depense') return a + e.montant;
    if (e.type === 'prime') return a + (e.parEmploye ? e.montant * nbEmployes : e.montant);
    return a;
  }, 0);
}

export interface ContexteConditions {
  mois: number;
  derniere: MoisArchive | undefined;
}

/** Conditions d'apparition des dilemmes. */
export const CONDITIONS: Record<string, (ent: Entreprise, c: ContexteConditions) => boolean> = {
  toujours: () => true,
  employes2: (ent) => ent.employes.length >= 2,
  employes3: (ent) => ent.employes.length >= 3,
  decembre: (ent, c) => c.mois === 12 && ent.employes.length >= 2,
  surcharge: (ent, c) => ent.employes.length >= 1 && (c.derniere?.indicateurs.utilisation ?? 0) > 1,
  employeCompetent: (ent) =>
    ent.employes.some((e) => e.competence >= 1.02 && e.moisAnciennete >= 4),
};

export function choisirConcerne(
  ent: Entreprise,
  cible: DefinitionDilemme['cible'],
  rng: Rng,
): Employe | null {
  if (ent.employes.length === 0) return null;
  const tries = [...ent.employes];
  switch (cible) {
    case 'plusCompetent':
      return tries.sort((a, b) => b.competence - a.competence)[0];
    case 'plusAncien':
      return tries.sort((a, b) => b.moisAnciennete - a.moisAnciennete)[0];
    case 'moralBas':
      return tries.sort((a, b) => a.moral - b.moral)[0];
    default:
      return rng.pick(tries);
  }
}

/**
 * Tire au plus un nouveau dilemme pour le mois qui vient. Un même dilemme ne revient
 * pas avant 12 mois.
 */
export function tirerDilemme(
  ent: Entreprise,
  definitions: readonly DefinitionDilemme[],
  c: ContexteConditions & { index: number; probabilite: number; id: string },
  rng: Rng,
): DilemmeEnCours | null {
  if (ent.dilemmes.length > 0 || !rng.chance(c.probabilite)) return null;
  const possibles = definitions.filter(
    (d) =>
      (CONDITIONS[d.condition] ?? (() => false))(ent, c) &&
      (ent.historiqueDilemmes[d.id] === undefined || c.index - ent.historiqueDilemmes[d.id] >= 12),
  );
  if (possibles.length === 0) return null;
  const def = rng.pick(possibles);
  const employe = choisirConcerne(ent, def.cible, rng);
  ent.historiqueDilemmes[def.id] = c.index;
  return {
    id: c.id,
    defId: def.id,
    employeId: employe?.id ?? null,
    nomEmploye: employe ? `${employe.prenom} ${employe.nom}` : '',
    index: c.index,
  };
}

/** Remplace {nom} par le nom de l'employé concerné. */
export function texteDilemme(texte: string, nomEmploye: string): string {
  return texte.split('{nom}').join(nomEmploye || 'Un employé');
}
