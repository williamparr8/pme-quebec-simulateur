/**
 * Gestion simplifiée des stocks (Jalon 1) : réapprovisionnement automatique
 * vers un stock cible exprimé en jours de consommation.
 *
 * - Un stock trop élevé de produits périssables augmente les pertes (péremption).
 * - Un stock trop bas provoque des ruptures (ventes perdues).
 * Le point de commande, le stock de sécurité et la QEC arriveront au Jalon 3.
 */
import { borner } from './util';

/** Proportion des visites perdues par manque de stock selon le stock cible (en jours). */
export function tauxRupture(stockJoursCible: number): number {
  return borner((3 - stockJoursCible) * 0.06, 0, 0.3);
}

/** Taux de perte sur le coût des produits périssables utilisés. */
export function tauxPerte(stockJoursCible: number): number {
  return 0.015 + 0.01 * Math.max(0, stockJoursCible - 4);
}

export interface Reapprovisionnement {
  /** Achats du mois au coût (dollars). */
  achats: number;
  /** Pertes par péremption (dollars). */
  pertes: number;
  /** Valeur du stock à la fin du mois (dollars). */
  stockFin: number;
}

/**
 * @param stockDebut valeur du stock au début du mois
 * @param coutVentes coût des marchandises vendues ce mois-ci
 * @param coutPerissables partie du coût des ventes qui est périssable
 * @param stockJoursCible nombre de jours de consommation à garder en stock
 */
export function reapprovisionner(
  stockDebut: number,
  coutVentes: number,
  coutPerissables: number,
  stockJoursCible: number,
): Reapprovisionnement {
  const pertes = Math.round(coutPerissables * tauxPerte(stockJoursCible) * 100) / 100;
  const cible = Math.round((coutVentes / 30) * Math.max(0, stockJoursCible) * 100) / 100;
  // Stock fin = stock début + achats − coût des ventes − pertes
  const achatsNecessaires = cible - stockDebut + coutVentes + pertes;
  const achats = Math.max(0, Math.round(achatsNecessaires * 100) / 100);
  const stockFin = Math.round((stockDebut + achats - coutVentes - pertes) * 100) / 100;
  // Si le stock de début dépasse les besoins, le surplus reste en stock (aucun achat).
  if (stockFin < 0) {
    // Impossible : on consomme au maximum ce qui est disponible.
    return { achats, pertes: Math.max(0, stockDebut + achats - coutVentes), stockFin: 0 };
  }
  return { achats, pertes, stockFin };
}
