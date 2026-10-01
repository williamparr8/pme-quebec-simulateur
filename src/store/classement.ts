/**
 * Classement local des meilleures parties (conservé dans ce navigateur seulement) :
 * valeur de l'entreprise, profit cumulé, satisfaction des employés et des clients.
 */
import { rapportFinPartie } from '../engine/simulation';
import type { EtatPartie } from '../engine/types';

const CLE = 'pme-quebec-classement';
const MAXIMUM = 100;

export interface EntreeClassement {
  /** Identifiant unique (graine, entreprise et mois) pour éviter les doublons. */
  id: string;
  date: string;
  nom: string;
  equipe: string | null;
  secteurId: string;
  villeId: string;
  difficulte: string;
  dureeMois: number;
  scenarioId: string | null;
  valeur: number;
  profit: number;
  moral: number;
  satisfaction: number;
  note: number;
  faillite: boolean;
}

export function lireClassement(): EntreeClassement[] {
  try {
    const brut = localStorage.getItem(CLE);
    const liste = brut ? (JSON.parse(brut) as EntreeClassement[]) : [];
    return Array.isArray(liste) ? liste : [];
  } catch {
    return [];
  }
}

/** Ajoute au classement chaque entreprise d'une partie terminée (sans doublon). */
export function enregistrerClassement(etat: EtatPartie): void {
  if (!etat.terminee) return;
  const liste = lireClassement();
  for (const ent of etat.entreprises) {
    const id = `${etat.config.graine}-${ent.id}-${ent.nom}-${etat.moisCourant}`;
    if (liste.some((x) => x.id === id)) continue;
    const r = rapportFinPartie(etat, ent);
    liste.push({
      id,
      date: new Date().toISOString(),
      nom: ent.nom,
      equipe: ent.equipe ?? null,
      secteurId: etat.config.secteurId,
      villeId: etat.config.villeId,
      difficulte: etat.config.difficulte,
      dureeMois: etat.config.dureeMois,
      scenarioId: etat.config.scenarioId ?? null,
      valeur: Math.round(r.bilan.valeurEntreprise),
      profit: Math.round(r.bilan.beneficeCumule),
      moral: Math.round(r.bilan.moralMoyen),
      satisfaction: r.bilan.satisfactionMoyenne,
      note: r.note,
      faillite: ent.enFaillite,
    });
  }
  liste.sort((a, b) => b.note - a.note);
  try {
    localStorage.setItem(CLE, JSON.stringify(liste.slice(0, MAXIMUM)));
  } catch {
    // Stockage plein ou indisponible : le classement n'est pas mis à jour.
  }
}

export function viderClassement(): void {
  try {
    localStorage.removeItem(CLE);
  } catch {
    // Rien à faire.
  }
}
