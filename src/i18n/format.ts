/** Formatage à la québécoise : 1 234,56 $, 12,5 %, JJ/MM/AAAA. */

const fmtArgent = new Intl.NumberFormat('fr-CA', { style: 'currency', currency: 'CAD' });
const fmtArgentRond = new Intl.NumberFormat('fr-CA', {
  style: 'currency',
  currency: 'CAD',
  maximumFractionDigits: 0,
});
const fmtNombre = new Intl.NumberFormat('fr-CA', { maximumFractionDigits: 0 });

/** 1 234,56 $ */
export function argent(montant: number): string {
  return fmtArgent.format(montant + 0);
}

/** 1 235 $ (sans les cents) */
export function argentRond(montant: number): string {
  return fmtArgentRond.format(Math.round(montant) + 0);
}

export function nombre(n: number): string {
  return fmtNombre.format(Math.round(n) + 0);
}

/** 0.125 → « 12,5 % » */
export function pourcentage(x: number, decimales = 1): string {
  return `${new Intl.NumberFormat('fr-CA', {
    minimumFractionDigits: decimales,
    maximumFractionDigits: decimales,
  }).format(x * 100 + 0)} %`;
}

/** Nombre décimal à la française : 4,25 */
export function decimal(x: number, decimales = 2): string {
  return new Intl.NumberFormat('fr-CA', {
    minimumFractionDigits: decimales,
    maximumFractionDigits: decimales,
  }).format(x + 0);
}

export const NOMS_MOIS = [
  'janvier',
  'février',
  'mars',
  'avril',
  'mai',
  'juin',
  'juillet',
  'août',
  'septembre',
  'octobre',
  'novembre',
  'décembre',
] as const;

/** « janvier 2027 » */
export function moisAnnee(annee: number, mois: number): string {
  return `${NOMS_MOIS[mois - 1]} ${annee}`;
}

/** Abrégé pour les graphiques : « janv. 27 » */
export function moisCourt(annee: number, mois: number): string {
  const court = [
    'janv.',
    'févr.',
    'mars',
    'avr.',
    'mai',
    'juin',
    'juil.',
    'août',
    'sept.',
    'oct.',
    'nov.',
    'déc.',
  ];
  return `${court[mois - 1]} ${String(annee).slice(2)}`;
}

/** JJ/MM/AAAA */
export function dateJJMMAAAA(date: Date): string {
  const j = String(date.getDate()).padStart(2, '0');
  const m = String(date.getMonth() + 1).padStart(2, '0');
  return `${j}/${m}/${date.getFullYear()}`;
}

/** Dernier jour du mois en JJ/MM/AAAA */
export function finDeMois(annee: number, mois: number): string {
  return dateJJMMAAAA(new Date(annee, mois, 0));
}

export function heureMinute(date: Date): string {
  return `${String(date.getHours()).padStart(2, '0')} h ${String(date.getMinutes()).padStart(2, '0')}`;
}
