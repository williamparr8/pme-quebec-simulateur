/**
 * Raccourcis clavier globaux du jeu :
 *   T M R O V F J : départements    Espace : terminer le mois    ? : aide
 *   I : définition du terme sélectionné    Échap : retour au tableau de bord
 * Ils sont ignorés pendant la saisie de texte et quand une fenêtre est ouverte.
 */
import { useEffect } from 'react';
import { useJeu, type Onglet } from '../../store/jeu';
import { ouvrirTermeDuFocus, useInfobulle } from '../composants/glossaire';

const TOUCHES: Record<string, Onglet> = {
  t: 'tableau',
  m: 'marketing',
  r: 'rh',
  o: 'operations',
  v: 'ventes',
  f: 'finance',
  j: 'juridique',
};

const SAISIE =
  'input[type="text"], input[type="number"], input:not([type]), textarea, select, [contenteditable="true"]';
/** Éléments sur lesquels la barre d'espace a déjà une action (cliquer, cocher…). */
const ACTIVABLE =
  'button, a[href], input, select, summary, [role="button"], [role="tab"], [role="radio"], [role="checkbox"]';

export function useRaccourcis(): void {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const s = useJeu.getState();
      if (s.modale || useInfobulle.getState().id) return;
      if (e.ctrlKey || e.metaKey || e.altKey || e.defaultPrevented) return;
      const cible = e.target instanceof Element ? e.target : null;
      if (cible?.closest(SAISIE)) return;

      if (e.key === '?') {
        e.preventDefault();
        s.ouvrirModale('aide');
        return;
      }
      if (e.key === 'i' || e.key === 'I') {
        if (ouvrirTermeDuFocus()) e.preventDefault();
        return;
      }
      if (e.key === ' ') {
        if (cible?.closest(ACTIVABLE)) return;
        e.preventDefault();
        if (s.etat && !s.etat.terminee) s.ouvrirModale('confirmerMois');
        return;
      }
      if (e.key === 'Escape') {
        if (s.onglet !== 'tableau') {
          e.preventDefault();
          s.changerOnglet('tableau');
        }
        return;
      }
      const onglet = TOUCHES[e.key.toLowerCase()];
      if (onglet && !e.shiftKey) {
        e.preventDefault();
        s.changerOnglet(onglet);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);
}
