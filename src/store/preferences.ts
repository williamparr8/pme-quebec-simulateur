/** Préférences de l'interface, conservées dans le navigateur. */
import { create } from 'zustand';

export type Theme = 'systeme' | 'clair' | 'sombre';

interface Valeurs {
  theme: Theme;
  /** Conseiller virtuel affiché (désactivable). */
  conseiller: boolean;
  /** Sons générés (caisse enregistreuse…). */
  sons: boolean;
  /** Animations de la scène et de l'interface (en plus de prefers-reduced-motion). */
  animations: boolean;
}

interface Preferences extends Valeurs {
  setTheme: (t: Theme) => void;
  setConseiller: (actif: boolean) => void;
  setSons: (actif: boolean) => void;
  setAnimations: (actif: boolean) => void;
}

const CLE = 'pme-quebec:preferences';
const DEFAUT: Valeurs = { theme: 'systeme', conseiller: true, sons: true, animations: true };

function lirePreferences(): Valeurs {
  try {
    const brut = window.localStorage.getItem(CLE);
    if (brut) {
      const p = JSON.parse(brut) as Partial<Valeurs>;
      const theme =
        p.theme === 'clair' || p.theme === 'sombre' || p.theme === 'systeme' ? p.theme : 'systeme';
      return {
        theme,
        conseiller: p.conseiller !== false,
        sons: p.sons !== false,
        animations: p.animations !== false,
      };
    }
  } catch {
    // Stockage indisponible : valeurs par défaut.
  }
  return DEFAUT;
}

function ecrire(p: Valeurs): void {
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

export function appliquerAnimations(actives: boolean): void {
  document.documentElement.classList.toggle('sans-animation', !actives);
}

export const usePreferences = create<Preferences>((set, get) => {
  const changer = (c: Partial<Valeurs>) => {
    const { theme, conseiller, sons, animations } = { ...get(), ...c };
    ecrire({ theme, conseiller, sons, animations });
    set(c);
  };
  return {
    ...lirePreferences(),
    setTheme: (theme) => {
      appliquerTheme(theme);
      changer({ theme });
    },
    setConseiller: (conseiller) => changer({ conseiller }),
    setSons: (sons) => changer({ sons }),
    setAnimations: (animations) => {
      appliquerAnimations(animations);
      changer({ animations });
    },
  };
});
