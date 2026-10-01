/**
 * Fenêtre modale accessible : le focus reste piégé à l'intérieur (Tab / Maj+Tab),
 * Échap ferme la fenêtre et le focus revient à l'élément d'origine.
 */
import { useEffect, useId, useRef, type ReactNode } from 'react';

interface Props {
  titre: ReactNode;
  onFermer: () => void;
  children: ReactNode;
  taille?: 'md' | 'lg' | 'xl';
  /** Pied de la fenêtre (boutons). */
  pied?: ReactNode;
}

const SELECTEUR_FOCUS =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function Modale({ titre, onFermer, children, taille = 'md', pied }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const idTitre = useId();
  const fermer = useRef(onFermer);
  useEffect(() => {
    fermer.current = onFermer;
  }, [onFermer]);

  useEffect(() => {
    const precedent = document.activeElement as HTMLElement | null;
    const boite = ref.current;
    const premier =
      boite?.querySelector<HTMLElement>('[data-focus-initial]') ??
      boite?.querySelector<HTMLElement>(SELECTEUR_FOCUS);
    (premier ?? boite)?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        fermer.current();
        return;
      }
      if (e.key !== 'Tab' || !boite) return;
      const elements = Array.from(boite.querySelectorAll<HTMLElement>(SELECTEUR_FOCUS));
      if (elements.length === 0) return;
      const debut = elements[0];
      const fin = elements[elements.length - 1];
      if (e.shiftKey && document.activeElement === debut) {
        e.preventDefault();
        fin.focus();
      } else if (!e.shiftKey && document.activeElement === fin) {
        e.preventDefault();
        debut.focus();
      }
    };
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('keydown', onKey, true);
      precedent?.focus?.();
    };
  }, []);

  const largeur = taille === 'xl' ? 'max-w-5xl' : taille === 'lg' ? 'max-w-3xl' : 'max-w-lg';
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 sm:items-center">
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={idTitre}
        tabIndex={-1}
        className={`my-8 w-full ${largeur} rounded-2xl border border-bordure bg-surface shadow-2xl`}
      >
        <header className="flex items-center justify-between gap-4 border-b border-bordure px-5 py-4">
          <h2 id={idTitre} className="text-xl font-bold">
            {titre}
          </h2>
          <button
            type="button"
            onClick={onFermer}
            className="rounded-md px-2 py-1 text-doux hover:bg-surface-2"
            aria-label="Fermer (Échap)"
          >
            <span aria-hidden="true">✕</span>
          </button>
        </header>
        <div className="max-h-[70vh] overflow-y-auto px-5 py-4">{children}</div>
        {pied && (
          <footer className="flex flex-wrap justify-end gap-2 border-t border-bordure px-5 py-3">
            {pied}
          </footer>
        )}
      </div>
    </div>
  );
}
