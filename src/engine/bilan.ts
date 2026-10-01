/**
 * Rapport de fin de partie : note par département, meilleures et pires décisions (avec
 * leur effet mesuré), choix face aux événements et comparaison avec le marché.
 */
import { dilemmeParId, secteurParId } from '../data';
import { DEMARCHES, estApplicable } from './conformite';
import { scoreEco } from './marketing';
import { bilanPartie, type BilanPartie } from './rapports';
import { evaluerScenario, scenarioParId, type EvaluationScenario } from './scenarios';
import type { Entreprise, EtatPartie, MoisArchive, ResumeDecisions } from './types';
import { borner } from './util';

/** Résumé des décisions appliquées pendant le mois (enregistré dans l'archive). */
export function resumeDecisions(ent: Entreprise, archive: MoisArchive): ResumeDecisions {
  const d = ent.decisions;
  return {
    indicePrix: archive.indicateurs.indicePrixOffre,
    qualite: d.qualiteId,
    publicite: Object.values(d.publicite).reduce((a, x) => a + x, 0),
    heuresOuverture: d.heuresOuverture,
    nbEmployes: ent.employes.length,
    masseSalarialeHoraire: ent.employes.reduce((a, e) => a + e.salaireHoraire * e.heuresSemaine, 0),
    promotion: d.promotion > 0,
    fidelite: d.programmeFidelite,
    livraison: d.livraison,
    eco: scoreEco(d),
    immobilisations: ent.immobilisations.length,
    prets: ent.prets.length,
    produits: ent.marketing.produits.filter((p) => p.statut === 'actif').length,
  };
}

export type TypeDecision =
  | 'prixHausse'
  | 'prixBaisse'
  | 'qualite'
  | 'publiciteHausse'
  | 'publiciteBaisse'
  | 'heuresHausse'
  | 'heuresBaisse'
  | 'embauche'
  | 'promotion'
  | 'fidelite'
  | 'livraison'
  | 'eco'
  | 'investissement'
  | 'emprunt'
  | 'nouveauProduit';

export interface DecisionMarquante {
  /** Mois (index) où la décision s'est appliquée. */
  index: number;
  type: TypeDecision;
  params: Record<string, number | string>;
  /** Bénéfice mensuel moyen avant et après (3 mois). */
  avant: number;
  apres: number;
  /** Variation à laquelle on s'attendait à cause de la saison et de la conjoncture. */
  attendu: number;
  /** Effet estimé de la décision ($ par mois) : (après − avant) − attendu. */
  effet: number;
  /** D'autres décisions ont été prises le même mois (l'effet est partagé). */
  partage: boolean;
}

function changements(a: ResumeDecisions, b: ResumeDecisions): DecisionMarquante['type'][] {
  const t: TypeDecision[] = [];
  const ratioPrix = b.indicePrix / Math.max(0.01, a.indicePrix) - 1;
  if (ratioPrix >= 0.05) t.push('prixHausse');
  else if (ratioPrix <= -0.05) t.push('prixBaisse');
  if (b.qualite !== a.qualite) t.push('qualite');
  if (Math.abs(b.publicite - a.publicite) >= Math.max(200, 0.3 * a.publicite))
    t.push(b.publicite > a.publicite ? 'publiciteHausse' : 'publiciteBaisse');
  if (Math.abs(b.heuresOuverture - a.heuresOuverture) >= Math.max(4, 0.1 * a.heuresOuverture))
    t.push(b.heuresOuverture > a.heuresOuverture ? 'heuresHausse' : 'heuresBaisse');
  if (b.nbEmployes > a.nbEmployes) t.push('embauche');
  if (b.promotion && !a.promotion) t.push('promotion');
  if (b.fidelite && !a.fidelite) t.push('fidelite');
  if (b.livraison && !a.livraison) t.push('livraison');
  if (b.eco > a.eco + 0.05) t.push('eco');
  if (b.immobilisations > a.immobilisations) t.push('investissement');
  if (b.prets > a.prets) t.push('emprunt');
  if (b.produits > a.produits) t.push('nouveauProduit');
  return t;
}

const moyenne = (liste: number[]): number =>
  liste.length ? liste.reduce((a, x) => a + x, 0) / liste.length : 0;

/**
 * Décisions marquantes et leur effet : on compare le bénéfice moyen des 3 mois suivants à
 * celui des 3 mois précédents, en retirant l'effet attendu de la saison et de la conjoncture
 * (variation du marché potentiel × marge brute). C'est une estimation : plusieurs décisions
 * prises le même mois se partagent l'effet.
 */
export function decisionsMarquantes(ent: Entreprise): DecisionMarquante[] {
  const a = ent.archives;
  const resultat: DecisionMarquante[] = [];
  for (let t = 1; t < a.length; t++) {
    const prec = a[t - 1].resume;
    const cour = a[t].resume;
    if (!prec || !cour) continue;
    const types = changements(prec, cour);
    if (types.length === 0) continue;
    const avantA = a.slice(Math.max(0, t - 3), t);
    const apresA = a.slice(t, t + 3);
    if (apresA.length < 2) continue;
    const avant = moyenne(avantA.map((x) => x.indicateurs.beneficeNet));
    const apres = moyenne(apresA.map((x) => x.indicateurs.beneficeNet));
    const potAvant = moyenne(avantA.map((x) => x.indicateurs.potentiel));
    const potApres = moyenne(apresA.map((x) => x.indicateurs.potentiel));
    const caAvant = moyenne(avantA.map((x) => x.indicateurs.chiffreAffaires));
    const margeAvant = moyenne(avantA.map((x) => x.indicateurs.tauxMargeBrute));
    const attendu = potAvant > 0 ? (potApres / potAvant - 1) * caAvant * margeAvant : 0;
    const effet = Math.round(apres - avant - attendu);
    for (const type of types) {
      const params: Record<string, number | string> = {};
      if (type === 'prixHausse' || type === 'prixBaisse')
        params.pct = cour.indicePrix / Math.max(0.01, prec.indicePrix) - 1;
      if (type === 'publiciteHausse' || type === 'publiciteBaisse') {
        params.de = prec.publicite;
        params.a = cour.publicite;
      }
      if (type === 'heuresHausse' || type === 'heuresBaisse') {
        params.de = prec.heuresOuverture;
        params.a = cour.heuresOuverture;
      }
      if (type === 'qualite') {
        params.de = prec.qualite;
        params.a = cour.qualite;
      }
      if (type === 'embauche') params.n = cour.nbEmployes - prec.nbEmployes;
      resultat.push({
        index: a[t].index,
        type,
        params,
        avant: Math.round(avant),
        apres: Math.round(apres),
        attendu: Math.round(attendu),
        effet,
        partage: types.length > 1,
      });
    }
  }
  return resultat;
}

/** Les 3 meilleures et les 3 pires décisions (selon leur effet estimé). */
export function meilleuresEtPires(ent: Entreprise): {
  meilleures: DecisionMarquante[];
  pires: DecisionMarquante[];
} {
  const liste = decisionsMarquantes(ent);
  return {
    meilleures: liste
      .filter((x) => x.effet > 0)
      .sort((x, y) => y.effet - x.effet)
      .slice(0, 3),
    pires: liste
      .filter((x) => x.effet < 0)
      .sort((x, y) => x.effet - y.effet)
      .slice(0, 3),
  };
}

export interface ChoixEvenement {
  index: number;
  titre: string;
  choix: string;
  explication: string;
}

/** Choix faits devant les événements, du plus récent au plus ancien. */
export function choixEvenements(ent: Entreprise): ChoixEvenement[] {
  return (ent.journalChoix ?? [])
    .map((j) => {
      const def = dilemmeParId(j.defId);
      const c = def.choix.find((x) => x.id === j.choixId);
      return {
        index: j.index,
        titre: def.titre,
        choix: c?.libelle ?? j.choixId,
        explication: c?.explication ?? '',
      };
    })
    .reverse();
}

export type Departement = 'marketing' | 'rh' | 'operations' | 'finance' | 'conformite';

export interface ScoreDepartement {
  id: Departement;
  /** Note sur 100. */
  note: number;
  /** Indicateurs qui expliquent la note. */
  details: Record<string, number>;
}

/** Note de 0 à 100 par département, à partir des indicateurs de toute la partie. */
export function scoresDepartements(etat: EtatPartie, ent: Entreprise): ScoreDepartement[] {
  const a = ent.archives;
  const fin = a.at(-1)?.indicateurs;
  const b = bilanPartie(ent);
  const secteur = secteurParId(etat.config.secteurId);
  const n = Math.max(1, a.length);
  const moy = (f: (x: MoisArchive) => number) => a.reduce((s, x) => s + f(x), 0) / n;

  // Marketing : notoriété, part de marché et note en ligne.
  const nbCommerces = etat.entreprises.length + etat.concurrents.filter((c) => c.actif).length;
  const partJuste = 1 / Math.max(2, nbCommerces);
  const partFinale = moy((x) => x.indicateurs.partMarche);
  const notoriete = fin?.notoriete ?? ent.clientele.notoriete;
  const note = fin?.note ?? ent.clientele.note;
  const marketing =
    40 * borner(notoriete / 0.7, 0, 1) +
    30 * borner(partFinale / partJuste, 0, 1) +
    30 * borner((note - 3) / 1.8, 0, 1);

  // RH : moral moyen et roulement du personnel.
  const employesMoyens = moy((x) => x.indicateurs.nbEmployes);
  const annees = Math.max(1, a.length / 12);
  const roulement = employesMoyens > 0 ? ent.rh.departs.length / (employesMoyens * annees) : 0;
  const rh =
    employesMoyens > 0
      ? 70 * borner((b.moralMoyen - 30) / 55, 0, 1) + 30 * borner(1 - roulement, 0, 1)
      : 70 * borner((b.moralMoyen - 30) / 55, 0, 1) + 30;

  // Opérations : clients servis, défauts et pertes.
  const demande = a.reduce((s, x) => s + x.indicateurs.demande, 0);
  const servies = a.reduce((s, x) => s + x.indicateurs.servies, 0);
  const tauxService = demande > 0 ? servies / demande : 1;
  const defauts = moy((x) => x.indicateurs.tauxDefauts);
  const operations =
    60 * borner((tauxService - 0.7) / 0.28, 0, 1) + 40 * borner(1 - defauts / 0.08, 0, 1);

  // Finance : marge nette, liquidités et recours à la marge de crédit.
  const margeNette = b.ventesCumulees > 0 ? b.beneficeCumule / b.ventesCumulees : -1;
  const moisMarge = a.filter((x) => x.indicateurs.margeCreditUtilisee > 0).length;
  const finance = ent.enFaillite
    ? 0
    : 55 * borner((margeNette + 0.05) / 0.2, 0, 1) +
      25 * borner((fin?.encaisse ?? 0) / 20_000, 0, 1) +
      20 * borner(1 - moisMarge / n, 0, 1);

  // Conformité : démarches faites, amendes et pénalités.
  const applicables = DEMARCHES.filter((dm) => estApplicable(dm.id, secteur));
  const faites = applicables.filter((dm) => ent.demarches[dm.id]).length;
  const amendes =
    a.reduce((s, x) => s + (x.mouvements.amendes ?? 0), 0) / 100 +
    (ent.fiscal.doitSInscrire && !ent.fiscal.inscritTaxes ? 2000 : 0);
  const conformite =
    60 * (applicables.length ? faites / applicables.length : 1) +
    40 * borner(1 - amendes / 5000, 0, 1);

  const r = (x: number) => Math.round(borner(x, 0, 100));
  return [
    { id: 'marketing', note: r(marketing), details: { notoriete, partFinale, note } },
    { id: 'rh', note: r(rh), details: { moral: b.moralMoyen, roulement } },
    { id: 'operations', note: r(operations), details: { tauxService, defauts } },
    { id: 'finance', note: r(finance), details: { margeNette, moisMarge } },
    {
      id: 'conformite',
      note: r(conformite),
      details: { faites, applicables: applicables.length, amendes },
    },
  ];
}

export interface LigneComparaison {
  id: string;
  nom: string;
  type: 'joueur' | 'equipe' | 'concurrent';
  /** Part de marché moyenne des 3 derniers mois. */
  part: number;
  note: number;
  notoriete: number;
  statut: 'actif' | 'faillite' | 'vendue' | 'rachete';
}

/** Comparaison finale avec les autres équipes et les concurrents. */
export function comparaisonMarche(etat: EtatPartie, ent: Entreprise): LigneComparaison[] {
  const lignes: LigneComparaison[] = etat.entreprises.map((e) => {
    const derniers = e.archives.slice(-3);
    return {
      id: e.id,
      nom: e.equipe ? `${e.nom} (${e.equipe})` : e.nom,
      type: e.id === ent.id ? 'joueur' : 'equipe',
      part: moyenne(derniers.map((x) => x.indicateurs.partMarche)),
      note: e.clientele.note,
      notoriete: e.clientele.notoriete,
      statut: e.enFaillite ? 'faillite' : e.vente ? 'vendue' : 'actif',
    };
  });
  const derniers = ent.archives.slice(-3);
  for (const c of etat.concurrents) {
    if (c.statut === 'aVenir') continue;
    const parts = derniers.map((x) => x.concurrents.find((y) => y.id === c.id)?.part ?? 0);
    lignes.push({
      id: c.id,
      nom: c.nom,
      type: 'concurrent',
      part: moyenne(parts),
      note: c.note,
      notoriete: c.notoriete,
      statut: c.statut === 'faillite' ? 'faillite' : c.statut === 'rachete' ? 'rachete' : 'actif',
    });
  }
  return lignes.sort((x, y) => y.part - x.part);
}

export type Mention = 'excellent' | 'tresBien' | 'bien' | 'passable' | 'aRetravailler';

export function mention(note: number): Mention {
  if (note >= 85) return 'excellent';
  if (note >= 72) return 'tresBien';
  if (note >= 60) return 'bien';
  if (note >= 45) return 'passable';
  return 'aRetravailler';
}

export interface RapportFin {
  bilan: BilanPartie;
  /** Note finale : celle du scénario s'il y en a un, sinon la note de gestion. */
  note: number;
  mention: Mention;
  departements: ScoreDepartement[];
  meilleures: DecisionMarquante[];
  pires: DecisionMarquante[];
  evenements: ChoixEvenement[];
  comparaison: LigneComparaison[];
  scenario: EvaluationScenario | null;
  quiz: { faits: number; bonnes: number; total: number };
}

export function rapportFinPartie(etat: EtatPartie, ent: Entreprise): RapportFin {
  const bilan = bilanPartie(ent);
  const scenario = etat.config.scenarioId
    ? evaluerScenario(ent, scenarioParId(etat.config.scenarioId))
    : null;
  const note = scenario ? scenario.note : bilan.note;
  const quiz = ent.pedagogie?.quiz ?? [];
  return {
    bilan,
    note,
    mention: mention(note),
    departements: scoresDepartements(etat, ent),
    ...meilleuresEtPires(ent),
    evenements: choixEvenements(ent),
    comparaison: comparaisonMarche(etat, ent),
    scenario,
    quiz: {
      faits: quiz.length,
      bonnes: quiz.reduce((s, q) => s + q.bonnes, 0),
      total: quiz.reduce((s, q) => s + q.questions.length, 0),
    },
  };
}
