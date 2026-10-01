/**
 * Boucle de simulation : création de la partie et simulation d'un mois.
 *
 * `simulerMois` est une fonction pure : elle reçoit un état et retourne un
 * nouvel état, sans rien modifier de l'original. Tout le hasard passe par le
 * générateur à graine (`rngState`), ce qui rend le moteur déterministe.
 */
import {
  FRAIS_TRAITEMENT_CARTES,
  INTERETS_FISCAUX,
  SALAIRE_MINIMUM,
  TAXES_VENTE,
} from '../data/fiscalite';
import { PERSONNALITES, personnaliteParId, posteParId, secteurParId, villeParId } from '../data';
import {
  cloturerExercice,
  convertirEnCapitalActions,
  creerGrandLivre,
  ecritureSimple,
  ouvrirNouveauMois,
  passerEcriture,
  type CompteId,
  type FluxId,
  type GrandLivre,
  type LigneEcriture,
  type TypeCapitaux,
} from './accounting';
import {
  ajusterPrixConcurrent,
  creerConcurrent,
  deciderConcurrent,
  majConcurrentApresMarche,
  offreConcurrent,
  type ObservationMarche,
} from './ai-competitors';
import { analyserMois } from './analyse';
import { finExerciceFiscal } from './annuel';
import {
  IDS_DEMARCHES,
  coutDemarche,
  demarche,
  estObligatoire,
  estSocieteActions,
  estSocietePersonnes,
  fraisComptablesForme,
  fraisImmatriculation,
  fraisMiseAJourAnnuelle,
  immatriculationObligatoire,
} from './conformite';
import { noteCible, nouvelleNote, satisfactionClients } from './customers';
import type {
  Amenagement,
  Emplacement,
  Equipement,
  FraisFixesMensuels,
  NiveauQualite,
  Secteur,
  Ville,
} from './data-types';
import {
  conjonctureInitiale,
  evoluerConjoncture,
  tauxPreferentiel,
  type Conjoncture,
} from './economy';
import {
  COUT_RECRUTEMENT,
  evoluerMoral,
  facteurMoral,
  genererEmploye,
  moralCible,
  probabiliteDepart,
  semainesPreavis,
} from './hr';
import { reapprovisionner, tauxRupture } from './inventory';
import { creerPret, effectuerVersement, portionCourante, rembourserPartiellement } from './loans';
import {
  evoluerNotoriete,
  indicePrixClient,
  indicePrixOffre,
  prixReference,
  simulerMarche,
  type Offre,
  type ResultatOffre,
} from './market';
import { TAUX_VACANCES, cotisationsEmployeur, salaireMensuel } from './payroll';
import { Rng } from './rng';
import { cumulerMouvements, etatResultats } from './statements';
import { FACTEUR_TAXES, depasseSeuilPetitFournisseur, retenuesEmploye, taxesSur } from './tax';
import type {
  ConfigPartie,
  CumulPaie,
  Decisions,
  Difficulte,
  Employe,
  Entreprise,
  EtatFiscal,
  EtatPartie,
  FormeJuridique,
  FrequenceTaxes,
  IdDemarche,
  Indicateurs,
  Message,
  MoisArchive,
  ParametresDemarrage,
} from './types';
import { SEMAINES_PAR_MOIS, borner, lisser, versCents, versDollars } from './util';

// ---------------------------------------------------------------------------
// Règles du jeu
// ---------------------------------------------------------------------------

export const DIFFICULTES: Record<
  Difficulte,
  { marche: number; notorieteDepart: number; agressivite: number; limiteMarge: number }
> = {
  facile: { marche: 1.1, notorieteDepart: 0.12, agressivite: 0.6, limiteMarge: 25_000 },
  realiste: { marche: 1.0, notorieteDepart: 0.08, agressivite: 1.0, limiteMarge: 20_000 },
  expert: { marche: 0.9, notorieteDepart: 0.05, agressivite: 1.4, limiteMarge: 15_000 },
};

export const REGLES_FINANCEMENT = {
  /** Prêt de démarrage : taux préférentiel + 2,5 %, fixe, sur 5 ans. */
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
  budgetPublicite: { min: 0, max: 20_000 },
  heuresOuverture: { min: 20, max: 112 },
  heuresProprietaire: { min: 0, max: 80 },
  salaireHoraire: { max: 40 },
  stockJoursCible: { min: 1, max: 21 },
  prelevements: { min: 0, max: 15_000 },
  salaireDirigeant: { min: 0, max: 20_000 },
  heuresEmploye: { min: 8, max: 45 },
  prixRatio: { min: 0.4, max: 3 },
} as const;

/** Bail commercial de 5 ans, indexé de 2,5 % par année. */
const DUREE_BAIL_MOIS = 60;
const INDEXATION_BAIL = 0.025;
/** Proportion des ventes payées par carte (débit ou crédit). */
const PART_VENTES_CARTES = 0.85;
/** Proportion des clients servis qui laissent un avis en ligne. */
const TAUX_AVIS = 0.008;
/** Probabilité mensuelle qu'un défaut d'inscription aux taxes soit découvert. */
const DETECTION_TAXES = 0.15;
/** Pénalité sur les taxes non perçues lors d'un avis de cotisation. */
const PENALITE_TAXES = 0.15;
/** Mois limite (fin juin) pour la déclaration de mise à jour annuelle du REQ. */
const MOIS_LIMITE_MAJ_REQ = 6;

const COMPTES_FRAIS_FIXES: Record<
  keyof FraisFixesMensuels,
  { compte: CompteId; libelle: string; taxable: boolean }
> = {
  electricite: {
    compte: 'electricite',
    libelle: 'Électricité et chauffage (Hydro-Québec)',
    taxable: true,
  },
  assurances: {
    compte: 'assurances',
    libelle: 'Assurances (taxe sur les primes non récupérable)',
    taxable: false,
  },
  comptable: { compte: 'honoraires', libelle: 'Honoraires du comptable', taxable: true },
  entretien: { compte: 'entretien', libelle: 'Entretien et réparations', taxable: true },
  logiciels: { compte: 'logiciels', libelle: 'Logiciel de caisse et abonnements', taxable: true },
  telecom: { compte: 'telecom', libelle: 'Téléphone et Internet', taxable: true },
};

// ---------------------------------------------------------------------------
// Outils
// ---------------------------------------------------------------------------

export function dateDuMois(config: ConfigPartie, index: number): { annee: number; mois: number } {
  return { annee: config.anneeDepart + Math.floor(index / 12), mois: (index % 12) + 1 };
}

function parId<T extends { id: string }>(liste: readonly T[], id: string): T {
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
  const demarches = new Set(params.demarches ?? []);
  if (immatriculationObligatoire(forme)) demarches.add('req');
  const equipement = equipementDe(secteur, params.equipementId).cout;
  const amenagement = amenagementDe(secteur, params.amenagementId).cout;
  const depotGarantie =
    loyerMensuelInitial(secteur, emplacementDe(ville, params.emplacementId)) *
    REGLES_FINANCEMENT.moisDepotGarantie;
  const stockInitial = secteur.stockInitial;
  const fraisDemarrage = secteur.fraisDemarrage;
  const fraisJuridiques = [...demarches].reduce((a, id) => a + coutDemarche(id, forme), 0);
  const taxable =
    equipement + amenagement + fraisDemarrage + stockInitial * secteur.partAchatsTaxables;
  const taxes = taxesSur(taxable).total;
  return {
    equipement,
    amenagement,
    depotGarantie,
    stockInitial,
    fraisDemarrage,
    fraisJuridiques,
    taxes,
    total:
      Math.round(
        (equipement +
          amenagement +
          depotGarantie +
          stockInitial +
          fraisDemarrage +
          fraisJuridiques +
          taxes) *
          100,
      ) / 100,
  };
}

export function pretMaximum(apport: number): number {
  return Math.max(
    0,
    Math.min(REGLES_FINANCEMENT.pretMax, Math.floor(apport * REGLES_FINANCEMENT.multipleApportMax)),
  );
}

export type ErreurDemarrage =
  'nomVide' | 'apportInsuffisant' | 'pretTropEleve' | 'financementInsuffisant' | 'associeRequis';

/** Mise de fonds totale des propriétaires (incluant l'associé d'une société de personnes). */
export function apportTotal(
  params: Pick<ParametresDemarrage, 'apportPersonnel' | 'apportAssocie' | 'formeJuridique'>,
): number {
  return (
    params.apportPersonnel +
    (estSocietePersonnes(params.formeJuridique) ? Math.max(0, params.apportAssocie) : 0)
  );
}

export function validerDemarrage(
  params: ParametresDemarrage,
  secteur: Secteur,
  ville: Ville,
): ErreurDemarrage[] {
  const erreurs: ErreurDemarrage[] = [];
  if (params.nomEntreprise.trim().length === 0) erreurs.push('nomVide');
  if (params.apportPersonnel < REGLES_FINANCEMENT.apportMin) erreurs.push('apportInsuffisant');
  if (estSocietePersonnes(params.formeJuridique) && params.apportAssocie <= 0)
    erreurs.push('associeRequis');
  const apports = apportTotal(params);
  if (params.montantPret > pretMaximum(apports)) erreurs.push('pretTropEleve');
  const couts = coutsDemarrage(params, secteur, ville);
  if (apports + params.montantPret < couts.total + REGLES_FINANCEMENT.fondsRoulementMin) {
    erreurs.push('financementInsuffisant');
  }
  return erreurs;
}

export function decisionsParDefaut(
  secteur: Secteur,
  salaireMinimum: number,
  forme: FormeJuridique = 'individuelle',
): Decisions {
  const prix: Record<string, number> = {};
  for (const ligne of secteur.lignes) prix[ligne.id] = ligne.prixReference;
  const poste = posteParId(secteur.postes[0]);
  const societe = estSocieteActions(forme);
  return {
    prix,
    qualiteId: 'standard',
    budgetPublicite: 2_500,
    heuresOuverture: secteur.heuresOuvertureReference,
    heuresProprietaire: 50,
    salaireHoraire: Math.max(salaireMinimum, poste.salaireMedian),
    stockJoursCible: secteur.stockCibleJoursDefaut,
    prelevements: societe ? 0 : 2_000,
    remboursementAutoMarge: true,
    apportPonctuel: 0,
    remboursementAnticipe: 0,
    salaireDirigeant: societe ? 2_500 : 0,
    dividendePonctuel: 0,
  };
}

/** Borne les décisions dans des limites réalistes (protège le moteur des valeurs absurdes). */
export function validerDecisions(
  d: Decisions,
  secteur: Secteur,
  salaireMinimum: number,
  forme: FormeJuridique = 'individuelle',
): Decisions {
  const b = BORNES_DECISIONS;
  const prix: Record<string, number> = {};
  for (const ligne of secteur.lignes) {
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
  return {
    prix,
    qualiteId: secteur.qualites.some((q) => q.id === d.qualiteId) ? d.qualiteId : 'standard',
    budgetPublicite: Math.round(
      borner(fini(d.budgetPublicite, 0), b.budgetPublicite.min, b.budgetPublicite.max),
    ),
    heuresOuverture: Math.round(
      borner(fini(d.heuresOuverture, 60), b.heuresOuverture.min, b.heuresOuverture.max),
    ),
    heuresProprietaire: Math.round(
      borner(fini(d.heuresProprietaire, 40), b.heuresProprietaire.min, b.heuresProprietaire.max),
    ),
    salaireHoraire:
      Math.round(
        borner(fini(d.salaireHoraire, salaireMinimum), salaireMinimum, b.salaireHoraire.max) * 100,
      ) / 100,
    stockJoursCible: Math.round(
      borner(fini(d.stockJoursCible, 7), b.stockJoursCible.min, b.stockJoursCible.max),
    ),
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
  };
}

function etatFiscalInitial(inscritTaxes: boolean): EtatFiscal {
  return {
    inscritTaxes,
    frequenceTaxes: 'trimestrielle',
    ventesTaxablesMois: [],
    doitSInscrire: false,
    ventesNonTaxees: 0,
    uccEquipement: 0,
    uccAmeliorations: 0,
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

// ---------------------------------------------------------------------------
// Écritures avec taxes
// ---------------------------------------------------------------------------

/**
 * Paiement d'une dépense ou d'un actif. Si elle est taxable : une entreprise inscrite
 * récupère la TPS (CTI) et la TVQ (RTI); une entreprise non inscrite les absorbe dans le coût.
 */
function payer(
  L: GrandLivre,
  ent: Entreprise,
  libelle: string,
  compte: CompteId,
  montantHT: number,
  taxable: boolean,
  flux: FluxId,
  contrepartie: CompteId = 'encaisse',
): void {
  const ht = versCents(montantHT);
  if (ht <= 0) return;
  if (!taxable) {
    ecritureSimple(L, libelle, compte, contrepartie, ht, flux);
    return;
  }
  const t = taxesSur(montantHT);
  const tps = versCents(t.tps);
  const tvq = versCents(t.tvq);
  if (ent.fiscal.inscritTaxes) {
    passerEcriture(L, {
      libelle: `${libelle} (TPS et TVQ récupérables)`,
      flux,
      lignes: [
        { compte, debit: ht },
        { compte: 'ctiARecouvrer', debit: tps },
        { compte: 'rtiARecouvrer', debit: tvq },
        { compte: contrepartie, credit: ht + tps + tvq },
      ],
    });
    ent.fiscal.taxesAnnee.cti += t.tps;
    ent.fiscal.taxesAnnee.rti += t.tvq;
  } else {
    ecritureSimple(
      L,
      `${libelle} (taxes incluses, non récupérables)`,
      compte,
      contrepartie,
      ht + tps + tvq,
      flux,
    );
  }
}

/** Ramène des comptes à zéro en contrepartie de l'encaisse (remises gouvernementales). */
function solderComptes(L: GrandLivre, libelle: string, comptes: CompteId[], flux: FluxId): number {
  const lignes: LigneEcriture[] = [];
  let net = 0;
  for (const id of comptes) {
    const b = L.soldes[id];
    if (b > 0) lignes.push({ compte: id, credit: b });
    else if (b < 0) lignes.push({ compte: id, debit: -b });
    net -= b;
  }
  if (lignes.length === 0) return 0;
  if (net > 0) lignes.push({ compte: 'encaisse', credit: net });
  else if (net < 0) lignes.push({ compte: 'encaisse', debit: -net });
  passerEcriture(L, { libelle, flux, lignes });
  return net;
}

// ---------------------------------------------------------------------------
// Création de la partie
// ---------------------------------------------------------------------------

export function creerPartie(config: ConfigPartie, params: ParametresDemarrage): EtatPartie {
  const secteur = secteurParId(config.secteurId);
  const ville = villeParId(config.villeId);
  const erreurs = validerDemarrage(params, secteur, ville);
  if (erreurs.length > 0) throw new Error(`Démarrage invalide : ${erreurs.join(', ')}`);

  const rng = new Rng(config.graine);
  const diff = DIFFICULTES[config.difficulte];
  const conjoncture = conjonctureInitiale();
  const salaireMinimum = SALAIRE_MINIMUM.general;
  const forme = params.formeJuridique;
  const emplacement = emplacementDe(ville, params.emplacementId);
  const equipement = equipementDe(secteur, params.equipementId);
  const amenagement = amenagementDe(secteur, params.amenagementId);
  const couts = coutsDemarrage(params, secteur, ville);
  const societe = estSocieteActions(forme);
  const avecAssocie = estSocietePersonnes(forme);

  const demarches = {} as Record<IdDemarche, boolean>;
  for (const id of IDS_DEMARCHES) demarches[id] = params.demarches.includes(id);
  if (immatriculationObligatoire(forme)) demarches.req = true;

  const poste = posteParId(secteur.postes[0]);
  const employes = [1, 2, 3].map((i) => genererEmploye(i, poste, poste.heuresSemaineDefaut, rng));
  const qualite = qualiteDe(secteur, 'standard');
  const livre = creerGrandLivre();

  const entreprise: Entreprise = {
    id: 'joueur-1',
    nom: params.nomEntreprise.trim(),
    proprietaire: params.nomProprietaire.trim() || 'Propriétaire',
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
    decisions: decisionsParDefaut(secteur, salaireMinimum, forme),
    employes,
    clientele: {
      notoriete: diff.notorieteDepart,
      qualitePercue: qualite.score + equipement.bonusQualite,
      service: 0.6,
      satisfaction: 0.7,
      note: 4,
      nbAvis: 0,
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
    dureeAmortAmeliorations: DUREE_BAIL_MOIS,
    dureeAmortEquipement: equipement.dureeVieMois,
    enAttente: { recrutement: 0, indemnites: 0, embauches: 0 },
    archives: [],
    moisEnDefaut: 0,
    enFaillite: false,
    prochainIdEmploye: employes.length + 1,
    joursFermeture: 0,
  };

  // Financement : mise de fonds (capital, parts d'associés ou actions) et prêt.
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
  if (params.montantPret > 0) {
    const taux = tauxPreferentiel(conjoncture) + REGLES_FINANCEMENT.ecartTauxPret;
    const pret = creerPret(
      'pret-demarrage',
      'Prêt de démarrage',
      versCents(params.montantPret),
      taux,
      REGLES_FINANCEMENT.dureePretMois,
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

  // Investissements de démarrage (taxes récupérables seulement si l'entreprise est inscrite).
  payer(
    livre,
    entreprise,
    `Achat : ${equipement.nom}`,
    'equipement',
    couts.equipement,
    true,
    'acquisitionImmobilisations',
  );
  payer(
    livre,
    entreprise,
    `Travaux : ${amenagement.nom}`,
    'ameliorationsLocatives',
    couts.amenagement,
    true,
    'acquisitionImmobilisations',
  );
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

  // Valeurs fiscales de départ des biens amortissables (FNACC).
  entreprise.fiscal.uccEquipement = versDollars(livre.soldes.equipement);
  entreprise.fiscal.uccAmeliorations = versDollars(livre.soldes.ameliorationsLocatives);
  entreprise.fiscal.coutAmeliorations = entreprise.fiscal.uccAmeliorations;

  // Jalon 1 : deux concurrents (le Géant et le Local branché).
  const concurrents = PERSONNALITES.slice(0, 2).map((p) =>
    creerConcurrent(p, secteur, diff.agressivite),
  );

  return {
    version: 1,
    config,
    moisCourant: 0,
    rngState: rng.state,
    conjoncture,
    salaireMinimum,
    entreprises: [entreprise],
    concurrents,
    terminee: false,
  };
}

// ---------------------------------------------------------------------------
// Actions du joueur entre deux mois
// ---------------------------------------------------------------------------

function trouverEntreprise(etat: EtatPartie, id: string): Entreprise {
  return parId(etat.entreprises, id);
}

/** Applique une action sur une copie de l'état (fonction pure). */
function action(
  etat: EtatPartie,
  entrepriseId: string,
  f: (ent: Entreprise, e: EtatPartie) => void,
): EtatPartie {
  const e = structuredClone(etat);
  f(trouverEntreprise(e, entrepriseId), e);
  return e;
}

export function modifierDecisions(
  etat: EtatPartie,
  entrepriseId: string,
  changements: Partial<Decisions>,
): EtatPartie {
  return action(etat, entrepriseId, (ent, e) => {
    const secteur = secteurParId(e.config.secteurId);
    ent.decisions = validerDecisions(
      { ...ent.decisions, ...changements },
      secteur,
      e.salaireMinimum,
      ent.formeJuridique,
    );
  });
}

export function embaucher(
  etat: EtatPartie,
  entrepriseId: string,
  heuresSemaine?: number,
): EtatPartie {
  return action(etat, entrepriseId, (ent, e) => {
    const secteur = secteurParId(e.config.secteurId);
    const poste = posteParId(secteur.postes[0]);
    const rng = new Rng(e.rngState);
    const heures = Math.round(
      borner(
        heuresSemaine ?? poste.heuresSemaineDefaut,
        BORNES_DECISIONS.heuresEmploye.min,
        BORNES_DECISIONS.heuresEmploye.max,
      ),
    );
    ent.employes.push(genererEmploye(ent.prochainIdEmploye, poste, heures, rng));
    ent.prochainIdEmploye += 1;
    ent.enAttente.recrutement += COUT_RECRUTEMENT;
    ent.enAttente.embauches += 1;
    e.rngState = rng.state;
  });
}

/** Fin d'emploi : l'employé part tout de suite et reçoit une indemnité tenant lieu de préavis. */
export function congedier(etat: EtatPartie, entrepriseId: string, employeId: string): EtatPartie {
  return action(etat, entrepriseId, (ent) => {
    const employe = parId(ent.employes, employeId);
    const semaines = semainesPreavis(employe.moisAnciennete);
    ent.enAttente.indemnites +=
      Math.round(semaines * employe.heuresSemaine * ent.decisions.salaireHoraire * 100) / 100;
    ent.employes = ent.employes.filter((x) => x.id !== employeId);
  });
}

export function modifierHeuresEmploye(
  etat: EtatPartie,
  entrepriseId: string,
  employeId: string,
  heures: number,
): EtatPartie {
  return action(etat, entrepriseId, (ent) => {
    const employe = parId(ent.employes, employeId);
    employe.heuresSemaine = Math.round(
      borner(heures, BORNES_DECISIONS.heuresEmploye.min, BORNES_DECISIONS.heuresEmploye.max),
    );
  });
}

/** Inscription volontaire aux fichiers de la TPS et de la TVQ. */
export function inscrireTaxes(etat: EtatPartie, entrepriseId: string): EtatPartie {
  return action(etat, entrepriseId, (ent) => {
    ent.fiscal.inscritTaxes = true;
    ent.fiscal.doitSInscrire = false;
  });
}

export function changerFrequenceTaxes(
  etat: EtatPartie,
  entrepriseId: string,
  frequence: FrequenceTaxes,
): EtatPartie {
  return action(etat, entrepriseId, (ent) => {
    ent.fiscal.frequenceTaxes = frequence;
  });
}

/** Faire une démarche oubliée (payer son coût maintenant) avant qu'elle soit découverte. */
export function regulariserDemarche(
  etat: EtatPartie,
  entrepriseId: string,
  id: IdDemarche,
): EtatPartie {
  return action(etat, entrepriseId, (ent) => {
    if (ent.demarches[id]) return;
    ent.demarches[id] = true;
    const cout = coutDemarche(id, ent.formeJuridique);
    if (cout > 0)
      ecritureSimple(
        ent.livre,
        `Régularisation : ${demarche(id).nom}`,
        'droitsPermis',
        'encaisse',
        versCents(cout),
        'droitsEtAmendes',
      );
  });
}

/** Produire la déclaration de mise à jour annuelle au REQ pour l'année en cours. */
export function produireMiseAJourAnnuelle(etat: EtatPartie, entrepriseId: string): EtatPartie {
  return action(etat, entrepriseId, (ent, e) => {
    const { annee } = dateDuMois(e.config, Math.min(e.moisCourant, e.config.dureeMois - 1));
    if (ent.fiscal.majAnnuelles.includes(annee)) return;
    ent.fiscal.majAnnuelles.push(annee);
    ecritureSimple(
      ent.livre,
      `Déclaration de mise à jour annuelle ${annee} (REQ)`,
      'droitsPermis',
      'encaisse',
      versCents(fraisMiseAJourAnnuelle(ent.formeJuridique)),
      'droitsEtAmendes',
    );
  });
}

/** S'incorporer : la société par actions prend effet le 1er janvier suivant (début d'un exercice). */
export function planifierIncorporation(
  etat: EtatPartie,
  entrepriseId: string,
  type: 'inc-qc' | 'inc-federal' | null,
): EtatPartie {
  return action(etat, entrepriseId, (ent) => {
    if (ent.formeJuridique !== 'individuelle') return;
    ent.fiscal.incorporationPrevue = type;
  });
}

/** La déclaration de mise à jour annuelle est-elle exigée cette année? */
export function majAnnuelleExigee(anneeDepart: number, ent: Entreprise, annee: number): boolean {
  return (
    annee > anneeDepart && (ent.demarches.req || immatriculationObligatoire(ent.formeJuridique))
  );
}

// ---------------------------------------------------------------------------
// Simulation d'un mois
// ---------------------------------------------------------------------------

interface ContexteMois {
  index: number;
  annee: number;
  mois: number;
  secteur: Secteur;
  ville: Ville;
  conj: Conjoncture;
  salaireMinimum: number;
  potentiel: number;
  rng: Rng;
  messagesCommuns: Message[];
  config: ConfigPartie;
}

interface Preparation {
  offre: Offre;
  capacite: number;
  heuresPersonnel: number;
  heuresEffectives: number;
  messages: Message[];
}

/**
 * Début du mois : changements de forme juridique, contrôles des organismes (démarches
 * oubliées, taxes non perçues), sinistres non assurés et obligations annuelles.
 */
function debutDeMois(ent: Entreprise, ctx: ContexteMois): Message[] {
  const L = ent.livre;
  const f = ent.fiscal;
  const m: Message[] = [];
  const { rng, secteur } = ctx;
  ent.joursFermeture = 0;

  // Incorporation planifiée : elle prend effet le 1er janvier.
  if (ctx.mois === 1 && f.incorporationPrevue && ent.formeJuridique === 'individuelle') {
    const nouvelle = f.incorporationPrevue;
    ecritureSimple(
      L,
      'Constitution de la société par actions',
      'droitsPermis',
      'encaisse',
      versCents(fraisImmatriculation(nouvelle)),
      'droitsEtAmendes',
    );
    convertirEnCapitalActions(L);
    ent.formeJuridique = nouvelle;
    ent.demarches.req = true;
    f.incorporationPrevue = null;
    ent.decisions = {
      ...ent.decisions,
      prelevements: 0,
      salaireDirigeant: ent.decisions.prelevements,
    };
    m.push({ code: 'incorporationEffectuee', niveau: 'succes', params: { forme: nouvelle } });
  }

  // Contrôles : une démarche obligatoire oubliée peut être découverte.
  for (const id of IDS_DEMARCHES) {
    if (ent.demarches[id]) continue;
    const d = demarche(id);
    if (
      id === 'req' &&
      ent.formeJuridique === 'individuelle' &&
      ent.nom.toLowerCase().includes(ent.proprietaire.toLowerCase())
    )
      continue;
    if (d.sinistre) {
      // Pas d'assurance : un accident ou un dégât d'eau est payé par l'entreprise.
      if (rng.chance(d.probabiliteDetection)) {
        const cout = Math.round(rng.range(d.sinistre[0], d.sinistre[1]));
        ecritureSimple(
          L,
          'Sinistre non assuré (dégât d’eau ou réclamation d’un client)',
          'sinistres',
          'encaisse',
          versCents(cout),
          'droitsEtAmendes',
        );
        m.push({ code: 'sinistreNonAssure', niveau: 'danger', params: { montant: cout } });
      }
      continue;
    }
    if (!estObligatoire(id, secteur, ent.employes.length) || !rng.chance(d.probabiliteDetection))
      continue;
    const cout = coutDemarche(id, ent.formeJuridique);
    if (d.amende > 0)
      ecritureSimple(
        L,
        `Amende : ${d.nom}`,
        'amendes',
        'encaisse',
        versCents(d.amende),
        'droitsEtAmendes',
      );
    if (cout > 0)
      ecritureSimple(
        L,
        `Régularisation forcée : ${d.nom}`,
        'droitsPermis',
        'encaisse',
        versCents(cout),
        'droitsEtAmendes',
      );
    ent.demarches[id] = true;
    ent.joursFermeture = Math.max(ent.joursFermeture, d.joursFermeture);
    m.push({
      code: 'demarcheDecouverte',
      niveau: 'danger',
      params: { nom: d.nom, organisme: d.organisme, amende: d.amende, jours: d.joursFermeture },
    });
  }

  // Taxes : un petit fournisseur qui a dépassé le seuil sans s'inscrire peut être découvert.
  if (f.doitSInscrire && !f.inscritTaxes && f.ventesNonTaxees > 0 && rng.chance(DETECTION_TAXES)) {
    const taxes = f.ventesNonTaxees * (TAXES_VENTE.tps + TAXES_VENTE.tvq);
    const penalite = taxes * PENALITE_TAXES;
    const interets = taxes * INTERETS_FISCAUX.tauxAnnuel * 0.25;
    const total = Math.round((taxes + penalite + interets) * 100) / 100;
    ecritureSimple(
      L,
      'Avis de cotisation : TPS/TVQ non perçues, pénalité et intérêts',
      'amendes',
      'encaisse',
      versCents(total),
      'droitsEtAmendes',
    );
    m.push({
      code: 'cotisationTaxes',
      niveau: 'danger',
      params: { ventes: f.ventesNonTaxees, montant: total },
    });
    f.inscritTaxes = true;
    f.doitSInscrire = false;
    f.ventesNonTaxees = 0;
  }

  // REQ : déclaration de mise à jour annuelle à produire avant la fin de juin.
  if (
    majAnnuelleExigee(ctx.config.anneeDepart, ent, ctx.annee) &&
    !f.majAnnuelles.includes(ctx.annee)
  ) {
    if (ctx.mois === MOIS_LIMITE_MAJ_REQ + 1) {
      const frais = fraisMiseAJourAnnuelle(ent.formeJuridique);
      ecritureSimple(
        L,
        `Déclaration de mise à jour annuelle ${ctx.annee} produite en retard`,
        'droitsPermis',
        'encaisse',
        versCents(frais),
        'droitsEtAmendes',
      );
      ecritureSimple(
        L,
        'Pénalité de retard du REQ (50 % des droits)',
        'amendes',
        'encaisse',
        versCents(frais * 0.5),
        'droitsEtAmendes',
      );
      f.majAnnuelles.push(ctx.annee);
      m.push({
        code: 'majAnnuelleEnRetard',
        niveau: 'alerte',
        params: { annee: ctx.annee, penalite: frais * 0.5 },
      });
    } else if (ctx.mois >= 3 && ctx.mois <= MOIS_LIMITE_MAJ_REQ) {
      m.push({ code: 'rappelMajAnnuelle', niveau: 'info', params: { annee: ctx.annee } });
    }
  }
  return m;
}

function preparerOffre(ent: Entreprise, ctx: ContexteMois, messages: Message[]): Preparation {
  const d = ent.decisions;
  const emplacement = emplacementDe(ctx.ville, ent.emplacementId);
  const amenagement = amenagementDe(ctx.secteur, ent.amenagementId);
  const ouvert = 1 - borner(ent.joursFermeture / 30, 0, 1);
  const heuresEmployes = ent.employes.reduce((a, x) => a + x.heuresSemaine, 0);
  const heuresPersonnel = heuresEmployes + d.heuresProprietaire;
  // Il faut au moins une personne sur place pour ouvrir.
  const heuresEffectives = Math.min(d.heuresOuverture, heuresPersonnel);
  const heuresProductives =
    ent.employes.reduce((a, x) => a + x.heuresSemaine * x.competence * facteurMoral(x.moral), 0) +
    d.heuresProprietaire;
  const capacite = Math.floor(
    heuresProductives * SEMAINES_PAR_MOIS * ctx.secteur.transactionsParHeureEmploye * ouvert,
  );
  return {
    capacite,
    heuresPersonnel,
    heuresEffectives,
    messages,
    offre: {
      id: ent.id,
      prix: d.prix,
      qualite: ent.clientele.qualitePercue,
      service: ent.clientele.service,
      ambiance: amenagement.ambiance,
      notoriete: ent.clientele.notoriete,
      note: ent.clientele.note,
      heuresOuverture: heuresEffectives,
      capaciteVisites: capacite,
      tauxRupture: tauxRupture(d.stockJoursCible),
      bonusEmplacement: Math.log(emplacement.achalandage),
      facteurPrixClient: ent.fiscal.inscritTaxes ? FACTEUR_TAXES : 1,
    },
  };
}

function resultatVide(): ResultatOffre {
  return {
    utilite: 0,
    attrait: 0,
    demande: 0,
    servies: 0,
    perduesCapacite: 0,
    perduesRupture: 0,
    part: 0,
    ventes: [],
    chiffreAffaires: 0,
    ticketMoyen: 0,
  };
}

/** Le mois commence-t-il par la remise de TPS/TVQ de la période précédente? */
function moisDeRemiseTaxes(frequence: FrequenceTaxes, mois: number): boolean {
  if (frequence === 'mensuelle') return true;
  if (frequence === 'trimestrielle') return mois === 1 || mois === 4 || mois === 7 || mois === 10;
  return mois === 4;
}

function ajouterPaie(
  cumuls: Record<string, CumulPaie>,
  cle: string,
  nom: string,
  brut: number,
  r: ReturnType<typeof retenuesEmploye>,
) {
  const c = cumuls[cle] ?? {
    nom,
    brut: 0,
    impotFederal: 0,
    impotQuebec: 0,
    rrq: 0,
    rqap: 0,
    assuranceEmploi: 0,
  };
  c.brut = Math.round((c.brut + brut) * 100) / 100;
  c.impotFederal = Math.round((c.impotFederal + r.impotFederal) * 100) / 100;
  c.impotQuebec = Math.round((c.impotQuebec + r.impotQuebec) * 100) / 100;
  c.rrq = Math.round((c.rrq + r.rrq) * 100) / 100;
  c.rqap = Math.round((c.rqap + r.rqap) * 100) / 100;
  c.assuranceEmploi = Math.round((c.assuranceEmploi + r.assuranceEmploi) * 100) / 100;
  cumuls[cle] = c;
}

function simulerEntreprise(
  ent: Entreprise,
  prep: Preparation,
  r: ResultatOffre,
  ctx: ContexteMois,
): Message[] {
  const L = ent.livre;
  const d = ent.decisions;
  const f = ent.fiscal;
  const { secteur, ville, conj, rng } = ctx;
  const messages: Message[] = [...prep.messages];
  const societe = estSocieteActions(ent.formeJuridique);

  // Nouvelle année : les cumuls de salaire pour les plafonds de cotisation repartent à zéro.
  if (ctx.mois === 1) for (const emp of ent.employes) emp.cumulBrutAnnee = 0;

  // Le salaire ne peut être inférieur au salaire minimum en vigueur.
  if (d.salaireHoraire < ctx.salaireMinimum) {
    d.salaireHoraire = ctx.salaireMinimum;
    messages.push({
      code: 'salaireAjusteMinimum',
      niveau: 'info',
      params: { salaire: ctx.salaireMinimum },
    });
  }

  // a) Opérations ponctuelles demandées par le joueur
  if (d.apportPonctuel > 0) {
    ecritureSimple(
      L,
      societe
        ? 'Émission d’actions additionnelles au fondateur'
        : 'Apport additionnel du propriétaire',
      'encaisse',
      societe ? 'capitalActions' : 'capital',
      versCents(d.apportPonctuel),
      'apportsProprietaire',
    );
    messages.push({
      code: 'apportPonctuel',
      niveau: 'info',
      params: { montant: d.apportPonctuel },
    });
  }
  const pretPrincipal = ent.prets.find((p) => p.solde > 0);
  if (d.remboursementAnticipe > 0 && pretPrincipal) {
    const montant = rembourserPartiellement(pretPrincipal, versCents(d.remboursementAnticipe));
    ecritureSimple(
      L,
      'Remboursement anticipé de l’emprunt',
      'empruntBancaire',
      'encaisse',
      montant,
      'remboursementsEmprunts',
    );
    messages.push({
      code: 'remboursementAnticipe',
      niveau: 'info',
      params: { montant: versDollars(montant) },
    });
  }

  // b) Paiements du mois précédent : fournisseurs (net 30), retenues à la source et cotisations (DAS)
  ecritureSimple(
    L,
    'Paiement des fournisseurs (achats du mois précédent)',
    'comptesFournisseurs',
    'encaisse',
    -L.soldes.comptesFournisseurs,
    'paiementsFournisseurs',
  );
  solderComptes(
    L,
    'Remise des retenues à la source et des cotisations (Revenu Québec et ARC)',
    ['retenuesAPayer', 'cotisationsAPayer'],
    'remisesGouvernementales',
  );

  // c) Remise de la TPS et de la TVQ de la période précédente (taxes perçues − CTI − RTI)
  if (ctx.index > 0 && moisDeRemiseTaxes(f.frequenceTaxes, ctx.mois)) {
    const net = solderComptes(
      L,
      'Remise de la TPS et de la TVQ (perçues moins CTI et RTI)',
      ['tpsAPayer', 'tvqAPayer', 'ctiARecouvrer', 'rtiARecouvrer'],
      'remisesTaxes',
    );
    if (net !== 0)
      messages.push({
        code: net > 0 ? 'remiseTaxes' : 'remboursementTaxes',
        niveau: 'info',
        params: { montant: Math.abs(versDollars(net)) },
      });
  }

  // d) Impôt des sociétés : acomptes provisionnels mensuels et solde de l'an dernier (mars)
  if (societe && f.acompteMensuel > 0) {
    ecritureSimple(
      L,
      'Acompte provisionnel d’impôt (fédéral et Québec)',
      'impotsAPayer',
      'encaisse',
      versCents(f.acompteMensuel),
      'impotsPayes',
    );
    f.acomptesVersesAnnee = Math.round((f.acomptesVersesAnnee + f.acompteMensuel) * 100) / 100;
  }
  if (ctx.mois === 3 && f.soldeImpotAPayer !== 0) {
    ecritureSimple(
      L,
      f.soldeImpotAPayer > 0
        ? 'Paiement du solde d’impôt de l’an dernier'
        : 'Remboursement d’impôt de l’an dernier',
      'impotsAPayer',
      'encaisse',
      versCents(f.soldeImpotAPayer),
      'impotsPayes',
    );
    messages.push({
      code: f.soldeImpotAPayer > 0 ? 'soldeImpotPaye' : 'remboursementImpot',
      niveau: 'info',
      params: { montant: Math.abs(f.soldeImpotAPayer) },
    });
    f.soldeImpotAPayer = 0;
  }

  // e) Ventes (avec TPS et TVQ si l'entreprise est inscrite) et frais de cartes
  const ventesHT = r.chiffreAffaires;
  let encaissement = ventesHT;
  if (f.inscritTaxes) {
    const t = taxesSur(ventesHT);
    passerEcriture(L, {
      libelle: 'Ventes du mois (TPS et TVQ perçues)',
      flux: 'encaissementsClients',
      lignes: [
        { compte: 'encaisse', debit: versCents(ventesHT) + versCents(t.tps) + versCents(t.tvq) },
        { compte: 'ventes', credit: versCents(ventesHT) },
        { compte: 'tpsAPayer', credit: versCents(t.tps) },
        { compte: 'tvqAPayer', credit: versCents(t.tvq) },
      ],
    });
    f.taxesAnnee.tpsPercue += t.tps;
    f.taxesAnnee.tvqPercue += t.tvq;
    encaissement += t.total;
  } else {
    ecritureSimple(
      L,
      'Ventes du mois (petit fournisseur : aucune taxe perçue)',
      'encaisse',
      'ventes',
      versCents(ventesHT),
      'encaissementsClients',
    );
  }
  ecritureSimple(
    L,
    'Frais de traitement des cartes de débit et de crédit',
    'fraisCartes',
    'encaisse',
    versCents(encaissement * PART_VENTES_CARTES * FRAIS_TRAITEMENT_CARTES.taux),
    'fraisBancaires',
  );

  // Seuil du petit fournisseur (ventes taxables des 4 derniers trimestres)
  f.ventesTaxablesMois = [...f.ventesTaxablesMois.slice(-11), ventesHT];
  if (!f.inscritTaxes) {
    const ventes12 = f.ventesTaxablesMois.reduce((a, x) => a + x, 0);
    if (!f.doitSInscrire && depasseSeuilPetitFournisseur(ventes12)) {
      f.doitSInscrire = true;
      messages.push({ code: 'seuilTaxesDepasse', niveau: 'danger', params: { ventes: ventes12 } });
    } else if (f.doitSInscrire) {
      f.ventesNonTaxees += ventesHT;
      messages.push({
        code: 'inscriptionTaxesRequise',
        niveau: 'danger',
        params: { ventes: f.ventesNonTaxees },
      });
    }
  }

  // f) Coût des ventes et réapprovisionnement (une partie des achats est taxable)
  const qualite = qualiteDe(secteur, d.qualiteId);
  let coutVentes = 0;
  let coutPerissables = 0;
  for (const v of r.ventes) {
    const ligne = secteur.lignes.find((l) => l.id === v.ligneId);
    if (!ligne) continue;
    const cout = v.unites * ligne.coutUnitaire * qualite.multiplicateurCout * conj.indiceCouts;
    coutVentes += cout;
    if (ligne.perissable) coutPerissables += cout;
  }
  const reappro = reapprovisionner(
    versDollars(L.soldes.stocks),
    coutVentes,
    coutPerissables,
    d.stockJoursCible,
  );
  const achatsTaxables = reappro.achats * secteur.partAchatsTaxables;
  ecritureSimple(
    L,
    'Achats d’aliments détaxés (payables dans 30 jours)',
    'stocks',
    'comptesFournisseurs',
    versCents(reappro.achats - achatsTaxables),
  );
  if (f.inscritTaxes) {
    payer(
      L,
      ent,
      'Achats d’emballages et de fournitures (payables dans 30 jours)',
      'stocks',
      achatsTaxables,
      true,
      'paiementsFournisseurs',
      'comptesFournisseurs',
    );
  } else {
    const t = taxesSur(achatsTaxables);
    passerEcriture(L, {
      libelle: 'Achats d’emballages et de fournitures (taxes non récupérables)',
      lignes: [
        { compte: 'stocks', debit: versCents(achatsTaxables) },
        { compte: 'coutMarchandises', debit: versCents(t.tps) + versCents(t.tvq) },
        {
          compte: 'comptesFournisseurs',
          credit: versCents(achatsTaxables) + versCents(t.tps) + versCents(t.tvq),
        },
      ],
    });
  }
  ecritureSimple(
    L,
    'Coût des marchandises vendues',
    'coutMarchandises',
    'stocks',
    versCents(coutVentes),
  );
  ecritureSimple(
    L,
    'Produits périmés jetés',
    'pertesStocks',
    'stocks',
    Math.min(versCents(reappro.pertes), Math.max(0, L.soldes.stocks)),
  );
  if (L.soldes.stocks < 0) {
    ecritureSimple(
      L,
      'Achat d’appoint de marchandises',
      'stocks',
      'comptesFournisseurs',
      -L.soldes.stocks,
    );
  }

  // g) Paie : salaire brut → retenues à la source → salaire net; cotisations de l'employeur
  const dirigeant = societe && d.salaireDirigeant > 0 ? d.salaireDirigeant : 0;
  const masseAnnuelle =
    (ent.employes.reduce((a, x) => a + salaireMensuel(d.salaireHoraire, x.heuresSemaine), 0) +
      dirigeant) *
    12;
  let salaires = 0;
  let vacances = 0;
  let retenues = 0;
  let cotisations = 0;
  for (const emp of ent.employes) {
    const brut = salaireMensuel(d.salaireHoraire, emp.heuresSemaine);
    const vac = Math.round(brut * TAUX_VACANCES * 100) / 100;
    const c = cotisationsEmployeur(
      brut + vac,
      emp.cumulBrutAnnee,
      secteur.tauxCnesst,
      masseAnnuelle,
    );
    const ret = retenuesEmploye(brut + vac, emp.cumulBrutAnnee, true);
    emp.cumulBrutAnnee += brut + vac;
    ajouterPaie(f.paieAnnee, emp.id, `${emp.prenom} ${emp.nom}`, brut + vac, ret);
    f.heuresRemunereesAnnee += emp.heuresSemaine * SEMAINES_PAR_MOIS;
    salaires += brut;
    vacances += vac;
    retenues += ret.total;
    cotisations += c.total;
  }
  if (ent.enAttente.indemnites > 0) {
    const ret = retenuesEmploye(ent.enAttente.indemnites, 0, true);
    ajouterPaie(
      f.paieAnnee,
      'indemnites',
      'Anciens employés (indemnités de préavis)',
      ent.enAttente.indemnites,
      ret,
    );
    salaires += ent.enAttente.indemnites;
    retenues += ret.total;
    messages.push({
      code: 'indemnitesPreavis',
      niveau: 'info',
      params: { montant: ent.enAttente.indemnites },
    });
  }
  let cDirigeant = 0;
  if (dirigeant > 0) {
    const cumul = f.paieAnnee.dirigeant?.brut ?? 0;
    // Un actionnaire qui contrôle plus de 40 % des actions n'est pas assurable à l'AE.
    const c = cotisationsEmployeur(dirigeant, cumul, 0, masseAnnuelle);
    const ret = retenuesEmploye(dirigeant, cumul, false);
    ajouterPaie(f.paieAnnee, 'dirigeant', `${ent.proprietaire} (dirigeant)`, dirigeant, ret);
    f.heuresRemunereesAnnee += Math.min(40, d.heuresProprietaire) * SEMAINES_PAR_MOIS;
    cDirigeant = versCents(dirigeant);
    retenues += ret.total;
    cotisations += c.total - c.assuranceEmploi;
  }
  const cSalaires = versCents(salaires);
  const cVacances = versCents(vacances);
  const cRetenues = versCents(retenues);
  passerEcriture(L, {
    libelle: 'Paie du mois (salaires bruts, retenues à la source et salaires nets versés)',
    flux: 'salairesVerses',
    lignes: [
      { compte: 'salaires', debit: cSalaires },
      { compte: 'vacances', debit: cVacances },
      { compte: 'salaireDirigeant', debit: cDirigeant },
      { compte: 'retenuesAPayer', credit: cRetenues },
      { compte: 'encaisse', credit: cSalaires + cVacances + cDirigeant - cRetenues },
    ],
  });
  ecritureSimple(
    L,
    'Cotisations de l’employeur (RRQ, RQAP, AE, FSS, CNT, CNESST)',
    'chargesSociales',
    'cotisationsAPayer',
    versCents(cotisations),
  );

  // h) Loyer (indexé à chaque anniversaire du bail) et frais fixes
  if (ctx.index > 0 && ctx.index % 12 === 0) {
    ent.bail.loyerMensuel = Math.round(ent.bail.loyerMensuel * (1 + ent.bail.indexation));
    messages.push({
      code: 'indexationLoyer',
      niveau: 'info',
      params: { loyer: versDollars(ent.bail.loyerMensuel), taux: ent.bail.indexation },
    });
  }
  payer(
    L,
    ent,
    'Loyer et frais communs',
    'loyer',
    versDollars(ent.bail.loyerMensuel),
    true,
    'loyerEtFrais',
  );
  for (const [cle, montant] of Object.entries(secteur.fraisFixesMensuels) as [
    keyof FraisFixesMensuels,
    number,
  ][]) {
    const { compte, libelle, taxable } = COMPTES_FRAIS_FIXES[cle];
    if (cle === 'assurances' && !ent.demarches.assurances) continue;
    let base = montant;
    if (cle === 'comptable') {
      base += fraisComptablesForme(ent.formeJuridique);
      if (!ent.demarches.compteBancaire)
        base += demarche('compteBancaire').fraisComptablesSupplementaires ?? 0;
    }
    payer(L, ent, libelle, compte, base * conj.indicePrix, taxable, 'loyerEtFrais');
  }

  // i) Publicité et recrutement
  payer(L, ent, 'Publicité', 'publicite', d.budgetPublicite, true, 'publicite');
  payer(
    L,
    ent,
    'Affichage de postes et intégration des nouveaux employés',
    'recrutement',
    ent.enAttente.recrutement,
    true,
    'publicite',
  );

  // j) Emprunts et marge de crédit
  for (const pret of ent.prets) {
    if (pret.solde <= 0) continue;
    const v = effectuerVersement(pret);
    ecritureSimple(
      L,
      `Intérêts – ${pret.nom}`,
      'interets',
      'encaisse',
      v.interets,
      'interetsPayes',
    );
    ecritureSimple(
      L,
      `Remboursement du capital – ${pret.nom}`,
      'empruntBancaire',
      'encaisse',
      v.capital,
      'remboursementsEmprunts',
    );
  }
  const margeUtilisee = -L.soldes.margeCredit;
  if (margeUtilisee > 0) {
    const taux = tauxPreferentiel(conj) + ent.margeCredit.ecartTaux;
    ecritureSimple(
      L,
      'Intérêts sur la marge de crédit',
      'interets',
      'encaisse',
      Math.round((margeUtilisee * taux) / 12),
      'interetsPayes',
    );
  }

  // k) Amortissement comptable (linéaire, sur la durée de vie ou la durée du bail)
  const amortir = (actif: CompteId, cumul: CompteId, duree: number, libelle: string) => {
    const cout = L.soldes[actif];
    const net = cout + L.soldes[cumul];
    const montant = Math.min(Math.round(cout / duree), net);
    ecritureSimple(L, libelle, 'amortissement', cumul, Math.max(0, montant));
  };
  amortir(
    'equipement',
    'amortCumEquipement',
    ent.dureeAmortEquipement,
    'Amortissement de l’équipement',
  );
  amortir(
    'ameliorationsLocatives',
    'amortCumAmeliorations',
    ent.dureeAmortAmeliorations,
    'Amortissement des améliorations locatives',
  );

  // l) Rémunération des propriétaires : prélèvements (individuelle, société de personnes) ou dividendes
  if (!societe) {
    ecritureSimple(
      L,
      'Prélèvements du propriétaire',
      'prelevements',
      'encaisse',
      versCents(d.prelevements),
      'prelevementsProprietaire',
    );
    if (ent.associe && ent.associe.part < 1) {
      const partAssocie = (d.prelevements * ent.associe.part) / (1 - ent.associe.part);
      ecritureSimple(
        L,
        `Prélèvements de l’associé (${ent.associe.nom})`,
        'prelevementsAssocie',
        'encaisse',
        versCents(partAssocie),
        'prelevementsProprietaire',
      );
    }
  } else if (d.dividendePonctuel > 0) {
    ecritureSimple(
      L,
      'Dividendes versés à l’actionnaire (non déterminés)',
      'dividendes',
      'encaisse',
      versCents(d.dividendePonctuel),
      'dividendesVerses',
    );
    messages.push({
      code: 'dividendeVerse',
      niveau: 'info',
      params: { montant: d.dividendePonctuel },
    });
  }

  // m) Marge de crédit automatique
  const limite = ent.margeCredit.limite;
  const utilisee = -L.soldes.margeCredit;
  if (L.soldes.encaisse < 0 && utilisee < limite) {
    const tirage = Math.min(limite - utilisee, -L.soldes.encaisse);
    ecritureSimple(
      L,
      'Tirage sur la marge de crédit',
      'encaisse',
      'margeCredit',
      tirage,
      'margeCredit',
    );
    messages.push({
      code: 'tirageMarge',
      niveau: 'alerte',
      params: { montant: versDollars(tirage) },
    });
  } else if (d.remboursementAutoMarge && utilisee > 0) {
    const coussin = versCents(REGLES_FINANCEMENT.coussinEncaisse);
    const remb = Math.min(utilisee, L.soldes.encaisse - coussin);
    if (remb > 0)
      ecritureSimple(
        L,
        'Remboursement de la marge de crédit',
        'margeCredit',
        'encaisse',
        remb,
        'margeCredit',
      );
  }

  // n) Clientèle : qualité perçue, service, satisfaction, avis et notoriété
  const equipement = equipementDe(secteur, ent.equipementId);
  const amenagement = amenagementDe(secteur, ent.amenagementId);
  const emplacement = emplacementDe(ville, ent.emplacementId);
  const cl = ent.clientele;
  const utilisation = prep.capacite > 0 ? r.demande / prep.capacite : r.demande > 0 ? 2 : 0;
  const ip = indicePrixOffre(d.prix, secteur, conj.indicePrix);
  const ipClient = indicePrixClient(prep.offre, secteur, conj.indicePrix);
  cl.qualitePercue = lisser(
    cl.qualitePercue,
    borner(qualite.score + equipement.bonusQualite, 0, 1),
    0.35,
  );

  const heuresTotales = prep.heuresPersonnel;
  const moralPondere =
    heuresTotales > 0
      ? (ent.employes.reduce((a, x) => a + x.moral * x.heuresSemaine, 0) +
          80 * d.heuresProprietaire) /
        heuresTotales
      : 50;
  const competencePonderee =
    heuresTotales > 0
      ? (ent.employes.reduce((a, x) => a + x.competence * x.heuresSemaine, 0) +
          1.1 * d.heuresProprietaire) /
        heuresTotales
      : 0.8;
  const serviceCible = borner(
    0.3 +
      0.3 * (moralPondere / 100) +
      0.2 * ((competencePonderee - 0.8) / 0.4) +
      0.25 * (1 - borner((utilisation - 0.75) / 0.5, 0, 1)),
    0.1,
    0.95,
  );
  cl.service = lisser(cl.service, serviceCible, 0.5);
  const tauxAttente = r.demande > 0 ? (r.perduesCapacite + 0.5 * r.perduesRupture) / r.demande : 0;
  cl.satisfaction = satisfactionClients(
    cl.qualitePercue,
    cl.service,
    amenagement.ambiance,
    ipClient,
    tauxAttente,
  );
  const nouveauxAvis = Math.round(r.servies * TAUX_AVIS);
  if (nouveauxAvis > 0) {
    const noteMois = borner(noteCible(cl.satisfaction) + rng.normal(0, 0.2), 1, 5);
    cl.note = nouvelleNote(cl.note, cl.nbAvis, noteMois, nouveauxAvis);
    cl.nbAvis += nouveauxAvis;
  }
  const effetNouveaute = ctx.index === 0 ? 0.06 : 0;
  cl.notoriete = borner(
    evoluerNotoriete(
      cl.notoriete,
      d.budgetPublicite,
      emplacement.visibilite,
      ctx.potentiel > 0 ? r.servies / ctx.potentiel : 0,
      cl.satisfaction,
    ) + effetNouveaute,
    0.01,
    0.98,
  );

  // o) Ressources humaines : moral, ancienneté et démissions
  const poste = posteParId(secteur.postes[0]);
  const salaireDuMarche = poste.salaireMedian * ville.indiceSalaires * conj.indicePrix;
  const restants: Employe[] = [];
  for (const emp of ent.employes) {
    emp.moral = evoluerMoral(
      emp,
      moralCible(d.salaireHoraire, salaireDuMarche, utilisation, emp.heuresSemaine),
      rng,
    );
    emp.moisAnciennete += 1;
    if (rng.chance(probabiliteDepart(emp.moral, ville.penurieMainOeuvre))) {
      messages.push({
        code: 'demission',
        niveau: 'alerte',
        params: { nom: `${emp.prenom} ${emp.nom}`, moral: emp.moral },
      });
    } else {
      restants.push(emp);
    }
  }
  ent.employes = restants;

  // p) Fin d'exercice fiscal (31 décembre) : DPA, impôts, relevés T4 et RL-1
  if (ctx.mois === 12) {
    const mouvementsAnnee = cumulerMouvements([
      ...ent.archives.filter((a) => a.annee === ctx.annee).map((a) => a.mouvements),
      L.mouvementsMois,
    ]);
    const decl = finExerciceFiscal(ent, ctx.annee, mouvementsAnnee, L);
    messages.push({
      code: societe ? 'declarationsSociete' : 'declarationsPersonnelles',
      niveau: 'info',
      params: {
        annee: ctx.annee,
        impot: societe ? (decl.societe?.total ?? 0) : decl.personnel.total,
        revenu: decl.revenuFiscal,
        feuillets: decl.feuillets.length,
      },
    });
  }

  // q) Suivi des difficultés financières
  if (L.soldes.encaisse < 0) ent.moisEnDefaut += 1;
  else ent.moisEnDefaut = 0;

  // r) Indicateurs du mois
  const resultats = etatResultats(L.mouvementsMois);
  const coutMainOeuvre = versDollars(cSalaires + cVacances + cDirigeant + versCents(cotisations));
  const indicateurs: Indicateurs = {
    potentiel: ctx.potentiel,
    demande: r.demande,
    servies: r.servies,
    perduesCapacite: r.perduesCapacite,
    perduesRupture: r.perduesRupture,
    partMarche: r.part,
    ventesParLigne: r.ventes,
    chiffreAffaires: r.chiffreAffaires,
    ticketMoyen: r.ticketMoyen,
    beneficeNet: resultats.beneficeNet,
    tauxMargeBrute: resultats.tauxMargeBrute,
    tauxMainOeuvre: r.chiffreAffaires > 0 ? coutMainOeuvre / r.chiffreAffaires : 0,
    encaisse: versDollars(L.soldes.encaisse),
    margeCreditUtilisee: versDollars(-L.soldes.margeCredit),
    notoriete: cl.notoriete,
    qualitePercue: cl.qualitePercue,
    service: cl.service,
    satisfaction: cl.satisfaction,
    note: cl.note,
    nbAvis: cl.nbAvis,
    moral:
      ent.employes.length > 0
        ? ent.employes.reduce((a, x) => a + x.moral, 0) / ent.employes.length
        : 0,
    nbEmployes: ent.employes.length,
    heuresOuvertureEffectives: prep.heuresEffectives,
    capacite: prep.capacite,
    utilisation,
    tauxDirecteur: conj.tauxDirecteur,
    tauxPreferentiel: tauxPreferentiel(conj),
    inflation: conj.inflationAnnuelle,
    salaireMinimum: ctx.salaireMinimum,
    indicePrixOffre: ip,
    coutMainOeuvre,
  };

  const archive: MoisArchive = {
    index: ctx.index,
    annee: ctx.annee,
    mois: ctx.mois,
    mouvements: L.mouvementsMois,
    soldesFin: { ...L.soldes },
    flux: L.fluxMois,
    ecritures: L.ecrituresMois,
    portionCouranteDette: ent.prets.reduce((a, p) => a + portionCourante(p), 0),
    indicateurs,
    messages: [],
    concurrents: [],
  };
  const precedente = ent.archives.at(-1);
  archive.messages = [
    ...messages,
    ...ctx.messagesCommuns,
    ...analyserMois(archive, precedente, d, secteur, ent, prep.heuresEffectives),
  ];
  ent.archives.push(archive);
  ouvrirNouveauMois(L);

  // s) Clôture de l'exercice comptable
  if (ctx.mois === 12) {
    const resultatAnnee = cloturerExercice(
      L,
      typeCapitaux(ent.formeJuridique),
      ent.associe?.part ?? 0,
    );
    archive.messages.push({
      code: 'finExercice',
      niveau: 'info',
      params: { annee: ctx.annee, benefice: versDollars(resultatAnnee) },
    });
  }

  // t) Remise à zéro des opérations ponctuelles
  d.apportPonctuel = 0;
  d.remboursementAnticipe = 0;
  d.dividendePonctuel = 0;
  ent.enAttente = { recrutement: 0, indemnites: 0, embauches: 0 };
  return archive.messages;
}

/** Observation publique des joueurs par les concurrents (données du mois précédent). */
function observerJoueurs(etat: EtatPartie, secteur: Secteur): ObservationMarche {
  const actives = etat.entreprises.filter((e) => !e.enFaillite);
  if (actives.length === 0) return { indicePrixJoueurs: 1, qualiteJoueurs: 0.5, partJoueurs: 0 };
  let ip = 0;
  let q = 0;
  let part = 0;
  for (const ent of actives) {
    const derniere = ent.archives.at(-1);
    ip += derniere
      ? derniere.indicateurs.indicePrixOffre
      : indicePrixOffre(ent.decisions.prix, secteur, etat.conjoncture.indicePrix);
    q += ent.clientele.qualitePercue;
    part += derniere ? derniere.indicateurs.partMarche : 0;
  }
  return {
    indicePrixJoueurs: ip / actives.length,
    qualiteJoueurs: q / actives.length,
    partJoueurs: part,
  };
}

/** Révision annuelle du salaire minimum (1er mai), arrondie à 0,05 $. */
function salaireMinimumDuMois(
  actuel: number,
  annee: number,
  mois: number,
): { taux: number; hausse: boolean } {
  if (mois === SALAIRE_MINIMUM.moisRevision && annee > 2026) {
    return {
      taux: Math.round(actuel * (1 + SALAIRE_MINIMUM.hausseAnnuelleSimulee) * 20) / 20,
      hausse: true,
    };
  }
  return { taux: actuel, hausse: false };
}

export function simulerMois(etatInitial: EtatPartie): EtatPartie {
  if (etatInitial.terminee) return etatInitial;
  const etat = structuredClone(etatInitial);
  const rng = new Rng(etat.rngState);
  const index = etat.moisCourant;
  const { annee, mois } = dateDuMois(etat.config, index);
  const secteur = secteurParId(etat.config.secteurId);
  const ville = villeParId(etat.config.villeId);
  const diff = DIFFICULTES[etat.config.difficulte];
  const messagesCommuns: Message[] = [];

  // 1. Conjoncture économique et salaire minimum
  etat.conjoncture = evoluerConjoncture(etat.conjoncture, mois, rng);
  const conj = etat.conjoncture;
  if (conj.derniereVariation !== 0) {
    messagesCommuns.push({
      code: conj.derniereVariation > 0 ? 'tauxDirecteurHausse' : 'tauxDirecteurBaisse',
      niveau: 'info',
      params: { taux: conj.tauxDirecteur, variation: conj.derniereVariation },
    });
  }
  const sm = salaireMinimumDuMois(etat.salaireMinimum, annee, mois);
  if (sm.hausse) {
    etat.salaireMinimum = sm.taux;
    messagesCommuns.push({
      code: 'hausseSalaireMinimum',
      niveau: 'info',
      params: { taux: sm.taux },
    });
  }

  // 2. Potentiel du marché ce mois-ci (saison, confiance des consommateurs, difficulté)
  const potentiel = Math.round(
    (ville.marchePotentielMensuel[secteur.id] ?? 0) *
      secteur.saisonnalite[mois - 1] *
      conj.confiance *
      diff.marche *
      (1 + rng.normal(0, 0.02)),
  );

  // 3. Les concurrents décident (en voyant les prix publics du mois dernier)
  const observation = observerJoueurs(etat, secteur);
  for (const c of etat.concurrents) {
    const perso = personnaliteParId(c.personnaliteId);
    const appliquees = deciderConcurrent(c, perso, observation, index, diff.agressivite, rng);
    for (const r of appliquees) {
      messagesCommuns.push({
        code:
          r.type === 'prix'
            ? 'concurrentPrix'
            : r.type === 'publicite'
              ? 'concurrentPublicite'
              : 'concurrentQualite',
        niveau: 'alerte',
        params: { nom: c.nom, valeur: r.valeur },
      });
    }
    ajusterPrixConcurrent(c, secteur, conj);
  }

  // 4. Début de mois des entreprises (contrôles, obligations), puis marché
  const ctx: ContexteMois = {
    index,
    annee,
    mois,
    secteur,
    ville,
    conj,
    salaireMinimum: etat.salaireMinimum,
    potentiel,
    rng,
    messagesCommuns,
    config: etat.config,
  };
  const actives = etat.entreprises.filter((e) => !e.enFaillite);
  const preparations = new Map<string, Preparation>();
  for (const ent of actives) {
    const debut = debutDeMois(ent, ctx);
    ent.decisions = validerDecisions(
      ent.decisions,
      secteur,
      Math.min(ent.decisions.salaireHoraire, etat.salaireMinimum),
      ent.formeJuridique,
    );
    preparations.set(ent.id, preparerOffre(ent, ctx, debut));
  }
  const offres: Offre[] = [
    ...actives.map((e) => (preparations.get(e.id) as Preparation).offre),
    ...etat.concurrents.filter((c) => c.actif).map(offreConcurrent),
  ];
  const marche = simulerMarche(offres, secteur, potentiel, conj.indicePrix);

  // 5. Résultats des concurrents
  for (const c of etat.concurrents) {
    majConcurrentApresMarche(
      c,
      personnaliteParId(c.personnaliteId),
      marche.resultats[c.id],
      secteur,
      conj,
      potentiel,
      rng,
    );
  }

  // 6. Résultats et comptabilité de chaque entreprise des joueurs
  for (const ent of actives) {
    const prep = preparations.get(ent.id) as Preparation;
    simulerEntreprise(ent, prep, marche.resultats[ent.id] ?? resultatVide(), ctx);
    const archive = ent.archives.at(-1) as MoisArchive;
    archive.concurrents = etat.concurrents.map((c) => ({
      id: c.id,
      part: marche.resultats[c.id]?.part ?? 0,
      prixIndice: c.indicePrixCible,
      note: c.note,
      notoriete: c.notoriete,
    }));
    if (ent.moisEnDefaut >= 3) {
      ent.enFaillite = true;
      archive.messages.push({
        code: estSocieteActions(ent.formeJuridique) ? 'failliteSociete' : 'faillite',
        niveau: 'danger',
      });
    }
  }

  // 7. Fin du mois
  etat.rngState = rng.state;
  etat.moisCourant = index + 1;
  if (etat.entreprises.every((e) => e.enFaillite)) {
    etat.terminee = true;
    etat.raisonFin = 'faillite';
  } else if (etat.moisCourant >= etat.config.dureeMois) {
    etat.terminee = true;
    etat.raisonFin = 'duree';
  }
  return etat;
}

/** Prix de référence actuel d'une ligne (avec l'inflation). Utile pour l'interface. */
export function prixMarche(etat: EtatPartie, ligneId: string): number {
  const secteur = secteurParId(etat.config.secteurId);
  const ligne = parId(secteur.lignes, ligneId);
  return prixReference(ligne, etat.conjoncture.indicePrix);
}

/** Salaire de référence du marché pour le poste principal. */
export function salaireMarche(etat: EtatPartie): number {
  const secteur = secteurParId(etat.config.secteurId);
  const ville = villeParId(etat.config.villeId);
  return (
    posteParId(secteur.postes[0]).salaireMedian * ville.indiceSalaires * etat.conjoncture.indicePrix
  );
}
