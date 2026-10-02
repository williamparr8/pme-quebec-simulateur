/**
 * Boucle de simulation : simulation d'un mois.
 *
 * `simulerMois` est une fonction pure : elle reçoit un état et retourne un
 * nouvel état, sans rien modifier de l'original. Tout le hasard passe par le
 * générateur à graine (`rngState`), ce qui rend le moteur déterministe.
 *
 * La création de la partie est dans creation.ts et les actions du joueur dans
 * actions.ts; ce module les réexporte pour l'interface.
 */
import {
  FRAIS_TRAITEMENT_CARTES,
  INTERETS_FISCAUX,
  SALAIRE_MINIMUM,
  TAXES_VENTE,
} from '../data/fiscalite';
import {
  DILEMMES,
  FORMATIONS,
  INITIATIVES_ECO,
  PARAMETRES_MARKETING,
  dilemmeParId,
  fournisseurParId,
  personaParId,
  personnaliteParId,
  plateformeParId,
  posteParId,
  secteurParId,
  traitParId,
  villeParId,
} from '../data';
import {
  cloturerExercice,
  convertirEnCapitalActions,
  ecritureSimple,
  ouvrirNouveauMois,
  passerEcriture,
  type CompteId,
} from './accounting';
import {
  contexteEffets,
  majAnnuelleExigee,
  reglerCreanceClient,
  valorisationEnCours,
} from './actions';
import {
  ajusterPrixConcurrent,
  deciderConcurrent,
  evoluerStatutsConcurrents,
  majConcurrentApresMarche,
  offreConcurrent,
  type ObservationMarche,
} from './ai-competitors';
import { analyserMois } from './analyse';
import { finExerciceFiscal } from './annuel';
import {
  FRAIS_COURSIER,
  PONCTUALITE,
  RISQUE_DEFAUT,
  genererAppels,
  moisEcheance,
  resoudreSoumissions,
} from './b2b';
import {
  IDS_DEMARCHES,
  coutDemarche,
  demarche,
  estObligatoire,
  estSocieteActions,
  fraisComptablesForme,
  fraisImmatriculation,
  fraisMiseAJourAnnuelle,
} from './conformite';
import {
  DIFFICULTES,
  REGLES_FINANCEMENT,
  amenagementDe,
  coutUnitaireLigne,
  dateDuMois,
  emplacementDe,
  equipementDe,
  facteurMarcheEquipes,
  politiqueParDefaut,
  qualiteDe,
  typeCapitaux,
  validerDecisions,
} from './creation';
import { resumeDecisions } from './bilan';
import {
  bonusCapaciteGestion,
  bonusConversionMarketing,
  bonusMoralRh,
  facteurFraisComptables,
  facteurRisqueFiscal,
  progresserCompetences,
} from './competences';
import { noteCible, noteDuMois, nouvelleNote, satisfactionClients } from './customers';
import type { FraisFixesMensuels, LigneProduit, Secteur, Ville } from './data-types';
import {
  chomageVille,
  evoluerConjoncture,
  facteurConjoncture,
  sensibilitePrixConjoncture,
  tauxPreferentiel,
  type Conjoncture,
} from './economy';
import { acheterMarchandises, payer, solderComptes } from './ecritures';
import {
  appliquerEffets,
  modificateur,
  montantEffets,
  tirerDilemme,
  vieillirModificateurs,
} from './events';
import {
  JOURS_FERIES_PAR_MOIS,
  conformeHygiene,
  effetsAvantages,
  evoluerMoral,
  facteurIntegration,
  facteurMoral,
  genererCandidat,
  indemniteJourFerie,
  moralCible,
  nombreCandidats,
  penurieDuMois,
  probabiliteDepart,
  progressionCompetence,
  salaireMarchePoste,
  tauxAbsenteisme,
  tauxVacances,
} from './hr';
import {
  COMPTES_IMMOBILISATIONS,
  amortirImmobilisations,
  effetsInvestissements,
  fraisInvestissements,
  usureEquipement,
  type EffetsCumules,
} from './immobilisations';
import {
  politiqueRecommandee,
  simulerStockLigne,
  stockVide,
  unitesEnStock,
  valeurStock,
  type ResultatStockLigne,
} from './inventory';
import {
  ajusterTauxVariable,
  effectuerVersement,
  portionCourante,
  rembourserPartiellement,
} from './loans';
import {
  evoluerNotoriete,
  facteurTaxesSecteur,
  indicePrixClient,
  indicePrixOffre,
  ligneTaxable,
  prixReference,
  simulerMarche,
  type Offre,
  type ResultatOffre,
  type SegmentMarche,
} from './market';
import {
  combinerGains,
  effetsPubliciteDuMois,
  evoluerAdhesion,
  evoluerImage,
  imageCible,
  malusFatiguePromo,
  netPromoterScore,
  notorieteMoyenne,
  planifierEffetsPublicite,
  promotionsRecentes,
  retentionClients,
  scoreEco,
  scoreLocal,
  segmentsMarche,
  totalPublicite,
  valeurVieClient,
} from './marketing';
import { cotisationsEmployeur, salaireMensuel } from './payroll';
import {
  bonusGamme,
  lignesOffre,
  lignesStock,
  produitB2BActif,
  resoudreLancements,
} from './produits';
import { Rng } from './rng';
import { cumulerMouvements, etatResultats } from './statements';
import { depasseSeuilPetitFournisseur, retenuesEmploye, taxesSur } from './tax';
import type {
  ConfigPartie,
  CumulPaie,
  Entreprise,
  EtatPartie,
  FrequenceTaxes,
  Indicateurs,
  Message,
  MoisArchive,
  StockLigneMois,
} from './types';
import { SEMAINES_PAR_MOIS, borner, lisser, versCents, versDollars } from './util';

export * from './creation';
export * from './actions';
export { conformeHygiene } from './hr';
export * from './bilan';
export * from './competences';
export * from './conseiller';
export * from './dialogues';
export * from './quiz';
export * from './scenarios';

// ---------------------------------------------------------------------------
// Règles
// ---------------------------------------------------------------------------

/** Proportion des ventes en magasin payées par carte (débit ou crédit). */
const PART_VENTES_CARTES = 0.85;
/** Revenu total médian des ménages au Québec en 2020 (Recensement 2021). */
const REVENU_MEDIAN_QUEBEC = 72_500;
/** Proportion des clients servis qui laissent un avis en ligne. */
const TAUX_AVIS = 0.008;
/** Probabilité mensuelle qu'un défaut d'inscription aux taxes soit découvert. */
const DETECTION_TAXES = 0.15;
/** Pénalité sur les taxes non perçues lors d'un avis de cotisation. */
const PENALITE_TAXES = 0.15;
/** Mois limite (fin juin) pour la déclaration de mise à jour annuelle du REQ. */
const MOIS_LIMITE_MAJ_REQ = 6;
/** Inspection du MAPAQ sans personne formée en hygiène : probabilité mensuelle et amende. */
const RISQUE_HYGIENE = 0.025;
const AMENDE_HYGIENE = 1500;
/** Escompte de paiement rapide (2/10 net 30). */
const TAUX_ESCOMPTE = 0.02;

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
// Contexte du mois
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
  segments: SegmentMarche[];
  etat: EtatPartie;
  /** Taux de chômage de la région ce mois-ci. */
  chomage: number;
}

interface Preparation {
  offre: Offre;
  capacite: number;
  /** Minutes de production disponibles ce mois-ci. */
  minutesProduction: number;
  sansProducteur: boolean;
  heuresPersonnel: number;
  heuresEffectives: number;
  heuresProprietaire: number;
  qualiteLignes: Record<string, number>;
  qualiteGlobale: number;
  coutLignes: Record<string, number>;
  effets: EffetsCumules;
  competenceMoyenne: number;
  moralPondere: number;
  bonusService: number;
  ambiance: number;
  eco: number;
  local: number;
  bonusConversion: number;
  promotionsRecentes: number;
  messages: Message[];
}

function nouvelId(ent: Entreprise, prefixe: string): string {
  ent.prochainId += 1;
  return `${prefixe}-${ent.prochainId}`;
}

/** Heures hebdomadaires d'un poste précis dans l'équipe. */
function heuresPoste(ent: Entreprise, role: string): number {
  return ent.employes
    .filter((e) => posteParId(e.posteId).role === role)
    .reduce((a, e) => a + e.heuresSemaine, 0);
}

// ---------------------------------------------------------------------------
// Début du mois
// ---------------------------------------------------------------------------

/**
 * Début du mois : changements de forme juridique, dilemmes non tranchés, risques qui
 * se concrétisent, contrôles des organismes, lancements de produits, résultat des
 * soumissions et obligations annuelles.
 */
function debutDeMois(ent: Entreprise, ctx: ContexteMois): Message[] {
  const L = ent.livre;
  const f = ent.fiscal;
  const m: Message[] = [];
  const { rng, secteur } = ctx;
  ent.joursFermeture = ent.effetsMois.joursFermeture ?? 0;

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
    ent.finance.actionnaires = [{ nom: ent.proprietaire, part: 1, type: 'fondateur' }];
    ent.decisions = {
      ...ent.decisions,
      prelevements: 0,
      salaireDirigeant: ent.decisions.prelevements,
    };
    m.push({ code: 'incorporationEffectuee', niveau: 'succes', params: { forme: nouvelle } });
  }

  // Dilemmes non tranchés : le choix par défaut s'applique (ne rien décider est un choix).
  for (const d of ent.dilemmes) {
    const def = dilemmeParId(d.defId);
    const choix = def.choix.find((c) => c.id === def.choixParDefaut) ?? def.choix[0];
    const c = contexteEffets(ent, d.employeId, ctx.index, rng, { etat: ctx.etat, dilemme: d });
    appliquerEffets(choix.effets, c);
    m.push(...c.messages);
    m.push({
      code: 'dilemmeNonTranche',
      niveau: 'alerte',
      params: { titre: def.titre, choix: choix.libelle },
    });
  }
  ent.dilemmes = [];

  // Risques différés (plaintes) : se concrétisent ou non.
  const echus = ent.risques.filter((r) => r.echeance <= ctx.index);
  ent.risques = ent.risques.filter((r) => r.echeance > ctx.index);
  for (const r of echus) {
    if (!rng.chance(r.probabilite)) continue;
    const montant = montantEffets(r.effets, ent.employes.length);
    const c = contexteEffets(ent, null, ctx.index, rng, { etat: ctx.etat });
    appliquerEffets(r.effets, c);
    m.push(...c.messages);
    m.push({ code: r.code, niveau: 'danger', params: { montant } });
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
    if (id === 'mapaq') ent.rh.gestionnaireHygiene = true;
    ent.joursFermeture = Math.max(ent.joursFermeture, d.joursFermeture);
    m.push({
      code: 'demarcheDecouverte',
      niveau: 'danger',
      params: { nom: d.nom, organisme: d.organisme, amende: d.amende, jours: d.joursFermeture },
    });
  }

  // Hygiène et salubrité : une inspection peut constater l'absence de personne formée.
  if (secteur.alimentation && !conformeHygiene(ent) && rng.chance(RISQUE_HYGIENE)) {
    ecritureSimple(
      L,
      'Constat d’infraction du MAPAQ (hygiène et salubrité)',
      'amendes',
      'encaisse',
      versCents(AMENDE_HYGIENE),
      'droitsEtAmendes',
    );
    payer(
      L,
      ent,
      'Formation obligatoire de gestionnaire en hygiène',
      'formation',
      220,
      true,
      'formationAvantages',
    );
    ent.rh.gestionnaireHygiene = true;
    m.push({ code: 'infractionHygiene', niveau: 'danger', params: { amende: AMENDE_HYGIENE } });
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
    const commis = heuresPoste(ent, 'administration') >= 5;
    if (commis && ctx.mois >= 3) {
      // Le commis comptable produit la déclaration à temps.
      f.majAnnuelles.push(ctx.annee);
      ecritureSimple(
        L,
        `Déclaration de mise à jour annuelle ${ctx.annee} (REQ)`,
        'droitsPermis',
        'encaisse',
        versCents(fraisMiseAJourAnnuelle(ent.formeJuridique)),
        'droitsEtAmendes',
      );
      m.push({ code: 'majAnnuelleAuto', niveau: 'info', params: { annee: ctx.annee } });
    } else if (ctx.mois === MOIS_LIMITE_MAJ_REQ + 1) {
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

  // Pertes récurrentes (vol dans la caisse).
  for (const p of ent.effetsMois.pertesRecurrentes) {
    ecritureSimple(L, p.libelle, 'sinistres', 'encaisse', versCents(p.montant), 'droitsEtAmendes');
    p.moisRestants -= 1;
  }
  // Revenus récurrents (ex. location d'une chaise à un travailleur autonome).
  for (const p of ent.effetsMois.revenusRecurrents ?? []) {
    ecritureSimple(
      L,
      p.libelle,
      'encaisse',
      'autresRevenus',
      versCents(p.montant),
      'autresEncaissements',
    );
    p.moisRestants -= 1;
  }

  // Nouveaux produits : fin du développement.
  m.push(
    ...resoudreLancements(
      ent,
      secteur,
      ctx.index,
      qualiteDe(secteur, ent.decisions.qualiteId).score,
      rng,
    ),
  );

  // Ventes aux entreprises : résultat des soumissions.
  const gagnes = resoudreSoumissions(ent, () => nouvelId(ent, 'contrat'), rng);
  ent.b2b.contrats.push(...gagnes);
  for (const r of ent.b2b.resultats)
    m.push({
      code: r.gagne ? 'soumissionGagnee' : 'soumissionPerdue',
      niveau: r.gagne ? 'succes' : 'info',
      params: { client: r.client, prix: r.prix },
    });

  // Salaire minimum et absentéisme du mois.
  let ajuste = false;
  for (const e of ent.employes) {
    if (e.salaireHoraire < ctx.salaireMinimum) {
      e.salaireHoraire = ctx.salaireMinimum;
      ajuste = true;
    }
    e.absenteisme = Math.round(tauxAbsenteisme(e.moral, traitParId(e.trait)) * 1000) / 1000;
  }
  if (ajuste)
    m.push({
      code: 'salaireAjusteMinimum',
      niveau: 'info',
      params: { salaire: ctx.salaireMinimum },
    });
  return m;
}

// ---------------------------------------------------------------------------
// Offre de l'entreprise
// ---------------------------------------------------------------------------

/** Bonus de qualité d'une ligne grâce aux employés formés (+0,02 par employé, max +0,04 par formation). */
function bonusFormations(ent: Entreprise, ligne: LigneProduit): number {
  let bonus = 0;
  for (const f of FORMATIONS) {
    const q = f.qualite;
    if (!q) continue;
    const vise =
      (q.categories?.includes(ligne.categorieAppro) ?? false) ||
      (q.lignes?.includes(ligne.id) ?? false) ||
      (q.production === true && ligne.production);
    if (!vise) continue;
    const formes = ent.employes.filter((e) => e.formations.includes(f.id)).length;
    bonus += Math.min(0.04, 0.02 * formes);
  }
  return bonus;
}

/** Minutes de production nécessaires pour une unité d'une ligne. */
export function minutesLigne(ligne: LigneProduit, secteur: Secteur): number {
  return ligne.production ? (ligne.minutesProduction ?? secteur.minutesProductionDefaut) : 0;
}

function preparerOffre(ent: Entreprise, ctx: ContexteMois, messages: Message[]): Preparation {
  const d = ent.decisions;
  const { secteur, conj } = ctx;
  const emplacement = emplacementDe(ctx.ville, ent.emplacementId);
  const amenagement = amenagementDe(secteur, ent.amenagementId);
  const equipement = equipementDe(secteur, ent.equipementId);
  const qualite = qualiteDe(secteur, d.qualiteId);
  const effets = effetsInvestissements(ent, secteur);
  const ouvert = 1 - borner(ent.joursFermeture / 30, 0, 1);
  const facteurMois = ent.effetsMois.capacite * modificateur(ent, 'capacite');
  const gerant = heuresPoste(ent, 'gestion') > 0;
  const capaciteAvantages =
    ent.employes.length > 0
      ? ent.employes.reduce(
          (a, e) => a + effetsAvantages(d.avantages, e.heuresSemaine).capacite,
          0,
        ) / ent.employes.length
      : 0;

  // Le temps passé à répondre aux avis est pris sur les heures du propriétaire.
  const heuresProprietaire = Math.max(
    0,
    d.heuresProprietaire +
      ent.effetsMois.heuresProprietaire -
      (d.reponseAvis === 'ignorer' ? 0 : 1),
  );
  // Dans certains secteurs, le propriétaire produit lui-même (coiffeur, ébéniste, paysagiste).
  const partProduction = secteur.productionProprietaire;
  let service = heuresProprietaire * (1 - partProduction);
  let production = 0;
  let heuresService = heuresProprietaire;
  let producteurs = 0;
  for (const e of ent.employes) {
    const poste = posteParId(e.posteId);
    const h = e.heuresSemaine * (1 - e.absenteisme);
    const prod = h * e.competence * facteurMoral(e.moral) * facteurIntegration(e.moisAnciennete);
    service += prod * poste.productiviteService;
    production += prod * poste.productiviteProduction;
    if (poste.productiviteService >= 0.25) heuresService += e.heuresSemaine;
    if (poste.role === 'production' && poste.productiviteProduction > 0) producteurs += 1;
  }
  const sansProducteur = producteurs === 0;
  // Sans employé de production, l'équipe de service dépanne un peu (ex. sandwichs au comptoir).
  if (sansProducteur) production += service * secteur.productionSansPersonnel;
  production += heuresProprietaire * partProduction;
  const multiplicateur =
    ouvert *
    facteurMois *
    (1 +
      effets.capaciteService +
      capaciteAvantages +
      (gerant ? 0.04 : 0) +
      bonusCapaciteGestion(ent));
  const capacite = Math.floor(
    service * SEMAINES_PAR_MOIS * secteur.transactionsParHeureEmploye * multiplicateur,
  );
  const minutesProduction = Math.floor(
    production *
      SEMAINES_PAR_MOIS *
      60 *
      ouvert *
      facteurMois *
      (1 + effets.capaciteProduction + (equipement.bonusProduction ?? 0) + (gerant ? 0.02 : 0)),
  );
  const heuresPersonnel =
    ent.employes.reduce((a, x) => a + x.heuresSemaine, 0) + heuresProprietaire;
  const heuresEffectives = Math.min(d.heuresOuverture, heuresService);

  // Qualité et coût de chaque ligne (qualité choisie, fournisseur, formation, investissements).
  const proprietaireProduit = secteur.productionProprietaire >= 0.5 && heuresProprietaire > 0;
  const qualiteLignes: Record<string, number> = {};
  const coutLignes: Record<string, number> = {};
  const facteurCouts = modificateur(ent, 'couts');
  for (const ligne of lignesStock(ent, secteur)) {
    const politique = d.approvisionnement[ligne.id];
    const fournisseurId =
      politique?.fournisseurId ?? secteur.fournisseursDefaut[ligne.categorieAppro];
    const f = fournisseurParId(fournisseurId);
    let q =
      qualite.score +
      equipement.bonusQualite +
      f.bonusQualite +
      (effets.qualiteLignes[ligne.id] ?? 0) +
      bonusFormations(ent, ligne);
    if (ligne.production && sansProducteur && !proprietaireProduit) q -= 0.06;
    qualiteLignes[ligne.id] = borner(q, 0.05, 1);
    coutLignes[ligne.id] = coutUnitaireLigne(
      ligne,
      fournisseurId,
      qualite,
      conj,
      (effets.coutLignes[ligne.id] ?? 1) * facteurCouts,
    );
  }
  let poids = 0;
  let somme = 0;
  for (const ligne of secteur.lignes) {
    const w = ligne.tauxAchat * ligne.prixReference;
    poids += w;
    somme += w * (qualiteLignes[ligne.id] ?? qualite.score);
  }
  const qualiteGlobale = poids > 0 ? somme / poids : qualite.score;

  // Moral et compétence de l'équipe (pondérés par les heures).
  const heuresTotales = heuresPersonnel;
  const moralPondere =
    heuresTotales > 0
      ? (ent.employes.reduce((a, x) => a + x.moral * x.heuresSemaine, 0) +
          80 * heuresProprietaire) /
        heuresTotales
      : 50;
  const competenceMoyenne =
    heuresTotales > 0
      ? (ent.employes.reduce((a, x) => a + x.competence * x.heuresSemaine, 0) +
          1.1 * heuresProprietaire) /
        heuresTotales
      : 0.8;
  const bonusService = Math.min(
    0.06,
    ent.employes.reduce((a, e) => a + traitParId(e.trait).service, 0) +
      (d.satisfactionGarantie ? 0.01 : 0),
  );

  // Positionnement et marketing.
  const ambiance = Math.min(0.95, amenagement.ambiance + effets.ambiance);
  const eco = scoreEco(d, effets.eco);
  const local = scoreLocal(d, secteur);
  const recentes = promotionsRecentes(ent.marketing, ctx.index);
  const prix: Record<string, number> = {};
  for (const [k, v] of Object.entries(d.prix))
    prix[k] = Math.round(v * (1 - d.promotion) * 100) / 100;
  const bonusSegments: Record<string, number> = {};
  const fidelite = PARAMETRES_MARKETING.fidelite;
  for (const seg of ctx.segments) {
    const p = personaParId(seg.id);
    bonusSegments[seg.id] =
      effets.commandeEnLigne * p.numerique +
      secteur.sensibilites.prix *
        p.sensibilites.prix *
        ent.marketing.adhesionFidelite *
        fidelite.rabais;
  }
  const ete = ctx.mois >= 5 && ctx.mois <= 9;
  const heuresMarketing = heuresPoste(ent, 'marketing');

  return {
    capacite,
    minutesProduction,
    sansProducteur,
    heuresPersonnel,
    heuresEffectives,
    heuresProprietaire,
    qualiteLignes,
    qualiteGlobale,
    coutLignes,
    effets,
    competenceMoyenne,
    moralPondere,
    bonusService,
    ambiance,
    eco,
    local,
    bonusConversion: Math.max(
      -0.05,
      0.25 * Math.min(1, heuresMarketing / 15) + bonusConversionMarketing(ent),
    ),
    promotionsRecentes: recentes,
    messages,
    offre: {
      id: ent.id,
      prix,
      qualite: ent.clientele.qualitePercue,
      service: ent.clientele.service,
      ambiance,
      notoriete: ent.clientele.notoriete,
      notorieteSegments: ent.marketing.notorieteSegments,
      note: ent.clientele.note,
      heuresOuverture: heuresEffectives,
      capaciteVisites: capacite,
      // L'achalandage compte beaucoup pour une boutique, presque pas pour un paysagiste.
      bonusEmplacement: secteur.importanceEmplacement * Math.log(emplacement.achalandage),
      facteurPrixClient: ent.fiscal.inscritTaxes ? facteurTaxesSecteur(secteur) : 1,
      eco,
      local,
      livraison: d.livraison,
      lignes: lignesOffre(ent, secteur, (id) => qualiteLignes[id] ?? qualite.score),
      bonusUtilite:
        bonusGamme(ent, secteur) +
        (d.promotion > 0 ? 0 : malusFatiguePromo(recentes)) -
        2 * ent.marketing.tauxRupturePercu,
      bonusSegments,
      image: ent.marketing.image,
      // Les membres du programme de fidélité viennent environ 25 % plus souvent.
      facteurDemande:
        (1 + (ete ? effets.demandeEte : 0)) *
        (1 + 0.25 * ent.marketing.adhesionFidelite) *
        modificateur(ent, 'demande'),
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
    parSegment: {},
    ventesLivraison: [],
    chiffreAffairesLivraison: 0,
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

// ---------------------------------------------------------------------------
// Simulation d'une entreprise
// ---------------------------------------------------------------------------

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
  const prime = tauxPreferentiel(conj);

  // Nouvelle année : les cumuls de salaire pour les plafonds de cotisation repartent à zéro.
  if (ctx.mois === 1) for (const emp of ent.employes) emp.cumulBrutAnnee = 0;

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
      `Remboursement anticipé – ${pretPrincipal.nom}`,
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

  // e) Prêts à taux variable : le taux suit le taux préférentiel
  if (ent.prets.some((p) => ajusterTauxVariable(p, prime)))
    messages.push({ code: 'tauxVariableAjuste', niveau: 'info', params: { prime } });

  // f) Approvisionnement, production et ventes réelles (au jour le jour)
  const lignes = lignesStock(ent, secteur);
  const demandeMarche = new Map(r.ventes.map((v) => [v.ligneId, v.unites]));
  const demandeLivraison = new Map(r.ventesLivraison.map((v) => [v.ligneId, v.unites]));
  const produitB2B = produitB2BActif(ent, secteur);
  const idB2B = produitB2B?.id ?? null;
  if (!produitB2B) ent.b2b.contrats = [];
  const demandeB2B = ent.b2b.contrats.reduce((a, c) => a + c.quantiteParMois, 0);
  const demandeLigne = (id: string) =>
    (demandeMarche.get(id) ?? 0) + (id === idB2B ? demandeB2B : 0);
  // Capacité de production (minutes) partagée entre les lignes produites sur place.
  const minutesDemandees = lignes.reduce(
    (a, l) => a + demandeLigne(l.id) * minutesLigne(l, secteur),
    0,
  );
  const ratioProduction =
    minutesDemandees > prep.minutesProduction ? prep.minutesProduction / minutesDemandees : 1;
  // Événements : délais de livraison plus longs (grève, port bloqué).
  const delaisSupplementaires = modificateur(ent, 'delais');
  const anticipation = (ent.modificateurs ?? []).some((m) => m.type === 'delais' && m.anticipation);
  const utilisation = prep.capacite > 0 ? r.demande / prep.capacite : r.demande > 0 ? 2 : 0;
  const tauxDefauts = borner(
    0.015 +
      0.06 * Math.max(0, 1.05 - prep.competenceMoyenne) +
      0.04 * Math.max(0, utilisation - 0.9) +
      0.03 * usureEquipement(ent),
    0.005,
    0.15,
  );
  ent.operations.tauxDefauts = Math.round(tauxDefauts * 1000) / 1000;
  const precision = prep.effets.pertesStocks < 1 ? 0.6 : 1;
  const siCents = L.soldes.stocks;
  const resultatsStock = new Map<string, ResultatStockLigne>();
  const rapportStocks: StockLigneMois[] = [];
  const actives = new Set(lignes.map((l) => l.id));
  let coutPerimes = 0;
  for (const ligne of lignes) {
    const stock = (ent.operations.stocks[ligne.id] ??= stockVide());
    let politique = d.approvisionnement[ligne.id];
    if (!politique) {
      politique = politiqueParDefaut(
        ligne,
        secteur.fournisseursDefaut[ligne.categorieAppro],
        demandeLigne(ligne.id),
        conj,
      );
      d.approvisionnement[ligne.id] = politique;
    }
    const base = fournisseurParId(politique.fournisseurId);
    const fournisseur =
      delaisSupplementaires > 0
        ? {
            ...base,
            delaiJours: base.delaiJours + delaisSupplementaires,
            fiabilite: base.fiabilite * 0.9,
          }
        : base;
    const cout = prep.coutLignes[ligne.id];
    const conservation = fournisseur.conservationJours ?? ligne.conservationJours;
    const demande = demandeLigne(ligne.id);
    // Ventes aux entreprises : la demande du mois est connue d'avance (contrats).
    if (ligne.id === idB2B) stock.demandeRecente = demande;
    if (politique.auto) {
      const calcul = politiqueRecommandee(
        stock.demandeRecente || demande,
        cout,
        anticipation ? fournisseur : base,
        conservation,
        precision,
      );
      politique.pointCommande = calcul.pointCommande;
      politique.quantite = calcul.quantite;
    }
    const res = simulerStockLigne(
      stock,
      {
        demande,
        capacitePreparation: ligne.production ? Math.floor(demande * ratioProduction) : Infinity,
        tauxDefauts,
        coutUnitaire: cout,
        fournisseur,
        conservationJours: conservation,
        pointCommande: politique.pointCommande,
        quantite: politique.quantite,
        methode: d.methodeInventaire,
        auto: politique.auto ? { precision } : undefined,
      },
      rng,
    );
    if (politique.auto) {
      politique.pointCommande = res.pointCommande;
      politique.quantite = res.quantite;
    }
    resultatsStock.set(ligne.id, res);
    coutPerimes += res.coutPerimees;
    rapportStocks.push({
      ligneId: ligne.id,
      demandees: demande,
      vendues: res.vendues,
      perdues: res.perdues + res.perduesPreparation,
      perimees: res.perimees,
      refaites: res.refaites,
      commandes: res.commandes,
      unitesAchetees: res.receptions.reduce((a, x) => a + x.quantite, 0),
      coutAchats: Math.round(res.receptions.reduce((a, x) => a + x.cout, 0) * 100) / 100,
      stockFinUnites: unitesEnStock(stock),
      valeurFin: Math.round(res.valeurFin * 100) / 100,
      pointCommande: politique.pointCommande,
      quantite: politique.quantite,
    });
  }
  // Produits retirés : le stock restant est jeté.
  for (const [id, stock] of Object.entries(ent.operations.stocks)) {
    if (actives.has(id)) continue;
    coutPerimes += valeurStock(stock, d.methodeInventaire);
    delete ent.operations.stocks[id];
  }

  // Ventes réelles par canal (magasin, livraison, entreprises).
  let ventesBrutes = 0;
  let ventesTaxablesBrutes = 0;
  let ventesLivraisonBrutes = 0;
  let perduesProduction = 0;
  let perduesStockVisites = 0;
  let unitesB2B = 0;
  const ventesParLigne: { ligneId: string; unites: number; chiffreAffaires: number }[] = [];
  const ligneCle = secteur.lignes.reduce(
    (a, l) => (l.tauxAchat > a.tauxAchat ? l : a),
    secteur.lignes[0],
  );
  for (const ligne of lignes) {
    const res = resultatsStock.get(ligne.id);
    if (!res) continue;
    const demande = demandeLigne(ligne.id);
    const part = demande > 0 ? res.vendues / demande : 0;
    const marche = demandeMarche.get(ligne.id) ?? 0;
    const magasinEtLivraison = Math.min(res.vendues, Math.round(marche * part));
    const livraison = Math.round((demandeLivraison.get(ligne.id) ?? 0) * part);
    if (ligne.id === idB2B) unitesB2B = res.vendues - magasinEtLivraison;
    const prix = d.prix[ligne.id] ?? prixReference(ligne, conj.indicePrix);
    ventesBrutes += magasinEtLivraison * prix;
    if (ligneTaxable(ligne)) ventesTaxablesBrutes += magasinEtLivraison * prix;
    ventesLivraisonBrutes += livraison * prix;
    ventesParLigne.push({
      ligneId: ligne.id,
      unites: magasinEtLivraison,
      chiffreAffaires: Math.round(magasinEtLivraison * prix * 100) / 100,
    });
    perduesProduction += res.perduesPreparation;
    perduesStockVisites += res.perdues * (ligne.id === ligneCle.id ? 1 : 0.3);
  }
  ventesBrutes = Math.round(ventesBrutes * 100) / 100;
  ventesLivraisonBrutes = Math.round(ventesLivraisonBrutes * 100) / 100;
  const perduesRupture = Math.min(r.servies, Math.round(perduesStockVisites));
  const servies = r.servies - perduesRupture;

  // Rabais : promotion, récompenses de fidélité, tasses réutilisables et gestes commerciaux.
  const fid = PARAMETRES_MARKETING.fidelite;
  const rabaisPromo = ventesBrutes * d.promotion;
  const apresPromo = ventesBrutes - rabaisPromo;
  const rabaisFidelite = d.programmeFidelite
    ? (apresPromo - ventesLivraisonBrutes) * ent.marketing.adhesionFidelite * fid.rabais
    : 0;
  // Remises aux clients liées aux initiatives écoresponsables (ex. tasse réutilisable).
  const rabaisEco = INITIATIVES_ECO.filter(
    (i) => i.rabaisClient && d.initiativesEco.includes(i.id),
  ).reduce((a, i) => a + servies * i.coutParVisite, 0);
  const compensations = d.reponseAvis === 'compenser' ? apresPromo * 0.008 : 0;
  const rabais =
    Math.round(
      Math.max(
        0,
        Math.min(ventesBrutes, rabaisPromo + rabaisFidelite + rabaisEco + compensations),
      ) * 100,
    ) / 100;
  const ventesNettes = Math.round((ventesBrutes - rabais) * 100) / 100;
  // Les rabais se répartissent entre les ventes taxables et les ventes détaxées.
  const partTaxable = ventesBrutes > 0 ? Math.min(1, ventesTaxablesBrutes / ventesBrutes) : 1;
  const ventesNettesTaxables = Math.round(ventesNettes * partTaxable * 100) / 100;

  // g) Ventes au détail (avec TPS et TVQ si l'entreprise est inscrite) et frais de cartes
  let encaissement = ventesNettes;
  if (f.inscritTaxes) {
    const t = taxesSur(ventesNettesTaxables);
    passerEcriture(L, {
      libelle:
        partTaxable < 1
          ? 'Ventes du mois (TPS et TVQ perçues sur les produits taxables; produits détaxés à 0 %)'
          : 'Ventes du mois (TPS et TVQ perçues sur le prix après rabais)',
      flux: 'encaissementsClients',
      lignes: [
        {
          compte: 'encaisse',
          debit: versCents(ventesNettes) + versCents(t.tps) + versCents(t.tvq),
        },
        { compte: 'rabaisPromotions', debit: versCents(rabais) },
        { compte: 'ventes', credit: versCents(ventesBrutes) },
        { compte: 'tpsAPayer', credit: versCents(t.tps) },
        { compte: 'tvqAPayer', credit: versCents(t.tvq) },
      ],
    });
    f.taxesAnnee.tpsPercue += t.tps;
    f.taxesAnnee.tvqPercue += t.tvq;
    encaissement += t.total;
  } else {
    passerEcriture(L, {
      libelle: 'Ventes du mois (petit fournisseur : aucune taxe perçue)',
      flux: 'encaissementsClients',
      lignes: [
        { compte: 'encaisse', debit: versCents(ventesNettes) },
        { compte: 'rabaisPromotions', debit: versCents(rabais) },
        { compte: 'ventes', credit: versCents(ventesBrutes) },
      ],
    });
  }
  const partMagasin = ventesBrutes > 0 ? 1 - ventesLivraisonBrutes / ventesBrutes : 1;
  const paiements = secteur.paiements ?? {
    partCartes: PART_VENTES_CARTES,
    taux: FRAIS_TRAITEMENT_CARTES.taux,
  };
  ecritureSimple(
    L,
    secteur.paiements
      ? 'Frais de la passerelle de paiement en ligne'
      : 'Frais de traitement des cartes de débit et de crédit',
    'fraisCartes',
    'encaisse',
    versCents(encaissement * partMagasin * paiements.partCartes * paiements.taux),
    'fraisBancaires',
  );
  // Frais variables par client servi (expédition des colis, carburant des équipes).
  if (secteur.fraisParVisite && servies > 0) {
    payer(
      L,
      ent,
      secteur.fraisParVisite.libelle,
      'fraisExpedition',
      servies *
        secteur.fraisParVisite.montant *
        conj.indicePrix *
        prep.effets.fraisParVisite *
        modificateur(ent, 'fraisParVisite'),
      true,
      'commissionsLivraison',
    );
  }
  if (ventesLivraisonBrutes > 0) {
    payer(
      L,
      ent,
      'Commissions de la plateforme de livraison',
      'commissions',
      ventesLivraisonBrutes * PARAMETRES_MARKETING.livraison.commission,
      true,
      'commissionsLivraison',
    );
  }

  // h) Ventes aux entreprises : livraisons facturées à crédit (comptes clients)
  let ventesB2B = 0;
  const ratioB2B = demandeB2B > 0 ? Math.max(0, unitesB2B) / demandeB2B : 0;
  for (const c of ent.b2b.contrats) {
    const livres = Math.round(c.quantiteParMois * ratioB2B);
    const ht = Math.round(livres * c.prixUnitaire * 100) / 100;
    if (ht > 0) {
      const t =
        f.inscritTaxes && (!produitB2B || ligneTaxable(produitB2B))
          ? taxesSur(ht)
          : { tps: 0, tvq: 0, total: 0 };
      const facture = {
        id: nouvelId(ent, 'fact'),
        contratId: c.id,
        client: c.client,
        cote: c.cote,
        emission: ctx.index,
        echeance: ctx.index + moisEcheance(c.delaiPaiementJours),
        ht: versCents(ht),
        tps: versCents(t.tps),
        tvq: versCents(t.tvq),
        statut: 'ouverte' as const,
      };
      passerEcriture(L, {
        libelle: `Facture à ${c.client} (${livres} × ${produitB2B?.unite ?? 'unité'}, ${c.delaiPaiementJours} jours)`,
        lignes: [
          { compte: 'comptesClients', debit: facture.ht + facture.tps + facture.tvq },
          { compte: 'ventes', credit: facture.ht },
          { compte: 'tpsAPayer', credit: facture.tps },
          { compte: 'tvqAPayer', credit: facture.tvq },
        ],
      });
      if (f.inscritTaxes) {
        f.taxesAnnee.tpsPercue += t.tps;
        f.taxesAnnee.tvqPercue += t.tvq;
      }
      ent.b2b.factures.push(facture);
      ventesB2B += ht;
    }
    const ratio = c.quantiteParMois > 0 ? livres / c.quantiteParMois : 1;
    c.satisfaction =
      ratio < 0.95
        ? borner(c.satisfaction - 0.6 * (1 - ratio), 0, 1)
        : borner(
            lisser(
              c.satisfaction,
              0.85 + 0.2 * ((idB2B ? (prep.qualiteLignes[idB2B] ?? 0.5) : 0.5) - 0.5),
              0.3,
            ),
            0,
            1,
          );
    c.moisRestants -= 1;
  }
  for (const c of ent.b2b.contrats) {
    if (c.satisfaction < 0.45)
      messages.push({ code: 'contratAnnule', niveau: 'alerte', params: { client: c.client } });
    else if (c.moisRestants <= 0)
      messages.push({ code: 'contratTermine', niveau: 'info', params: { client: c.client } });
  }
  ent.b2b.contrats = ent.b2b.contrats.filter((c) => c.satisfaction >= 0.45 && c.moisRestants > 0);
  if (ventesB2B > 0 && produitB2B?.b2b?.coursier && !prep.effets.livraisonPropre) {
    payer(
      L,
      ent,
      'Livraisons aux clients d’affaires par coursier',
      'commissions',
      ventesB2B * FRAIS_COURSIER,
      true,
      'commissionsLivraison',
    );
  }

  // Seuil du petit fournisseur (ventes taxables des 4 derniers trimestres)
  const ventesTaxables = ventesNettes + ventesB2B;
  f.ventesTaxablesMois = [...f.ventesTaxablesMois.slice(-11), ventesTaxables];
  if (!f.inscritTaxes) {
    const ventes12 = f.ventesTaxablesMois.reduce((a, x) => a + x, 0);
    if (!f.doitSInscrire && depasseSeuilPetitFournisseur(ventes12)) {
      f.doitSInscrire = true;
      messages.push({ code: 'seuilTaxesDepasse', niveau: 'danger', params: { ventes: ventes12 } });
    } else if (f.doitSInscrire) {
      f.ventesNonTaxees += ventesTaxables;
      messages.push({
        code: 'inscriptionTaxesRequise',
        niveau: 'danger',
        params: { ventes: f.ventesNonTaxees },
      });
    }
  }

  // i) Achats reçus selon les conditions de paiement, puis coût des ventes (inventaire périodique)
  const achats = { comptant: 0, net30: 0, escompte: 0 };
  for (const res of resultatsStock.values()) {
    for (const rec of res.receptions) {
      if (rec.conditions === 'comptant') achats.comptant += rec.cout;
      else if (rec.conditions === 'net30') achats.net30 += rec.cout;
      else achats.escompte += rec.cout;
    }
  }
  const part = secteur.partAchatsTaxables;
  acheterMarchandises(L, ent, 'Achats payés à la livraison', achats.comptant, part, 'encaisse');
  acheterMarchandises(
    L,
    ent,
    'Achats à crédit (net 30 jours)',
    achats.net30,
    part,
    'comptesFournisseurs',
  );
  if (d.prendreEscomptes && achats.escompte > 0) {
    acheterMarchandises(
      L,
      ent,
      'Achats payés en 10 jours (2/10 net 30)',
      achats.escompte,
      part,
      'encaisse',
    );
    ecritureSimple(
      L,
      'Escompte de 2 % obtenu pour paiement rapide',
      'encaisse',
      'escomptesAchats',
      versCents(achats.escompte * TAUX_ESCOMPTE),
      'paiementsFournisseurs',
    );
  } else {
    acheterMarchandises(
      L,
      ent,
      'Achats à crédit (2/10 net 30, escompte non pris)',
      achats.escompte,
      part,
      'comptesFournisseurs',
    );
  }
  const achatsCents = L.soldes.stocks - siCents;
  const sfCents = versCents(
    Object.values(ent.operations.stocks).reduce(
      (a, s) => a + valeurStock(s, d.methodeInventaire),
      0,
    ),
  );
  const pertesCents = versCents(coutPerimes);
  ecritureSimple(L, 'Produits périmés jetés', 'pertesStocks', 'stocks', pertesCents);
  ecritureSimple(
    L,
    'Coût des marchandises vendues (stock d’ouverture + achats − stock de clôture)',
    'coutMarchandises',
    'stocks',
    siCents + achatsCents - pertesCents - sfCents,
  );

  // j) Paie : salaire brut → retenues à la source → salaire net; cotisations de l'employeur
  const dirigeant = societe && d.salaireDirigeant > 0 ? d.salaireDirigeant : 0;
  const masseAnnuelle =
    (ent.employes.reduce((a, x) => a + salaireMensuel(x.salaireHoraire, x.heuresSemaine), 0) +
      dirigeant) *
    12;
  const feries = JOURS_FERIES_PAR_MOIS[ctx.mois - 1];
  const primeParEmploye = ent.employes.length > 0 ? ent.effetsMois.primes / ent.employes.length : 0;
  let salaires = 0;
  let vacances = 0;
  let retenues = 0;
  let cotisations = 0;
  let coutAvantages = 0;
  for (const emp of ent.employes) {
    const brut =
      salaireMensuel(emp.salaireHoraire, emp.heuresSemaine * (1 - emp.absenteisme)) +
      primeParEmploye;
    const ferie = feries * indemniteJourFerie(emp.salaireHoraire, emp.heuresSemaine);
    const vac = Math.round((brut + ferie) * tauxVacances(emp.moisAnciennete) * 100) / 100;
    const total = brut + ferie + vac;
    const c = cotisationsEmployeur(total, emp.cumulBrutAnnee, secteur.tauxCnesst, masseAnnuelle);
    const ret = retenuesEmploye(total, emp.cumulBrutAnnee, true);
    emp.cumulBrutAnnee += total;
    ajouterPaie(f.paieAnnee, emp.id, `${emp.prenom} ${emp.nom}`, total, ret);
    f.heuresRemunereesAnnee += emp.heuresSemaine * SEMAINES_PAR_MOIS;
    salaires += brut;
    vacances += vac + ferie;
    retenues += ret.total;
    cotisations += c.total;
    coutAvantages += effetsAvantages(d.avantages, emp.heuresSemaine).cout;
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
    libelle:
      feries > 0
        ? 'Paie du mois (salaires, vacances, indemnité de jour férié, retenues à la source)'
        : 'Paie du mois (salaires bruts, retenues à la source et salaires nets versés)',
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
  ecritureSimple(
    L,
    'Avantages sociaux (assurance collective, repas, rabais)',
    'avantagesSociaux',
    'encaisse',
    versCents(coutAvantages),
    'formationAvantages',
  );

  // k) Loyer (indexé à chaque anniversaire du bail) et frais fixes
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
  const commis = Math.min(1, heuresPoste(ent, 'administration') / 10);
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
      // Un commis comptable à l'interne fait une partie du travail du comptable externe.
      base *= 1 - 0.6 * commis;
      // Un propriétaire qui maîtrise la fiscalité fait lui-même une partie du travail.
      base *= facteurFraisComptables(ent);
    }
    payer(L, ent, libelle, compte, base * conj.indicePrix, taxable, 'loyerEtFrais');
  }
  payer(
    L,
    ent,
    'Frais d’utilisation des investissements (abonnements, véhicule, terrasse)',
    'logiciels',
    fraisInvestissements(ent, secteur, ctx.mois) * conj.indicePrix,
    true,
    'loyerEtFrais',
  );
  const ecoMensuel = INITIATIVES_ECO.filter(
    (i) => d.initiativesEco.includes(i.id) && i.id !== 'tasse',
  ).reduce((a, i) => a + i.coutMensuel + i.coutParVisite * servies, 0);
  payer(
    L,
    ent,
    'Initiatives écoresponsables (emballages, compost, certification)',
    'ecoresponsabilite',
    ecoMensuel,
    true,
    'loyerEtFrais',
  );

  // l) Marketing : publicité par canal et programme de fidélité
  const pub = totalPublicite(d.publicite);
  payer(L, ent, 'Publicité (tous les canaux)', 'publicite', pub, true, 'publicite');
  if (d.programmeFidelite)
    payer(
      L,
      ent,
      'Logiciel du programme de fidélité',
      'publicite',
      fid.coutLogicielMensuel,
      true,
      'publicite',
    );
  planifierEffetsPublicite(ent.marketing, secteur, d.publicite, ctx.index, prep.bonusConversion);
  const gainsPub = effetsPubliciteDuMois(ent.marketing, ctx.index);

  // m) Emprunts et marge de crédit
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
    ecritureSimple(
      L,
      'Intérêts sur la marge de crédit',
      'interets',
      'encaisse',
      Math.round((margeUtilisee * (prime + ent.margeCredit.ecartTaux)) / 12),
      'interetsPayes',
    );
  }

  // n) Placements : intérêts du mois et certificats échus
  for (const p of ent.finance.placements) {
    ecritureSimple(
      L,
      'Intérêts sur les placements',
      'encaisse',
      'revenusPlacement',
      Math.round((p.montant * p.taux) / 12),
      'interetsRecus',
    );
  }
  for (const p of ent.finance.placements.filter(
    (x) => x.echeance !== null && x.echeance <= ctx.index,
  )) {
    ecritureSimple(
      L,
      'Échéance d’un certificat de placement garanti',
      'encaisse',
      'placements',
      p.montant,
      'placementsNets',
    );
    messages.push({
      code: 'placementEchu',
      niveau: 'info',
      params: { montant: versDollars(p.montant) },
    });
  }
  ent.finance.placements = ent.finance.placements.filter(
    (x) => x.echeance === null || x.echeance > ctx.index,
  );

  // o) Amortissement comptable (linéaire, bien par bien)
  for (const [type, montant] of amortirImmobilisations(ent)) {
    const c = COMPTES_IMMOBILISATIONS[type];
    ecritureSimple(L, `Amortissement ${c.libelle}`, 'amortissement', c.cumul, montant);
  }

  // p) Comptes clients : encaissements, retards et mauvaises créances
  for (const fa of ent.b2b.factures) {
    if (fa.statut !== 'ouverte' || fa.echeance > ctx.index) continue;
    if (rng.chance(PONCTUALITE[fa.cote])) {
      ecritureSimple(
        L,
        `Paiement reçu de ${fa.client}`,
        'encaisse',
        'comptesClients',
        fa.ht + fa.tps + fa.tvq,
        'encaissementsClients',
      );
      fa.statut = 'payee';
    }
  }
  const clientsEnDefaut = new Set<string>();
  for (const client of new Set(
    ent.b2b.factures.filter((x) => x.statut === 'ouverte').map((x) => x.client),
  )) {
    const ouvertes = ent.b2b.factures.filter((x) => x.client === client && x.statut === 'ouverte');
    const enRetard = ouvertes.some((x) => x.echeance < ctx.index);
    if (rng.chance(RISQUE_DEFAUT[ouvertes[0].cote] * (enRetard ? 3 : 1)))
      clientsEnDefaut.add(client);
    else if (enRetard)
      messages.push({ code: 'clientEnRetard', niveau: 'alerte', params: { client } });
  }
  for (const client of clientsEnDefaut) {
    const { total } = reglerCreanceClient(ent, client, 0);
    messages.push({
      code: 'creanceIrrecouvrable',
      niveau: 'danger',
      params: { client, montant: total },
    });
  }
  ent.b2b.factures = ent.b2b.factures.filter(
    (x) => x.statut === 'ouverte' || x.emission >= ctx.index - 12,
  );

  // q) Rémunération des propriétaires : prélèvements (individuelle, société de personnes) ou dividendes
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
      'Dividendes versés aux actionnaires (non déterminés)',
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

  // r) Marge de crédit automatique
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

  // s) Clientèle : qualité perçue, service, satisfaction, avis, notoriété, image et fidélité
  const emplacement = emplacementDe(ville, ent.emplacementId);
  const cl = ent.clientele;
  const m = ent.marketing;
  const ip = indicePrixOffre(d.prix, secteur, conj.indicePrix);
  const ipClient = indicePrixClient(prep.offre, secteur, conj.indicePrix);
  cl.qualitePercue = lisser(cl.qualitePercue, borner(prep.qualiteGlobale, 0, 1), 0.35);
  const serviceCible = borner(
    0.3 +
      0.3 * (prep.moralPondere / 100) +
      0.2 * ((prep.competenceMoyenne - 0.8) / 0.4) +
      0.25 * (1 - borner((utilisation - 0.75) / 0.5, 0, 1)) +
      prep.bonusService,
    0.1,
    0.95,
  );
  cl.service = lisser(cl.service, serviceCible, 0.5);
  const tauxAttente =
    r.demande > 0
      ? (r.perduesCapacite + 0.5 * perduesRupture + 0.15 * perduesProduction) / r.demande
      : 0;
  const plaintes = Math.round(servies * tauxDefauts * 0.35 * (d.satisfactionGarantie ? 0.4 : 1));
  cl.satisfaction = borner(
    satisfactionClients(cl.qualitePercue, cl.service, prep.ambiance, ipClient, tauxAttente) -
      0.6 * tauxDefauts * (d.satisfactionGarantie ? 0.4 : 1),
    0.05,
    0.98,
  );
  const nouveauxAvis = Math.round(servies * TAUX_AVIS);
  if (nouveauxAvis > 0) {
    const noteMois = noteDuMois(noteCible(cl.satisfaction) + rng.normal(0, 0.2), d.reponseAvis);
    cl.note = nouvelleNote(cl.note, cl.nbAvis, noteMois, nouveauxAvis);
    cl.nbAvis += nouveauxAvis;
  }
  m.tauxRupturePercu = lisser(
    m.tauxRupturePercu,
    r.servies > 0 ? perduesRupture / r.servies : 0,
    0.5,
  );
  m.adhesionFidelite = evoluerAdhesion(m.adhesionFidelite, d.programmeFidelite);
  const retentionAvant = m.retention;
  m.retention = retentionClients({
    satisfaction: cl.satisfaction,
    note: cl.note,
    adhesion: m.adhesionFidelite,
    tauxRupture: m.tauxRupturePercu,
  });
  const oubli = 0.07 * (1.3 - 0.6 * m.retention);
  const fatigue = prep.promotionsRecentes >= PARAMETRES_MARKETING.promotion.moisFatigue;
  for (const seg of ctx.segments) {
    const persona = personaParId(seg.id);
    const promo =
      d.promotion > 0 ? d.promotion * 0.25 * persona.sensibilites.prix * (fatigue ? 0.5 : 1) : 0;
    const potentielSeg = ctx.potentiel * seg.part;
    const serviesSeg = r.parSegment[seg.id]?.servies ?? 0;
    const n = m.notorieteSegments[seg.id] ?? cl.notoriete;
    m.notorieteSegments[seg.id] = borner(
      evoluerNotoriete(
        n,
        0,
        emplacement.visibilite * secteur.importanceEmplacement,
        potentielSeg > 0 ? serviesSeg / potentielSeg : 0,
        cl.satisfaction,
        oubli,
        combinerGains([gainsPub[seg.id] ?? 0, promo]),
      ) + (ctx.index === 0 ? 0.06 : 0),
      0.01,
      0.98,
    );
  }
  cl.notoriete = notorieteMoyenne(secteur, m.notorieteSegments);
  const bonusCommandites = Math.min(
    0.08,
    (d.publicite.commandites ?? 0) / 10_000 + (d.publicite.evenements ?? 0) / 15_000,
  );
  m.image = evoluerImage(
    m.image,
    imageCible({
      qualite: cl.qualitePercue,
      ambiance: prep.ambiance,
      note: cl.note,
      eco: prep.eco,
      local: prep.local,
      satisfaction: cl.satisfaction,
      bonusCommandites,
    }),
  );
  const clientsActifs = Math.round(servies / secteur.visitesParClientMois);
  const nouveauxClients = Math.max(0, Math.round(clientsActifs - retentionAvant * m.clientsActifs));
  m.clientsActifs = clientsActifs;
  if (d.promotion > 0)
    m.historiquePromos = [...m.historiquePromos.filter((i) => i >= ctx.index - 12), ctx.index];

  // t) Ressources humaines : moral, compétence, ancienneté, départs et syndicalisation
  const penurie = penurieDuMois(ctx.chomage, ctx.mois, modificateur(ent, 'penurie'));
  const gerant = heuresPoste(ent, 'gestion') > 0;
  const syndique = ent.rh.syndicat.statut === 'accredite';
  const restants = [];
  for (const emp of ent.employes) {
    const poste = posteParId(emp.posteId);
    const trait = traitParId(emp.trait);
    const av = effetsAvantages(d.avantages, emp.heuresSemaine);
    emp.moral = evoluerMoral(
      emp,
      moralCible({
        salaireHoraire: emp.salaireHoraire,
        salaireMarche: salaireMarchePoste(poste, ville.indiceSalaires, conj.indicePrix),
        utilisation,
        heuresSemaine: emp.heuresSemaine,
        trait,
        avantages: av.moral,
        gerant: gerant && poste.role !== 'gestion',
        syndique,
        moisDepuisEvaluation:
          emp.derniereEvaluation === null ? null : ctx.index - emp.derniereEvaluation,
        moisDepuisAugmentation:
          ctx.index - (emp.derniereAugmentation ?? ctx.index - emp.moisAnciennete),
        moisAnciennete: emp.moisAnciennete,
      }) + bonusMoralRh(ent),
      rng,
    );
    emp.competence = progressionCompetence(emp);
    emp.moisAnciennete += 1;
    if (rng.chance(probabiliteDepart(emp.moral, penurie, trait, av.depart))) {
      ent.rh.departs.push({ index: ctx.index, type: 'demission' });
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
  ent.rh.departs = ent.rh.departs.filter((x) => x.index > ctx.index - 12);
  const moralMoyen =
    ent.employes.length > 0
      ? ent.employes.reduce((a, x) => a + x.moral, 0) / ent.employes.length
      : 70;
  ent.rh.moisMoralBas = moralMoyen < 40 && ent.employes.length >= 4 ? ent.rh.moisMoralBas + 1 : 0;
  if (!syndique && ent.rh.moisMoralBas >= 6 && rng.chance(0.25)) {
    ent.rh.syndicat = { statut: 'accredite', depuis: ctx.index };
    for (const emp of ent.employes)
      if (posteParId(emp.posteId).role !== 'gestion')
        emp.salaireHoraire = Math.round(emp.salaireHoraire * 1.05 * 100) / 100;
    messages.push({ code: 'syndicatAccredite', niveau: 'danger' });
  }

  // u) Préparation du mois suivant : candidats, dilemme, appels d'offres
  const suivant = ctx.index + 1;
  const moisSuivant = (ctx.mois % 12) + 1;
  ent.rh.candidats = ent.rh.candidats.filter((c) => c.expire > ctx.index);
  for (const aff of ent.rh.affichages.filter((a) => a.moisCandidats === suivant)) {
    const poste = posteParId(aff.posteId);
    const pen = penurieDuMois(ctx.chomage, moisSuivant, modificateur(ent, 'penurie'));
    const n = nombreCandidats(aff.plateformeId, pen, rng);
    for (let i = 0; i < n; i++) {
      ent.rh.candidats.push(
        genererCandidat(
          nouvelId(ent, 'cand'),
          poste,
          plateformeParId(aff.plateformeId),
          {
            salaireMarche: salaireMarchePoste(poste, ville.indiceSalaires, conj.indicePrix),
            salaireMinimum: ctx.salaireMinimum,
            penurie: pen,
          },
          suivant,
          rng,
        ),
      );
    }
    messages.push({
      code: n > 0 ? 'candidatsRecus' : 'aucunCandidat',
      niveau: n > 0 ? 'info' : 'alerte',
      params: { n, poste: poste.nom },
    });
  }
  ent.rh.affichages = ent.rh.affichages.filter((a) => a.moisCandidats > suivant);

  // v) Fin d'exercice fiscal (31 décembre) : DPA, impôts, relevés T4 et RL-1
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

  // w) Suivi des difficultés financières
  if (L.soldes.encaisse < 0) ent.moisEnDefaut += 1;
  else ent.moisEnDefaut = 0;

  // x) Indicateurs du mois
  const resultats = etatResultats(L.mouvementsMois);
  const coutMainOeuvre = versDollars(cSalaires + cVacances + cDirigeant + versCents(cotisations));
  const chiffreAffaires = resultats.ventes;
  const depensesMarketing = pub + (d.programmeFidelite ? fid.coutLogicielMensuel : 0);
  const margeBrute = resultats.margeBrute;
  const serviesSegments: Record<string, number> = {};
  for (const [k, v] of Object.entries(r.parSegment)) serviesSegments[k] = v.servies;
  const indicateurs: Indicateurs = {
    potentiel: ctx.potentiel,
    demande: r.demande,
    servies,
    perduesCapacite: r.perduesCapacite,
    perduesRupture,
    perduesProduction,
    partMarche: r.part,
    ventesParLigne,
    chiffreAffaires,
    ventesMagasin: Math.round((ventesBrutes - ventesLivraisonBrutes) * 100) / 100,
    ventesLivraison: ventesLivraisonBrutes,
    ventesB2B: Math.round(ventesB2B * 100) / 100,
    rabais,
    ticketMoyen: servies > 0 ? ventesNettes / servies : 0,
    beneficeNet: resultats.beneficeNet,
    tauxMargeBrute: resultats.tauxMargeBrute,
    tauxMainOeuvre: chiffreAffaires > 0 ? coutMainOeuvre / chiffreAffaires : 0,
    encaisse: versDollars(L.soldes.encaisse),
    margeCreditUtilisee: versDollars(-L.soldes.margeCredit),
    notoriete: cl.notoriete,
    notorieteSegments: { ...m.notorieteSegments },
    serviesSegments,
    qualitePercue: cl.qualitePercue,
    service: cl.service,
    satisfaction: cl.satisfaction,
    note: cl.note,
    nbAvis: cl.nbAvis,
    nps: netPromoterScore(cl.satisfaction),
    image: m.image,
    retention: m.retention,
    clientsActifs,
    nouveauxClients,
    cac: nouveauxClients > 0 ? depensesMarketing / nouveauxClients : 0,
    clv: clientsActifs > 0 ? valeurVieClient(margeBrute / clientsActifs, m.retention) : 0,
    depensesMarketing,
    tauxDefauts,
    plaintes,
    moral:
      ent.employes.length > 0
        ? ent.employes.reduce((a, x) => a + x.moral, 0) / ent.employes.length
        : 0,
    nbEmployes: ent.employes.length,
    absenteisme:
      ent.employes.length > 0
        ? ent.employes.reduce((a, x) => a + x.absenteisme, 0) / ent.employes.length
        : 0,
    heuresOuvertureEffectives: prep.heuresEffectives,
    capacite: prep.capacite,
    capaciteProduction: Math.round(prep.minutesProduction / 60),
    demandeProduction: Math.round(minutesDemandees / 60),
    utilisation,
    tauxDirecteur: conj.tauxDirecteur,
    tauxPreferentiel: prime,
    inflation: conj.inflationAnnuelle,
    chomage: ctx.chomage,
    tauxChange: conj.tauxChange,
    salaireMinimum: ctx.salaireMinimum,
    indicePrixOffre: ip,
    coutMainOeuvre,
  };
  if (prep.sansProducteur && perduesProduction >= 20)
    messages.push({
      code: 'sansProducteur',
      niveau: 'alerte',
      params: { perdues: perduesProduction, production: secteur.libelleProduction },
    });

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
    stocks: rapportStocks,
    prevision: d.prevision,
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

  // y) Clôture de l'exercice comptable
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

  // z) Remise à zéro des opérations ponctuelles et des effets du mois
  d.apportPonctuel = 0;
  d.remboursementAnticipe = 0;
  d.dividendePonctuel = 0;
  d.promotion = 0;
  d.prevision = null;
  ent.enAttente = { indemnites: 0 };
  ent.effetsMois = {
    capacite: 1,
    heuresProprietaire: 0,
    primes: 0,
    joursFermeture: 0,
    pertesRecurrentes: ent.effetsMois.pertesRecurrentes.filter((p) => p.moisRestants > 0),
    revenusRecurrents: (ent.effetsMois.revenusRecurrents ?? []).filter((p) => p.moisRestants > 0),
  };
  vieillirModificateurs(ent);
  return archive.messages;
}

/** Après la simulation : nouveau dilemme et appels d'offres pour le mois suivant. */
function preparerMoisSuivant(ent: Entreprise, etat: EtatPartie, ctx: ContexteMois): void {
  const suivant = ctx.index + 1;
  if (ent.enFaillite || suivant >= etat.config.dureeMois) return;
  const moisSuivant = (ctx.mois % 12) + 1;
  const diff = DIFFICULTES[etat.config.difficulte];
  const enLigne =
    ctx.secteur.id === 'enLigne' ||
    ent.immobilisations.some((i) =>
      ['siteWeb', 'applicationMobile', 'logicielRendezVous'].includes(i.investissementId ?? ''),
    );
  const importateur = lignesStock(ent, ctx.secteur).some((l) => {
    const id = ent.decisions.approvisionnement[l.id]?.fournisseurId;
    return id !== undefined && fournisseurParId(id).devise === 'USD';
  });
  const dilemme = tirerDilemme(
    ent,
    DILEMMES,
    {
      mois: moisSuivant,
      derniere: ent.archives.at(-1),
      index: suivant,
      probabilite: diff.evenements,
      id: nouvelId(ent, 'dil'),
      secteur: ctx.secteur,
      concurrents: etat.concurrents,
      conj: ctx.conj,
      valorisation: Math.round(valorisationEnCours(ent) * 1.1),
      enLigne,
      hygieneConforme: conformeHygiene(ent),
      usure: usureEquipement(ent),
      importateur,
      poidsNature: diff.poidsNature,
      poidsFiscal: diff.poidsFiscal * facteurRisqueFiscal(ent),
    },
    ctx.rng,
  );
  if (dilemme) {
    ent.dilemmes.push(dilemme);
    ent.archives.at(-1)?.messages.push({
      code: 'nouveauDilemme',
      niveau: 'alerte',
      params: { titre: dilemmeParId(dilemme.defId).titre },
    });
  }
  const produitB2B = produitB2BActif(ent, ctx.secteur);
  if (produitB2B) {
    const appels = genererAppels(
      ent,
      produitB2B,
      produitB2B.prixReference * ctx.conj.indicePrix,
      suivant,
      moisSuivant,
      () => nouvelId(ent, 'appel'),
      ctx.rng,
    );
    ent.b2b.appels = appels;
    if (appels.length > 0)
      ent.archives
        .at(-1)
        ?.messages.push({ code: 'appelsOffres', niveau: 'info', params: { n: appels.length } });
  }
}

/** Observation publique des joueurs par les concurrents (données du mois précédent). */
function observerJoueurs(etat: EtatPartie, secteur: Secteur): ObservationMarche {
  const actives = etat.entreprises.filter((e) => !e.enFaillite && !e.vente);
  if (actives.length === 0) return { indicePrixJoueurs: 1, qualiteJoueurs: 0.5, partJoueurs: 0 };
  let ip = 0;
  let q = 0;
  let part = 0;
  let eco = 0;
  let produitsReussis = 0;
  for (const ent of actives) {
    const derniere = ent.archives.at(-1);
    ip += derniere
      ? derniere.indicateurs.indicePrixOffre
      : indicePrixOffre(ent.decisions.prix, secteur, etat.conjoncture.indicePrix);
    q += ent.clientele.qualitePercue;
    part += derniere ? derniere.indicateurs.partMarche : 0;
    eco = Math.max(eco, scoreEco(ent.decisions));
    produitsReussis += ent.marketing.produits.filter(
      (p) => p.statut === 'actif' && p.succes,
    ).length;
  }
  return {
    indicePrixJoueurs: ip / actives.length,
    qualiteJoueurs: q / actives.length,
    partJoueurs: part,
    // Ce que les concurrents voient (et peuvent copier) : livraison, fidélité, écoresponsabilité.
    livraison: actives.some((e) => e.decisions.livraison),
    fidelite: actives.some((e) => e.decisions.programmeFidelite),
    eco,
    produitsReussis,
  };
}

/**
 * Sensibilité des clients au prix dans la ville : plus le revenu médian est bas, plus
 * les clients comparent les prix (et davantage quand l'économie ralentit).
 */
export function sensibilitePrixVille(ville: Ville, conj: Conjoncture): number {
  return Math.sqrt(REVENU_MEDIAN_QUEBEC / ville.revenuMedian) * sensibilitePrixConjoncture(conj);
}

/** Potentiel du marché d'un mois (saison, conjoncture, tendance du secteur, difficulté). */
export function potentielDuMois(
  secteur: Secteur,
  ville: Ville,
  conj: Conjoncture,
  index: number,
  mois: number,
  facteurDifficulte: number,
): number {
  return (
    (ville.marchePotentielMensuel[secteur.id] ?? 0) *
    secteur.saisonnalite[mois - 1] *
    facteurConjoncture(conj, secteur.cyclicite) *
    Math.pow(1 + secteur.croissanceAnnuelle, index / 12) *
    facteurDifficulte
  );
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

  // 1. Conjoncture économique (cycle, chômage, inflation, taux) et salaire minimum
  const phaseAvant = etat.conjoncture.phase;
  etat.conjoncture = evoluerConjoncture(etat.conjoncture, mois, rng, diff.risqueRecession);
  const conj = etat.conjoncture;
  if (conj.phase !== phaseAvant) {
    messagesCommuns.push({
      code: 'phaseEconomique',
      niveau: conj.phase === 'recession' || conj.phase === 'ralentissement' ? 'alerte' : 'info',
      params: { phase: conj.phase, chomage: conj.chomage },
    });
  }
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

  // 2. Potentiel du marché ce mois-ci (saison, conjoncture, tendance, difficulté)
  const potentiel = Math.round(
    potentielDuMois(secteur, ville, conj, index, mois, diff.marche) *
      facteurMarcheEquipes(etat.entreprises.length) *
      (1 + rng.normal(0, 0.02)),
  );

  // 3. Les concurrents : arrivées, faillites et rachats, puis décisions (en voyant les
  // prix publics du mois dernier)
  messagesCommuns.push(...evoluerStatutsConcurrents(etat.concurrents, index, rng));
  const observation = observerJoueurs(etat, secteur);
  for (const c of etat.concurrents) {
    if (!c.actif) continue;
    const perso = personnaliteParId(c.personnaliteId);
    const appliquees = deciderConcurrent(
      c,
      perso,
      observation,
      index,
      diff.agressivite,
      rng,
      secteur,
    );
    for (const r of appliquees) {
      messagesCommuns.push({
        code:
          r.type === 'prix'
            ? 'concurrentPrix'
            : r.type === 'publicite'
              ? 'concurrentPublicite'
              : r.type === 'qualite'
                ? 'concurrentQualite'
                : 'concurrentCopie',
        niveau: 'alerte',
        params: { nom: c.nom, valeur: r.valeur, idee: r.idee ?? '' },
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
    segments: segmentsMarche(secteur),
    etat,
    chomage: chomageVille(ville.chomage, conj),
  };
  const actives = etat.entreprises.filter((e) => !e.enFaillite && !e.vente);
  const preparations = new Map<string, Preparation>();
  for (const ent of actives) {
    const debut = debutDeMois(ent, ctx);
    ent.decisions = validerDecisions(
      ent.decisions,
      secteur,
      ent.formeJuridique,
      lignesStock(ent, secteur),
    );
    preparations.set(ent.id, preparerOffre(ent, ctx, debut));
  }
  const offres: Offre[] = [
    ...actives.map((e) => (preparations.get(e.id) as Preparation).offre),
    ...etat.concurrents.filter((c) => c.actif).map(offreConcurrent),
  ];
  const marche = simulerMarche(offres, secteur, potentiel, conj.indicePrix, {
    segments: ctx.segments,
    mois,
    sensibilitePrix: sensibilitePrixVille(ville, conj),
    livraison: {
      part: secteur.partLivraison,
      majoration: PARAMETRES_MARKETING.livraison.majorationClient,
      panier: secteur.panierLivraison,
    },
  });

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
    archive.resume = resumeDecisions(ent, archive);
    progresserCompetences(ent, archive, (defId) => dilemmeParId(defId).categorie);
    archive.concurrents = etat.concurrents
      .filter((c) => c.statut !== 'aVenir')
      .map((c) => ({
        id: c.id,
        part: c.actif ? (marche.resultats[c.id]?.part ?? 0) : 0,
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
    preparerMoisSuivant(ent, etat, ctx);
  }

  // 7. Fin du mois
  etat.rngState = rng.state;
  etat.moisCourant = index + 1;
  if (etat.entreprises.every((e) => e.enFaillite || e.vente)) {
    etat.terminee = true;
    etat.raisonFin = etat.entreprises.some((e) => e.vente) ? 'vente' : 'faillite';
  } else if (etat.moisCourant >= etat.config.dureeMois) {
    etat.terminee = true;
    etat.raisonFin = 'duree';
  }
  return etat;
}

/** Prix de référence actuel d'une ligne (avec l'inflation). Utile pour l'interface. */
export function prixMarche(etat: EtatPartie, ligneId: string): number {
  const secteur = secteurParId(etat.config.secteurId);
  const ligne = [...secteur.lignes, ...secteur.nouveauxProduits].find((l) => l.id === ligneId);
  if (!ligne) throw new Error(`Ligne introuvable : ${ligneId}`);
  return prixReference(ligne, etat.conjoncture.indicePrix);
}

/** Salaire de référence du marché pour un poste (par défaut : le poste de base). */
export function salaireMarche(etat: EtatPartie, posteId?: string): number {
  const secteur = secteurParId(etat.config.secteurId);
  const ville = villeParId(etat.config.villeId);
  return salaireMarchePoste(
    posteParId(posteId ?? secteur.postes[0]),
    ville.indiceSalaires,
    etat.conjoncture.indicePrix,
  );
}
