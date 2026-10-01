/**
 * Satisfaction de la clientèle et avis en ligne.
 */
import { borner } from './util';

/**
 * Satisfaction (0 à 1) : rapport qualité-prix, service, ambiance et attente.
 * @param indicePrix 1 = prix du marché
 * @param tauxAttente proportion des clients qui n'ont pas pu être servis (file trop longue)
 */
export function satisfactionClients(
  qualite: number,
  service: number,
  ambiance: number,
  indicePrix: number,
  tauxAttente: number,
): number {
  return borner(
    0.62 +
      0.6 * (qualite - 0.55) +
      0.4 * (service - 0.55) +
      0.15 * (ambiance - 0.5) -
      0.7 * (indicePrix - 1) -
      0.8 * borner(tauxAttente, 0, 1),
    0.05,
    0.98,
  );
}

/**
 * Note des avis du mois selon la gestion des avis : répondre aux avis négatifs adoucit
 * leur effet (les lecteurs voient que le commerce s'en occupe); offrir un geste commercial
 * (produit gratuit, remboursement) encore davantage.
 */
export function noteDuMois(note: number, reponse: 'ignorer' | 'repondre' | 'compenser'): number {
  const negatif = note < 4;
  const bonus =
    reponse === 'repondre' ? (negatif ? 0.12 : 0.03) : reponse === 'compenser' ? (negatif ? 0.25 : 0.05) : 0;
  return borner(note + bonus, 1, 5);
}

/** Note moyenne (sur 5) que donnent des clients ayant ce niveau de satisfaction. */
export function noteCible(satisfaction: number): number {
  return borner(1.4 + 3.6 * satisfaction, 1, 5);
}

/**
 * Nouvelle note moyenne après les avis du mois. Les premiers avis font beaucoup
 * bouger la note; quand il y en a beaucoup, elle devient plus stable.
 * Le poids des anciens avis est plafonné pour que la note reste sensible aux changements.
 */
export function nouvelleNote(
  noteActuelle: number,
  nbAvis: number,
  noteDuMois: number,
  nouveauxAvis: number,
): number {
  if (nouveauxAvis <= 0) return noteActuelle;
  const poidsAncien = Math.min(nbAvis, 250);
  return borner(
    (noteActuelle * poidsAncien + noteDuMois * nouveauxAvis) / (poidsAncien + nouveauxAvis),
    1,
    5,
  );
}
