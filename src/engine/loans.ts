/**
 * Prêts à terme : versements mensuels constants (capital + intérêts).
 * Les calculs se font en cents pour que le solde final soit exactement 0.
 *
 * - Taux fixe : le taux et le versement ne changent pas.
 * - Taux variable : le taux suit le taux préférentiel; le versement est recalculé
 *   sur la durée restante à chaque changement de taux.
 * - Report (différé) : pendant les premiers mois, on ne paie que les intérêts.
 */
import type { Cents } from './util';

export type TypeTaux = 'fixe' | 'variable';

export interface Pret {
  id: string;
  nom: string;
  /** Prêteur (banque, BDC, famille…). */
  preteur: string;
  capitalInitial: Cents;
  /** Taux annuel nominal, capitalisé mensuellement (ex. 0.0695). */
  tauxAnnuel: number;
  type: TypeTaux;
  /** Taux variable : écart au-dessus du taux préférentiel. */
  ecartTaux: number;
  /** Durée d'amortissement après le report (mois). */
  dureeMois: number;
  /** Mois de report restants (intérêts seulement). */
  moisDiffere: number;
  /** Nombre de versements de capital déjà faits. */
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
  if (pret.moisDiffere > 0) return { interets, capital: 0 };
  const dernier = pret.versementsFaits >= pret.dureeMois - 1;
  let capital = dernier ? pret.solde : pret.versementMensuel - interets;
  capital = Math.min(Math.max(capital, 0), pret.solde);
  return { interets, capital };
}

export interface OptionsPret {
  preteur?: string;
  type?: TypeTaux;
  ecartTaux?: number;
  differeMois?: number;
}

export function creerPret(
  id: string,
  nom: string,
  capital: Cents,
  tauxAnnuel: number,
  dureeMois: number,
  options: OptionsPret = {},
): Pret {
  return {
    id,
    nom,
    preteur: options.preteur ?? 'Banque',
    capitalInitial: capital,
    tauxAnnuel,
    type: options.type ?? 'fixe',
    ecartTaux: options.ecartTaux ?? 0,
    dureeMois,
    moisDiffere: Math.max(0, options.differeMois ?? 0),
    versementsFaits: 0,
    solde: capital,
    versementMensuel: versementMensuel(capital, tauxAnnuel, dureeMois),
  };
}

/** Applique un versement au prêt (mutation) et retourne sa ventilation. */
export function effectuerVersement(pret: Pret): { interets: Cents; capital: Cents } {
  const v = prochainVersement(pret);
  if (pret.solde <= 0) return v;
  if (pret.moisDiffere > 0) {
    pret.moisDiffere -= 1;
    return v;
  }
  pret.solde -= v.capital;
  pret.versementsFaits += 1;
  return v;
}

/** Tableau d'amortissement complet à partir de l'état actuel du prêt. */
export function tableauAmortissement(pret: Pret): LigneAmortissement[] {
  const copie: Pret = { ...pret };
  const lignes: LigneAmortissement[] = [];
  let numero = 0;
  let securite = 0;
  while (copie.solde > 0 && securite++ < 1200) {
    const { interets, capital } = effectuerVersement(copie);
    numero += 1;
    lignes.push({ numero, versement: interets + capital, interets, capital, solde: copie.solde });
  }
  return lignes;
}

/** Capital qui sera remboursé au cours des 12 prochains mois (portion à court terme). */
export function portionCourante(pret: Pret): Cents {
  return tableauAmortissement(pret)
    .slice(0, 12)
    .reduce((acc, l) => acc + l.capital, 0);
}

/** Durée restante d'amortissement (mois). */
function moisRestants(pret: Pret): number {
  return Math.max(1, pret.dureeMois - pret.versementsFaits);
}

/** Remboursement anticipé : réduit le solde et recalcule le versement sur la durée restante. */
export function rembourserPartiellement(pret: Pret, montant: Cents): Cents {
  const rembourse = Math.min(Math.max(0, montant), pret.solde);
  pret.solde -= rembourse;
  pret.versementMensuel = versementMensuel(pret.solde, pret.tauxAnnuel, moisRestants(pret));
  return rembourse;
}

/**
 * Taux variable : applique le nouveau taux et recalcule le versement sur la durée restante.
 * Retourne vrai si le taux a changé.
 */
export function ajusterTauxVariable(pret: Pret, tauxPreferentiel: number): boolean {
  if (pret.type !== 'variable' || pret.solde <= 0) return false;
  const nouveau = Math.round((tauxPreferentiel + pret.ecartTaux) * 10000) / 10000;
  if (Math.abs(nouveau - pret.tauxAnnuel) < 1e-9) return false;
  pret.tauxAnnuel = nouveau;
  pret.versementMensuel = versementMensuel(pret.solde, nouveau, moisRestants(pret));
  return true;
}

/** Total des intérêts restants à payer selon le taux actuel. */
export function interetsRestants(pret: Pret): Cents {
  return tableauAmortissement(pret).reduce((a, l) => a + l.interets, 0);
}

/**
 * Comparaison taux fixe et taux variable pour un même emprunt : coût total des intérêts
 * selon un scénario d'évolution du taux préférentiel (variation en points, appliquée
 * graduellement sur la première année).
 */
export function comparerTaux(
  capital: Cents,
  dureeMois: number,
  tauxFixe: number,
  tauxVariableInitial: number,
  variationPrefAnnuelle: number,
): { interetsFixe: Cents; interetsVariable: Cents; versementFixe: Cents } {
  const fixe = creerPret('f', 'fixe', capital, tauxFixe, dureeMois);
  const interetsFixe = tableauAmortissement(fixe).reduce((a, l) => a + l.interets, 0);
  const variable = creerPret('v', 'variable', capital, tauxVariableInitial, dureeMois, {
    type: 'variable',
  });
  let interetsVariable = 0;
  let mois = 0;
  while (variable.solde > 0 && mois < 1200) {
    const progression = Math.min(1, mois / 12);
    const taux = Math.max(0.005, tauxVariableInitial + variationPrefAnnuelle * progression);
    if (Math.abs(taux - variable.tauxAnnuel) > 1e-9) {
      variable.tauxAnnuel = taux;
      variable.versementMensuel = versementMensuel(variable.solde, taux, moisRestants(variable));
    }
    interetsVariable += effectuerVersement(variable).interets;
    mois += 1;
  }
  return { interetsFixe, interetsVariable, versementFixe: fixe.versementMensuel };
}
