/**
 * Prêts à terme : versements mensuels constants (capital + intérêts).
 * Les calculs se font en cents pour que le solde final soit exactement 0.
 */
import type { Cents } from './util';

export interface Pret {
  id: string;
  nom: string;
  capitalInitial: Cents;
  /** Taux annuel nominal, capitalisé mensuellement (ex. 0.0695). */
  tauxAnnuel: number;
  dureeMois: number;
  /** Nombre de versements déjà faits. */
  versementsFaits: number;
  solde: Cents;
  versementMensuel: Cents;
}

export interface LigneAmortissement {
  numero: number;
  versement: Cents;
  interets: Cents;
  capital: Cents;
  solde: Cents;
}

/** Versement mensuel constant d'un prêt (formule de l'annuité), en cents. */
export function versementMensuel(capital: Cents, tauxAnnuel: number, dureeMois: number): Cents {
  if (dureeMois <= 0) throw new Error('La durée doit être positive');
  if (capital <= 0) return 0;
  const i = tauxAnnuel / 12;
  if (i === 0) return Math.ceil(capital / dureeMois);
  return Math.round((capital * i) / (1 - Math.pow(1 + i, -dureeMois)));
}

/** Intérêts et capital du prochain versement. Le dernier versement solde exactement le prêt. */
export function prochainVersement(pret: Pret): { interets: Cents; capital: Cents } {
  if (pret.solde <= 0) return { interets: 0, capital: 0 };
  const interets = Math.round((pret.solde * pret.tauxAnnuel) / 12);
  const dernier = pret.versementsFaits >= pret.dureeMois - 1;
  let capital = dernier ? pret.solde : pret.versementMensuel - interets;
  capital = Math.min(Math.max(capital, 0), pret.solde);
  return { interets, capital };
}

export function creerPret(
  id: string,
  nom: string,
  capital: Cents,
  tauxAnnuel: number,
  dureeMois: number,
): Pret {
  return {
    id,
    nom,
    capitalInitial: capital,
    tauxAnnuel,
    dureeMois,
    versementsFaits: 0,
    solde: capital,
    versementMensuel: versementMensuel(capital, tauxAnnuel, dureeMois),
  };
}

/** Applique un versement au prêt (mutation) et retourne sa ventilation. */
export function effectuerVersement(pret: Pret): { interets: Cents; capital: Cents } {
  const v = prochainVersement(pret);
  pret.solde -= v.capital;
  pret.versementsFaits += 1;
  return v;
}

/** Tableau d'amortissement complet à partir de l'état actuel du prêt. */
export function tableauAmortissement(pret: Pret): LigneAmortissement[] {
  const copie: Pret = { ...pret };
  const lignes: LigneAmortissement[] = [];
  let securite = 0;
  while (copie.solde > 0 && securite++ < 1200) {
    const { interets, capital } = effectuerVersement(copie);
    lignes.push({
      numero: copie.versementsFaits,
      versement: interets + capital,
      interets,
      capital,
      solde: copie.solde,
    });
  }
  return lignes;
}

/** Capital qui sera remboursé au cours des 12 prochains mois (portion à court terme). */
export function portionCourante(pret: Pret): Cents {
  return tableauAmortissement(pret)
    .slice(0, 12)
    .reduce((acc, l) => acc + l.capital, 0);
}

/** Remboursement anticipé : réduit le solde et recalcule le versement sur la durée restante. */
export function rembourserPartiellement(pret: Pret, montant: Cents): Cents {
  const rembourse = Math.min(Math.max(0, montant), pret.solde);
  pret.solde -= rembourse;
  const restants = Math.max(1, pret.dureeMois - pret.versementsFaits);
  pret.versementMensuel = versementMensuel(pret.solde, pret.tauxAnnuel, restants);
  return rembourse;
}
