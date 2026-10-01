/**
 * Requêtes de lecture pour l'interface : états financiers par période, ratios,
 * seuil de rentabilité et bilan de fin de partie.
 */
import type { Mouvements, MouvementsFlux } from './accounting';
import { portionCourante } from './loans';
import {
  bilan,
  cumulerFlux,
  cumulerMouvements,
  etatFlux,
  etatResultats,
  type Bilan,
  type EtatFlux,
  type EtatResultats,
} from './statements';
import type { Entreprise, MoisArchive } from './types';
import { versDollars } from './util';

export type Periode =
  { type: 'mois'; index: number } | { type: 'exercice'; annee: number } | { type: 'cumul' };

export function archivesPeriode(ent: Entreprise, periode: Periode): MoisArchive[] {
  switch (periode.type) {
    case 'mois':
      return ent.archives.filter((a) => a.index === periode.index);
    case 'exercice':
      return ent.archives.filter((a) => a.annee === periode.annee);
    case 'cumul':
      return ent.archives;
  }
}

export function exercicesJoues(ent: Entreprise): number[] {
  return [...new Set(ent.archives.map((a) => a.annee))];
}

export interface EtatsFinanciers {
  resultats: EtatResultats;
  flux: EtatFlux;
  bilan: Bilan;
  nbMois: number;
}

/** États financiers d'une période. Sans mois joué, le bilan d'ouverture est retourné. */
export function etatsFinanciers(ent: Entreprise, periode: Periode): EtatsFinanciers {
  const archives = archivesPeriode(ent, periode);
  if (archives.length === 0) {
    const portion = ent.prets.reduce((a, p) => a + portionCourante(p), 0);
    return {
      resultats: etatResultats(ent.livre.mouvementsMois),
      flux: etatFlux(ent.livre.fluxMois),
      bilan: bilan(ent.livre.soldes, portion),
      nbMois: 0,
    };
  }
  const mouvements: Mouvements = cumulerMouvements(archives.map((a) => a.mouvements));
  const flux: MouvementsFlux = cumulerFlux(archives.map((a) => a.flux));
  const fin = archives[archives.length - 1];
  return {
    resultats: etatResultats(mouvements),
    flux: etatFlux(flux),
    bilan: bilan(fin.soldesFin, fin.portionCouranteDette),
    nbMois: archives.length,
  };
}

export interface Ratio {
  id:
    | 'liquidite'
    | 'liquiditeImmediate'
    | 'fondsRoulement'
    | 'endettement'
    | 'margeBrute'
    | 'margeNette'
    | 'couvertureInterets'
    | 'rendementActif'
    | 'rendementCapitaux'
    | 'rotationStocks'
    | 'delaiRecouvrement';
  valeur: number | null;
  /** Zone visée pour une PME de ce secteur. */
  cible: [number, number];
  format: 'fois' | 'pourcentage' | 'argent' | 'jours';
}

/** Montant d'un poste du bilan (actif à court terme) par compte. */
function poste(b: EtatsFinanciers['bilan'], compte: string): number {
  return b.actifCourt.find((l) => l.compte === compte)?.montant ?? 0;
}

export function ratios(
  etats: EtatsFinanciers,
  cibleMargeBrute: [number, number],
  cibleMargeNette: [number, number],
): Ratio[] {
  const { resultats: r, bilan: b, nbMois } = etats;
  const div = (a: number, c: number): number | null => (c !== 0 ? a / c : null);
  const annualisation = nbMois > 0 ? 12 / nbMois : 0;
  const stocks = poste(b, 'stocks');
  const clients = poste(b, 'comptesClients');
  return [
    {
      id: 'liquidite',
      valeur: div(b.totalActifCourt, b.totalPassifCourt),
      cible: [1.2, 2],
      format: 'fois',
    },
    {
      id: 'liquiditeImmediate',
      valeur: div(b.totalActifCourt - stocks, b.totalPassifCourt),
      cible: [0.8, 1.5],
      format: 'fois',
    },
    {
      id: 'fondsRoulement',
      valeur: b.totalActifCourt - b.totalPassifCourt,
      cible: [5_000, 100_000],
      format: 'argent',
    },
    {
      id: 'endettement',
      valeur: div(b.totalPassif, b.totalActif),
      cible: [0, 0.6],
      format: 'pourcentage',
    },
    {
      id: 'margeBrute',
      valeur: r.ventes > 0 ? r.tauxMargeBrute : null,
      cible: cibleMargeBrute,
      format: 'pourcentage',
    },
    {
      id: 'margeNette',
      valeur: div(r.beneficeNet, r.ventes),
      cible: cibleMargeNette,
      format: 'pourcentage',
    },
    { id: 'couvertureInterets', valeur: div(r.baii, r.interets), cible: [3, 10], format: 'fois' },
    {
      id: 'rendementActif',
      valeur:
        b.totalActif > 0 && nbMois > 0 ? (r.beneficeNet * annualisation) / b.totalActif : null,
      cible: [0.05, 0.2],
      format: 'pourcentage',
    },
    {
      id: 'rendementCapitaux',
      valeur:
        b.capitaux.total > 0 && nbMois > 0
          ? (r.beneficeNet * annualisation) / b.capitaux.total
          : null,
      cible: [0.08, 0.3],
      format: 'pourcentage',
    },
    {
      id: 'rotationStocks',
      valeur: stocks > 0 && nbMois > 0 ? (r.coutMarchandises * annualisation) / stocks : null,
      cible: [40, 120],
      format: 'fois',
    },
    {
      id: 'delaiRecouvrement',
      valeur: r.ventes > 0 && nbMois > 0 ? (clients / (r.ventes * annualisation)) * 365 : null,
      cible: [0, 30],
      format: 'jours',
    },
  ];
}

export interface SeuilRentabilite {
  /** Charges fixes de la période ($). */
  chargesFixes: number;
  /** Proportion de chaque dollar de vente qui reste après les coûts variables. */
  tauxMargeContribution: number;
  /** Ventes nécessaires pour ne faire ni profit ni perte ($), ou null si impossible. */
  seuil: number | null;
  ventes: number;
  /** Marge de sécurité : (ventes − seuil) / ventes. */
  margeSecurite: number | null;
}

/**
 * Seuil de rentabilité. Coûts variables : coût des marchandises, pertes et frais de
 * cartes. Tout le reste (loyer, salaires, publicité, amortissement, intérêts) est
 * traité comme fixe à court terme.
 */
export function seuilRentabilite(mouvements: Mouvements): SeuilRentabilite {
  const r = etatResultats(mouvements);
  const variables = r.coutMarchandises + versDollars(mouvements.fraisCartes ?? 0);
  const chargesFixes =
    r.totalChargesExploitation -
    versDollars(mouvements.fraisCartes ?? 0) +
    r.amortissement +
    r.interets;
  const taux = r.ventes > 0 ? (r.ventes - variables) / r.ventes : 0;
  const seuil = taux > 0 ? chargesFixes / taux : null;
  return {
    chargesFixes,
    tauxMargeContribution: taux,
    seuil,
    ventes: r.ventes,
    margeSecurite: seuil !== null && r.ventes > 0 ? (r.ventes - seuil) / r.ventes : null,
  };
}

export interface BilanPartie {
  beneficeCumule: number;
  prelevementsCumules: number;
  capitauxPropres: number;
  apportsTotal: number;
  ventesCumulees: number;
  partMarcheFinale: number;
  noteFinale: number;
  satisfactionMoyenne: number;
  moralMoyen: number;
  /** Valeur estimée de l'entreprise : 3 × BAIIA des 12 derniers mois + encaisse − dettes. */
  valeurEntreprise: number;
  /** Part de l'entreprise détenue par le joueur (après un investisseur ou un associé). */
  partProprietaire: number;
  valeurPourProprietaire: number;
  /** L'entreprise a été vendue (offre de rachat acceptée). */
  vendue: boolean;
  /** Note globale sur 100. */
  note: number;
}

export function bilanPartie(ent: Entreprise): BilanPartie {
  const cumul = etatsFinanciers(ent, { type: 'cumul' });
  const derniers12 = etatResultats(
    cumulerMouvements(ent.archives.slice(-12).map((a) => a.mouvements)),
  );
  const fin = ent.archives.at(-1);
  const flux = cumulerFlux(ent.archives.map((a) => a.flux));
  const apportsTotal = versDollars(flux.apportsProprietaire ?? 0);
  const prelevementsCumules = -versDollars(flux.prelevementsProprietaire ?? 0);
  const n = Math.max(1, ent.archives.length);
  const moyenne = (f: (a: MoisArchive) => number) => ent.archives.reduce((s, a) => s + f(a), 0) / n;
  const b = cumul.bilan;
  const dettes = b.totalPassif;
  const encaisse = Math.max(0, fin ? fin.indicateurs.encaisse : 0);
  const baiiaAnnuel = (derniers12.baiia * 12) / Math.max(1, Math.min(12, ent.archives.length));
  // Entreprise vendue : sa valeur est le prix obtenu de l'acheteur.
  const valeurEntreprise = ent.vente
    ? ent.vente.prix
    : Math.max(0, 3 * baiiaAnnuel + encaisse - dettes);
  const partProprietaire =
    ent.finance.actionnaires.find((a) => a.type === 'fondateur')?.part ??
    (ent.associe ? 1 - ent.associe.part : 1);

  // Note : rendement pour le propriétaire (50), clients (25), employés (10), part de marché (15).
  const richesse =
    (ent.vente ? ent.vente.prix * partProprietaire : b.capitaux.total) +
    prelevementsCumules -
    apportsTotal;
  const scoreFinance = Math.max(0, Math.min(50, 25 + (richesse / Math.max(1, apportsTotal)) * 25));
  const satisfactionMoyenne = moyenne((a) => a.indicateurs.satisfaction);
  const moralMoyen = moyenne((a) => a.indicateurs.moral);
  const scoreClients = Math.max(0, Math.min(25, satisfactionMoyenne * 28));
  const scoreEmployes = Math.max(0, Math.min(10, moralMoyen / 8));
  const partFinale = fin ? fin.indicateurs.partMarche : 0;
  const scorePart = Math.max(0, Math.min(15, partFinale * 50));
  const note = Math.round(
    ent.enFaillite
      ? Math.min(35, scoreClients + scoreEmployes)
      : scoreFinance + scoreClients + scoreEmployes + scorePart,
  );

  return {
    beneficeCumule: cumul.resultats.beneficeNet,
    prelevementsCumules,
    capitauxPropres: b.capitaux.total,
    apportsTotal,
    ventesCumulees: cumul.resultats.ventes,
    partMarcheFinale: partFinale,
    noteFinale: fin ? fin.indicateurs.note : 0,
    satisfactionMoyenne,
    moralMoyen,
    valeurEntreprise,
    partProprietaire,
    valeurPourProprietaire: Math.round(valeurEntreprise * partProprietaire),
    vendue: ent.vente !== null && ent.vente !== undefined,
    note,
  };
}
