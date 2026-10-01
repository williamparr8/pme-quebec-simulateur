/**
 * Approvisionnement et gestion des stocks, simulés au jour le jour pour chaque ligne :
 *
 * - Chaque jour, on vend ce qui est demandé tant qu'il reste du stock (sinon : rupture).
 * - Les lots vieillissent et sont jetés à la date de péremption.
 * - Quand la position de stock (en main + commandé) atteint le point de commande, on
 *   commande la quantité prévue. La commande arrive après le délai du fournisseur
 *   (parfois plus tard si le fournisseur n'est pas fiable).
 * - Le stock est évalué au coût moyen pondéré ou selon la méthode PEPS (premier entré,
 *   premier sorti). Physiquement, les produits les plus vieux sortent toujours en premier.
 */
import { TAUX_CHANGE } from '../data/fiscalite';
import type { ConditionsPaiement, Fournisseur } from './data-types';
import type { Rng } from './rng';
import type { Lot, MethodeInventaire, StockLigne } from './types';
import { borner } from './util';

const JOURS_PAR_MOIS = 30;
/** Coût de possession annuel en proportion du coût (financement, espace, assurance). */
export const TAUX_POSSESSION = 0.25;
/** Coût interne de passer une commande (temps, réception, vérification) ($). */
export const COUT_INTERNE_COMMANDE = 15;
/** Niveau de service visé pour le stock de sécurité (95 % : z = 1,65). */
const Z_SERVICE = 1.65;
/** Frais de petite commande sous le minimum du fournisseur (proportion du minimum). */
export const FRAIS_PETITE_COMMANDE = 0.15;

/** Coût total d'une commande, incluant la livraison et les frais de petite commande ($). */
export function coutCommande(quantite: number, coutUnitaire: number, f: Fournisseur): number {
  const marchandises = quantite * coutUnitaire;
  const petite = marchandises < f.minimumCommande ? FRAIS_PETITE_COMMANDE * f.minimumCommande : 0;
  return marchandises + f.fraisCommande + petite;
}

/** Coût unitaire d'une marchandise chez un fournisseur, avec le taux de change ($ CA). */
export function coutChezFournisseur(coutBase: number, f: Fournisseur, tauxChange: number): number {
  const change = f.devise === 'USD' ? tauxChange / TAUX_CHANGE.reference : 1;
  return coutBase * f.indicePrix * change;
}

/** Quantité économique de commande (formule de Wilson) : √(2 × D × S / H). */
export function quantiteEconomique(
  demandeAnnuelle: number,
  coutCommande: number,
  coutPossessionUnitaire: number,
): number {
  if (demandeAnnuelle <= 0 || coutPossessionUnitaire <= 0) return 0;
  return Math.sqrt((2 * demandeAnnuelle * coutCommande) / coutPossessionUnitaire);
}

export interface CalculPolitique {
  demandeJour: number;
  stockSecurite: number;
  pointCommande: number;
  qec: number;
  /** Quantité maximale avant péremption. */
  quantiteMaxPeremption: number;
  /** Quantité minimale imposée par le fournisseur. */
  quantiteMinFournisseur: number;
  quantite: number;
}

/**
 * Politique recommandée : point de commande = demande pendant le délai + stock de sécurité;
 * quantité = QEC, bornée par la péremption et la commande minimale du fournisseur.
 * @param precision 1 = prévision ordinaire; < 1 = prévision plus précise (logiciel)
 */
export function politiqueRecommandee(
  demandeMois: number,
  coutUnitaire: number,
  f: Fournisseur,
  conservationJours: number,
  precision = 1,
): CalculPolitique {
  const demandeJour = Math.max(0, demandeMois) / JOURS_PAR_MOIS;
  const ecartJour = demandeJour * 0.2 * precision;
  const delaiEffectif = f.delaiJours + (1 - f.fiabilite) * 4;
  const stockSecurite = Z_SERVICE * ecartJour * Math.sqrt(Math.max(1, delaiEffectif));
  // Si on vend moins d'une unité pendant la durée de conservation, on ne garde pas de stock.
  const pointCommande =
    demandeJour * conservationJours < 1
      ? 0
      : Math.max(1, Math.ceil(demandeJour * f.delaiJours + stockSecurite));
  const qec = quantiteEconomique(
    demandeJour * 360,
    f.fraisCommande + COUT_INTERNE_COMMANDE,
    coutUnitaire * TAUX_POSSESSION,
  );
  const quantiteMaxPeremption = Math.max(
    1,
    Math.floor(demandeJour * Math.max(1, conservationJours - 1)),
  );
  const quantiteMinFournisseur = coutUnitaire > 0 ? Math.ceil(f.minimumCommande / coutUnitaire) : 0;
  const optimale = Math.round(Math.min(Math.max(qec, demandeJour), quantiteMaxPeremption));
  // On atteint le minimum du fournisseur seulement si la marchandise ne périme pas avant
  // d'être vendue; sinon, on paie les frais de petite commande.
  const quantite = Math.max(
    1,
    quantiteMinFournisseur <= quantiteMaxPeremption
      ? Math.max(optimale, quantiteMinFournisseur)
      : optimale,
  );
  return {
    demandeJour,
    stockSecurite,
    pointCommande,
    qec,
    quantiteMaxPeremption,
    quantiteMinFournisseur,
    quantite,
  };
}

export function unitesEnStock(s: StockLigne): number {
  return s.lots.reduce((a, l) => a + l.quantite, 0);
}

/** Valeur du stock selon la méthode d'évaluation ($). */
export function valeurStock(s: StockLigne, methode: MethodeInventaire): number {
  if (methode === 'coutMoyen') return unitesEnStock(s) * s.coutMoyen;
  return s.lots.reduce((a, l) => a + l.quantite * l.cout, 0);
}

export function stockVide(): StockLigne {
  return { lots: [], commandes: [], coutMoyen: 0, demandeRecente: 0 };
}

export interface ParamsLigneStock {
  /** Unités demandées ce mois-ci. */
  demande: number;
  /** Unités qu'on peut préparer ce mois-ci (cuisine); Infinity si sans limite. */
  capacitePreparation: number;
  /** Proportion des produits ratés à refaire (consomment du stock sans vente). */
  tauxDefauts: number;
  coutUnitaire: number;
  fournisseur: Fournisseur;
  conservationJours: number;
  pointCommande: number;
  quantite: number;
  methode: MethodeInventaire;
  /**
   * Mode automatique : le point de commande et la quantité sont recalculés chaque semaine
   * selon les ventes observées (précision de la prévision : 1 = ordinaire, < 1 = logiciel).
   */
  auto?: { precision: number };
}

export interface Reception {
  quantite: number;
  /** Coût total incluant les frais de commande ($). */
  cout: number;
  conditions: ConditionsPaiement;
}

export interface ResultatStockLigne {
  vendues: number;
  /** Unités non vendues faute de stock. */
  perdues: number;
  /** Unités non vendues faute de personnel en cuisine. */
  perduesPreparation: number;
  perimees: number;
  refaites: number;
  commandes: number;
  receptions: Reception[];
  /** Coût des unités sorties (vendues et refaites) selon la méthode ($). */
  coutSorties: number;
  /** Coût des unités périmées ($). */
  coutPerimees: number;
  valeurFin: number;
  /** Politique en vigueur à la fin du mois (recalculée en mode automatique). */
  pointCommande: number;
  quantite: number;
}

/** Répartit un total entier sur 30 jours selon des poids, sans perdre d'unités. */
function repartir(total: number, poids: number[]): number[] {
  const somme = poids.reduce((a, x) => a + x, 0) || 1;
  let cumul = 0;
  let precedent = 0;
  return poids.map((p) => {
    cumul += (total * p) / somme;
    const r = Math.round(cumul);
    const jour = r - precedent;
    precedent = r;
    return jour;
  });
}

/** Retire des unités des lots les plus vieux; retourne le coût PEPS et la quantité obtenue. */
function sortir(lots: Lot[], quantite: number): { quantite: number; cout: number } {
  let reste = quantite;
  let cout = 0;
  for (const lot of lots) {
    if (reste <= 0) break;
    const q = Math.min(lot.quantite, reste);
    lot.quantite -= q;
    reste -= q;
    cout += q * lot.cout;
  }
  for (let i = lots.length - 1; i >= 0; i--) if (lots[i].quantite <= 0) lots.splice(i, 1);
  return { quantite: quantite - reste, cout };
}

/**
 * Simule un mois de ventes et d'approvisionnement pour une ligne (mutation de `stock`).
 */
export function simulerStockLigne(
  stock: StockLigne,
  p: ParamsLigneStock,
  rng: Rng,
): ResultatStockLigne {
  const r: ResultatStockLigne = {
    vendues: 0,
    perdues: 0,
    perduesPreparation: 0,
    perimees: 0,
    refaites: 0,
    commandes: 0,
    receptions: [],
    coutSorties: 0,
    coutPerimees: 0,
    valeurFin: 0,
    pointCommande: p.pointCommande,
    quantite: p.quantite,
  };
  const poids = Array.from({ length: JOURS_PAR_MOIS }, () =>
    Math.max(0.2, 1 + rng.normal(0, 0.15)),
  );
  const demandeJours = repartir(Math.max(0, Math.round(p.demande)), poids);
  const capaciteJours = Number.isFinite(p.capacitePreparation)
    ? repartir(Math.max(0, Math.floor(p.capacitePreparation)), poids)
    : null;
  const f = p.fournisseur;
  let pointCommande = p.pointCommande;
  let quantiteCommande = Math.max(1, Math.round(p.quantite));
  let estimationJour = (stock.demandeRecente || p.demande) / JOURS_PAR_MOIS;
  let vouluesSemaine = 0;
  const cmp = p.methode === 'coutMoyen';

  const sortirCout = (q: number): { quantite: number; cout: number } => {
    const avant = stock.coutMoyen;
    const s = sortir(stock.lots, q);
    return cmp ? { quantite: s.quantite, cout: s.quantite * avant } : s;
  };

  for (let jour = 0; jour < JOURS_PAR_MOIS; jour++) {
    // 1. Réceptions du matin
    for (const c of stock.commandes) c.jours -= 1;
    for (const c of stock.commandes.filter((x) => x.jours <= 0)) {
      const enMain = unitesEnStock(stock);
      const coutUnitaire = c.cout / Math.max(1, c.quantite);
      stock.coutMoyen =
        enMain + c.quantite > 0
          ? (enMain * stock.coutMoyen + c.cout) / (enMain + c.quantite)
          : coutUnitaire;
      stock.lots.push({
        quantite: c.quantite,
        cout: coutUnitaire,
        joursRestants: p.conservationJours,
      });
      r.receptions.push({ quantite: c.quantite, cout: c.cout, conditions: f.conditions });
    }
    stock.commandes = stock.commandes.filter((x) => x.jours > 0);

    // 2. Ventes de la journée (limitées par la préparation en cuisine, puis par le stock)
    const voulues = demandeJours[jour];
    vouluesSemaine += voulues;
    const preparables = capaciteJours ? Math.min(voulues, capaciteJours[jour]) : voulues;
    r.perduesPreparation += voulues - preparables;
    const vente = sortirCout(preparables);
    r.vendues += vente.quantite;
    r.perdues += preparables - vente.quantite;
    r.coutSorties += vente.cout;
    // Produits ratés refaits : consomment du stock sans générer de vente.
    const aRefaire = Math.round(vente.quantite * p.tauxDefauts);
    if (aRefaire > 0) {
      const refait = sortirCout(aRefaire);
      r.refaites += refait.quantite;
      r.coutSorties += refait.cout;
    }

    // 3. Fin de journée : vieillissement et péremption
    for (const lot of stock.lots) lot.joursRestants -= 1;
    const perimes = stock.lots.filter((l) => l.joursRestants <= 0);
    for (const lot of perimes) {
      r.perimees += lot.quantite;
      r.coutPerimees += cmp ? lot.quantite * stock.coutMoyen : lot.quantite * lot.cout;
    }
    stock.lots = stock.lots.filter((l) => l.joursRestants > 0);

    // 4. Mode automatique : chaque semaine, la prévision s'ajuste aux ventes observées.
    if (p.auto && jour % 7 === 6) {
      estimationJour = 0.6 * (vouluesSemaine / 7) + 0.4 * estimationJour;
      vouluesSemaine = 0;
      const calcul = politiqueRecommandee(
        estimationJour * JOURS_PAR_MOIS,
        p.coutUnitaire,
        f,
        p.conservationJours,
        p.auto.precision,
      );
      pointCommande = calcul.pointCommande;
      quantiteCommande = Math.max(1, calcul.quantite);
    }

    // 5. Commande si la position de stock atteint le point de commande (0 : ne plus commander)
    const enCommande = stock.commandes.reduce((a, c) => a + c.quantite, 0);
    if (pointCommande > 0 && unitesEnStock(stock) + enCommande <= pointCommande) {
      const retard = rng.chance(f.fiabilite) ? 0 : rng.int(1, 3);
      stock.commandes.push({
        quantite: quantiteCommande,
        cout: coutCommande(quantiteCommande, p.coutUnitaire, f),
        jours: Math.max(1, f.delaiJours + retard),
      });
      r.commandes += 1;
    }
  }
  if (unitesEnStock(stock) === 0) stock.coutMoyen = 0;
  r.valeurFin = valeurStock(stock, p.methode);
  r.pointCommande = pointCommande;
  r.quantite = quantiteCommande;
  stock.demandeRecente = p.demande;
  return r;
}

/** Taux de rupture d'une ligne (unités perdues faute de stock / unités voulues). */
export function tauxRuptureLigne(r: Pick<ResultatStockLigne, 'vendues' | 'perdues'>): number {
  const voulues = r.vendues + r.perdues;
  return voulues > 0 ? borner(r.perdues / voulues, 0, 1) : 0;
}

/** Crée le stock initial d'une ligne (lots frais achetés avant l'ouverture). */
export function stockInitial(
  valeur: number,
  coutUnitaire: number,
  conservationJours: number,
  demandeEstimee: number,
): StockLigne {
  const quantite = coutUnitaire > 0 ? Math.floor(valeur / coutUnitaire) : 0;
  return {
    lots: quantite > 0 ? [{ quantite, cout: coutUnitaire, joursRestants: conservationJours }] : [],
    commandes: [],
    coutMoyen: quantite > 0 ? coutUnitaire : 0,
    demandeRecente: demandeEstimee,
  };
}
