/**
 * Vendre ou transmettre l'entreprise : évaluation (multiple du BAIIA normalisé, actif net),
 * offres d'un tiers, d'une relève (employé de confiance) ou de la famille, et fiscalité de la vente
 * (gain en capital imposable à 50 %, exemption cumulative de 1 250 000 $ pour les actions d'une
 * société par actions). Simplifications : les conditions de l'exemption (détention de 24 mois,
 * tests d'actif) sont présumées remplies, l'impôt est calculé sur le seul gain, et la réserve de
 * gain en capital n'est modélisée que par un étalement fixe pour la transmission familiale.
 */
import { estSocieteActions } from './conformite';
import { palier } from './croissance';
import { payer } from './ecritures';
import { versementMensuel } from './loans';
import { Rng } from './rng';
import { bilan, cumulerFlux, cumulerMouvements, etatResultats } from './statements';
import { impotPersonnel } from './tax';
import type { Entreprise, EtatPartie } from './types';
import { borner, versCents, versDollars } from './util';

export type RouteVente = 'tiers' | 'releve' | 'famille';

/** Mois de préparation avant qu'une relève puisse acheter l'entreprise. */
export const MOIS_PREPARATION_RELEVE = 12;
/** Honoraires du plan de transmission (comptable et avocat). */
export const FRAIS_PLAN_TRANSMISSION = 2_500;
/** Exemption cumulative des gains en capital (actions admissibles de petite entreprise). */
export const EXEMPTION_GAINS_CAPITAL = 1_250_000; // À VÉRIFIER : seuil en vigueur depuis le 25 juin 2024
export const TAUX_INCLUSION_GAIN = 0.5;
/** Salaire qu'un acheteur doit verser à un gestionnaire (retiré du BAIIA d'une entreprise non incorporée). */
export const SALAIRE_GESTIONNAIRE = 55_000;
/** Taux d'actualisation du solde de prix de vente (risque de non-paiement inclus). */
export const TAUX_ACTUALISATION = 0.1;
export const MOIS_HISTORIQUE_MIN = 6;

export interface ParametresRoute {
  nom: string;
  description: string;
  /** Prix payé par rapport à la valeur de l'entreprise (le tiers varie d'un mois à l'autre). */
  facteurPrix: number;
  partComptant: number;
  moisSolde: number;
  tauxSolde: number;
  fraisFixes: number;
  courtage: number;
  /** Réduction de l'impôt grâce à l'étalement du gain (réserve). */
  etalement: number;
  exigeReleve: boolean;
}

export const ROUTES: Record<RouteVente, ParametresRoute> = {
  tiers: {
    nom: 'Vente à un tiers',
    description:
      'Un acheteur externe (concurrent, investisseur, entrepreneur) paie comptant. Un courtier prend 5 % du prix.',
    facteurPrix: 1,
    partComptant: 1,
    moisSolde: 0,
    tauxSolde: 0,
    fraisFixes: 3_500,
    courtage: 0.05,
    etalement: 0,
    exigeReleve: false,
  },
  releve: {
    nom: 'Relève : un employé de confiance',
    description:
      'Ton employé achète l’entreprise à prix d’ami, avec 25 % comptant et le reste payé sur 5 ans (solde de prix de vente). Il faut l’avoir préparé pendant 12 mois.',
    facteurPrix: 0.88,
    partComptant: 0.25,
    moisSolde: 60,
    tauxSolde: 0.06,
    fraisFixes: 3_500,
    courtage: 0,
    etalement: 0,
    exigeReleve: true,
  },
  famille: {
    nom: 'Succession : un membre de la famille',
    description:
      'Un proche reprend l’entreprise à un prix familial, avec 10 % comptant et le reste sur 10 ans. Le gain peut être étalé : l’impôt est moins lourd. Il faut avoir préparé la relève pendant 12 mois.',
    facteurPrix: 0.75,
    partComptant: 0.1,
    moisSolde: 120,
    tauxSolde: 0.04,
    fraisFixes: 2_000,
    courtage: 0,
    etalement: 0.15,
    exigeReleve: true,
  },
};

const ACHETEURS = [
  'Groupe Lemieux inc.',
  'Investissements Beaulieu',
  'Gestion Roy et fils',
  'Placements du Faubourg',
  'Alliance Dubé ltée',
];

const arrondi = (x: number): number => Math.round(x);

export interface LigneEvaluation {
  libelle: string;
  valeur: number;
  explication: string;
}

export interface EvaluationEntreprise {
  /** Assez d'historique (6 mois) pour évaluer le rendement. */
  suffisant: boolean;
  baiia: number;
  ajustementGestion: number;
  baiiaNormalise: number;
  multiple: number;
  valeurRendement: number;
  encaisse: number;
  dettes: number;
  actifNet: number;
  /** Valeur des actions : valeur de rendement + encaisse − dettes (plancher : 60 % de l'actif net). */
  valeurActions: number;
  lignes: LigneEvaluation[];
}

/** Part des actions détenue par le propriétaire (après les investisseurs ou un associé). */
export function partFondateur(ent: Entreprise): number {
  return (
    ent.finance.actionnaires.find((a) => a.type === 'fondateur')?.part ??
    (ent.associe ? 1 - ent.associe.part : 1)
  );
}

export function evaluerEntreprise(ent: Entreprise): EvaluationEntreprise {
  const n = ent.archives.length;
  const derniers = ent.archives.slice(-12);
  const portion = ent.archives.at(-1)?.portionCouranteDette ?? 0;
  const b = bilan(ent.livre.soldes, portion);
  const encaisse = Math.max(0, ent.livre.soldes.encaisse / 100);
  const dettes = b.totalPassif;
  const actifNet = b.capitaux.total;
  const suffisant = n >= MOIS_HISTORIQUE_MIN;

  const r = etatResultats(cumulerMouvements(derniers.map((a) => a.mouvements)));
  const baiia = suffisant ? (r.baiia * 12) / Math.min(12, n) : 0;
  const ajustementGestion = estSocieteActions(ent.formeJuridique) ? 0 : -SALAIRE_GESTIONNAIRE;
  const baiiaNormalise = suffisant ? baiia + ajustementGestion : 0;

  const base = { petite: 2.5, pme: 3.5, grande: 4.5 }[palier(ent)];
  let croissance = 0;
  if (n >= 12) {
    const recents = ent.archives.slice(-6).reduce((s, a) => s + a.indicateurs.chiffreAffaires, 0);
    const avant = ent.archives
      .slice(-12, -6)
      .reduce((s, a) => s + a.indicateurs.chiffreAffaires, 0);
    croissance = avant > 0 ? (recents - avant) / avant : 0;
  }
  const satisfaction =
    ent.archives.slice(-6).reduce((s, a) => s + a.indicateurs.satisfaction, 0) /
    Math.max(1, Math.min(6, n));
  const ajCroissance = borner(croissance * 4, -0.5, 0.5);
  const ajClients = borner((satisfaction - 0.7) * 2, -0.4, 0.4);
  const multiple = borner(base + ajCroissance + ajClients, 1.5, 5.5);
  const valeurRendement = suffisant ? Math.max(0, multiple * baiiaNormalise) : 0;

  const parRendement = suffisant ? Math.max(0, valeurRendement + encaisse - dettes) : 0;
  const valeurActions = arrondi(Math.max(parRendement, 0.6 * Math.max(0, actifNet)));

  const lignes: LigneEvaluation[] = [
    {
      libelle: 'BAIIA des 12 derniers mois (annualisé)',
      valeur: arrondi(baiia),
      explication:
        'Bénéfice avant intérêts, impôts et amortissement : ce que l’entreprise rapporte.',
    },
    {
      libelle: 'Ajustement pour le salaire d’un gestionnaire',
      valeur: ajustementGestion,
      explication:
        ajustementGestion === 0
          ? 'Ta société te verse déjà un salaire (une charge) : aucun ajustement.'
          : 'Un acheteur doit payer quelqu’un pour te remplacer : tes prélèvements ne sont pas une charge, il faut la retrancher.',
    },
    {
      libelle: 'BAIIA normalisé',
      valeur: arrondi(baiiaNormalise),
      explication: 'Le rendement qu’un acheteur peut vraiment espérer.',
    },
    {
      libelle: `Multiple appliqué (${multiple.toFixed(1).replace('.', ',')} ×)`,
      valeur: arrondi(valeurRendement),
      explication: `Selon la taille (palier), la croissance récente et la satisfaction des clients. C’est la valeur d’entreprise.`,
    },
    {
      libelle: 'Plus : encaisse',
      valeur: arrondi(encaisse),
      explication: 'L’argent en caisse revient aux vendeurs.',
    },
    {
      libelle: 'Moins : dettes',
      valeur: -arrondi(dettes),
      explication: 'Fournisseurs, taxes, emprunts : l’acheteur les déduit du prix.',
    },
    {
      libelle: 'Valeur des actions',
      valeur: valeurActions,
      explication:
        'Le prix de référence. Jamais en dessous de 60 % de l’actif net (valeur de liquidation).',
    },
  ];
  return {
    suffisant,
    baiia: arrondi(baiia),
    ajustementGestion,
    baiiaNormalise: arrondi(baiiaNormalise),
    multiple,
    valeurRendement: arrondi(valeurRendement),
    encaisse: arrondi(encaisse),
    dettes: arrondi(dettes),
    actifNet: arrondi(actifNet),
    valeurActions,
    lignes,
  };
}

export interface OffreVente {
  route: RouteVente | 'forcee';
  acheteur: string;
  disponible: boolean;
  raison: string;
  valeurActions: number;
  /** Prix de toute l'entreprise (avant la part des investisseurs). */
  prixEntreprise: number;
  /** Part du prix qui te revient (selon ta part des actions). */
  prixProprietaire: number;
  comptant: number;
  solde: number;
  moisSolde: number;
  tauxSolde: number;
  versementMensuel: number;
  valeurActuelleSolde: number;
  frais: number;
  baseCout: number;
  gain: number;
  exemption: number;
  gainImposable: number;
  impot: number;
  net: number;
}

function apportsDuProprietaire(ent: Entreprise): number {
  const flux = cumulerFlux(ent.archives.map((a) => a.flux));
  return Math.max(0, versDollars(flux.apportsProprietaire ?? 0)) * partFondateur(ent);
}

/** Cœur du calcul : prix, frais, fiscalité et ce que le propriétaire garde. */
function calculerOffre(
  ent: Entreprise,
  ev: EvaluationEntreprise,
  r: ParametresRoute,
  facteur: number,
): Omit<OffreVente, 'route' | 'acheteur' | 'disponible' | 'raison'> {
  const part = partFondateur(ent);
  const prixEntreprise = arrondi(ev.valeurActions * facteur * r.facteurPrix);
  const prixProprietaire = arrondi(prixEntreprise * part);
  const comptant = arrondi(prixProprietaire * r.partComptant);
  const solde = prixProprietaire - comptant;
  let versement = 0;
  let valeurActuelleSolde = 0;
  if (solde > 0 && r.moisSolde > 0) {
    versement = versementMensuel(versCents(solde), r.tauxSolde, r.moisSolde) / 100;
    const i = TAUX_ACTUALISATION / 12;
    valeurActuelleSolde = arrondi((versement * (1 - Math.pow(1 + i, -r.moisSolde))) / i);
  }
  const frais = prixProprietaire > 0 ? arrondi(prixProprietaire * r.courtage + r.fraisFixes) : 0;
  const baseCout = arrondi(apportsDuProprietaire(ent));
  const gain = Math.max(0, prixProprietaire - frais - baseCout);
  const exemption = estSocieteActions(ent.formeJuridique)
    ? Math.min(gain, EXEMPTION_GAINS_CAPITAL)
    : 0;
  const gainImposable = arrondi((gain - exemption) * TAUX_INCLUSION_GAIN);
  const impot = arrondi(impotPersonnel({ emploi: gainImposable }).total * (1 - r.etalement));
  const net = Math.max(0, comptant + valeurActuelleSolde - frais - impot);
  return {
    valeurActions: ev.valeurActions,
    prixEntreprise,
    prixProprietaire,
    comptant,
    solde,
    moisSolde: r.moisSolde,
    tauxSolde: r.tauxSolde,
    versementMensuel: arrondi(versement * 100) / 100,
    valeurActuelleSolde,
    frais,
    baseCout,
    gain: arrondi(gain),
    exemption: arrondi(exemption),
    gainImposable,
    impot,
    net: arrondi(net),
  };
}

const indexOffre = (etat: EtatPartie): number =>
  Math.min(etat.moisCourant, etat.config.dureeMois - 1);

/** Offre d'achat pour une voie donnée (reproductible : même mois, même offre). */
export function offreVente(etat: EtatPartie, ent: Entreprise, route: RouteVente): OffreVente {
  const ev = evaluerEntreprise(ent);
  const r = ROUTES[route];
  const rng = new Rng((etat.config.graine ^ (indexOffre(etat) * 40503 + 12345)) >>> 0);
  const facteur = route === 'tiers' ? 0.9 + 0.3 * rng.next() : 1;
  const acheteur =
    route === 'tiers'
      ? ACHETEURS[rng.int(0, ACHETEURS.length - 1)]
      : (ent.releve?.nom ?? 'Ta relève');
  let disponible = true;
  let raison = '';
  if (!ev.suffisant) {
    disponible = false;
    raison = `Il faut au moins ${MOIS_HISTORIQUE_MIN} mois d’historique pour qu’un acheteur te fasse une offre.`;
  } else if (ev.valeurActions <= 0) {
    disponible = false;
    raison = 'Personne ne veut acheter une entreprise sans valeur.';
  } else if (r.exigeReleve) {
    const rel = ent.releve;
    const attendu = route === 'releve' ? 'employe' : 'famille';
    if (!rel || rel.type !== attendu) {
      disponible = false;
      raison =
        route === 'releve'
          ? 'Désigne d’abord un employé comme relève.'
          : 'Désigne d’abord un membre de ta famille comme relève.';
    } else if (rel.employeId && !ent.employes.some((x) => x.id === rel.employeId)) {
      disponible = false;
      raison = 'Ton employé de relève a quitté l’entreprise.';
    } else {
      const restant = rel.debut + MOIS_PREPARATION_RELEVE - indexOffre(etat);
      if (restant > 0) {
        disponible = false;
        raison = `Ta relève sera prête dans ${restant} mois.`;
      }
    }
  }
  return {
    route,
    acheteur,
    disponible,
    raison,
    ...calculerOffre(ent, ev, r, facteur),
  };
}

/** Désigne une relève (employé de confiance ou membre de la famille) et paie le plan de transmission. */
export function preparerReleve(
  etat: EtatPartie,
  entrepriseId: string,
  choix: { type: 'employe'; employeId: string } | { type: 'famille'; prenom: string },
): EtatPartie {
  const e = structuredClone(etat);
  const ent = e.entreprises.find((x) => x.id === entrepriseId);
  if (!ent || ent.vente || ent.enFaillite || ent.releve) return etat;
  const index = indexOffre(e);
  if (choix.type === 'employe') {
    const emp = ent.employes.find((x) => x.id === choix.employeId);
    if (!emp) return etat;
    ent.releve = {
      type: 'employe',
      nom: `${emp.prenom} ${emp.nom}`,
      employeId: emp.id,
      debut: index,
    };
  } else {
    const famille = ent.proprietaire.trim().split(/\s+/).at(-1) ?? '';
    ent.releve = { type: 'famille', nom: `${choix.prenom} ${famille}`.trim(), debut: index };
  }
  payer(
    ent.livre,
    ent,
    'Plan de transmission (comptable et avocat)',
    'honoraires',
    FRAIS_PLAN_TRANSMISSION,
    true,
    'loyerEtFrais',
  );
  return e;
}

/** Abandonne la préparation de la relève (les honoraires déjà payés sont perdus). */
export function annulerReleve(etat: EtatPartie, entrepriseId: string): EtatPartie {
  const e = structuredClone(etat);
  const ent = e.entreprises.find((x) => x.id === entrepriseId);
  if (!ent?.releve) return etat;
  delete ent.releve;
  return e;
}

/** Conclut la vente : l'entreprise est vendue et la partie se termine pour ce joueur. */
export function vendreEntreprise(
  etat: EtatPartie,
  entrepriseId: string,
  route: RouteVente,
): EtatPartie {
  const e = structuredClone(etat);
  const ent = e.entreprises.find((x) => x.id === entrepriseId);
  if (!ent || ent.vente || ent.enFaillite || e.terminee) return etat;
  const o = offreVente(e, ent, route);
  if (!o.disponible) return etat;
  ent.vente = {
    prix: o.prixEntreprise,
    index: indexOffre(e),
    acheteur: o.acheteur,
    route,
    net: o.net,
    impot: o.impot,
    frais: o.frais,
    comptant: o.comptant,
    solde: o.solde,
  };
  if (e.entreprises.every((x) => x.enFaillite || x.vente)) {
    e.terminee = true;
    e.raisonFin = 'vente';
  }
  return e;
}

/** Vente forcée par le conseil d'administration (clause d'entraînement des investisseurs). */
export function venteForcee(ent: Entreprise, index: number): NonNullable<Entreprise['vente']> {
  const ev = evaluerEntreprise(ent);
  const o = calculerOffre(ent, ev, ROUTES.tiers, 0.85);
  return {
    prix: o.prixEntreprise,
    index,
    acheteur: 'Un acheteur trouvé par le conseil d’administration',
    route: 'forcee',
    net: o.net,
    impot: o.impot,
    frais: o.frais,
    comptant: o.comptant,
    solde: o.solde,
  };
}
