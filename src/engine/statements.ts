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
  let cmv = 0;
  let exploitation = 0;
  let interets = 0;
  let amortissement = 0;
  const chargesExploitation: LignePoste[] = [];

  for (const id of COMPTES) {
    const def = PLAN_COMPTABLE[id];
    if (def.classe === 'produit') ventes -= m(id);
    else if (def.classe === 'charge') {
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
  const bai = baii - interets;
  return {
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
    beneficeAvantImpot: versDollars(bai),
    // Entreprise individuelle : le bénéfice est imposé dans la déclaration personnelle du propriétaire.
    impots: 0,
    beneficeNet: versDollars(bai),
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
  ajouter(actifCourt, 'comptesClients', s('comptesClients'));
  ajouter(actifCourt, 'stocks', s('stocks'));
  const totalActifCourt = Math.max(0, encaisse) + s('comptesClients') + s('stocks');

  const actifLong: LignePoste[] = [];
  ajouter(actifLong, 'depotGarantie', s('depotGarantie'));
  const immobilisations = [
    {
      libelle: PLAN_COMPTABLE.equipement.nom,
      cout: versDollars(s('equipement')),
      amortCumule: versDollars(-s('amortCumEquipement')),
      net: versDollars(s('equipement') + s('amortCumEquipement')),
    },
    {
      libelle: PLAN_COMPTABLE.ameliorationsLocatives.nom,
      cout: versDollars(s('ameliorationsLocatives')),
      amortCumule: versDollars(-s('amortCumAmeliorations')),
      net: versDollars(s('ameliorationsLocatives') + s('amortCumAmeliorations')),
    },
  ].filter((i) => i.cout !== 0);
  const totalActifLong =
    s('depotGarantie') +
    s('equipement') +
    s('amortCumEquipement') +
    s('ameliorationsLocatives') +
    s('amortCumAmeliorations');

  const emprunt = -s('empruntBancaire');
  const portionCourante = Math.min(Math.max(0, portionCouranteDette), emprunt);

  const passifCourt: LignePoste[] = [];
  if (encaisse < 0) ajouter(passifCourt, 'encaisse', -encaisse, 'Découvert bancaire');
  ajouter(passifCourt, 'margeCredit', -s('margeCredit'));
  ajouter(passifCourt, 'comptesFournisseurs', -s('comptesFournisseurs'));
  ajouter(passifCourt, 'cotisationsAPayer', -s('cotisationsAPayer'));
  ajouter(
    passifCourt,
    'empruntBancaire',
    portionCourante,
    'Portion de la dette à long terme échéant à moins d’un an',
  );
  const totalPassifCourt =
    Math.max(0, -encaisse) -
    s('margeCredit') -
    s('comptesFournisseurs') -
    s('cotisationsAPayer') +
    portionCourante;

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
  const totalCapitaux = capital + resultatExercice - prelevements;

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
