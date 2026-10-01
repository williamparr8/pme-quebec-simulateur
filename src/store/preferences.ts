/** Préférences de l'interface, conservées dans le navigateur. */
import { create } from 'zustand';

export type Theme = 'systeme' | 'clair' | 'sombre';

interface Preferences {
  theme: Theme;
  /** Conseiller virtuel affiché (désactivable). */
  conseiller: boolean;
  setTheme: (t: Theme) => void;
  setConseiller: (actif: boolean) => void;
}

const CLE = 'pme-quebec:preferences';

function lirePreferences(): { theme: Theme; conseiller: boolean } {
  try {
    const brut = window.localStorage.getItem(CLE);
    if (brut) {
      const p = JSON.parse(brut) as { theme?: Theme; conseiller?: boolean };
      const theme =
        p.theme === 'clair' || p.theme === 'sombre' || p.theme === 'systeme' ? p.theme : 'systeme';
      return { theme, conseiller: p.conseiller !== false };
    }
  } catch {
    // Stockage indisponible : valeurs par défaut.
  }
  return { theme: 'systeme', conseiller: true };
}

function ecrire(p: { theme: Theme; conseiller: boolean }): void {
  try {
    window.localStorage.setItem(CLE, JSON.stringify(p));
  } catch {
    // Ignoré : la préférence durera le temps de la session.
  }
}

export function appliquerTheme(theme: Theme): void {
  const racine = document.documentElement;
  const sombre =
    theme === 'sombre' ||
    (theme === 'systeme' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  racine.classList.toggle('dark', sombre);
  racine.style.colorScheme = sombre ? 'dark' : 'light';
}

export const usePreferences = create<Preferences>((set, get) => ({
  ...lirePreferences(),
  setTheme: (theme) => {
    ecrire({ theme, conseiller: get().conseiller });
    appliquerTheme(theme);
    set({ theme });
  },
  setConseiller: (conseiller) => {
    ecrire({ theme: get().theme, conseiller });
    set({ conseiller });
  },
}));
