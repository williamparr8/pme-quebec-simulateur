/**
 * Production des états financiers à partir du grand livre.
 * Tous les montants retournés sont en dollars (arrondis au cent).
 */
import {
  COMPTES,
  FLUX,
  PLAN_COMPTABLE,
  type Activite,
  type CompteId,
  type FluxId,
  type Mouvements,
  type MouvementsFlux,
  type Soldes,
} from './accounting';
import { versDollars, type Cents } from './util';

export interface LignePoste {
  compte: CompteId;
  libelle: string;
  montant: number;
}

export interface EtatResultats {
  /** Ventes avant les rabais, promotions et récompenses de fidélité. */
  ventesBrutes: number;
  rabais: number;
  /** Ventes nettes. */
  ventes: number;
  coutMarchandises: number;
  margeBrute: number;
  /** Marge brute en proportion des ventes (0 si aucune vente). */
  tauxMargeBrute: number;
  chargesExploitation: LignePoste[];
  totalChargesExploitation: number;
  /** Bénéfice avant intérêts, impôts et amortissement (BAIIA). */
  baiia: number;
  amortissement: number;
  /** Bénéfice d'exploitation (BAII). */
  baii: number;
  interets: number;
  /** Revenus de placement et subventions. */
  autresProduits: number;
  beneficeAvantImpot: number;
  impots: number;
  beneficeNet: number;
}

/** Additionne les mouvements de plusieurs mois. */
export function cumulerMouvements(liste: readonly Mouvements[]): Mouvements {
  const total: Mouvements = {};
  for (const m of liste) {
    for (const [compte, valeur] of Object.entries(m) as [CompteId, Cents][]) {
      total[compte] = (total[compte] ?? 0) + valeur;
    }
  }
  return total;
}

export function cumulerFlux(liste: readonly MouvementsFlux[]): MouvementsFlux {
  const total: MouvementsFlux = {};
  for (const m of liste) {
    for (const [flux, valeur] of Object.entries(m) as [FluxId, Cents][]) {
      total[flux] = (total[flux] ?? 0) + valeur;
    }
  }
  return total;
}

export function etatResultats(mouvements: Mouvements): EtatResultats {
  const m = (id: CompteId): Cents => mouvements[id] ?? 0;
  let ventes = 0;
  let autresProduits = 0;
  let cmv = 0;
  let exploitation = 0;
  let interets = 0;
  let amortissement = 0;
  let impots = 0;
  const chargesExploitation: LignePoste[] = [];

  for (const id of COMPTES) {
    const def = PLAN_COMPTABLE[id];
    if (def.classe === 'produit') {
      if (def.groupe === 'autresProduits') autresProduits -= m(id);
      else ventes -= m(id);
    } else if (def.classe === 'charge') {
      switch (def.groupe) {
        case 'cmv':
          cmv += m(id);
          break;
        case 'financieres':
          interets += m(id);
          break;
        case 'amortissement':
          amortissement += m(id);
          break;
        case 'impots':
          impots += m(id);
          break;
        default:
          exploitation += m(id);
          if (m(id) !== 0) {
            chargesExploitation.push({ compte: id, libelle: def.nom, montant: versDollars(m(id)) });
          }
      }
    }
  }

  const margeBrute = ventes - cmv;
  const baiia = margeBrute - exploitation;
  const baii = baiia - amortissement;
  const bai = baii - interets + autresProduits;
  return {
    ventesBrutes: versDollars(-m('ventes')),
    rabais: versDollars(m('rabaisPromotions')),
    ventes: versDollars(ventes),
    coutMarchandises: versDollars(cmv),
    margeBrute: versDollars(margeBrute),
    tauxMargeBrute: ventes > 0 ? margeBrute / ventes : 0,
    chargesExploitation,
    totalChargesExploitation: versDollars(exploitation),
    baiia: versDollars(baiia),
    amortissement: versDollars(amortissement),
    baii: versDollars(baii),
    interets: versDollars(interets),
    autresProduits: versDollars(autresProduits),
    beneficeAvantImpot: versDollars(bai),
    // Entreprise individuelle et société de personnes : aucun impôt ici, le bénéfice est imposé
    // dans la déclaration personnelle des propriétaires. Société par actions : impôt des sociétés.
    impots: versDollars(impots),
    beneficeNet: versDollars(bai - impots),
  };
}

export interface Bilan {
  actifCourt: LignePoste[];
  totalActifCourt: number;
  actifLong: LignePoste[];
  immobilisations: { libelle: string; cout: number; amortCumule: number; net: number }[];
  totalActifLong: number;
  totalActif: number;
  passifCourt: LignePoste[];
  totalPassifCourt: number;
  passifLong: LignePoste[];
  totalPassifLong: number;
  totalPassif: number;
  capitaux: {
    /** Postes des capitaux propres, selon la forme juridique. */
    lignes: { libelle: string; montant: number }[];
    capital: number;
    beneficeExercice: number;
    prelevements: number;
    total: number;
  };
  totalPassifEtCapitaux: number;
  /** Écart entre l'actif et le passif + capitaux (doit être 0). */
  ecart: number;
}

/**
 * Bilan à partir des soldes. `portionCouranteDette` est la partie de l'emprunt
 * remboursable dans les 12 prochains mois : elle est présentée au passif à court terme.
 */
export function bilan(soldes: Soldes, portionCouranteDette: Cents = 0): Bilan {
  const s = (id: CompteId): Cents => soldes[id];

  const actifCourt: LignePoste[] = [];
  const ajouter = (liste: LignePoste[], compte: CompteId, montant: Cents, libelle?: string) => {
    if (montant !== 0) {
      liste.push({
        compte,
        libelle: libelle ?? PLAN_COMPTABLE[compte].nom,
        montant: versDollars(montant),
      });
    }
  };

  const encaisse = s('encaisse');
  if (encaisse >= 0) ajouter(actifCourt, 'encaisse', encaisse);
  // Comptes à court terme dont le solde peut être débiteur (actif) ou créditeur (passif).
  const courants: CompteId[] = [
    'placements',
    'comptesClients',
    'stocks',
    'ctiARecouvrer',
    'rtiARecouvrer',
    'comptesFournisseurs',
    'retenuesAPayer',
    'cotisationsAPayer',
    'tpsAPayer',
    'tvqAPayer',
    'taxesARegulariser',
    'impotsAPayer',
  ];
  const nomsInverses: Partial<Record<CompteId, string>> = {
    impotsAPayer: 'Impôts sur le revenu à recevoir (acomptes en trop)',
    tpsAPayer: 'TPS à recevoir',
    tvqAPayer: 'TVQ à recevoir',
  };
  let totalActifCourt = Math.max(0, encaisse);
  for (const id of courants) {
    if (s(id) > 0) {
      ajouter(
        actifCourt,
        id,
        s(id),
        PLAN_COMPTABLE[id].classe === 'passif' ? nomsInverses[id] : undefined,
      );
      totalActifCourt += s(id);
    }
  }

  const actifLong: LignePoste[] = [];
  ajouter(actifLong, 'depotGarantie', s('depotGarantie'));
  const paires: [CompteId, CompteId][] = [
    ['equipement', 'amortCumEquipement'],
    ['ameliorationsLocatives', 'amortCumAmeliorations'],
    ['vehicules', 'amortCumVehicules'],
    ['informatique', 'amortCumInformatique'],
  ];
  const immobilisations = paires
    .map(([actif, cumul]) => ({
      libelle: PLAN_COMPTABLE[actif].nom,
      cout: versDollars(s(actif)),
      amortCumule: versDollars(-s(cumul)),
      net: versDollars(s(actif) + s(cumul)),
    }))
    .filter((i) => i.cout !== 0);
  const totalActifLong =
    s('depotGarantie') + paires.reduce((a, [actif, cumul]) => a + s(actif) + s(cumul), 0);

  const emprunt = -s('empruntBancaire');
  const portionCourante = Math.min(Math.max(0, portionCouranteDette), emprunt);

  const passifCourt: LignePoste[] = [];
  if (encaisse < 0) ajouter(passifCourt, 'encaisse', -encaisse, 'Découvert bancaire');
  ajouter(passifCourt, 'margeCredit', -s('margeCredit'));
  let totalPassifCourt = Math.max(0, -encaisse) - s('margeCredit') + portionCourante;
  for (const id of courants) {
    if (s(id) < 0) {
      ajouter(passifCourt, id, -s(id));
      totalPassifCourt -= s(id);
    }
  }
  ajouter(
    passifCourt,
    'empruntBancaire',
    portionCourante,
    'Portion de la dette à long terme échéant à moins d’un an',
  );

  const passifLong: LignePoste[] = [];
  ajouter(
    passifLong,
    'empruntBancaire',
    emprunt - portionCourante,
    'Emprunt bancaire (long terme)',
  );
  const totalPassifLong = emprunt - portionCourante;

  let resultatExercice = 0;
  for (const id of COMPTES) {
    const classe = PLAN_COMPTABLE[id].classe;
    if (classe === 'produit' || classe === 'charge') resultatExercice -= s(id);
  }
  const capital = -s('capital');
  const prelevements = s('prelevements');
  const lignesCapitaux: { libelle: string; montant: number }[] = [];
  const poste = (libelle: string, montant: Cents) => {
    if (montant !== 0) lignesCapitaux.push({ libelle, montant: versDollars(montant) });
  };
  poste('Capital – propriétaire (début de l’exercice et apports)', capital);
  poste('Capital – associé', -s('capitalAssocie'));
  poste('Capital-actions', -s('capitalActions'));
  poste('Bénéfices non répartis au début de l’exercice', -s('benefNonRepartis'));
  lignesCapitaux.push({
    libelle: 'Bénéfice net de l’exercice',
    montant: versDollars(resultatExercice),
  });
  poste('Moins : prélèvements du propriétaire', -prelevements);
  poste('Moins : prélèvements de l’associé', -s('prelevementsAssocie'));
  poste('Moins : dividendes déclarés', -s('dividendes'));
  const totalCapitaux =
    capital -
    s('capitalAssocie') -
    s('capitalActions') -
    s('benefNonRepartis') +
    resultatExercice -
    prelevements -
    s('prelevementsAssocie') -
    s('dividendes');

  const totalActif = totalActifCourt + totalActifLong;
  const totalPassif = totalPassifCourt + totalPassifLong;
  return {
    actifCourt,
    totalActifCourt: versDollars(totalActifCourt),
    actifLong,
    immobilisations,
    totalActifLong: versDollars(totalActifLong),
    totalActif: versDollars(totalActif),
    passifCourt,
    totalPassifCourt: versDollars(totalPassifCourt),
    passifLong,
    totalPassifLong: versDollars(totalPassifLong),
    totalPassif: versDollars(totalPassif),
    capitaux: {
      lignes: lignesCapitaux,
      capital: versDollars(capital),
      beneficeExercice: versDollars(resultatExercice),
      prelevements: versDollars(prelevements),
      total: versDollars(totalCapitaux),
    },
    totalPassifEtCapitaux: versDollars(totalPassif + totalCapitaux),
    ecart: versDollars(totalActif - totalPassif - totalCapitaux),
  };
}

export interface SectionFlux {
  activite: Activite;
  lignes: { flux: FluxId; libelle: string; montant: number }[];
  total: number;
}

export interface EtatFlux {
  sections: SectionFlux[];
  variationNette: number;
}

/** État des flux de trésorerie, méthode directe. */
export function etatFlux(flux: MouvementsFlux): EtatFlux {
  const activites: Activite[] = ['exploitation', 'investissement', 'financement'];
  const sections = activites.map((activite) => {
    const lignes = (Object.keys(FLUX) as FluxId[])
      .filter((id) => FLUX[id].activite === activite && (flux[id] ?? 0) !== 0)
      .map((id) => ({ flux: id, libelle: FLUX[id].nom, montant: versDollars(flux[id] ?? 0) }));
    const total = (Object.keys(FLUX) as FluxId[])
      .filter((id) => FLUX[id].activite === activite)
      .reduce((acc, id) => acc + (flux[id] ?? 0), 0);
    return { activite, lignes, total: versDollars(total) };
  });
  const variation = (Object.values(flux) as Cents[]).reduce((a, b) => a + b, 0);
  return { sections, variationNette: versDollars(variation) };
}
