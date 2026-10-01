/**
 * Boucle de simulation : création de la partie et simulation d'un mois.
 *
 * `simulerMois` est une fonction pure : elle reçoit un état et retourne un
 * nouvel état, sans rien modifier de l'original. Tout le hasard passe par le
 * générateur à graine (`rngState`), ce qui rend le moteur déterministe.
 */
import { FRAIS_TRAITEMENT_CARTES, SALAIRE_MINIMUM } from '../data/fiscalite';
import { PERSONNALITES, personnaliteParId, posteParId, secteurParId, villeParId } from '../data';
import {
  cloturerExercice,
  creerGrandLivre,
  ecritureSimple,
  ouvrirNouveauMois,
  passerEcriture,
  type CompteId,
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
import {
  creerPret,
  effectuerVersement,
  portionCourante,
  rembourserPartiellement,
  type Pret,
} from './loans';
import {
  evoluerNotoriete,
  indicePrixOffre,
  prixReference,
  simulerMarche,
  type Offre,
  type ResultatOffre,
} from './market';
import { TAUX_VACANCES, cotisationsEmployeur, salaireMensuel } from './payroll';
import { Rng } from './rng';
import { etatResultats } from './statements';
import type {
  ConfigPartie,
  Decisions,
  Difficulte,
  Employe,
  Entreprise,
  EtatPartie,
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
  /** La banque prête au plus 3 $ pour chaque dollar investi par le propriétaire. */
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

const COMPTES_FRAIS_FIXES: Record<keyof FraisFixesMensuels, { compte: CompteId; libelle: string }> =
  {
    electricite: { compte: 'electricite', libelle: 'Électricité et chauffage (Hydro-Québec)' },
    assurances: { compte: 'assurances', libelle: 'Assurances' },
    comptable: { compte: 'honoraires', libelle: 'Honoraires du comptable' },
    entretien: { compte: 'entretien', libelle: 'Entretien et réparations' },
    logiciels: { compte: 'logiciels', libelle: 'Logiciel de caisse et abonnements' },
    telecom: { compte: 'telecom', libelle: 'Téléphone et Internet' },
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

export interface CoutsDemarrage {
  equipement: number;
  amenagement: number;
  depotGarantie: number;
  stockInitial: number;
  fraisDemarrage: number;
  total: number;
}

export function coutsDemarrage(
  params: Pick<ParametresDemarrage, 'emplacementId' | 'equipementId' | 'amenagementId'>,
  secteur: Secteur,
  ville: Ville,
): CoutsDemarrage {
  const equipement = equipementDe(secteur, params.equipementId).cout;
  const amenagement = amenagementDe(secteur, params.amenagementId).cout;
  const depotGarantie =
    loyerMensuelInitial(secteur, emplacementDe(ville, params.emplacementId)) *
    REGLES_FINANCEMENT.moisDepotGarantie;
  const stockInitial = secteur.stockInitial;
  const fraisDemarrage = secteur.fraisDemarrage;
  return {
    equipement,
    amenagement,
    depotGarantie,
    stockInitial,
    fraisDemarrage,
    total: equipement + amenagement + depotGarantie + stockInitial + fraisDemarrage,
  };
}

export function pretMaximum(apport: number): number {
  return Math.max(
    0,
    Math.min(REGLES_FINANCEMENT.pretMax, Math.floor(apport * REGLES_FINANCEMENT.multipleApportMax)),
  );
}

export type ErreurDemarrage =
  'nomVide' | 'apportInsuffisant' | 'pretTropEleve' | 'financementInsuffisant';

export function validerDemarrage(
  params: ParametresDemarrage,
  secteur: Secteur,
  ville: Ville,
): ErreurDemarrage[] {
  const erreurs: ErreurDemarrage[] = [];
  if (params.nomEntreprise.trim().length === 0) erreurs.push('nomVide');
  if (params.apportPersonnel < REGLES_FINANCEMENT.apportMin) erreurs.push('apportInsuffisant');
  if (params.montantPret > pretMaximum(params.apportPersonnel)) erreurs.push('pretTropEleve');
  const couts = coutsDemarrage(params, secteur, ville);
  if (
    params.apportPersonnel + params.montantPret <
    couts.total + REGLES_FINANCEMENT.fondsRoulementMin
  ) {
    erreurs.push('financementInsuffisant');
  }
  return erreurs;
}

export function decisionsParDefaut(secteur: Secteur, salaireMinimum: number): Decisions {
  const prix: Record<string, number> = {};
  for (const ligne of secteur.lignes) prix[ligne.id] = ligne.prixReference;
  const poste = posteParId(secteur.postes[0]);
  return {
    prix,
    qualiteId: 'standard',
    budgetPublicite: 2_500,
    heuresOuverture: secteur.heuresOuvertureReference,
    heuresProprietaire: 50,
    salaireHoraire: Math.max(salaireMinimum, poste.salaireMedian),
    stockJoursCible: secteur.stockCibleJoursDefaut,
    prelevements: 2_000,
    remboursementAutoMarge: true,
    apportPonctuel: 0,
    remboursementAnticipe: 0,
  };
}

/** Borne les décisions dans des limites réalistes (protège le moteur des valeurs absurdes). */
export function validerDecisions(
  d: Decisions,
  secteur: Secteur,
  salaireMinimum: number,
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
  const fini = (x: number, defaut: number) => (Number.isFinite(x) ? x : defaut);
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
    prelevements: Math.round(
      borner(fini(d.prelevements, 0), b.prelevements.min, b.prelevements.max),
    ),
    remboursementAutoMarge: d.remboursementAutoMarge,
    apportPonctuel: Math.round(borner(fini(d.apportPonctuel, 0), 0, 200_000)),
    remboursementAnticipe: Math.round(borner(fini(d.remboursementAnticipe, 0), 0, 1_000_000)),
  };
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
  const emplacement = emplacementDe(ville, params.emplacementId);
  const equipement = equipementDe(secteur, params.equipementId);
  const amenagement = amenagementDe(secteur, params.amenagementId);
  const couts = coutsDemarrage(params, secteur, ville);

  const livre = creerGrandLivre();
  ecritureSimple(
    livre,
    'Mise de fonds du propriétaire',
    'encaisse',
    'capital',
    versCents(params.apportPersonnel),
    'apportsProprietaire',
  );
  const prets: Pret[] = [];
  if (params.montantPret > 0) {
    const taux = tauxPreferentiel(conjoncture) + REGLES_FINANCEMENT.ecartTauxPret;
    const pret = creerPret(
      'pret-demarrage',
      'Prêt de démarrage',
      versCents(params.montantPret),
      taux,
      REGLES_FINANCEMENT.dureePretMois,
    );
    prets.push(pret);
    ecritureSimple(
      livre,
      'Prêt bancaire de démarrage',
      'encaisse',
      'empruntBancaire',
      pret.capitalInitial,
      'empruntsRecus',
    );
  }
  ecritureSimple(
    livre,
    `Achat : ${equipement.nom}`,
    'equipement',
    'encaisse',
    versCents(couts.equipement),
    'acquisitionImmobilisations',
  );
  ecritureSimple(
    livre,
    `Travaux : ${amenagement.nom}`,
    'ameliorationsLocatives',
    'encaisse',
    versCents(couts.amenagement),
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
  ecritureSimple(
    livre,
    'Stock initial de marchandises',
    'stocks',
    'encaisse',
    versCents(couts.stockInitial),
    'achatStockInitial',
  );
  ecritureSimple(
    livre,
    'Frais de démarrage (permis, enseigne, inauguration)',
    'fraisDemarrage',
    'encaisse',
    versCents(couts.fraisDemarrage),
    'fraisDemarrage',
  );

  const poste = posteParId(secteur.postes[0]);
  const employes = [1, 2, 3].map((i) => genererEmploye(i, poste, poste.heuresSemaineDefaut, rng));
  const qualite = qualiteDe(secteur, 'standard');

  const entreprise: Entreprise = {
    id: 'joueur-1',
    nom: params.nomEntreprise.trim(),
    proprietaire: params.nomProprietaire.trim() || 'Propriétaire',
    couleur: params.couleur,
    formeJuridique: 'individuelle',
    emplacementId: emplacement.id,
    equipementId: equipement.id,
    amenagementId: amenagement.id,
    decisions: decisionsParDefaut(secteur, salaireMinimum),
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
    prets,
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
  };

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

export function modifierDecisions(
  etat: EtatPartie,
  entrepriseId: string,
  changements: Partial<Decisions>,
): EtatPartie {
  const e = structuredClone(etat);
  const ent = trouverEntreprise(e, entrepriseId);
  const secteur = secteurParId(e.config.secteurId);
  ent.decisions = validerDecisions({ ...ent.decisions, ...changements }, secteur, e.salaireMinimum);
  return e;
}

export function embaucher(
  etat: EtatPartie,
  entrepriseId: string,
  heuresSemaine?: number,
): EtatPartie {
  const e = structuredClone(etat);
  const ent = trouverEntreprise(e, entrepriseId);
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
  return e;
}

/** Fin d'emploi : l'employé part tout de suite et reçoit une indemnité tenant lieu de préavis. */
export function congedier(etat: EtatPartie, entrepriseId: string, employeId: string): EtatPartie {
  const e = structuredClone(etat);
  const ent = trouverEntreprise(e, entrepriseId);
  const employe = parId(ent.employes, employeId);
  const semaines = semainesPreavis(employe.moisAnciennete);
  ent.enAttente.indemnites +=
    Math.round(semaines * employe.heuresSemaine * ent.decisions.salaireHoraire * 100) / 100;
  ent.employes = ent.employes.filter((x) => x.id !== employeId);
  return e;
}

export function modifierHeuresEmploye(
  etat: EtatPartie,
  entrepriseId: string,
  employeId: string,
  heures: number,
): EtatPartie {
  const e = structuredClone(etat);
  const employe = parId(trouverEntreprise(e, entrepriseId).employes, employeId);
  employe.heuresSemaine = Math.round(
    borner(heures, BORNES_DECISIONS.heuresEmploye.min, BORNES_DECISIONS.heuresEmploye.max),
  );
  return e;
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
}

interface Preparation {
  offre: Offre;
  capacite: number;
  heuresPersonnel: number;
  heuresEffectives: number;
}

function preparerOffre(ent: Entreprise, ctx: ContexteMois): Preparation {
  const d = ent.decisions;
  const emplacement = emplacementDe(ctx.ville, ent.emplacementId);
  const amenagement = amenagementDe(ctx.secteur, ent.amenagementId);
  const heuresEmployes = ent.employes.reduce((a, x) => a + x.heuresSemaine, 0);
  const heuresPersonnel = heuresEmployes + d.heuresProprietaire;
  // Il faut au moins une personne sur place pour ouvrir.
  const heuresEffectives = Math.min(d.heuresOuverture, heuresPersonnel);
  const heuresProductives =
    ent.employes.reduce((a, x) => a + x.heuresSemaine * x.competence * facteurMoral(x.moral), 0) +
    d.heuresProprietaire;
  const capacite = Math.floor(
    heuresProductives * SEMAINES_PAR_MOIS * ctx.secteur.transactionsParHeureEmploye,
  );
  return {
    capacite,
    heuresPersonnel,
    heuresEffectives,
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

function simulerEntreprise(
  ent: Entreprise,
  prep: Preparation,
  r: ResultatOffre,
  ctx: ContexteMois,
): Message[] {
  const L = ent.livre;
  const d = ent.decisions;
  const { secteur, ville, conj, rng } = ctx;
  const messages: Message[] = [];

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
      'Apport additionnel du propriétaire',
      'encaisse',
      'capital',
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

  // b) Paiement des fournisseurs du mois dernier (conditions net 30) et remises gouvernementales
  ecritureSimple(
    L,
    'Paiement des fournisseurs (achats du mois précédent)',
    'comptesFournisseurs',
    'encaisse',
    -L.soldes.comptesFournisseurs,
    'paiementsFournisseurs',
  );
  ecritureSimple(
    L,
    'Remise des cotisations du mois précédent (Revenu Québec et ARC)',
    'cotisationsAPayer',
    'encaisse',
    -L.soldes.cotisationsAPayer,
    'remisesGouvernementales',
  );

  // c) Ventes et frais de cartes
  ecritureSimple(
    L,
    'Ventes du mois',
    'encaisse',
    'ventes',
    versCents(r.chiffreAffaires),
    'encaissementsClients',
  );
  ecritureSimple(
    L,
    'Frais de traitement des cartes de débit et de crédit',
    'fraisCartes',
    'encaisse',
    versCents(r.chiffreAffaires * PART_VENTES_CARTES * FRAIS_TRAITEMENT_CARTES.taux),
    'fraisBancaires',
  );

  // d) Coût des ventes et réapprovisionnement
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
  ecritureSimple(
    L,
    'Achats de marchandises (payables dans 30 jours)',
    'stocks',
    'comptesFournisseurs',
    versCents(reappro.achats),
  );
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

  // e) Paie
  const masseAnnuelle =
    ent.employes.reduce((a, x) => a + salaireMensuel(d.salaireHoraire, x.heuresSemaine), 0) * 12;
  let salaires = 0;
  let vacances = 0;
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
    emp.cumulBrutAnnee += brut + vac;
    salaires += brut;
    vacances += vac;
    cotisations += c.total;
  }
  salaires += ent.enAttente.indemnites;
  if (ent.enAttente.indemnites > 0) {
    messages.push({
      code: 'indemnitesPreavis',
      niveau: 'info',
      params: { montant: ent.enAttente.indemnites },
    });
  }
  const cSalaires = versCents(salaires);
  const cVacances = versCents(vacances);
  passerEcriture(L, {
    libelle: 'Paie du mois (salaires et indemnités de vacances)',
    flux: 'salairesVerses',
    lignes: [
      { compte: 'salaires', debit: cSalaires },
      { compte: 'vacances', debit: cVacances },
      { compte: 'encaisse', credit: cSalaires + cVacances },
    ],
  });
  ecritureSimple(
    L,
    'Cotisations de l’employeur (RRQ, RQAP, AE, FSS, CNT, CNESST)',
    'chargesSociales',
    'cotisationsAPayer',
    versCents(cotisations),
  );

  // f) Loyer (indexé à chaque anniversaire du bail) et frais fixes
  if (ctx.index > 0 && ctx.index % 12 === 0) {
    ent.bail.loyerMensuel = Math.round(ent.bail.loyerMensuel * (1 + ent.bail.indexation));
    messages.push({
      code: 'indexationLoyer',
      niveau: 'info',
      params: { loyer: versDollars(ent.bail.loyerMensuel), taux: ent.bail.indexation },
    });
  }
  ecritureSimple(
    L,
    'Loyer et frais communs',
    'loyer',
    'encaisse',
    ent.bail.loyerMensuel,
    'loyerEtFrais',
  );
  for (const [cle, montant] of Object.entries(secteur.fraisFixesMensuels) as [
    keyof FraisFixesMensuels,
    number,
  ][]) {
    const { compte, libelle } = COMPTES_FRAIS_FIXES[cle];
    ecritureSimple(
      L,
      libelle,
      compte,
      'encaisse',
      versCents(montant * conj.indicePrix),
      'loyerEtFrais',
    );
  }

  // g) Publicité et recrutement
  ecritureSimple(
    L,
    'Publicité',
    'publicite',
    'encaisse',
    versCents(d.budgetPublicite),
    'publicite',
  );
  ecritureSimple(
    L,
    'Affichage de postes et intégration des nouveaux employés',
    'recrutement',
    'encaisse',
    versCents(ent.enAttente.recrutement),
    'publicite',
  );

  // h) Emprunts et marge de crédit
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

  // i) Amortissement (linéaire, sur la durée de vie ou la durée du bail)
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

  // j) Prélèvements du propriétaire
  ecritureSimple(
    L,
    'Prélèvements du propriétaire',
    'prelevements',
    'encaisse',
    versCents(d.prelevements),
    'prelevementsProprietaire',
  );

  // k) Marge de crédit automatique
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
    if (remb > 0) {
      ecritureSimple(
        L,
        'Remboursement de la marge de crédit',
        'margeCredit',
        'encaisse',
        remb,
        'margeCredit',
      );
    }
  }

  // l) Clientèle : qualité perçue, service, satisfaction, avis et notoriété
  const equipement = equipementDe(secteur, ent.equipementId);
  const amenagement = amenagementDe(secteur, ent.amenagementId);
  const emplacement = emplacementDe(ville, ent.emplacementId);
  const cl = ent.clientele;
  const utilisation = prep.capacite > 0 ? r.demande / prep.capacite : r.demande > 0 ? 2 : 0;
  const ip = indicePrixOffre(d.prix, secteur, conj.indicePrix);
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
    ip,
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

  // m) Ressources humaines : moral, ancienneté et démissions
  const poste = posteParId(secteur.postes[0]);
  const salaireMarche = poste.salaireMedian * ville.indiceSalaires * conj.indicePrix;
  const restants: Employe[] = [];
  for (const emp of ent.employes) {
    emp.moral = evoluerMoral(
      emp,
      moralCible(d.salaireHoraire, salaireMarche, utilisation, emp.heuresSemaine),
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

  // n) Suivi des difficultés financières
  if (L.soldes.encaisse < 0) ent.moisEnDefaut += 1;
  else ent.moisEnDefaut = 0;

  // o) Indicateurs du mois
  const resultats = etatResultats(L.mouvementsMois);
  const coutMainOeuvre = versDollars(cSalaires + cVacances + versCents(cotisations));
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

  // p) Fin de l'exercice financier (31 décembre)
  if (ctx.mois === 12) {
    const resultatAnnee = cloturerExercice(L);
    archive.messages.push({
      code: 'finExercice',
      niveau: 'info',
      params: { annee: ctx.annee, benefice: versDollars(resultatAnnee) },
    });
  }

  // q) Remise à zéro des opérations ponctuelles
  d.apportPonctuel = 0;
  d.remboursementAnticipe = 0;
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
    const taux = Math.round(actuel * (1 + SALAIRE_MINIMUM.hausseAnnuelleSimulee) * 20) / 20;
    return { taux, hausse: true };
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

  // 4. Marché : chaque commerce reçoit sa part de la demande
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
  };
  const actives = etat.entreprises.filter((e) => !e.enFaillite);
  const preparations = new Map<string, Preparation>();
  for (const ent of actives) {
    ent.decisions = validerDecisions(
      ent.decisions,
      secteur,
      Math.min(ent.decisions.salaireHoraire, etat.salaireMinimum),
    );
    preparations.set(ent.id, preparerOffre(ent, ctx));
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
      archive.messages.push({ code: 'faillite', niveau: 'danger' });
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
