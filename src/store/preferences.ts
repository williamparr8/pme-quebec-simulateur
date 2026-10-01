/** Préférences de l'interface, conservées dans le navigateur. */
import { create } from 'zustand';

export type Theme = 'systeme' | 'clair' | 'sombre';

interface Preferences {
  theme: Theme;
  setTheme: (t: Theme) => void;
}

const CLE = 'pme-quebec:preferences';

function lirePreferences(): { theme: Theme } {
  try {
    const brut = window.localStorage.getItem(CLE);
    if (brut) {
      const p = JSON.parse(brut) as { theme?: Theme };
      if (p.theme === 'clair' || p.theme === 'sombre' || p.theme === 'systeme')
        return { theme: p.theme };
    }
  } catch {
    // Stockage indisponible : valeurs par défaut.
  }
  return { theme: 'systeme' };
}

export function appliquerTheme(theme: Theme): void {
  const racine = document.documentElement;
  const sombre =
    theme === 'sombre' ||
    (theme === 'systeme' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  racine.classList.toggle('dark', sombre);
  racine.style.colorScheme = sombre ? 'dark' : 'light';
}

export const usePreferences = create<Preferences>((set) => ({
  ...lirePreferences(),
  setTheme: (theme) => {
    try {
      window.localStorage.setItem(CLE, JSON.stringify({ theme }));
    } catch {
      // Ignoré : la préférence durera le temps de la session.
    }
    appliquerTheme(theme);
    set({ theme });
  },
}));
