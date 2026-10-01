export type Saison = 'hiver' | 'printemps' | 'ete' | 'automne';

/** Saison au Québec selon le mois (1-12). */
export function saisonDuMois(mois: number): Saison {
  if (mois === 12 || mois <= 3) return 'hiver';
  if (mois <= 5) return 'printemps';
  if (mois <= 8) return 'ete';
  return 'automne';
}
