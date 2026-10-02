/** Types de l'état d'une partie. Tout l'état est sérialisable en JSON (sauvegarde). */
import type { GrandLivre, Ecriture, Mouvements, MouvementsFlux, Soldes } from './accounting';
import type { Concurrent } from './ai-competitors';
import type { ClasseDpa, IdSourceFinancement, IdTypeEtude, TypeImmobilisation } from './data-types';
import type { Conjoncture } from './economy';
import type { EffetDilemme } from './events';
import type { Pret, TypeTaux } from './loans';
import type { VenteLigne } from './market';
import type { Cents } from './util';

export type Difficulte = 'facile' | 'realiste' | 'expert';
export const DUREES_PARTIE = [12, 24, 36, 60] as const;
export type DureePartie = (typeof DUREES_PARTIE)[number];

/** Version du format de sauvegarde (3 : Jalon 4). */
export const VERSION_ETAT = 3;

export interface ConfigPartie {
  graine: number;
  difficulte: Difficulte;
  dureeMois: DureePartie;
  secteurId: string;
  villeId: string;
  /** Première année de la partie (l'exercice financier suit l'année civile). */
  anneeDepart: number;
  /** Tutoriel guidé pendant les 3 premiers mois. */
  tutoriel?: boolean;
  /** Scénario choisi (mode Prof / Scénario), avec ses objectifs. */
  scenarioId?: string;
}

/** Mini plan d'affaires présenté aux prêteurs. */
export interface PlanAffaires {
  /** Ventes mensuelles moyennes prévues la première année ($). */
  ventesMensuelles: number;
  /** Marge brute prévue (0 à 1). */
  margeBrute: number;
  /** Clientèle visée en priorité (persona). */
  clienteleCible: string;
  /** Mois de fonds de roulement prévus pour couvrir les charges fixes. */
  moisFondsRoulement: number;
}

export type MethodeInventaire = 'coutMoyen' | 'peps';

/** Choix faits à la création de l'entreprise. */
export interface ParametresDemarrage {
  nomEntreprise: string;
  nomProprietaire: string;
  couleur: string;
  emplacementId: string;
  equipementId: string;
  amenagementId: string;
  /** Mise de fonds personnelle du propriétaire ($). */
  apportPersonnel: number;
  /** Prêt bancaire de démarrage demandé ($). */
  montantPret: number;
  typeTauxPret: TypeTaux;
  formeJuridique: FormeJuridique;
  /** Société de personnes : nom et apport de l'associé ($). */
  nomAssocie: string;
  apportAssocie: number;
  /** Démarches de démarrage faites avant l'ouverture. */
  demarches: IdDemarche[];
  /** Inscription aux fichiers de la TPS et de la TVQ dès l'ouverture. */
  inscritTaxes: boolean;
  /** Âge du propriétaire (programmes pour les 18 à 39 ans). */
  ageProprietaire: number;
  /** Autres sources de financement demandées ($). */
  financements: Partial<Record<IdSourceFinancement, number>>;
  planAffaires: PlanAffaires | null;
  methodeInventaire: MethodeInventaire;
  /** Nom de l'équipe (mode équipes en alternance). */
  nomEquipe?: string;
  /** Parcours du propriétaire (compétences de départ). */
  profil?: 'gestion' | 'finance' | 'marketing' | 'rh' | 'fiscalite';
}

/**
 * Formes juridiques simulées :
 * - individuelle : entreprise individuelle
 * - senc : société en nom collectif (associés solidairement responsables)
 * - sec : société en commandite (commandité responsable, commanditaire limité à son apport)
 * - inc-qc / inc-federal : société par actions (Loi sur les sociétés par actions du Québec / LCSA)
 */
export type FormeJuridique = 'individuelle' | 'senc' | 'sec' | 'inc-qc' | 'inc-federal';

export const FORMES_SOCIETE_PERSONNES: readonly FormeJuridique[] = ['senc', 'sec'];
export const FORMES_SOCIETE_ACTIONS: readonly FormeJuridique[] = ['inc-qc', 'inc-federal'];

export type IdDemarche =
  | 'req'
  | 'retenues'
  | 'cnesst'
  | 'permisMunicipal'
  | 'mapaq'
  | 'assurances'
  | 'compteBancaire'
  | 'francisation'
  | 'racj'
  | 'pesticides'
  | 'confidentialite';

export type FrequenceTaxes = 'mensuelle' | 'trimestrielle' | 'annuelle';

/** Cumul annuel de la paie d'un salarié (pour les relevés T4 et RL-1). */
export interface CumulPaie {
  nom: string;
  brut: number;
  impotFederal: number;
  impotQuebec: number;
  rrq: number;
  rqap: number;
  assuranceEmploi: number;
}

/** Résumé des déclarations de fin d'exercice. */
export interface DeclarationAnnuelle {
  annee: number;
  forme: FormeJuridique;
  /** Bénéfice comptable avant impôts sur le revenu. */
  beneficeComptable: number;
  amortissementComptable: number;
  /** Déduction pour amortissement (fiscale). */
  dpa: number;
  /** DPA par catégorie. */
  dpaParClasse: Partial<Record<ClasseDpa, number>>;
  /** Dépenses non déductibles (amendes et pénalités). */
  nonDeductibles: number;
  /** Revenu net d'entreprise selon les règles fiscales. */
  revenuFiscal: number;
  pertesUtilisees: number;
  pertesReportees: number;
  heuresRemunerees: number;
  /** Société par actions (T2 et CO-17). */
  societe?: {
    revenuImposable: number;
    facteurDpeQuebec: number;
    impotFederal: number;
    impotQuebec: number;
    total: number;
    acomptesVerses: number;
    solde: number;
  };
  /** Propriétaire (T1 et TP-1) : revenu d'entreprise ou salaire et dividendes. */
  personnel: {
    revenuEntreprise: number;
    salaire: number;
    dividendes: number;
    impotFederal: number;
    impotQuebec: number;
    cotisations: number;
    total: number;
  };
  /** Relevés T4 et RL-1 produits pour les salariés. */
  feuillets: CumulPaie[];
  taxes: { tpsPercue: number; tvqPercue: number; cti: number; rti: number };
}

export interface EtatFiscal {
  inscritTaxes: boolean;
  frequenceTaxes: FrequenceTaxes;
  /** Ventes taxables des 12 derniers mois (pour le seuil du petit fournisseur). */
  ventesTaxablesMois: number[];
  /** L'inscription aux taxes est devenue obligatoire (seuil de 30 000 $ dépassé). */
  doitSInscrire: boolean;
  /** Ventes faites sans percevoir les taxes alors que l'inscription était obligatoire. */
  ventesNonTaxees: number;
  /** Fraction non amortie du coût en capital (FNACC) par catégorie, en dollars. */
  fnacc: Partial<Record<ClasseDpa, number>>;
  /** Acquisitions de l'année par catégorie (incitatif à l'investissement accéléré). */
  ajoutsAnnee: Partial<Record<ClasseDpa, number>>;
  /** Coût total des améliorations locatives (catégorie 13, amorties sur la durée du bail). */
  coutAmeliorations: number;
  pertesReportees: number;
  /** Acompte provisionnel mensuel d'impôt (société). */
  acompteMensuel: number;
  acomptesVersesAnnee: number;
  /** Solde d'impôt de l'exercice précédent à payer (positif) ou à recevoir (négatif), réglé en mars. */
  soldeImpotAPayer: number;
  heuresRemunereesAnnee: number;
  paieAnnee: Record<string, CumulPaie>;
  taxesAnnee: { tpsPercue: number; tvqPercue: number; cti: number; rti: number };
  declarations: DeclarationAnnuelle[];
  /** Années pour lesquelles la déclaration de mise à jour annuelle du REQ a été produite. */
  majAnnuelles: number[];
  incorporationPrevue: 'inc-qc' | 'inc-federal' | null;
}

/** Politique d'approvisionnement d'une ligne de produits. */
export interface PolitiqueAppro {
  fournisseurId: string;
  /** Calculer automatiquement le point de commande et la quantité (QEC). */
  auto: boolean;
  /** Point de commande (unités). */
  pointCommande: number;
  /** Quantité commandée à chaque fois (unités). */
  quantite: number;
}

export type ReponseAvis = 'ignorer' | 'repondre' | 'compenser';

/** Décisions modifiables à chaque tour. Elles restent en vigueur d'un mois à l'autre. */
export interface Decisions {
  /** Prix de vente par ligne de produits, avant taxes ($). */
  prix: Record<string, number>;
  qualiteId: string;
  /** Budget de publicité du mois par canal ($). */
  publicite: Record<string, number>;
  /** Rabais promotionnel sur tous les prix ce mois-ci (0 à 0,3; remis à 0 après le mois). */
  promotion: number;
  programmeFidelite: boolean;
  initiativesEco: string[];
  /** Inscription au répertoire de l'achat local (Panier Bleu). */
  panierBleu: boolean;
  /** Offrir les produits sur une plateforme de livraison. */
  livraison: boolean;
  reponseAvis: ReponseAvis;
  /** Remplacer gratuitement un produit raté (politique de satisfaction garantie). */
  satisfactionGarantie: boolean;
  /** Heures d'ouverture par semaine. */
  heuresOuverture: number;
  /** Heures travaillées par le propriétaire par semaine (non payées : il se paie par ses prélèvements). */
  heuresProprietaire: number;
  avantages: string[];
  approvisionnement: Record<string, PolitiqueAppro>;
  /** Payer en 10 jours les fournisseurs qui offrent un escompte (2/10 net 30). */
  prendreEscomptes: boolean;
  methodeInventaire: MethodeInventaire;
  /** Prélèvements mensuels du propriétaire pour vivre ($). */
  prelevements: number;
  /** Rembourser automatiquement la marge de crédit quand l'encaisse le permet. */
  remboursementAutoMarge: boolean;
  /** Apport ponctuel du propriétaire ce mois-ci ($, remis à 0 après le mois). */
  apportPonctuel: number;
  /** Remboursement anticipé des emprunts ce mois-ci ($, remis à 0 après le mois). */
  remboursementAnticipe: number;
  /** Société par actions : salaire brut mensuel du dirigeant ($). */
  salaireDirigeant: number;
  /** Société par actions : dividende versé ce mois-ci ($, remis à 0 après le mois). */
  dividendePonctuel: number;
  /** Prévision du mois faite par le joueur (budget), remise à null après le mois. */
  prevision: { ventes: number; benefice: number } | null;
}

export interface Employe {
  id: string;
  prenom: string;
  nom: string;
  posteId: string;
  heuresSemaine: number;
  salaireHoraire: number;
  /** Moral de 0 à 100. */
  moral: number;
  /** Compétence : 1 = employé moyen. */
  competence: number;
  /** Années d'expérience à l'embauche. */
  experience: number;
  trait: string;
  formations: string[];
  moisAnciennete: number;
  /** Salaire brut cumulé depuis le 1er janvier (pour les plafonds de cotisation). */
  cumulBrutAnnee: number;
  /** Index du mois de la dernière évaluation (null : jamais). */
  derniereEvaluation: number | null;
  /** Index du mois de la dernière augmentation (null : jamais). */
  derniereAugmentation: number | null;
  /** Taux d'absentéisme du dernier mois. */
  absenteisme: number;
}

export interface Candidat {
  id: string;
  prenom: string;
  nom: string;
  posteId: string;
  competence: number;
  experience: number;
  /** Salaire horaire espéré ($). */
  attentes: number;
  trait: string;
  heuresSouhaitees: number;
  plateformeId: string;
  /** Dernier mois (index) où le candidat est disponible. */
  expire: number;
  statut: 'disponible' | 'refuse';
}

export interface Affichage {
  id: string;
  posteId: string;
  plateformeId: string;
  moisPublication: number;
  /** Index du mois où les candidatures arrivent. */
  moisCandidats: number;
}

export interface EtatRH {
  candidats: Candidat[];
  affichages: Affichage[];
  /** Départs (démissions et fins d'emploi) : index du mois. */
  departs: { index: number; type: 'demission' | 'finEmploi' }[];
  /** Mois consécutifs avec un moral moyen très bas. */
  moisMoralBas: number;
  syndicat: { statut: 'aucun' | 'accredite'; depuis: number };
  /** Le propriétaire a suivi la formation de gestionnaire en hygiène et salubrité. */
  gestionnaireHygiene: boolean;
}

export interface EtatClientele {
  notoriete: number;
  qualitePercue: number;
  service: number;
  satisfaction: number;
  note: number;
  nbAvis: number;
}

export interface ProduitLance {
  ligneId: string;
  statut: 'developpement' | 'actif' | 'retire';
  moisDisponible: number;
  /** Multiplicateur de la demande (succès ≈ 1, échec ≈ 0,3). */
  facteur: number;
  succes: boolean;
}

export interface Estimation {
  valeur: number;
  /** Marge d'erreur (± au niveau de confiance de 95 %), 0 si non applicable. */
  marge: number;
}

export interface EtudeMarche {
  id: string;
  typeId: IdTypeEtude;
  index: number;
  annee: number;
  mois: number;
  taille: number | null;
  notorieteSegments?: Record<string, Estimation>;
  notoriete?: Estimation;
  satisfaction?: Estimation;
  /** Prix jugé acceptable par la majorité, par ligne ($). */
  prixAcceptable?: Record<string, Estimation>;
  /** Potentiel du marché (visites par mois). */
  potentiel?: Estimation;
  /** Parts de segment du marché. */
  partsSegments?: Record<string, number>;
  /** Critères les plus importants par persona (du plus au moins important). */
  criteres?: Record<string, string[]>;
  /** Nouveaux produits les plus prometteurs (du meilleur au moins bon). */
  produitsPrometteurs?: string[];
  perception?: { qualite: number; service: number; ambiance: number; prix: number };
  concurrents?: {
    id: string;
    part: Estimation;
    budgetPublicite: number;
    qualite: number;
    ventesMensuelles: number;
  }[];
}

export interface EtatMarketing {
  notorieteSegments: Record<string, number>;
  /** Effets de la publicité à venir (délais et effets répartis sur plusieurs mois). */
  effetsDifferes: { mois: number; gains: Record<string, number> }[];
  /** Image de marque (0 à 1). */
  image: number;
  /** Part des clients membres du programme de fidélité. */
  adhesionFidelite: number;
  clientsActifs: number;
  retention: number;
  /** Mois (index) où une promotion a eu lieu. */
  historiquePromos: number[];
  /** Initiatives écoresponsables dont le coût initial est payé. */
  initiativesPayees: string[];
  /** Taux de rupture perçu par les clients (lissé). */
  tauxRupturePercu: number;
  etudes: EtudeMarche[];
  produits: ProduitLance[];
}

export interface Lot {
  quantite: number;
  /** Coût unitaire ($). */
  cout: number;
  /** Jours avant la péremption. */
  joursRestants: number;
}

export interface StockLigne {
  lots: Lot[];
  commandes: { quantite: number; cout: number; jours: number }[];
  /** Coût moyen pondéré ($ par unité). */
  coutMoyen: number;
  /** Ventes du dernier mois (unités) : base des calculs automatiques. */
  demandeRecente: number;
}

export interface EtatOperations {
  stocks: Record<string, StockLigne>;
  tauxDefauts: number;
  /** Fournisseurs qui ont fermé leurs portes (faillite). */
  fournisseursFermes?: string[];
}

export interface Immobilisation {
  id: string;
  nom: string;
  type: TypeImmobilisation;
  classeDpa: ClasseDpa;
  cout: number;
  dureeVieMois: number;
  /** Index du mois d'acquisition (-1 : avant l'ouverture). */
  acquisition: number;
  /** Amortissement comptable cumulé (cents). */
  amortCumule: Cents;
  investissementId?: string;
}

export interface Placement {
  id: string;
  typeId: string;
  montant: Cents;
  taux: number;
  /** Index du mois d'échéance (null : retrait en tout temps). */
  echeance: number | null;
}

export interface Actionnaire {
  nom: string;
  part: number;
  type: 'fondateur' | 'ange';
}

export interface EtatFinance {
  placements: Placement[];
  actionnaires: Actionnaire[];
}

export interface AppelOffres {
  id: string;
  client: string;
  typeClient: string;
  quantiteParMois: number;
  dureeMois: number;
  delaiPaiementJours: 30 | 45 | 60;
  cote: 'A' | 'B' | 'C';
  /** Prix unitaire visé par le client (caché au joueur). */
  prixCible: number;
  nbConcurrents: number;
  expire: number;
  soumission: number | null;
}

export interface Contrat {
  id: string;
  client: string;
  cote: 'A' | 'B' | 'C';
  quantiteParMois: number;
  prixUnitaire: number;
  moisRestants: number;
  delaiPaiementJours: 30 | 45 | 60;
  /** Satisfaction du client (0 à 1). */
  satisfaction: number;
}

export interface Facture {
  id: string;
  contratId: string;
  client: string;
  cote: 'A' | 'B' | 'C';
  emission: number;
  echeance: number;
  ht: Cents;
  tps: Cents;
  tvq: Cents;
  statut: 'ouverte' | 'payee' | 'radiee';
}

export interface EtatB2B {
  appels: AppelOffres[];
  contrats: Contrat[];
  factures: Facture[];
  /** Résultat des soumissions du dernier mois. */
  resultats: { client: string; gagne: boolean; prix: number }[];
}

export interface DilemmeEnCours {
  id: string;
  defId: string;
  employeId: string | null;
  nomEmploye: string;
  index: number;
  /** Valeurs propres à cet événement (ex. concurrent visé, montant d'une offre). */
  params?: { concurrentId?: string; concurrent?: string; prix?: number };
}

/** Effet temporaire d'un événement (dure quelques mois). */
export interface Modificateur {
  type: 'demande' | 'couts' | 'capacite' | 'penurie' | 'fraisParVisite' | 'delais';
  /** Multiplicateur (demande, coûts, capacité, frais) ou valeur ajoutée (pénurie, jours de délai). */
  valeur: number;
  moisRestants: number;
  libelle: string;
  /** Délais : le calcul automatique des commandes en tient compte. */
  anticipation?: boolean;
}

export interface RisqueDiffere {
  code: string;
  echeance: number;
  probabilite: number;
  effets: EffetDilemme[];
}

/** Effets temporaires à appliquer au prochain mois simulé. */
export interface EffetsMois {
  capacite: number;
  heuresProprietaire: number;
  /** Primes à verser avec la prochaine paie ($ bruts au total). */
  primes: number;
  /** Jours de fermeture causés par un événement (sinistre, tournage…). */
  joursFermeture: number;
  pertesRecurrentes: { montant: number; moisRestants: number; libelle: string }[];
  /** Revenus récurrents (ex. location d'une chaise à un travailleur autonome). */
  revenusRecurrents: { montant: number; moisRestants: number; libelle: string }[];
}

export interface Indicateurs {
  potentiel: number;
  demande: number;
  servies: number;
  perduesCapacite: number;
  perduesRupture: number;
  /** Unités non vendues faute de capacité de production (cuisine, atelier, équipes). */
  perduesProduction: number;
  partMarche: number;
  ventesParLigne: VenteLigne[];
  chiffreAffaires: number;
  /** Ventes en magasin, par livraison et aux entreprises ($). */
  ventesMagasin: number;
  ventesLivraison: number;
  ventesB2B: number;
  rabais: number;
  ticketMoyen: number;
  beneficeNet: number;
  tauxMargeBrute: number;
  /** Salaires et charges sociales / ventes. */
  tauxMainOeuvre: number;
  encaisse: number;
  margeCreditUtilisee: number;
  notoriete: number;
  notorieteSegments: Record<string, number>;
  /** Clients servis par persona. */
  serviesSegments: Record<string, number>;
  qualitePercue: number;
  service: number;
  satisfaction: number;
  note: number;
  nbAvis: number;
  nps: number;
  image: number;
  retention: number;
  clientsActifs: number;
  nouveauxClients: number;
  /** Coût d'acquisition d'un client ($). */
  cac: number;
  /** Valeur à vie d'un client (marge brute) ($). */
  clv: number;
  depensesMarketing: number;
  tauxDefauts: number;
  plaintes: number;
  moral: number;
  nbEmployes: number;
  absenteisme: number;
  heuresOuvertureEffectives: number;
  capacite: number;
  /** Heures de production disponibles et demandées ce mois-ci. */
  capaciteProduction: number;
  demandeProduction: number;
  utilisation: number;
  tauxDirecteur: number;
  tauxPreferentiel: number;
  inflation: number;
  /** Taux de chômage de la région. */
  chomage: number;
  tauxChange: number;
  salaireMinimum: number;
  /** Indice de prix de l'entreprise par rapport au marché (1 = prix du marché). */
  indicePrixOffre: number;
  /** Salaires, vacances et charges sociales du mois ($). */
  coutMainOeuvre: number;
}

/** Résultat de l'approvisionnement d'une ligne pendant le mois. */
export interface StockLigneMois {
  ligneId: string;
  demandees: number;
  vendues: number;
  perdues: number;
  perimees: number;
  refaites: number;
  commandes: number;
  unitesAchetees: number;
  coutAchats: number;
  stockFinUnites: number;
  valeurFin: number;
  pointCommande: number;
  quantite: number;
}

export type NiveauMessage = 'succes' | 'info' | 'alerte' | 'danger';

/** Message du rapport mensuel. Le texte est produit par l'interface (i18n) à partir du code. */
export interface Message {
  code: string;
  niveau: NiveauMessage;
  params?: Record<string, number | string>;
}

export interface MoisArchive {
  /** Index du mois dans la partie (0 = premier mois). */
  index: number;
  annee: number;
  mois: number;
  mouvements: Mouvements;
  soldesFin: Soldes;
  flux: MouvementsFlux;
  ecritures: Ecriture[];
  /** Portion à court terme de la dette à la fin du mois (cents). */
  portionCouranteDette: Cents;
  indicateurs: Indicateurs;
  stocks: StockLigneMois[];
  prevision: { ventes: number; benefice: number } | null;
  messages: Message[];
  /** Concurrents : ventes et parts publiques estimées. */
  concurrents: { id: string; part: number; prixIndice: number; note: number; notoriete: number }[];
  /** Résumé des décisions du mois (sert au rapport de fin : meilleures et pires décisions). */
  resume?: ResumeDecisions;
}

/** Résumé chiffré des décisions d'un mois, comparé d'un mois à l'autre. */
export interface ResumeDecisions {
  indicePrix: number;
  qualite: string;
  publicite: number;
  heuresOuverture: number;
  nbEmployes: number;
  masseSalarialeHoraire: number;
  promotion: boolean;
  fidelite: boolean;
  livraison: boolean;
  eco: number;
  immobilisations: number;
  prets: number;
  produits: number;
}

/** Choix fait devant un événement (journal pour le rapport de fin). */
export interface ChoixJournal {
  index: number;
  defId: string;
  choixId: string;
}

/** Résultats aux quiz et bonus pédagogique accumulé. */
export interface EtatPedagogie {
  quiz: { index: number; questions: string[]; bonnes: number }[];
  /** Rabais sur la prochaine formation ou étude de marché (0 à 0,5). */
  rabais: number;
}

export interface Bail {
  loyerMensuel: Cents;
  dureeMois: number;
  /** Hausse annuelle du loyer à chaque anniversaire du bail. */
  indexation: number;
}

export interface MargeCredit {
  limite: Cents;
  /** Écart au-dessus du taux préférentiel. */
  ecartTaux: number;
}

export interface Entreprise {
  id: string;
  nom: string;
  proprietaire: string;
  ageProprietaire: number;
  couleur: string;
  formeJuridique: FormeJuridique;
  /** Société de personnes : l'associé et sa part des bénéfices (0 à 1). */
  associe: { nom: string; part: number } | null;
  /** Démarches de démarrage faites (vrai) ou oubliées (faux). */
  demarches: Record<IdDemarche, boolean>;
  fiscal: EtatFiscal;
  emplacementId: string;
  equipementId: string;
  amenagementId: string;
  decisions: Decisions;
  employes: Employe[];
  rh: EtatRH;
  clientele: EtatClientele;
  marketing: EtatMarketing;
  operations: EtatOperations;
  immobilisations: Immobilisation[];
  finance: EtatFinance;
  b2b: EtatB2B;
  dilemmes: DilemmeEnCours[];
  /** Dernier mois où chaque dilemme est survenu (pour éviter les répétitions). */
  historiqueDilemmes: Record<string, number>;
  risques: RisqueDiffere[];
  effetsMois: EffetsMois;
  livre: GrandLivre;
  prets: Pret[];
  margeCredit: MargeCredit;
  bail: Bail;
  /** Indemnités de fin d'emploi à verser avec la prochaine paie ($). */
  enAttente: { indemnites: number };
  archives: MoisArchive[];
  /** Nombre de mois consécutifs à découvert au-delà de la marge de crédit. */
  moisEnDefaut: number;
  enFaillite: boolean;
  /** Compteur d'identifiants (employés, candidats, contrats, factures…). */
  prochainId: number;
  /** Jours de fermeture forcée ce mois-ci (inspection, ordonnance, sinistre). */
  joursFermeture: number;
  /** Effets temporaires des événements. */
  modificateurs: Modificateur[];
  /** Vente de l'entreprise (fin de partie) : prix reçu et mois de la vente. */
  vente: { prix: number; index: number; acheteur: string } | null;
  /** Nom de l'équipe (mode équipes en alternance). */
  equipe?: string;
  journalChoix?: ChoixJournal[];
  pedagogie?: EtatPedagogie;
  /** Compétences du propriétaire (0 à 100) et formations qu'il a suivies. */
  competences?: Record<'gestion' | 'finance' | 'marketing' | 'rh' | 'fiscalite', number>;
  formationsProprietaire?: string[];
}

export interface EtatPartie {
  version: typeof VERSION_ETAT;
  config: ConfigPartie;
  /** Index du prochain mois à jouer (0 = le premier mois n'est pas encore joué). */
  moisCourant: number;
  rngState: number;
  conjoncture: Conjoncture;
  salaireMinimum: number;
  entreprises: Entreprise[];
  concurrents: Concurrent[];
  terminee: boolean;
  raisonFin?: 'duree' | 'faillite' | 'vente';
}
