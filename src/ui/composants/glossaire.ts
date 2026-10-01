/** Glossaire et état de l'infobulle ouverte (touche I). */
import { create } from 'zustand';
import glossaireJson from '../../data/glossaire.json';

export interface EntreeGlossaire {
  id: string;
  terme: string;
  categorie: string;
  definition: string;
  exemple?: string;
  formule?: string;
}

export const GLOSSAIRE: EntreeGlossaire[] = glossaireJson.termes;
const PAR_ID = new Map(GLOSSAIRE.map((t) => [t.id, t]));

export function definition(id: string): EntreeGlossaire | undefined {
  return PAR_ID.get(id);
}

interface EtatInfobulle {
  id: string | null;
  x: number;
  y: number;
  ouvrir: (id: string, ancre: Element) => void;
  fermer: () => void;
}

export const useInfobulle = create<EtatInfobulle>((set) => ({
  id: null,
  x: 0,
  y: 0,
  ouvrir: (id, ancre) => {
    const r = ancre.getBoundingClientRect();
    set({ id, x: r.left, y: r.bottom });
  },
  fermer: () => set({ id: null }),
}));

/** Ouvre l'infobulle de l'élément qui a le focus (touche I). Retourne vrai si un terme a été trouvé. */
export function ouvrirTermeDuFocus(): boolean {
  const actif = document.activeElement;
  const porteur = actif?.closest('[data-terme]');
  const id = porteur?.getAttribute('data-terme');
  if (porteur && id && PAR_ID.has(id)) {
    useInfobulle.getState().ouvrir(id, actif ?? porteur);
    return true;
  }
  return false;
}
