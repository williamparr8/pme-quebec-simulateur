/**
 * Comptabilité en partie double.
 *
 * Convention : chaque solde est conservé en cents, « débit positif ».
 * Un actif ou une charge a donc un solde positif; un passif, un compte de
 * capitaux propres ou un produit a un solde négatif. La somme de tous les
 * soldes vaut toujours 0 : c'est ce qui garantit un bilan équilibré.
 */
import type { Cents } from './util';

export type ClasseCompte = 'actif' | 'passif' | 'capitaux' | 'produit' | 'charge';

export type GroupeCompte =
  | 'actifCourt'
  | 'actifLong'
  | 'immobilisations'
  | 'passifCourt'
  | 'passifLong'
  | 'capitaux'
  | 'produits'
  | 'autresProduits'
  | 'cmv'
  | 'exploitation'
  | 'financieres'
  | 'amortissement'
  | 'impots';

interface DefinitionCompte {
  numero: string;
  nom: string;
  classe: ClasseCompte;
  groupe: GroupeCompte;
  /** Compte de contrepartie (ex. amortissement cumulé, qui réduit un actif). */
  contrepartie?: boolean;
}

export const PLAN_COMPTABLE = {
  encaisse: { numero: '1000', nom: 'Encaisse', classe: 'actif', groupe: 'actifCourt' },
  placements: {
    numero: '1050',
    nom: 'Placements à court terme',
    classe: 'actif',
    groupe: 'actifCourt',
  },
  comptesClients: { numero: '1100', nom: 'Comptes clients', classe: 'actif', groupe: 'actifCourt' },
  stocks: { numero: '1200', nom: 'Stocks de marchandises', classe: 'actif', groupe: 'actifCourt' },
  ctiARecouvrer: {
    numero: '1310',
    nom: 'TPS à recouvrer (CTI)',
    classe: 'actif',
    groupe: 'actifCourt',
  },
  rtiARecouvrer: {
    numero: '1320',
    nom: 'TVQ à recouvrer (RTI)',
    classe: 'actif',
    groupe: 'actifCourt',
  },
  depotGarantie: {
    numero: '1400',
    nom: 'Dépôt de garantie (bail)',
    classe: 'actif',
    groupe: 'actifLong',
  },
  equipement: { numero: '1500', nom: 'Équipement', classe: 'actif', groupe: 'immobilisations' },
  amortCumEquipement: {
    numero: '1510',
    nom: 'Amortissement cumulé – équipement',
    classe: 'actif',
    groupe: 'immobilisations',
    contrepartie: true,
  },
  ameliorationsLocatives: {
    numero: '1520',
    nom: 'Améliorations locatives',
    classe: 'actif',
    groupe: 'immobilisations',
  },
  amortCumAmeliorations: {
    numero: '1530',
    nom: 'Amortissement cumulé – améliorations locatives',
    classe: 'actif',
    groupe: 'immobilisations',
    contrepartie: true,
  },
  vehicules: { numero: '1540', nom: 'Véhicules', classe: 'actif', groupe: 'immobilisations' },
  amortCumVehicules: {
    numero: '1550',
    nom: 'Amortissement cumulé – véhicules',
    classe: 'actif',
    groupe: 'immobilisations',
    contrepartie: true,
  },
  informatique: {
    numero: '1560',
    nom: 'Matériel informatique et logiciels',
    classe: 'actif',
    groupe: 'immobilisations',
  },
  amortCumInformatique: {
    numero: '1570',
    nom: 'Amortissement cumulé – informatique',
    classe: 'actif',
    groupe: 'immobilisations',
    contrepartie: true,
  },
  margeCredit: { numero: '2050', nom: 'Marge de crédit', classe: 'passif', groupe: 'passifCourt' },
  comptesFournisseurs: {
    numero: '2100',
    nom: 'Comptes fournisseurs',
    classe: 'passif',
    groupe: 'passifCourt',
  },
  cotisationsAPayer: {
    numero: '2200',
    nom: 'Cotisations de l’employeur à payer',
    classe: 'passif',
    groupe: 'passifCourt',
  },
  retenuesAPayer: {
    numero: '2210',
    nom: 'Retenues à la source à remettre',
    classe: 'passif',
    groupe: 'passifCourt',
  },
  tpsAPayer: { numero: '2300', nom: 'TPS perçue', classe: 'passif', groupe: 'passifCourt' },
  tvqAPayer: { numero: '2310', nom: 'TVQ perçue', classe: 'passif', groupe: 'passifCourt' },
  taxesARegulariser: {
    numero: '2320',
    nom: 'Taxes, amendes et intérêts à payer (avis de cotisation)',
    classe: 'passif',
    groupe: 'passifCourt',
  },
  impotsAPayer: {
    numero: '2400',
    nom: 'Impôts sur le revenu à payer',
    classe: 'passif',
    groupe: 'passifCourt',
  },
  empruntBancaire: {
    numero: '2500',
    nom: 'Emprunts à long terme',
    classe: 'passif',
    groupe: 'passifLong',
  },
  capital: {
    numero: '3000',
    nom: 'Capital – propriétaire',
    classe: 'capitaux',
    groupe: 'capitaux',
  },
  capitalAssocie: {
    numero: '3010',
    nom: 'Capital – associé',
    classe: 'capitaux',
    groupe: 'capitaux',
  },
  capitalActions: {
    numero: '3050',
    nom: 'Capital-actions',
    classe: 'capitaux',
    groupe: 'capitaux',
  },
  prelevements: {
    numero: '3100',
    nom: 'Prélèvements du propriétaire',
    classe: 'capitaux',
    groupe: 'capitaux',
  },
  prelevementsAssocie: {
    numero: '3110',
    nom: 'Prélèvements de l’associé',
    classe: 'capitaux',
    groupe: 'capitaux',
  },
  benefNonRepartis: {
    numero: '3200',
    nom: 'Bénéfices non répartis',
    classe: 'capitaux',
    groupe: 'capitaux',
  },
  dividendes: {
    numero: '3300',
    nom: 'Dividendes déclarés',
    classe: 'capitaux',
    groupe: 'capitaux',
  },
  ventes: { numero: '4000', nom: 'Ventes', classe: 'produit', groupe: 'produits' },
  rabaisPromotions: {
    numero: '4100',
    nom: 'Rabais, promotions et récompenses de fidélité',
    classe: 'produit',
    groupe: 'produits',
  },
  revenusPlacement: {
    numero: '4500',
    nom: 'Revenus de placement',
    classe: 'produit',
    groupe: 'autresProduits',
  },
  subventions: {
    numero: '4600',
    nom: 'Subventions',
    classe: 'produit',
    groupe: 'autresProduits',
  },
  autresRevenus: {
    numero: '4700',
    nom: 'Autres revenus (indemnités d’assurance, cachets, locations)',
    classe: 'produit',
    groupe: 'autresProduits',
  },
  coutMarchandises: {
    numero: '5000',
    nom: 'Coût des marchandises vendues',
    classe: 'charge',
    groupe: 'cmv',
  },
  pertesStocks: {
    numero: '5050',
    nom: 'Pertes sur stocks (péremption)',
    classe: 'charge',
    groupe: 'cmv',
  },
  escomptesAchats: {
    numero: '5060',
    nom: 'Escomptes sur achats',
    classe: 'charge',
    groupe: 'cmv',
  },
  salaires: { numero: '5100', nom: 'Salaires', classe: 'charge', groupe: 'exploitation' },
  vacances: {
    numero: '5105',
    nom: 'Indemnités de vacances et de jours fériés',
    classe: 'charge',
    groupe: 'exploitation',
  },
  chargesSociales: {
    numero: '5110',
    nom: 'Charges sociales de l’employeur',
    classe: 'charge',
    groupe: 'exploitation',
  },
  avantagesSociaux: {
    numero: '5115',
    nom: 'Avantages sociaux',
    classe: 'charge',
    groupe: 'exploitation',
  },
  recrutement: {
    numero: '5120',
    nom: 'Frais de recrutement',
    classe: 'charge',
    groupe: 'exploitation',
  },
  formation: {
    numero: '5140',
    nom: 'Formation du personnel',
    classe: 'charge',
    groupe: 'exploitation',
  },
  salaireDirigeant: {
    numero: '5130',
    nom: 'Salaire du dirigeant',
    classe: 'charge',
    groupe: 'exploitation',
  },
  loyer: {
    numero: '5200',
    nom: 'Loyer et frais communs',
    classe: 'charge',
    groupe: 'exploitation',
  },
  electricite: {
    numero: '5210',
    nom: 'Électricité et chauffage',
    classe: 'charge',
    groupe: 'exploitation',
  },
  assurances: { numero: '5220', nom: 'Assurances', classe: 'charge', groupe: 'exploitation' },
  honoraires: {
    numero: '5230',
    nom: 'Honoraires professionnels',
    classe: 'charge',
    groupe: 'exploitation',
  },
  entretien: {
    numero: '5240',
    nom: 'Entretien et réparations',
    classe: 'charge',
    groupe: 'exploitation',
  },
  logiciels: {
    numero: '5250',
    nom: 'Logiciels et abonnements',
    classe: 'charge',
    groupe: 'exploitation',
  },
  telecom: {
    numero: '5260',
    nom: 'Téléphone et Internet',
    classe: 'charge',
    groupe: 'exploitation',
  },
  publicite: { numero: '5300', nom: 'Publicité', classe: 'charge', groupe: 'exploitation' },
  etudesMarche: {
    numero: '5310',
    nom: 'Études de marché',
    classe: 'charge',
    groupe: 'exploitation',
  },
  developpementProduits: {
    numero: '5320',
    nom: 'Développement de nouveaux produits',
    classe: 'charge',
    groupe: 'exploitation',
  },
  commissions: {
    numero: '5330',
    nom: 'Commissions des plateformes et frais de livraison',
    classe: 'charge',
    groupe: 'exploitation',
  },
  fraisExpedition: {
    numero: '5335',
    nom: 'Frais d’expédition et de déplacement',
    classe: 'charge',
    groupe: 'exploitation',
  },
  fraisDivers: {
    numero: '5490',
    nom: 'Frais divers',
    classe: 'charge',
    groupe: 'exploitation',
  },
  ecoresponsabilite: {
    numero: '5340',
    nom: 'Initiatives écoresponsables',
    classe: 'charge',
    groupe: 'exploitation',
  },
  fraisCartes: {
    numero: '5400',
    nom: 'Frais bancaires et de cartes',
    classe: 'charge',
    groupe: 'exploitation',
  },
  creancesIrrecouvrables: {
    numero: '5410',
    nom: 'Créances irrécouvrables',
    classe: 'charge',
    groupe: 'exploitation',
  },
  fraisDemarrage: {
    numero: '5450',
    nom: 'Frais de démarrage',
    classe: 'charge',
    groupe: 'exploitation',
  },
  droitsPermis: {
    numero: '5460',
    nom: 'Droits, permis et immatriculation',
    classe: 'charge',
    groupe: 'exploitation',
  },
  amendes: {
    numero: '5470',
    nom: 'Amendes et pénalités (non déductibles)',
    classe: 'charge',
    groupe: 'exploitation',
  },
  sinistres: {
    numero: '5480',
    nom: 'Pertes non assurées et vols',
    classe: 'charge',
    groupe: 'exploitation',
  },
  interets: {
    numero: '5500',
    nom: 'Intérêts et frais financiers',
    classe: 'charge',
    groupe: 'financieres',
  },
  amortissement: {
    numero: '5600',
    nom: 'Amortissement des immobilisations',
    classe: 'charge',
    groupe: 'amortissement',
  },
  impots: {
    numero: '5800',
    nom: 'Impôts sur le revenu',
    classe: 'charge',
    groupe: 'impots',
  },
} as const satisfies Record<string, DefinitionCompte>;

export type CompteId = keyof typeof PLAN_COMPTABLE;

export const COMPTES: readonly CompteId[] = Object.keys(PLAN_COMPTABLE) as CompteId[];

export function definitionCompte(id: CompteId): DefinitionCompte {
  return PLAN_COMPTABLE[id];
}

/** Catégories de l'état des flux de trésorerie (méthode directe). */
export type Activite = 'exploitation' | 'investissement' | 'financement';

export const FLUX = {
  encaissementsClients: { nom: 'Encaissements des clients', activite: 'exploitation' },
  paiementsFournisseurs: { nom: 'Paiements aux fournisseurs', activite: 'exploitation' },
  salairesVerses: { nom: 'Salaires versés', activite: 'exploitation' },
  remisesGouvernementales: {
    nom: 'Remises de retenues et cotisations (DAS)',
    activite: 'exploitation',
  },
  remisesTaxes: { nom: 'Remises nettes de TPS et de TVQ', activite: 'exploitation' },
  impotsPayes: { nom: 'Impôts sur le revenu payés', activite: 'exploitation' },
  droitsEtAmendes: { nom: 'Droits, permis, amendes et sinistres', activite: 'exploitation' },
  loyerEtFrais: { nom: 'Loyer et frais d’exploitation', activite: 'exploitation' },
  publicite: { nom: 'Publicité, marketing et recrutement', activite: 'exploitation' },
  formationAvantages: { nom: 'Formation et avantages sociaux', activite: 'exploitation' },
  commissionsLivraison: {
    nom: 'Commissions des plateformes et frais de livraison',
    activite: 'exploitation',
  },
  fraisBancaires: { nom: 'Frais bancaires et de cartes', activite: 'exploitation' },
  interetsPayes: { nom: 'Intérêts payés', activite: 'exploitation' },
  interetsRecus: { nom: 'Intérêts reçus', activite: 'exploitation' },
  subventionsRecues: { nom: 'Subventions reçues', activite: 'exploitation' },
  autresEncaissements: {
    nom: 'Autres encaissements (assurances, cachets, locations)',
    activite: 'exploitation',
  },
  achatStockInitial: { nom: 'Achat du stock initial', activite: 'exploitation' },
  fraisDemarrage: { nom: 'Frais de démarrage', activite: 'exploitation' },
  acquisitionImmobilisations: {
    nom: 'Acquisition d’immobilisations',
    activite: 'investissement',
  },
  depotGarantie: { nom: 'Dépôt de garantie versé', activite: 'investissement' },
  placementsNets: { nom: 'Placements à court terme (net)', activite: 'investissement' },
  apportsProprietaire: {
    nom: 'Apports des propriétaires et émission d’actions',
    activite: 'financement',
  },
  prelevementsProprietaire: { nom: 'Prélèvements des propriétaires', activite: 'financement' },
  dividendesVerses: { nom: 'Dividendes versés', activite: 'financement' },
  empruntsRecus: { nom: 'Emprunts obtenus', activite: 'financement' },
  remboursementsEmprunts: { nom: 'Remboursement du capital des emprunts', activite: 'financement' },
  margeCredit: { nom: 'Variation de la marge de crédit', activite: 'financement' },
} as const satisfies Record<string, { nom: string; activite: Activite }>;

export type FluxId = keyof typeof FLUX;

export interface LigneEcriture {
  compte: CompteId;
  /** Montant au débit, en cents (entier positif). */
  debit?: Cents;
  /** Montant au crédit, en cents (entier positif). */
  credit?: Cents;
}

export interface Ecriture {
  libelle: string;
  lignes: LigneEcriture[];
  /** Obligatoire si l'écriture touche l'encaisse : classe le mouvement dans l'état des flux. */
  flux?: FluxId;
}

export type Soldes = Record<CompteId, Cents>;
export type Mouvements = Partial<Record<CompteId, Cents>>;
export type MouvementsFlux = Partial<Record<FluxId, Cents>>;

export interface GrandLivre {
  soldes: Soldes;
  /** Mouvements nets du mois en cours (débit positif). */
  mouvementsMois: Mouvements;
  /** Variation de l'encaisse du mois en cours, par catégorie de flux. */
  fluxMois: MouvementsFlux;
  /** Écritures du mois en cours (journal général). */
  ecrituresMois: Ecriture[];
}

export function soldesVides(): Soldes {
  const soldes = {} as Soldes;
  for (const id of COMPTES) soldes[id] = 0;
  return soldes;
}

export function creerGrandLivre(): GrandLivre {
  return { soldes: soldesVides(), mouvementsMois: {}, fluxMois: {}, ecrituresMois: [] };
}

export class ErreurComptable extends Error {}

function validerMontant(montant: number | undefined, libelle: string): Cents {
  const m = montant ?? 0;
  if (!Number.isInteger(m) || m < 0) {
    throw new ErreurComptable(`Montant invalide (${m}) dans l'écriture « ${libelle} »`);
  }
  return m;
}

/**
 * Passe une écriture au grand livre. Lance une erreur si l'écriture n'est pas
 * équilibrée (débits ≠ crédits) ou si un mouvement d'encaisse n'est pas classé.
 * Les lignes à zéro sont ignorées; une écriture entièrement nulle n'est pas conservée.
 */
export function passerEcriture(livre: GrandLivre, ecriture: Ecriture): void {
  let debits = 0;
  let credits = 0;
  const lignes = ecriture.lignes.filter((l) => (l.debit ?? 0) !== 0 || (l.credit ?? 0) !== 0);
  for (const ligne of lignes) {
    const d = validerMontant(ligne.debit, ecriture.libelle);
    const c = validerMontant(ligne.credit, ecriture.libelle);
    if (d > 0 && c > 0) {
      throw new ErreurComptable(
        `Une ligne ne peut être au débit et au crédit (« ${ecriture.libelle} »)`,
      );
    }
    debits += d;
    credits += c;
  }
  if (debits !== credits) {
    throw new ErreurComptable(
      `Écriture déséquilibrée « ${ecriture.libelle} » : débits ${debits} ≠ crédits ${credits}`,
    );
  }
  if (debits === 0) return;

  for (const ligne of lignes) {
    const net = (ligne.debit ?? 0) - (ligne.credit ?? 0);
    livre.soldes[ligne.compte] += net;
    livre.mouvementsMois[ligne.compte] = (livre.mouvementsMois[ligne.compte] ?? 0) + net;
    if (ligne.compte === 'encaisse') {
      if (!ecriture.flux) {
        throw new ErreurComptable(
          `Mouvement d'encaisse sans catégorie de flux (« ${ecriture.libelle} »)`,
        );
      }
      livre.fluxMois[ecriture.flux] = (livre.fluxMois[ecriture.flux] ?? 0) + net;
    }
  }
  livre.ecrituresMois.push({ ...ecriture, lignes });
}

/** Raccourci : débite un compte et crédite un autre du même montant. */
export function ecritureSimple(
  livre: GrandLivre,
  libelle: string,
  debit: CompteId,
  credit: CompteId,
  montant: Cents,
  flux?: FluxId,
): void {
  if (montant === 0) return;
  if (montant < 0) {
    ecritureSimple(livre, libelle, credit, debit, -montant, flux);
    return;
  }
  passerEcriture(livre, {
    libelle,
    flux,
    lignes: [
      { compte: debit, debit: montant },
      { compte: credit, credit: montant },
    ],
  });
}

/** Balance de vérification : la somme des soldes doit être nulle. */
export function totalBalance(soldes: Soldes): Cents {
  let total = 0;
  for (const id of COMPTES) total += soldes[id];
  return total;
}

/** Réinitialise les cumuls du mois (après l'archivage). */
export function ouvrirNouveauMois(livre: GrandLivre): void {
  livre.mouvementsMois = {};
  livre.fluxMois = {};
  livre.ecrituresMois = [];
}

/** Comment les capitaux propres sont structurés selon la forme juridique. */
export type TypeCapitaux = 'proprietaire' | 'associes' | 'actions';

/**
 * Clôture de l'exercice : les produits et les charges sont virés aux capitaux propres.
 * - Entreprise individuelle : au capital du propriétaire (avec les prélèvements).
 * - Société de personnes : réparti entre les associés selon `partAssocie`.
 * - Société par actions : aux bénéfices non répartis (avec les dividendes).
 * La somme des soldes reste nulle. Retourne le résultat de l'exercice (cents).
 */
export function cloturerExercice(
  livre: GrandLivre,
  type: TypeCapitaux = 'proprietaire',
  partAssocie = 0,
): Cents {
  let resultat = 0;
  for (const id of COMPTES) {
    const def = PLAN_COMPTABLE[id];
    if (def.classe === 'produit' || def.classe === 'charge') {
      resultat -= livre.soldes[id];
      livre.soldes[id] = 0;
    }
  }
  const s = livre.soldes;
  // Un bénéfice (résultat > 0) augmente un compte de capitaux, qui a un solde créditeur (négatif).
  if (type === 'actions') {
    s.benefNonRepartis -= resultat;
    s.benefNonRepartis += s.dividendes;
    s.dividendes = 0;
  } else {
    const partDeLAssocie = type === 'associes' ? Math.round(resultat * partAssocie) : 0;
    s.capitalAssocie -= partDeLAssocie;
    s.capital -= resultat - partDeLAssocie;
    s.capitalAssocie += s.prelevementsAssocie;
    s.prelevementsAssocie = 0;
  }
  s.capital += s.prelevements;
  s.prelevements = 0;
  return resultat;
}

/** Virement du capital du propriétaire au capital-actions lors de l'incorporation (roulement). */
export function convertirEnCapitalActions(livre: GrandLivre): Cents {
  const montant = -(livre.soldes.capital + livre.soldes.capitalAssocie);
  livre.soldes.capitalActions += livre.soldes.capital + livre.soldes.capitalAssocie;
  livre.soldes.capital = 0;
  livre.soldes.capitalAssocie = 0;
  return montant;
}
