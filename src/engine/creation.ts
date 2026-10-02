/**
 * Création de la partie : coûts de démarrage, validation du financement, décisions par
 * défaut et état initial de l'entreprise (équipe, stocks, immobilisations, prêts).
 */
import { SALAIRE_MINIMUM } from '../data/fiscalite';
import {
  PARAMETRES_MARKETING,
  PERSONNALITES,
  fournisseurParId,
  personnaliteParId,
  posteParId,
  secteurParId,
  sourceFinancementParId,
  villeParId,
} from '../data';
import { ajouterAcquisition } from './annuel';
import { creerGrandLivre, ecritureSimple, type TypeCapitaux } from './accounting';
import { calibrerConcurrents, creerConcurrent } from './ai-competitors';
import {
  IDS_DEMARCHES,
  coutDemarche,
  demarche,
  estApplicable,
  estSocieteActions,
  estSocietePersonnes,
  immatriculationObligatoire,
} from './conformite';
import type {
  Amenagement,
  Emplacement,
  Equipement,
  IdSourceFinancement,
  LigneProduit,
  NiveauQualite,
  Secteur,
  Ville,
} from './data-types';
import { conjonctureInitiale, type Conjoncture } from './economy';
import { appliquerScenario, scenarioParId } from './scenarios';
import { competencesInitiales } from './competences';
import { COMPTES_IMMOBILISATIONS } from './immobilisations';
import { saisonLigne, type Offre } from './market';
import { payer } from './ecritures';
import {
  IDS_SOURCES,
  apportReconnu,
  evaluerPlan,
  partAnge,
  pretBancaireMax,
  tauxSource,
  totalSources,
  validerSources,
  type ErreurSource,
  type EvaluationPlan,
} from './financement';
import { genererEmploye, salaireMarchePoste } from './hr';
import { coutChezFournisseur, politiqueRecommandee, stockInitial } from './inventory';
import { creerPret } from './loans';
import { etatMarketingInitial, publiciteParDefaut, segmentsMarche } from './marketing';
import { Rng } from './rng';
import { taxesSur } from './tax';
import type {
  ConfigPartie,
  Decisions,
  Difficulte,
  Entreprise,
  EtatFiscal,
  EtatPartie,
  FormeJuridique,
  IdDemarche,
  MethodeInventaire,
  ParametresDemarrage,
  PolitiqueAppro,
} from './types';
import { VERSION_ETAT } from './types';
import { borner, versCents, versDollars } from './util';

// ---------------------------------------------------------------------------
// Règles du jeu
// ---------------------------------------------------------------------------

export const DIFFICULTES: Record<
  Difficulte,
  {
    marche: number;
    notorieteDepart: number;
    agressivite: number;
    limiteMarge: number;
    /** Probabilité mensuelle d'un événement (ou dilemme). */
    evenements: number;
    /** Poids des événements selon leur nature (moins d'événements négatifs en mode Facile). */
    poidsNature: { negatif: number; positif: number; neutre: number };
    /** Poids des vérifications fiscales (plus fréquentes en mode Expert). */
    poidsFiscal: number;
    /** Multiplicateur du risque de ralentissement et de récession. */
    risqueRecession: number;
  }
> = {
  facile: {
    marche: 1.1,
    notorieteDepart: 0.2,
    agressivite: 0.6,
    limiteMarge: 25_000,
    evenements: 0.35,
    poidsNature: { negatif: 0.5, positif: 1.4, neutre: 1 },
    poidsFiscal: 0.5,
    risqueRecession: 0.6,
  },
  realiste: {
    marche: 1.0,
    notorieteDepart: 0.15,
    agressivite: 1.0,
    limiteMarge: 20_000,
    evenements: 0.45,
    poidsNature: { negatif: 1, positif: 1, neutre: 1 },
    poidsFiscal: 1,
    risqueRecession: 1,
  },
  expert: {
    marche: 0.9,
    notorieteDepart: 0.1,
    agressivite: 1.4,
    limiteMarge: 15_000,
    evenements: 0.55,
    poidsNature: { negatif: 1.4, positif: 0.8, neutre: 1 },
    poidsFiscal: 2.5,
    risqueRecession: 1.5,
  },
};

export const REGLES_FINANCEMENT = {
  /** Prêt bancaire : taux préférentiel + 2,5 % (fixe) ou + 2 % (variable), sur 5 ans. */
  ecartTauxPret: 0.025,
  dureePretMois: 60,
  /** La banque prête au plus 3 $ pour chaque dollar investi par les propriétaires. */
  multipleApportMax: 3,
  pretMax: 150_000,
  apportMin: 5_000,
  /** Marge de crédit : taux préférentiel + 3 %. */
  ecartTauxMarge: 0.03,
  /** Dépôt de garantie exigé par le propriétaire de l'immeuble (en mois de loyer). */
  moisDepotGarantie: 2,
  /** Encaisse minimale gardée avant de rembourser la marge de crédit. */
  coussinEncaisse: 5_000,
  /** Fonds de roulement minimal exigé à l'ouverture. */
  fondsRoulementMin: 3_000,
} as const;

export const BORNES_DECISIONS = {
  publiciteCanal: { min: 0, max: 15_000 },
  heuresOuverture: { min: 20, max: 112 },
  heuresProprietaire: { min: 0, max: 80 },
  salaireHoraire: { max: 60 },
  prelevements: { min: 0, max: 15_000 },
  salaireDirigeant: { min: 0, max: 20_000 },
  heuresEmploye: { min: 8, max: 45 },
  prixRatio: { min: 0.4, max: 3 },
  promotion: { min: 0, max: 0.3 },
} as const;

/** Bail commercial de 5 ans, indexé de 2,5 % par année. */
export const DUREE_BAIL_MOIS = 60;
const INDEXATION_BAIL = 0.025;
/** Part du potentiel du marché qu'un nouveau commerce sert le premier mois (premières commandes). */
const PART_VISITES_ESTIMEES = 0.07;

/** Visites estimées pendant le premier mois (pour les premières commandes). */
export function visitesEstimees(secteur: Secteur, ville?: Ville): number {
  const potentiel = ville?.marchePotentielMensuel[secteur.id];
  return potentiel ? Math.round(potentiel * PART_VISITES_ESTIMEES) : 1500;
}

/** L'emplacement est-il permis pour ce secteur (ex. un commerce en ligne n'a pas de vitrine)? */
export function emplacementPermis(secteur: Secteur, emplacementId: string): boolean {
  return secteur.emplacements.includes(emplacementId);
}

// ---------------------------------------------------------------------------
// Outils
// ---------------------------------------------------------------------------

export function dateDuMois(config: ConfigPartie, index: number): { annee: number; mois: number } {
  return { annee: config.anneeDepart + Math.floor(index / 12), mois: (index % 12) + 1 };
}

export function parId<T extends { id: string }>(liste: readonly T[], id: string): T {
  const x = liste.find((e) => e.id === id);
  if (!x) throw new Error(`Élément introuvable : ${id}`);
  return x;
}

export function emplacementDe(ville: Ville, id: string): Emplacement {
  return parId(ville.emplacements, id);
}
export function equipementDe(secteur: Secteur, id: string): Equipement {
  return parId(secteur.equipements, id);
}
export function amenagementDe(secteur: Secteur, id: string): Amenagement {
  return parId(secteur.amenagements, id);
}
export function qualiteDe(secteur: Secteur, id: string): NiveauQualite {
  return parId(secteur.qualites, id);
}

export function loyerMensuelInitial(secteur: Secteur, emplacement: Emplacement): number {
  return Math.round(
    (secteur.superficiePi2 * (emplacement.loyerNetPi2 + emplacement.fraisCommunsPi2)) / 12,
  );
}

export function typeCapitaux(forme: FormeJuridique): TypeCapitaux {
  if (estSocieteActions(forme)) return 'actions';
  if (estSocietePersonnes(forme)) return 'associes';
  return 'proprietaire';
}

export interface CoutsDemarrage {
  equipement: number;
  amenagement: number;
  depotGarantie: number;
  stockInitial: number;
  fraisDemarrage: number;
  /** Immatriculation ou constitution et autres démarches choisies (permis, francisation…). */
  fraisJuridiques: number;
  /** TPS et TVQ payées sur les achats de démarrage (récupérables si l'entreprise est inscrite). */
  taxes: number;
  total: number;
}

type ParamsCouts = Pick<ParametresDemarrage, 'emplacementId' | 'equipementId' | 'amenagementId'> &
  Partial<Pick<ParametresDemarrage, 'formeJuridique' | 'demarches'>>;

export function coutsDemarrage(
  params: ParamsCouts,
  secteur: Secteur,
  ville: Ville,
): CoutsDemarrage {
  const forme = params.formeJuridique ?? 'individuelle';
  const demarches = new Set((params.demarches ?? []).filter((id) => estApplicable(id, secteur)));
  if (immatriculationObligatoire(forme)) demarches.add('req');
  const equipement = equipementDe(secteur, params.equipementId).cout;
  const amenagement = amenagementDe(secteur, params.amenagementId).cout;
  const depotGarantie =
    loyerMensuelInitial(secteur, emplacementDe(ville, params.emplacementId)) *
    REGLES_FINANCEMENT.moisDepotGarantie;
  const stock = secteur.stockInitial;
  const fraisDemarrage = secteur.fraisDemarrage;
  const fraisJuridiques = [...demarches].reduce((a, id) => a + coutDemarche(id, forme), 0);
  const taxable = equipement + amenagement + fraisDemarrage + stock * secteur.partAchatsTaxables;
  const taxes = taxesSur(taxable).total;
  return {
    equipement,
    amenagement,
    depotGarantie,
    stockInitial: stock,
    fraisDemarrage,
    fraisJuridiques,
    taxes,
    total:
      Math.round(
        (equipement +
          amenagement +
          depotGarantie +
          stock +
          fraisDemarrage +
          fraisJuridiques +
          taxes) *
          100,
      ) / 100,
  };
}

/** Prêt bancaire maximal pour une mise de fonds (3 fois l'apport, plafonné). */
export function pretMaximum(apport: number): number {
  return pretBancaireMax(apport);
}

/** Mise de fonds totale des propriétaires (incluant l'associé d'une société de personnes). */
export function apportTotal(
  params: Pick<ParametresDemarrage, 'apportPersonnel' | 'apportAssocie' | 'formeJuridique'>,
): number {
  return (
    params.apportPersonnel +
    (estSocietePersonnes(params.formeJuridique) ? Math.max(0, params.apportAssocie) : 0)
  );
}

/** Charges fixes mensuelles estimées (loyer, frais fixes, salaires de l'équipe de départ). */
export function chargesFixesEstimees(params: ParamsCouts, secteur: Secteur, ville: Ville): number {
  const loyer = loyerMensuelInitial(secteur, emplacementDe(ville, params.emplacementId));
  const frais = Object.values(secteur.fraisFixesMensuels).reduce((a, x) => a + x, 0);
  const salaires = secteur.equipeDepart.reduce((a, eq) => {
    const poste = posteParId(eq.posteId);
    return a + eq.nombre * poste.heuresSemaineDefaut * poste.salaireMedian * (52 / 12) * 1.15;
  }, 0);
  return Math.round(loyer + frais + salaires + 2500);
}

/** Subvention non remboursable obtenue au démarrage ($). */
export function subventionDemarrage(params: ParametresDemarrage): number {
  return (params.financements.creavenir ?? 0) > 0
    ? (sourceFinancementParId('creavenir').subvention ?? 0)
    : 0;
}

/** Total des fonds obtenus : apports, prêts, investisseur et subvention. */
export function financementTotal(params: ParametresDemarrage): number {
  return (
    apportTotal(params) + params.montantPret + totalSources(params) + subventionDemarrage(params)
  );
}

export function evaluationPlanDemarrage(
  params: ParametresDemarrage,
  secteur: Secteur,
  ville: Ville,
): EvaluationPlan | null {
  if (!params.planAffaires) return null;
  const couts = coutsDemarrage(params, secteur, ville);
  return evaluerPlan(params.planAffaires, {
    secteur,
    ville,
    emplacement: emplacementDe(ville, params.emplacementId),
    apports: apportTotal(params),
    coutProjet: couts.total,
    chargesFixesMensuelles: chargesFixesEstimees(params, secteur, ville),
  });
}

export type ErreurDemarrage =
  | 'nomVide'
  | 'apportInsuffisant'
  | 'pretTropEleve'
  | 'financementInsuffisant'
  | 'associeRequis'
  | 'sourceInvalide'
  | 'emplacementInvalide';

export function erreursSources(
  params: ParametresDemarrage,
  secteur: Secteur,
  ville: Ville,
): ErreurSource[] {
  const couts = coutsDemarrage(params, secteur, ville);
  const evaluation = evaluationPlanDemarrage(params, secteur, ville);
  return validerSources(params, {
    apports: apportTotal(params),
    coutProjet: couts.total,
    scorePlan: evaluation?.score ?? null,
  });
}

export function validerDemarrage(
  params: ParametresDemarrage,
  secteur: Secteur,
  ville: Ville,
): ErreurDemarrage[] {
  const erreurs: ErreurDemarrage[] = [];
  if (params.nomEntreprise.trim().length === 0) erreurs.push('nomVide');
  if (!emplacementPermis(secteur, params.emplacementId)) {
    erreurs.push('emplacementInvalide');
    return erreurs;
  }
  if (params.apportPersonnel < REGLES_FINANCEMENT.apportMin) erreurs.push('apportInsuffisant');
  if (estSocietePersonnes(params.formeJuridique) && params.apportAssocie <= 0)
    erreurs.push('associeRequis');
  const apports = apportTotal(params);
  if (params.montantPret > pretBancaireMax(apportReconnu(params, apports)))
    erreurs.push('pretTropEleve');
  if (erreursSources(params, secteur, ville).length > 0) erreurs.push('sourceInvalide');
  const couts = coutsDemarrage(params, secteur, ville);
  if (financementTotal(params) < couts.total + REGLES_FINANCEMENT.fondsRoulementMin) {
    erreurs.push('financementInsuffisant');
  }
  return erreurs;
}

/** Coût unitaire d'une ligne avec la qualité standard et le fournisseur choisi. */
function coutLigne(ligne: LigneProduit, fournisseurId: string, conj: Conjoncture): number {
  return coutChezFournisseur(
    ligne.coutUnitaire * conj.indiceCouts,
    fournisseurParId(fournisseurId),
    conj.tauxChange,
  );
}

/** Politique d'approvisionnement par défaut d'une ligne (calcul automatique). */
export function politiqueParDefaut(
  ligne: LigneProduit,
  fournisseurId: string,
  demandeMois: number,
  conj: Conjoncture,
): PolitiqueAppro {
  const f = fournisseurParId(fournisseurId);
  const calcul = politiqueRecommandee(
    demandeMois,
    coutLigne(ligne, fournisseurId, conj),
    f,
    f.conservationJours ?? ligne.conservationJours,
  );
  return {
    fournisseurId,
    auto: true,
    pointCommande: calcul.pointCommande,
    quantite: calcul.quantite,
  };
}

export function decisionsParDefaut(
  secteur: Secteur,
  _salaireMinimum = 0,
  forme: FormeJuridique = 'individuelle',
  methode: MethodeInventaire = 'coutMoyen',
  ville?: Ville,
): Decisions {
  const visites = visitesEstimees(secteur, ville);
  const prix: Record<string, number> = {};
  for (const ligne of secteur.lignes) prix[ligne.id] = ligne.prixReference;
  const societe = estSocieteActions(forme);
  const conj = conjonctureInitiale();
  const approvisionnement: Record<string, PolitiqueAppro> = {};
  for (const ligne of secteur.lignes) {
    approvisionnement[ligne.id] = politiqueParDefaut(
      ligne,
      secteur.fournisseursDefaut[ligne.categorieAppro],
      visites * ligne.tauxAchat * saisonLigne(ligne, 1),
      conj,
    );
  }
  return {
    prix,
    qualiteId: 'standard',
    publicite: publiciteParDefaut(secteur),
    promotion: 0,
    programmeFidelite: false,
    initiativesEco: [],
    panierBleu: false,
    livraison: false,
    reponseAvis: 'ignorer',
    satisfactionGarantie: false,
    heuresOuverture: secteur.heuresOuvertureReference,
    heuresProprietaire: 50,
    avantages: [],
    approvisionnement,
    prendreEscomptes: false,
    methodeInventaire: methode,
    prelevements: societe ? 0 : 2_000,
    remboursementAutoMarge: true,
    apportPonctuel: 0,
    remboursementAnticipe: 0,
    salaireDirigeant: societe ? 2_500 : 0,
    dividendePonctuel: 0,
    prevision: null,
  };
}

/**
 * Borne les décisions dans des limites réalistes (protège le moteur des valeurs absurdes).
 * @param lignes lignes vendues par l'entreprise (par défaut : celles du secteur)
 */
export function validerDecisions(
  d: Decisions,
  secteur: Secteur,
  forme: FormeJuridique = 'individuelle',
  lignes: readonly LigneProduit[] = secteur.lignes,
): Decisions {
  const b = BORNES_DECISIONS;
  const prix: Record<string, number> = {};
  for (const ligne of lignes) {
    const p = d.prix[ligne.id];
    const valeur = Number.isFinite(p) ? p : ligne.prixReference;
    prix[ligne.id] =
      Math.round(
        borner(
          valeur,
          ligne.prixReference * b.prixRatio.min,
          ligne.prixReference * b.prixRatio.max * 1.5,
        ) * 100,
      ) / 100;
  }
  const fini = (x: number | undefined, defaut: number) =>
    x !== undefined && Number.isFinite(x) ? x : defaut;
  const societe = estSocieteActions(forme);
  const publicite: Record<string, number> = {};
  for (const [canal, montant] of Object.entries(d.publicite ?? {})) {
    const m = Math.round(borner(fini(montant, 0), b.publiciteCanal.min, b.publiciteCanal.max));
    if (m > 0) publicite[canal] = m;
  }
  const approvisionnement: Record<string, PolitiqueAppro> = {};
  for (const [id, p] of Object.entries(d.approvisionnement ?? {})) {
    approvisionnement[id] = {
      fournisseurId: p.fournisseurId,
      auto: p.auto,
      pointCommande: Math.round(borner(fini(p.pointCommande, 0), 0, 100_000)),
      quantite: Math.round(borner(fini(p.quantite, 1), 1, 100_000)),
    };
  }
  const prevision =
    d.prevision && Number.isFinite(d.prevision.ventes) && Number.isFinite(d.prevision.benefice)
      ? {
          ventes: Math.round(borner(d.prevision.ventes, 0, 10_000_000)),
          benefice: Math.round(borner(d.prevision.benefice, -10_000_000, 10_000_000)),
        }
      : null;
  return {
    prix,
    qualiteId: secteur.qualites.some((q) => q.id === d.qualiteId) ? d.qualiteId : 'standard',
    publicite,
    promotion:
      Math.round(borner(fini(d.promotion, 0), b.promotion.min, b.promotion.max) * 100) / 100,
    programmeFidelite: Boolean(d.programmeFidelite),
    initiativesEco: [...new Set(d.initiativesEco ?? [])].filter((id) =>
      secteur.initiativesEco.includes(id),
    ),
    panierBleu: Boolean(d.panierBleu),
    livraison: Boolean(d.livraison) && secteur.partLivraison > 0,
    reponseAvis: ['ignorer', 'repondre', 'compenser'].includes(d.reponseAvis)
      ? d.reponseAvis
      : 'ignorer',
    satisfactionGarantie: Boolean(d.satisfactionGarantie),
    heuresOuverture: Math.round(
      borner(fini(d.heuresOuverture, 60), b.heuresOuverture.min, b.heuresOuverture.max),
    ),
    heuresProprietaire: Math.round(
      borner(fini(d.heuresProprietaire, 40), b.heuresProprietaire.min, b.heuresProprietaire.max),
    ),
    avantages: [...new Set(d.avantages ?? [])],
    approvisionnement,
    prendreEscomptes: Boolean(d.prendreEscomptes),
    methodeInventaire: d.methodeInventaire === 'peps' ? 'peps' : 'coutMoyen',
    // Une société par actions ne fait pas de prélèvements : elle verse un salaire ou des dividendes.
    prelevements: societe
      ? 0
      : Math.round(borner(fini(d.prelevements, 0), b.prelevements.min, b.prelevements.max)),
    remboursementAutoMarge: d.remboursementAutoMarge,
    apportPonctuel: Math.round(borner(fini(d.apportPonctuel, 0), 0, 200_000)),
    remboursementAnticipe: Math.round(borner(fini(d.remboursementAnticipe, 0), 0, 1_000_000)),
    salaireDirigeant: societe
      ? Math.round(
          borner(fini(d.salaireDirigeant, 0), b.salaireDirigeant.min, b.salaireDirigeant.max),
        )
      : 0,
    dividendePonctuel: societe ? Math.round(borner(fini(d.dividendePonctuel, 0), 0, 500_000)) : 0,
    prevision,
  };
}

function etatFiscalInitial(inscritTaxes: boolean): EtatFiscal {
  return {
    inscritTaxes,
    frequenceTaxes: 'trimestrielle',
    ventesTaxablesMois: [],
    doitSInscrire: false,
    ventesNonTaxees: 0,
    fnacc: {},
    ajoutsAnnee: {},
    coutAmeliorations: 0,
    pertesReportees: 0,
    acompteMensuel: 0,
    acomptesVersesAnnee: 0,
    soldeImpotAPayer: 0,
    heuresRemunereesAnnee: 0,
    paieAnnee: {},
    taxesAnnee: { tpsPercue: 0, tvqPercue: 0, cti: 0, rti: 0 },
    declarations: [],
    majAnnuelles: [],
    incorporationPrevue: null,
  };
}

const NOMS_PRETS: Record<IdSourceFinancement, string> = {
  loveMoney: 'Prêt de la famille (love money)',
  futurpreneur: 'Prêt Futurpreneur et BDC',
  bdc: 'Prêt de démarrage BDC',
  fondsLocal: 'Prêt des fonds locaux (FLI et FLS)',
  creavenir: 'Financement Créavenir (Desjardins)',
  ange: 'Investisseur providentiel',
};

// ---------------------------------------------------------------------------
// Création de la partie
// ---------------------------------------------------------------------------

/** Nombre maximal d'équipes sur le même marché (mode équipes en alternance). */
export const MAX_EQUIPES = 4;

/**
 * Taille du marché selon le nombre d'équipes. Chaque commerce ajouté attire déjà ses propres
 * clients (option « ne rien acheter » du modèle de marché) : le marché grandit donc peu
 * (n^0,18, calibré par simulation) pour que le profit par équipe baisse quand les équipes
 * sont plus nombreuses, sans faillites en série. Voir DECISIONS.md.
 */
export function facteurMarcheEquipes(nombre: number): number {
  return Math.pow(Math.max(1, nombre), 0.18);
}

/**
 * Crée la partie : une entreprise par équipe (une seule en solo), toutes sur le même
 * marché, face aux 5 concurrents.
 */
export function creerPartie(
  config: ConfigPartie,
  parametres: ParametresDemarrage | ParametresDemarrage[],
): EtatPartie {
  const liste = Array.isArray(parametres) ? parametres : [parametres];
  if (liste.length < 1 || liste.length > MAX_EQUIPES)
    throw new Error(`Nombre d’équipes invalide : ${liste.length}`);
  const secteur = secteurParId(config.secteurId);
  const ville = villeParId(config.villeId);
  const rng = new Rng(config.graine);
  const diff = DIFFICULTES[config.difficulte];
  const conjoncture = conjonctureInitiale();
  const salaireMinimum = SALAIRE_MINIMUM.general;
  const contexte = { secteur, ville, rng, diff, conjoncture, salaireMinimum };
  const entreprises = liste.map((params, i) => {
    const ent = creerEntreprise(params, `joueur-${i + 1}`, contexte);
    if (liste.length > 1) ent.equipe = params.nomEquipe?.trim() || `Équipe ${i + 1}`;
    return ent;
  });
  const nombre = liste.length;

  const saisonMoyenne = secteur.saisonnalite.reduce((a, x) => a + x, 0) / 12;
  const potentielMoyen =
    (ville.marchePotentielMensuel[secteur.id] ?? 0) *
    saisonMoyenne *
    diff.marche *
    facteurMarcheEquipes(nombre);
  // Cinq concurrents (le Nouveau joueur arrive en cours de partie).
  const concurrents = PERSONNALITES.map((p) =>
    creerConcurrent(p, {
      secteur,
      ville,
      potentiel: potentielMoyen,
      agressivite: diff.agressivite,
      rng,
      dureeMois: config.dureeMois,
    }),
  );
  calibrerConcurrents(
    concurrents,
    personnaliteParId,
    secteur,
    potentielMoyen,
    entreprises.map((e) => ({ ...offreReference(secteur, potentielMoyen), id: e.id })),
    {
      segments: segmentsMarche(secteur),
      livraison: {
        part: secteur.partLivraison,
        majoration: PARAMETRES_MARKETING.livraison.majorationClient,
        panier: secteur.panierLivraison,
      },
    },
  );

  const etat: EtatPartie = {
    version: VERSION_ETAT,
    config,
    moisCourant: 0,
    rngState: rng.state,
    conjoncture,
    salaireMinimum,
    entreprises,
    concurrents,
    terminee: false,
  };
  const scenario = config.scenarioId ? scenarioParId(config.scenarioId) : null;
  if (scenario) appliquerScenario(etat, scenario);
  return etat;
}

interface ContexteEntreprise {
  secteur: Secteur;
  ville: Ville;
  rng: Rng;
  diff: (typeof DIFFICULTES)[Difficulte];
  conjoncture: Conjoncture;
  salaireMinimum: number;
}

/** Crée l'entreprise d'une équipe : employés, stocks, financement et écritures d'ouverture. */
function creerEntreprise(
  params: ParametresDemarrage,
  id: string,
  ctx: ContexteEntreprise,
): Entreprise {
  const { secteur, ville, rng, diff, conjoncture, salaireMinimum } = ctx;
  const erreurs = validerDemarrage(params, secteur, ville);
  if (erreurs.length > 0) throw new Error(`Démarrage invalide : ${erreurs.join(', ')}`);
  const forme = params.formeJuridique;
  const emplacement = emplacementDe(ville, params.emplacementId);
  const equipement = equipementDe(secteur, params.equipementId);
  const amenagement = amenagementDe(secteur, params.amenagementId);
  const couts = coutsDemarrage(params, secteur, ville);
  const societe = estSocieteActions(forme);
  const avecAssocie = estSocietePersonnes(forme);
  let prochainId = 1;
  const nouvelId = (prefixe: string) => `${prefixe}-${prochainId++}`;

  const demarches = {} as Record<IdDemarche, boolean>;
  for (const id of IDS_DEMARCHES)
    demarches[id] = estApplicable(id, secteur) && params.demarches.includes(id);
  if (immatriculationObligatoire(forme)) demarches.req = true;

  const employes = secteur.equipeDepart.flatMap((eq) => {
    const poste = posteParId(eq.posteId);
    const salaire = Math.max(salaireMinimum, salaireMarchePoste(poste, ville.indiceSalaires, 1));
    return Array.from({ length: eq.nombre }, () =>
      genererEmploye(nouvelId('emp'), poste, poste.heuresSemaineDefaut, salaire, rng),
    );
  });
  const qualite = qualiteDe(secteur, 'standard');
  const livre = creerGrandLivre();
  const decisions = decisionsParDefaut(
    secteur,
    salaireMinimum,
    forme,
    params.methodeInventaire,
    ville,
  );
  const visites = visitesEstimees(secteur, ville);
  const typeEquipement = equipement.type ?? 'equipement';
  const typeAmenagement = amenagement.type ?? 'ameliorations';

  // Stock initial : quelques jours de ventes des produits périssables; le reste du budget
  // va aux marchandises qui se conservent le plus longtemps (grains de café, lait UHT…).
  const stocks: Entreprise['operations']['stocks'] = {};
  const besoins = secteur.lignes.map((ligne) => {
    const f = fournisseurParId(decisions.approvisionnement[ligne.id].fournisseurId);
    const cout = coutLigne(ligne, f.id, conjoncture);
    const conservation = f.conservationJours ?? ligne.conservationJours;
    const demande = visites * ligne.tauxAchat * saisonLigne(ligne, 1);
    const jours = Math.max(1, Math.min(conservation - 1, 5));
    return { ligne, cout, conservation, demande, valeur: (demande / 30) * jours * cout };
  });
  const vendues = besoins.filter((b) => b.demande > 0);
  const candidats = vendues.length > 0 ? vendues : besoins;
  const durable = candidats.reduce(
    (a, b) => (b.conservation > a.conservation ? b : a),
    candidats[0],
  );
  let reste = secteur.stockInitial;
  for (const b of besoins) {
    if (b === durable) continue;
    const valeur = Math.min(reste, b.valeur);
    reste -= valeur;
    stocks[b.ligne.id] = stockInitial(valeur, b.cout, b.conservation, b.demande);
  }
  stocks[durable.ligne.id] = stockInitial(
    reste,
    durable.cout,
    durable.conservation,
    durable.demande,
  );

  const entreprise: Entreprise = {
    id,
    nom: params.nomEntreprise.trim(),
    proprietaire: params.nomProprietaire.trim() || 'Propriétaire',
    ageProprietaire: params.ageProprietaire,
    couleur: params.couleur,
    formeJuridique: forme,
    associe: avecAssocie
      ? {
          nom: params.nomAssocie.trim() || 'Associé',
          part: params.apportAssocie / (params.apportPersonnel + params.apportAssocie),
        }
      : null,
    demarches,
    fiscal: etatFiscalInitial(params.inscritTaxes),
    emplacementId: emplacement.id,
    equipementId: equipement.id,
    amenagementId: amenagement.id,
    decisions,
    employes,
    rh: {
      candidats: [],
      affichages: [],
      departs: [],
      moisMoralBas: 0,
      syndicat: { statut: 'aucun', depuis: -1 },
      // Le permis du MAPAQ exige qu'une personne de l'établissement soit formée en hygiène.
      gestionnaireHygiene: demarches.mapaq,
    },
    clientele: {
      notoriete: diff.notorieteDepart,
      qualitePercue: qualite.score + equipement.bonusQualite,
      service: 0.6,
      satisfaction: 0.7,
      note: 4,
      nbAvis: 0,
    },
    marketing: etatMarketingInitial(secteur, diff.notorieteDepart),
    operations: { stocks, tauxDefauts: 0.03 },
    immobilisations: [
      {
        id: nouvelId('immo'),
        nom: equipement.nom,
        type: typeEquipement,
        classeDpa: equipement.classeDpa ?? '8',
        cout: equipement.cout,
        dureeVieMois: equipement.dureeVieMois,
        acquisition: -1,
        amortCumule: 0,
      },
      {
        id: nouvelId('immo'),
        nom: amenagement.nom,
        type: typeAmenagement,
        classeDpa: amenagement.classeDpa ?? '13',
        cout: amenagement.cout,
        dureeVieMois: amenagement.dureeVieMois ?? DUREE_BAIL_MOIS,
        acquisition: -1,
        amortCumule: 0,
      },
    ],
    finance: {
      placements: [],
      actionnaires: societe
        ? [{ nom: params.nomProprietaire.trim() || 'Fondateur', part: 1, type: 'fondateur' }]
        : [],
    },
    b2b: { appels: [], contrats: [], factures: [], resultats: [] },
    dilemmes: [],
    historiqueDilemmes: {},
    risques: [],
    effetsMois: {
      capacite: 1,
      heuresProprietaire: 0,
      primes: 0,
      joursFermeture: 0,
      pertesRecurrentes: [],
      revenusRecurrents: [],
    },
    livre,
    prets: [],
    margeCredit: {
      limite: versCents(diff.limiteMarge),
      ecartTaux: REGLES_FINANCEMENT.ecartTauxMarge,
    },
    bail: {
      loyerMensuel: versCents(loyerMensuelInitial(secteur, emplacement)),
      dureeMois: DUREE_BAIL_MOIS,
      indexation: INDEXATION_BAIL,
    },
    enAttente: { indemnites: 0 },
    archives: [],
    moisEnDefaut: 0,
    enFaillite: false,
    prochainId: 0,
    joursFermeture: 0,
    modificateurs: [],
    vente: null,
    competences: competencesInitiales(params.profil),
    formationsProprietaire: [],
  };

  // Financement : mise de fonds (capital, parts d'associés ou actions).
  ecritureSimple(
    livre,
    societe ? 'Émission d’actions ordinaires au fondateur' : 'Mise de fonds du propriétaire',
    'encaisse',
    societe ? 'capitalActions' : 'capital',
    versCents(params.apportPersonnel),
    'apportsProprietaire',
  );
  if (avecAssocie) {
    ecritureSimple(
      livre,
      'Mise de fonds de l’associé',
      'encaisse',
      'capitalAssocie',
      versCents(params.apportAssocie),
      'apportsProprietaire',
    );
  }

  // Prêt bancaire (taux fixe ou variable).
  if (params.montantPret > 0) {
    const variable = params.typeTauxPret === 'variable';
    const taux = tauxSource('banque', conjoncture, variable);
    const pret = creerPret(
      nouvelId('pret'),
      `Prêt à terme bancaire (taux ${variable ? 'variable' : 'fixe'})`,
      versCents(params.montantPret),
      taux,
      REGLES_FINANCEMENT.dureePretMois,
      {
        preteur: 'Banque',
        type: variable ? 'variable' : 'fixe',
        ecartTaux: variable ? REGLES_FINANCEMENT.ecartTauxPret - 0.005 : 0,
      },
    );
    entreprise.prets.push(pret);
    ecritureSimple(
      livre,
      'Prêt bancaire de démarrage',
      'encaisse',
      'empruntBancaire',
      pret.capitalInitial,
      'empruntsRecus',
    );
  }

  // Autres sources : prêts, subvention et investisseur providentiel.
  for (const id of IDS_SOURCES) {
    const montant = Math.max(0, params.financements[id] ?? 0);
    if (montant <= 0) continue;
    const s = sourceFinancementParId(id);
    if (id === 'ange') {
      const fondateur = entreprise.finance.actionnaires[0];
      const evaluation = evaluationPlanDemarrage(params, secteur, ville);
      const part = partAnge(montant, params.apportPersonnel, evaluation?.score ?? 0);
      fondateur.part = Math.round((1 - part) * 10000) / 10000;
      entreprise.finance.actionnaires.push({
        nom: 'Investisseur providentiel',
        part: Math.round(part * 10000) / 10000,
        type: 'ange',
      });
      ecritureSimple(
        livre,
        'Émission d’actions à un investisseur providentiel',
        'encaisse',
        'capitalActions',
        versCents(montant),
        'apportsProprietaire',
      );
      continue;
    }
    const pret = creerPret(
      nouvelId('pret'),
      NOMS_PRETS[id],
      versCents(montant),
      tauxSource(id, conjoncture),
      s.dureeMois,
      {
        preteur: s.organisme,
        type: s.tauxVariable ? 'variable' : 'fixe',
        ecartTaux: s.ecartTaux ?? 0,
        differeMois: s.differeMois,
      },
    );
    entreprise.prets.push(pret);
    ecritureSimple(
      livre,
      NOMS_PRETS[id],
      'encaisse',
      'empruntBancaire',
      pret.capitalInitial,
      'empruntsRecus',
    );
    if (s.subvention) {
      ecritureSimple(
        livre,
        `Subvention non remboursable – ${s.nom}`,
        'encaisse',
        'subventions',
        versCents(s.subvention),
        'subventionsRecues',
      );
    }
  }

  // Investissements de démarrage (taxes récupérables seulement si l'entreprise est inscrite).
  const compteEquipement = COMPTES_IMMOBILISATIONS[typeEquipement].actif;
  const compteAmenagement = COMPTES_IMMOBILISATIONS[typeAmenagement].actif;
  const avantEquipement = livre.soldes[compteEquipement];
  payer(
    livre,
    entreprise,
    `Achat : ${equipement.nom}`,
    compteEquipement,
    couts.equipement,
    true,
    'acquisitionImmobilisations',
  );
  const coutEquipement = livre.soldes[compteEquipement] - avantEquipement;
  const avantAmenagement = livre.soldes[compteAmenagement];
  payer(
    livre,
    entreprise,
    typeAmenagement === 'informatique'
      ? `Conception : ${amenagement.nom}`
      : `Travaux : ${amenagement.nom}`,
    compteAmenagement,
    couts.amenagement,
    true,
    'acquisitionImmobilisations',
  );
  const coutAmenagement = livre.soldes[compteAmenagement] - avantAmenagement;
  ecritureSimple(
    livre,
    'Dépôt de garantie du bail',
    'depotGarantie',
    'encaisse',
    versCents(couts.depotGarantie),
    'depotGarantie',
  );
  const stockTaxable = couts.stockInitial * secteur.partAchatsTaxables;
  ecritureSimple(
    livre,
    'Stock initial de marchandises (aliments détaxés)',
    'stocks',
    'encaisse',
    versCents(couts.stockInitial - stockTaxable),
    'achatStockInitial',
  );
  payer(
    livre,
    entreprise,
    'Stock initial (emballages et fournitures)',
    'stocks',
    stockTaxable,
    true,
    'achatStockInitial',
  );
  payer(
    livre,
    entreprise,
    'Frais de démarrage (enseigne, inauguration, frais juridiques)',
    'fraisDemarrage',
    couts.fraisDemarrage,
    true,
    'fraisDemarrage',
  );
  for (const id of IDS_DEMARCHES) {
    if (!demarches[id]) continue;
    const cout = coutDemarche(id, forme);
    if (cout > 0)
      ecritureSimple(
        livre,
        demarche(id).nom,
        'droitsPermis',
        'encaisse',
        versCents(cout),
        'droitsEtAmendes',
      );
  }

  // Le coût des immobilisations inscrit aux livres (taxes non récupérables incluses au besoin).
  entreprise.immobilisations[0].cout = versDollars(coutEquipement);
  entreprise.immobilisations[1].cout = versDollars(coutAmenagement);
  // Valeurs fiscales de départ des biens amortissables (FNACC).
  for (const immo of entreprise.immobilisations)
    ajouterAcquisition(entreprise.fiscal, immo.classeDpa, immo.cout);

  entreprise.prochainId = prochainId;
  return entreprise;
}

/**
 * Offre d'un commerce indépendant typique déjà établi : sert à estimer les ventes, donc
 * les frais fixes, des concurrents au départ.
 */
function offreReference(secteur: Secteur, potentiel: number): Offre {
  const prix: Record<string, number> = {};
  for (const l of secteur.lignes) prix[l.id] = l.prixReference;
  return {
    id: 'reference',
    prix,
    qualite: 0.55,
    service: 0.6,
    ambiance: 0.6,
    notoriete: 0.3,
    note: 4,
    heuresOuverture: secteur.heuresOuvertureReference,
    capaciteVisites: potentiel,
  };
}

/** Coût unitaire actuel d'une ligne chez son fournisseur, avec la qualité et les effets. */
export function coutUnitaireLigne(
  ligne: LigneProduit,
  fournisseurId: string,
  qualite: NiveauQualite,
  conj: Conjoncture,
  multiplicateur = 1,
): number {
  return coutChezFournisseur(
    ligne.coutUnitaire * qualite.multiplicateurCout * conj.indiceCouts * multiplicateur,
    fournisseurParId(fournisseurId),
    conj.tauxChange,
  );
}

export type { ErreurSource, EvaluationPlan };
