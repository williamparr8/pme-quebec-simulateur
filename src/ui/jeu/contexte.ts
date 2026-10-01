/** Accès pratique aux données de la partie en cours pour les pages du jeu. */
import { secteurParId, villeParId } from '../../data';
import type { Secteur, Ville } from '../../engine/data-types';
import { dateDuMois } from '../../engine/simulation';
import type { Entreprise, EtatPartie, MoisArchive } from '../../engine/types';
import { useJeu } from '../../store/jeu';

export interface JeuCourant {
  etat: EtatPartie;
  ent: Entreprise;
  secteur: Secteur;
  ville: Ville;
  /** Dernier mois joué (undefined avant le premier mois). */
  derniere: MoisArchive | undefined;
  precedente: MoisArchive | undefined;
  /** Mois qui va être joué. */
  date: { annee: number; mois: number };
}

export function useJeuCourant(): JeuCourant {
  const etat = useJeu((s) => s.etat);
  if (!etat) throw new Error('Aucune partie en cours');
  const ent = etat.entreprises[0];
  return {
    etat,
    ent,
    secteur: secteurParId(etat.config.secteurId),
    ville: villeParId(etat.config.villeId),
    derniere: ent.archives.at(-1),
    precedente: ent.archives.at(-2),
    date: dateDuMois(etat.config, Math.min(etat.moisCourant, etat.config.dureeMois - 1)),
  };
}

/** Variation relative entre deux valeurs (null si impossible). */
export function variation(actuel: number | undefined, avant: number | undefined): number | null {
  if (actuel === undefined || avant === undefined || avant === 0) return null;
  return actuel / Math.abs(avant) - Math.sign(avant);
}
