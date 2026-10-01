/**
 * Financement : mini plan d'affaires évalué par les prêteurs, sources de financement
 * de démarrage (banque, love money, BDC, Futurpreneur, fonds locaux, Créavenir,
 * investisseur providentiel), évaluation du crédit en cours de partie et placements.
 */
import { SOURCES_FINANCEMENT, TYPES_PLACEMENTS, sourceFinancementParId } from '../data';
import type { Emplacement, IdSourceFinancement, Secteur, Ville } from './data-types';
import { tauxPreferentiel, type Conjoncture } from './economy';
import { versementMensuel } from './loans';
import { cumulerMouvements, etatResultats, bilan } from './statements';
import type { Entreprise, FormeJuridique, ParametresDemarrage, PlanAffaires } from './types';
import { borner, versCents } from './util';

export const IDS_SOURCES: readonly IdSourceFinancement[] = [
  'loveMoney',
  'futurpreneur',
  'bdc',
  'fondsLocal',
  'creavenir',
  'ange',
];

/** Plafond du prêt bancaire et multiple de la mise de fonds. */
export const REGLES_BANQUE = { multipleApport: 3, pretMax: 150_000, partLoveMoney: 0.5 };

// ---------------------------------------------------------------------------
// Plan d'affaires
// ---------------------------------------------------------------------------

/** Ventes mensuelles d'un commerce comparable après sa première année (repère des prêteurs). */
export function ventesReference(
  secteur: Secteur,
  ville: Ville,
  emplacement: Emplacement,
  facteurMarche = 1,
): number {
  const saison = secteur.saisonnalite.reduce((a, x) => a + x, 0) / 12;
  const potentiel = (ville.marchePotentielMensuel[secteur.id] ?? 0) * saison * facteurMarche;
  const ticket = secteur.lignes.reduce((a, l) => a + l.tauxAchat * l.prixReference, 0);
  return Math.round(potentiel * 0.16 * emplacement.achalandage * ticket);
}

export type CommentairePlan =
  | 'tropOptimiste'
  | 'optimiste'
  | 'realiste'
  | 'tropPrudent'
  | 'margeIrrealiste'
  | 'apportFaible'
  | 'apportTresFaible'
  | 'fondsRoulementFaible'
  | 'nonRentable';

export interface EvaluationPlan {
  score: number;
  /** Ventes prévues / repère des prêteurs. */
  ratio: number;
  reference: number;
  commentaires: CommentairePlan[];
}

export function evaluerPlan(
  plan: PlanAffaires,
  p: {
    secteur: Secteur;
    ville: Ville;
    emplacement: Emplacement;
    apports: number;
    coutProjet: number;
    chargesFixesMensuelles: number;
    facteurMarche?: number;
  },
): EvaluationPlan {
  const reference = ventesReference(p.secteur, p.ville, p.emplacement, p.facteurMarche);
  const ratio = reference > 0 ? plan.ventesMensuelles / reference : 0;
  const commentaires: CommentairePlan[] = [];
  let score = 100;
  if (ratio > 1.6) {
    score -= 45;
    commentaires.push('tropOptimiste');
  } else if (ratio > 1.3) {
    score -= 25;
    commentaires.push('optimiste');
  } else if (ratio < 0.6) {
    score -= 20;
    commentaires.push('tropPrudent');
  } else commentaires.push('realiste');
  const [min, max] = p.secteur.margeBruteCible;
  if (plan.margeBrute < min - 0.1 || plan.margeBrute > max + 0.1) {
    score -= 15;
    commentaires.push('margeIrrealiste');
  }
  const partApport = p.coutProjet > 0 ? p.apports / p.coutProjet : 1;
  if (partApport < 0.1) {
    score -= 35;
    commentaires.push('apportTresFaible');
  } else if (partApport < 0.2) {
    score -= 20;
    commentaires.push('apportFaible');
  }
  if (plan.moisFondsRoulement < 3) {
    score -= 10;
    commentaires.push('fondsRoulementFaible');
  }
  if (plan.ventesMensuelles * plan.margeBrute < p.chargesFixesMensuelles) {
    score -= 15;
    commentaires.push('nonRentable');
  }
  return { score: borner(score, 0, 100), ratio, reference, commentaires };
}

// ---------------------------------------------------------------------------
// Sources de démarrage
// ---------------------------------------------------------------------------

export type CodeErreurSource =
  | 'montantMin'
  | 'montantMax'
  | 'age'
  | 'forme'
  | 'planRequis'
  | 'planInsuffisant'
  | 'apportInsuffisant'
  | 'partProjet'
  | 'reqRequis'
  | 'partAngeTropElevee';

export interface ErreurSource {
  source: IdSourceFinancement;
  code: CodeErreurSource;
}

export function estSocieteActionsForme(forme: FormeJuridique): boolean {
  return forme === 'inc-qc' || forme === 'inc-federal';
}

/** Valeur que l'investisseur providentiel accorde au projet avant son investissement. */
export function valorisationAnge(apportPersonnel: number, scorePlan: number): number {
  return Math.round(apportPersonnel * 2 * (0.6 + scorePlan / 100));
}

/** Proportion des actions que l'investisseur demande pour un montant donné. */
export function partAnge(montant: number, apportPersonnel: number, scorePlan: number): number {
  if (montant <= 0) return 0;
  const pre = valorisationAnge(apportPersonnel, scorePlan);
  return montant / (pre + montant);
}

/** Mise de fonds reconnue par la banque (la love money compte à moitié). */
export function apportReconnu(params: ParametresDemarrage, apports: number): number {
  const f = params.financements;
  return (
    apports +
    REGLES_BANQUE.partLoveMoney * (f.loveMoney ?? 0) +
    (f.ange ?? 0) +
    ((f.creavenir ?? 0) > 0 ? (sourceFinancementParId('creavenir').subvention ?? 0) : 0)
  );
}

export function pretBancaireMax(apportReconnuTotal: number): number {
  return Math.max(
    0,
    Math.min(REGLES_BANQUE.pretMax, Math.floor(apportReconnuTotal * REGLES_BANQUE.multipleApport)),
  );
}

export function validerSources(
  params: ParametresDemarrage,
  p: { apports: number; coutProjet: number; scorePlan: number | null },
): ErreurSource[] {
  const erreurs: ErreurSource[] = [];
  for (const id of IDS_SOURCES) {
    const montant = params.financements[id] ?? 0;
    if (montant <= 0) continue;
    const s = sourceFinancementParId(id);
    const ajouter = (code: CodeErreurSource) => erreurs.push({ source: id, code });
    if (montant < s.montantMin) ajouter('montantMin');
    if (montant > s.montantMax) ajouter('montantMax');
    if (
      (s.ageMin !== undefined && params.ageProprietaire < s.ageMin) ||
      (s.ageMax !== undefined && params.ageProprietaire > s.ageMax)
    )
      ajouter('age');
    if (s.formes && !s.formes.includes(params.formeJuridique)) ajouter('forme');
    if (s.scorePlanMin !== null) {
      if (p.scorePlan === null) ajouter('planRequis');
      else if (p.scorePlan < s.scorePlanMin) ajouter('planInsuffisant');
    }
    if (p.coutProjet > 0 && p.apports / p.coutProjet < s.apportMinPct) ajouter('apportInsuffisant');
    if (s.partProjetMax !== undefined && montant > s.partProjetMax * p.coutProjet)
      ajouter('partProjet');
    if (
      id === 'fondsLocal' &&
      params.formeJuridique === 'individuelle' &&
      !params.demarches.includes('req')
    )
      ajouter('reqRequis');
    if (id === 'ange' && partAnge(montant, params.apportPersonnel, p.scorePlan ?? 0) > 0.49)
      ajouter('partAngeTropElevee');
  }
  return erreurs;
}

/** Taux annuel d'une source au démarrage. */
export function tauxSource(
  id: IdSourceFinancement | 'banque',
  conj: Conjoncture,
  variable = false,
) {
  const s = sourceFinancementParId(id);
  if (s.ecartTaux === null) return s.tauxFixe ?? 0;
  const ecart = id === 'banque' && variable ? s.ecartTaux - 0.005 : s.ecartTaux;
  return Math.round((tauxPreferentiel(conj) + ecart) * 10000) / 10000;
}

/** Montant total des sources de financement de démarrage (hors banque et apports). */
export function totalSources(params: ParametresDemarrage): number {
  return IDS_SOURCES.reduce((a, id) => a + Math.max(0, params.financements[id] ?? 0), 0);
}

export function sourcesAdmissibles(secteurId: string) {
  return SOURCES_FINANCEMENT.filter(
    (s) => s.type !== 'nonAdmissible' || (s.secteurs ?? []).includes(secteurId),
  );
}

// ---------------------------------------------------------------------------
// Crédit en cours de partie
// ---------------------------------------------------------------------------

export type RaisonRefus = 'historiqueInsuffisant' | 'rcsdFaible' | 'endettementEleve' | 'decouvert';

export interface EvaluationCredit {
  accepte: boolean;
  taux: number;
  raisons: RaisonRefus[];
  /** Ratio de couverture du service de la dette (BAIIA / versements annuels). */
  rcsd: number | null;
  endettement: number;
  versement: number;
}

/** Évaluation d'une demande de prêt par la banque. */
export function evaluerCredit(
  ent: Entreprise,
  montant: number,
  dureeMois: number,
  type: 'fixe' | 'variable',
  conj: Conjoncture,
): EvaluationCredit {
  const raisons: RaisonRefus[] = [];
  const derniers = ent.archives.slice(-3);
  if (derniers.length < 3) raisons.push('historiqueInsuffisant');
  const portion = derniers.at(-1)?.portionCouranteDette ?? 0;
  const b = bilan(ent.livre.soldes, portion);
  const endettement =
    b.totalActif + montant > 0 ? (b.totalPassif + montant) / (b.totalActif + montant) : 1;
  const taux =
    Math.round(
      (tauxPreferentiel(conj) + (type === 'fixe' ? 0.025 : 0.02) + (endettement > 0.6 ? 0.01 : 0)) *
        10000,
    ) / 10000;
  const versement = versementMensuel(versCents(montant), taux, dureeMois) / 100;
  let rcsd: number | null = null;
  if (derniers.length > 0) {
    const r = etatResultats(cumulerMouvements(derniers.map((a) => a.mouvements)));
    const baiiaAnnuel = (r.baiia * 12) / derniers.length;
    const service =
      (ent.prets.filter((p) => p.solde > 0).reduce((a, p) => a + p.versementMensuel, 0) / 100 +
        versement) *
      12;
    rcsd = service > 0 ? baiiaAnnuel / service : null;
    if (rcsd !== null && rcsd < 1.25) raisons.push('rcsdFaible');
  }
  if (endettement > 0.75) raisons.push('endettementEleve');
  if (ent.moisEnDefaut > 0) raisons.push('decouvert');
  return { accepte: raisons.length === 0, taux, raisons, rcsd, endettement, versement };
}

/** Limite maximale de la marge de crédit que la banque accepte (selon les ventes récentes). */
export function limiteMargeMax(ent: Entreprise, limiteBase: number): number {
  const derniers = ent.archives.slice(-3);
  const ventes =
    derniers.length > 0
      ? derniers.reduce((a, x) => a + x.indicateurs.chiffreAffaires, 0) / derniers.length
      : 0;
  const clients = Math.max(0, ent.livre.soldes.comptesClients) / 100;
  const stocks = Math.max(0, ent.livre.soldes.stocks) / 100;
  return Math.min(
    80_000,
    Math.round((limiteBase + 0.5 * ventes + 0.75 * clients + 0.5 * stocks) / 1000) * 1000,
  );
}

// ---------------------------------------------------------------------------
// Placements
// ---------------------------------------------------------------------------

export function typePlacement(id: string) {
  const t = TYPES_PLACEMENTS.find((x) => x.id === id);
  if (!t) throw new Error(`Placement introuvable : ${id}`);
  return t;
}

export function tauxPlacement(id: string, conj: Conjoncture): number {
  return Math.max(
    0.0025,
    Math.round((conj.tauxDirecteur + typePlacement(id).ecart) * 10000) / 10000,
  );
}
