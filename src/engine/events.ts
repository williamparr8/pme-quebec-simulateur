/**
 * Événements et dilemmes : situations avec 2 à 4 choix, des conséquences (parfois
 * différées ou aléatoires) et une leçon d'affaires. Les événements touchent tous les
 * départements : météo, opérations, marketing, juridique, finances, marché et RH.
 *
 * Les effets sont décrits dans les données (src/data/evenements.json) avec un petit
 * langage d'effets interprété ici. Les effets qui touchent la comptabilité ou d'autres
 * modules passent par les fonctions du contexte (fournies par actions.ts).
 */
import type { Concurrent } from './ai-competitors';
import type { Secteur } from './data-types';
import type { Conjoncture } from './economy';
import type { Rng } from './rng';
import type {
  DilemmeEnCours,
  Employe,
  Entreprise,
  Message,
  Modificateur,
  MoisArchive,
} from './types';
import { borner } from './util';

export type CibleEmploye = 'concerne' | 'tous' | 'autres';
export type CategorieDepense =
  | 'formation'
  | 'entretien'
  | 'amendes'
  | 'recrutement'
  | 'sinistres'
  | 'honoraires'
  | 'publicite'
  | 'divers';
export type CategorieEncaissement = 'subvention' | 'assurance' | 'autre';
export type NatureEvenement = 'negatif' | 'positif' | 'neutre';

export type EffetDilemme =
  | { type: 'moral'; cible: CibleEmploye; valeur: number }
  | { type: 'competence'; cible: CibleEmploye; valeur: number }
  | { type: 'salaire'; cible: CibleEmploye; pourcentage: number }
  | { type: 'heures'; cible: CibleEmploye; facteur: number }
  | { type: 'prime'; montant: number; parEmploye?: boolean }
  | { type: 'depense'; categorie: CategorieDepense; montant: number; libelle: string }
  | { type: 'encaissement'; montant: number; categorie: CategorieEncaissement; libelle: string }
  | { type: 'depart'; cible: 'concerne'; probabilite: number }
  | { type: 'congedier'; cible: 'concerne' }
  | { type: 'heuresProprietaire'; valeur: number }
  | { type: 'capacite'; facteur: number; mois?: number }
  | { type: 'demande'; facteur: number; mois: number; libelle: string }
  | { type: 'couts'; facteur: number; mois: number; libelle: string }
  | { type: 'fraisParVisite'; facteur: number; mois: number }
  | { type: 'penurie'; valeur: number; mois: number }
  | { type: 'delais'; jours: number; mois: number; anticipation: boolean }
  | { type: 'fermeture'; jours: number }
  | {
      type: 'stockPerdu';
      proportion: number;
      perissables?: boolean;
      categorie?: string;
      libelle: string;
    }
  | { type: 'notoriete'; valeur: number }
  | { type: 'satisfaction'; valeur: number }
  | { type: 'note'; valeur: number }
  | { type: 'image'; valeur: number }
  | { type: 'pertesRecurrentes'; montant: number; mois: number; libelle: string }
  | { type: 'revenusRecurrents'; montant: number; mois: number; libelle: string }
  | { type: 'loyer'; pourcentage: number }
  | { type: 'prix'; facteur: number }
  | { type: 'promotion'; taux: number }
  | { type: 'publicite'; facteur: number }
  | { type: 'panierBleu' }
  | { type: 'tauxMarge'; ecart: number }
  | { type: 'syndicat' }
  | { type: 'embaucher'; posteId?: string; competence: number; majorationSalaire?: number }
  | { type: 'fournisseurFaillite'; mode: 'fiable' | 'moinsCher' }
  | { type: 'fournisseursCanadiens' }
  | { type: 'creanceClient'; mode: 'radier' | 'recouvrer'; part?: number }
  | { type: 'concurrent'; action: 'arrivee' | 'fermer' }
  | { type: 'vente'; facteur: number }
  | {
      type: 'risque';
      probabilite: number;
      delaiMois: number;
      code: string;
      effets: EffetDilemme[];
    }
  | { type: 'hasard'; probabilite: number; siOui: EffetDilemme[]; siNon: EffetDilemme[] }
  | { type: 'si'; condition: string; alors: EffetDilemme[]; sinon: EffetDilemme[] };

export interface ChoixDilemme {
  id: string;
  libelle: string;
  explication: string;
  effets: EffetDilemme[];
}

export interface DefinitionDilemme {
  id: string;
  categorie: string;
  /** Négatif, positif ou neutre : la difficulté change la fréquence des événements négatifs. */
  nature?: NatureEvenement;
  titre: string;
  description: string;
  condition: string;
  /** Secteurs où l'événement peut survenir (tous si absent). */
  secteurs?: string[];
  /** Mois civils où l'événement peut survenir (tous si absent). */
  mois?: number[];
  /** Poids relatif dans le tirage (1 par défaut). */
  poids?: number;
  /** Poids relatif selon le secteur. */
  poidsSecteurs?: Record<string, number>;
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
  /** Événement en cours (valeurs propres : concurrent visé, montant d'une offre). */
  dilemme?: DilemmeEnCours;
  /** Inscrit une dépense aux livres (fournie par le moteur). */
  depense: (categorie: CategorieDepense, montant: number, libelle: string) => void;
  /** Inscrit un encaissement (subvention, indemnité d'assurance, autre produit). */
  encaisser: (montant: number, categorie: CategorieEncaissement, libelle: string) => void;
  /** Met fin à l'emploi d'un employé avec l'indemnité de préavis. */
  congedier: (employeId: string) => void;
  /** Effets qui touchent les stocks, les fournisseurs, les clients ou les concurrents. */
  perdreStock?: (
    proportion: number,
    perissables: boolean,
    categorie: string | undefined,
    libelle: string,
  ) => void;
  fournisseurFaillite?: (mode: 'fiable' | 'moinsCher') => void;
  fournisseursCanadiens?: () => void;
  embaucher?: (posteId: string | undefined, competence: number, majorationSalaire: number) => void;
  creanceClient?: (mode: 'radier' | 'recouvrer', part: number) => void;
  concurrent?: (action: 'arrivee' | 'fermer') => void;
  vendre?: (facteur: number) => void;
  /** Évalue une condition nommée (pour l'effet « si »). */
  condition?: (nom: string) => boolean;
  messages: Message[];
}

function cibles(ent: Entreprise, cible: CibleEmploye, employeId: string | null): Employe[] {
  if (cible === 'tous') return ent.employes;
  if (cible === 'autres') return ent.employes.filter((e) => e.id !== employeId);
  return ent.employes.filter((e) => e.id === employeId);
}

function ajouterModificateur(ent: Entreprise, m: Modificateur): void {
  (ent.modificateurs ??= []).push(m);
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
      case 'heures':
        for (const x of cibles(ent, e.cible, c.employeId))
          x.heuresSemaine = Math.round(borner(x.heuresSemaine * e.facteur, 8, 45));
        break;
      case 'prime':
        ent.effetsMois.primes += e.parEmploye ? e.montant * ent.employes.length : e.montant;
        break;
      case 'depense':
        c.depense(e.categorie, e.montant, e.libelle);
        break;
      case 'encaissement':
        c.encaisser(e.montant, e.categorie, e.libelle);
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
        if (e.mois && e.mois > 1)
          ajouterModificateur(ent, {
            type: 'capacite',
            valeur: e.facteur,
            moisRestants: e.mois,
            libelle: 'Capacité',
          });
        else ent.effetsMois.capacite *= e.facteur;
        break;
      case 'demande':
      case 'couts':
        ajouterModificateur(ent, {
          type: e.type,
          valeur: e.facteur,
          moisRestants: e.mois,
          libelle: e.libelle,
        });
        break;
      case 'fraisParVisite':
        ajouterModificateur(ent, {
          type: 'fraisParVisite',
          valeur: e.facteur,
          moisRestants: e.mois,
          libelle: 'Frais par client',
        });
        break;
      case 'penurie':
        ajouterModificateur(ent, {
          type: 'penurie',
          valeur: e.valeur,
          moisRestants: e.mois,
          libelle: 'Pénurie de main-d’œuvre',
        });
        break;
      case 'delais':
        ajouterModificateur(ent, {
          type: 'delais',
          valeur: e.jours,
          moisRestants: e.mois,
          libelle: 'Délais de livraison',
          anticipation: e.anticipation,
        });
        break;
      case 'fermeture':
        ent.effetsMois.joursFermeture = Math.min(
          30,
          (ent.effetsMois.joursFermeture ?? 0) + e.jours,
        );
        break;
      case 'stockPerdu':
        c.perdreStock?.(e.proportion, e.perissables ?? false, e.categorie, e.libelle);
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
      case 'note':
        ent.clientele.note = Math.round(borner(ent.clientele.note + e.valeur, 1, 5) * 100) / 100;
        break;
      case 'image':
        ent.marketing.image = borner(ent.marketing.image + e.valeur, 0, 1);
        break;
      case 'pertesRecurrentes':
        ent.effetsMois.pertesRecurrentes.push({
          montant: e.montant,
          moisRestants: e.mois,
          libelle: e.libelle,
        });
        break;
      case 'revenusRecurrents':
        (ent.effetsMois.revenusRecurrents ??= []).push({
          montant: e.montant,
          moisRestants: e.mois,
          libelle: e.libelle,
        });
        break;
      case 'loyer':
        ent.bail.loyerMensuel = Math.round(ent.bail.loyerMensuel * (1 + e.pourcentage));
        break;
      case 'prix':
        for (const k of Object.keys(ent.decisions.prix))
          ent.decisions.prix[k] = Math.round(ent.decisions.prix[k] * e.facteur * 100) / 100;
        break;
      case 'promotion':
        ent.decisions.promotion = Math.max(ent.decisions.promotion, e.taux);
        break;
      case 'publicite':
        for (const k of Object.keys(ent.decisions.publicite))
          ent.decisions.publicite[k] = Math.round(ent.decisions.publicite[k] * e.facteur);
        break;
      case 'panierBleu':
        ent.decisions.panierBleu = true;
        break;
      case 'tauxMarge':
        ent.margeCredit.ecartTaux =
          Math.round((ent.margeCredit.ecartTaux + e.ecart) * 10000) / 10000;
        break;
      case 'syndicat':
        if (ent.rh.syndicat.statut !== 'accredite') {
          ent.rh.syndicat = { statut: 'accredite', depuis: c.index };
          for (const x of ent.employes)
            x.salaireHoraire = Math.round(x.salaireHoraire * 1.05 * 100) / 100;
          c.messages.push({ code: 'syndicatAccredite', niveau: 'danger' });
        }
        break;
      case 'embaucher':
        c.embaucher?.(e.posteId, e.competence, e.majorationSalaire ?? 0);
        break;
      case 'fournisseurFaillite':
        c.fournisseurFaillite?.(e.mode);
        break;
      case 'fournisseursCanadiens':
        c.fournisseursCanadiens?.();
        break;
      case 'creanceClient':
        c.creanceClient?.(e.mode, e.part ?? 0);
        break;
      case 'concurrent':
        c.concurrent?.(e.action);
        break;
      case 'vente':
        c.vendre?.(e.facteur);
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
      case 'si':
        appliquerEffets((c.condition?.(e.condition) ?? false) ? e.alors : e.sinon, c);
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

/** Modificateurs actifs d'un type, combinés (produit pour les facteurs, somme pour les ajouts). */
export function modificateur(ent: Entreprise, type: Modificateur['type']): number {
  const liste = (ent.modificateurs ?? []).filter((m) => m.type === type && m.moisRestants > 0);
  if (type === 'penurie' || type === 'delais') return liste.reduce((a, m) => a + m.valeur, 0);
  return liste.reduce((a, m) => a * m.valeur, 1);
}

/** Passe un mois : les modificateurs expirés disparaissent. */
export function vieillirModificateurs(ent: Entreprise): void {
  ent.modificateurs = (ent.modificateurs ?? [])
    .map((m) => ({ ...m, moisRestants: m.moisRestants - 1 }))
    .filter((m) => m.moisRestants > 0);
}

export interface ContexteConditions {
  mois: number;
  derniere: MoisArchive | undefined;
  index?: number;
  secteur?: Secteur;
  concurrents?: readonly Concurrent[];
  conj?: Conjoncture;
  /** Valeur estimée de l'entreprise (offre de rachat). */
  valorisation?: number;
  /** L'entreprise vend en ligne (secteur en ligne ou site Web transactionnel). */
  enLigne?: boolean;
  /** Le personnel respecte les règles d'hygiène du MAPAQ. */
  hygieneConforme?: boolean;
  /** Usure de l'équipement (0 à 1). */
  usure?: number;
  /** Au moins un fournisseur payé en dollars américains. */
  importateur?: boolean;
}

const benefice3Mois = (ent: Entreprise) =>
  ent.archives.slice(-3).reduce((a, x) => a + x.indicateurs.beneficeNet, 0);

const physique = (ent: Entreprise) =>
  ent.emplacementId !== 'enLigne' && ent.emplacementId !== 'industriel';

/** Conditions d'apparition des événements (et conditions des effets « si »). */
export const CONDITIONS: Record<string, (ent: Entreprise, c: ContexteConditions) => boolean> = {
  toujours: () => true,
  employes1: (ent) => ent.employes.length >= 1,
  employes2: (ent) => ent.employes.length >= 2,
  employes3: (ent) => ent.employes.length >= 3,
  decembre: (ent, c) => c.mois === 12 && ent.employes.length >= 2,
  surcharge: (ent, c) => ent.employes.length >= 1 && (c.derniere?.indicateurs.utilisation ?? 0) > 1,
  employeCompetent: (ent) =>
    ent.employes.some((e) => e.competence >= 1.02 && e.moisAnciennete >= 4),
  alimentation: (_ent, c) => c.secteur?.alimentation ?? false,
  vitrine: (ent) => physique(ent),
  pasEnLigne: (ent) => ent.emplacementId !== 'enLigne',
  enLigneOuSite: (_ent, c) => c.enLigne ?? false,
  importateur: (_ent, c) => c.importateur ?? false,
  clientsAffaires: (ent) => ent.b2b.factures.some((f) => f.statut === 'ouverte'),
  anciennete6: (_ent, c) => (c.index ?? 0) >= 6,
  anciennete12: (_ent, c) => (c.index ?? 0) >= 12,
  offreRachat: (ent, c) =>
    (c.index ?? 0) >= 18 &&
    benefice3Mois(ent) > 0 &&
    (c.concurrents ?? []).some((x) => x.actif && x.personnaliteId === 'geant'),
  nouveauAVenir: (_ent, c) =>
    (c.index ?? 0) >= 3 &&
    (c.concurrents ?? []).some((x) => x.statut === 'aVenir' && x.arrivee !== null),
  concurrentEnDifficulte: (_ent, c) =>
    (c.concurrents ?? []).some((x) => x.actif && x.personnaliteId !== 'geant' && x.tresorerie < 0),
  departRecent: (ent, c) =>
    ent.rh.departs.some((d) => d.type === 'finEmploi' && (c.index ?? 0) - d.index <= 6) ||
    ent.rh.departs.filter((d) => (c.index ?? 0) - d.index <= 6).length >= 2,
  promotionRecente: (ent, c) => ent.marketing.historiquePromos.some((i) => (c.index ?? 0) - i <= 3),
  margeUtilisee: (ent, c) =>
    (c.derniere?.indicateurs.margeCreditUtilisee ?? 0) > 0 && benefice3Mois(ent) < 0,
  ralentissement: (_ent, c) => c.conj?.phase === 'ralentissement' || c.conj?.phase === 'recession',
  moralFragile: (ent) =>
    ent.employes.length >= 4 &&
    ent.rh.syndicat.statut !== 'accredite' &&
    ent.employes.reduce((a, e) => a + e.moral, 0) / ent.employes.length < 55,
  equipementUse: (_ent, c) => (c.usure ?? 0) >= 0.2,
  // Conditions des effets « si »
  assure: (ent) => ent.demarches.assurances,
  compteBancaire: (ent) => ent.demarches.compteBancaire,
  hygieneConforme: (_ent, c) => c.hygieneConforme ?? true,
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

/** Événements possibles ce mois-ci (condition, secteur, mois et délai de 12 mois respectés). */
export function evenementsPossibles(
  ent: Entreprise,
  definitions: readonly DefinitionDilemme[],
  c: ContexteConditions & { index: number },
): DefinitionDilemme[] {
  return definitions.filter(
    (d) =>
      (CONDITIONS[d.condition] ?? (() => false))(ent, c) &&
      (!d.secteurs || (c.secteur !== undefined && d.secteurs.includes(c.secteur.id))) &&
      (!d.mois || d.mois.includes(c.mois)) &&
      (ent.historiqueDilemmes[d.id] === undefined || c.index - ent.historiqueDilemmes[d.id] >= 12),
  );
}

/** Concurrent visé par un événement ({concurrent} dans le texte). */
function concurrentVise(def: DefinitionDilemme, c: ContexteConditions): Concurrent | undefined {
  const liste = c.concurrents ?? [];
  if (def.condition === 'nouveauAVenir') return liste.find((x) => x.statut === 'aVenir');
  if (def.condition === 'concurrentEnDifficulte')
    return liste
      .filter((x) => x.actif && x.personnaliteId !== 'geant' && x.tresorerie < 0)
      .sort((a, b) => a.tresorerie - b.tresorerie)[0];
  if (def.condition === 'offreRachat')
    return liste.find((x) => x.actif && x.personnaliteId === 'geant');
  return undefined;
}

/**
 * Tire au plus un nouvel événement pour le mois qui vient. Un même événement ne revient
 * pas avant 12 mois. Les poids tiennent compte du secteur et de la difficulté (moins
 * d'événements négatifs en mode Facile, plus de vérifications fiscales en mode Expert).
 */
export function tirerDilemme(
  ent: Entreprise,
  definitions: readonly DefinitionDilemme[],
  c: ContexteConditions & {
    index: number;
    probabilite: number;
    id: string;
    poidsNature?: Partial<Record<NatureEvenement, number>>;
    poidsFiscal?: number;
  },
  rng: Rng,
): DilemmeEnCours | null {
  if (ent.dilemmes.length > 0 || !rng.chance(c.probabilite)) return null;
  const possibles = evenementsPossibles(ent, definitions, c);
  if (possibles.length === 0) return null;
  const poids = possibles.map(
    (d) =>
      (d.poids ?? 1) *
      (c.secteur ? (d.poidsSecteurs?.[c.secteur.id] ?? 1) : 1) *
      (c.poidsNature?.[d.nature ?? 'negatif'] ?? 1) *
      (d.categorie === 'fiscal' ? (c.poidsFiscal ?? 1) : 1),
  );
  const total = poids.reduce((a, x) => a + x, 0);
  if (total <= 0) return null;
  let x = rng.next() * total;
  let def = possibles[possibles.length - 1];
  for (const [i, d] of possibles.entries()) {
    x -= poids[i];
    if (x <= 0) {
      def = d;
      break;
    }
  }
  const employe = choisirConcerne(ent, def.cible, rng);
  ent.historiqueDilemmes[def.id] = c.index;
  const concurrent = concurrentVise(def, c);
  const params: DilemmeEnCours['params'] = {};
  if (concurrent) {
    params.concurrentId = concurrent.id;
    params.concurrent = concurrent.nom;
  }
  if (def.condition === 'offreRachat')
    params.prix = Math.round((c.valorisation ?? 0) / 1000) * 1000;
  return {
    id: c.id,
    defId: def.id,
    employeId: employe?.id ?? null,
    nomEmploye: employe ? `${employe.prenom} ${employe.nom}` : '',
    index: c.index,
    params,
  };
}

export interface ValeursTexte {
  /** Nom de l'employé concerné. */
  nom?: string;
  /** Le commerce, avec article (ex. « le café »). */
  commerce?: string;
  concurrent?: string;
  /** Montant déjà formaté (ex. « 250 000 $ »). */
  prix?: string;
}

/** Remplace les marqueurs {nom}, {commerce}, {Commerce}, {concurrent} et {prix}. */
export function texteDilemme(texte: string, valeurs: string | ValeursTexte): string {
  const v: ValeursTexte = typeof valeurs === 'string' ? { nom: valeurs } : valeurs;
  const commerce = v.commerce ?? 'ton commerce';
  return texte
    .split('{nom}')
    .join(v.nom || 'Un employé')
    .split('{Commerce}')
    .join(commerce.charAt(0).toUpperCase() + commerce.slice(1))
    .split('{commerce}')
    .join(commerce)
    .split('{concurrent}')
    .join(v.concurrent || 'Un concurrent')
    .split('{prix}')
    .join(v.prix ?? '');
}
