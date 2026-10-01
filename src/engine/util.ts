/** Montant en cents (entier). Toute la comptabilité est tenue en cents pour un bilan exact. */
export type Cents = number;

/** Convertit des dollars en cents entiers (et élimine le « -0 »). */
export function versCents(dollars: number): Cents {
  if (!Number.isFinite(dollars)) throw new Error(`Montant invalide : ${dollars}`);
  return Math.round(dollars * 100) + 0;
}

export function versDollars(cents: Cents): number {
  return cents / 100;
}

export function borner(valeur: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, valeur));
}

/** Rapproche progressivement une valeur de sa cible (lissage exponentiel). */
export function lisser(actuel: number, cible: number, vitesse: number): number {
  return actuel + (cible - actuel) * vitesse;
}

export function somme(valeurs: readonly number[]): number {
  let total = 0;
  for (const v of valeurs) total += v;
  return total;
}

/** Nombre moyen de semaines dans un mois (52 semaines / 12 mois). */
export const SEMAINES_PAR_MOIS = 52 / 12;
