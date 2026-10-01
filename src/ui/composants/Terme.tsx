/**
 * Infobulles du glossaire. Un terme se consulte en cliquant dessus, ou au clavier :
 * mettre le focus sur l'élément (ou un curseur qui porte data-terme) et appuyer sur I.
 */
import { useEffect, useRef, type ReactNode } from 'react';
import { definition, useInfobulle } from './glossaire';

export function Terme({ id, children }: { id: string; children?: ReactNode }) {
  const ouvrir = useInfobulle((s) => s.ouvrir);
  const entree = definition(id);
  if (!entree) return <>{children}</>;
  return (
    <span
      role="button"
      tabIndex={0}
      data-terme={id}
      className="cursor-help underline decoration-dotted decoration-2 underline-offset-4"
      title="Définition (I)"
      onClick={(e) => ouvrir(id, e.currentTarget)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          ouvrir(id, e.currentTarget);
        }
      }}
    >
      {children ?? entree.terme}
    </span>
  );
}

/** Affichage global de l'infobulle ouverte. */
export function Infobulle() {
  const { id, x, y, fermer } = useInfobulle();
  const ref = useRef<HTMLDivElement>(null);
  const entree = id ? definition(id) : undefined;

  useEffect(() => {
    if (!entree) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'i' || e.key === 'I') {
        e.preventDefault();
        e.stopPropagation();
        fermer();
      }
    };
    const onClic = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) fermer();
    };
    document.addEventListener('keydown', onKey, true);
    document.addEventListener('mousedown', onClic);
    return () => {
      document.removeEventListener('keydown', onKey, true);
      document.removeEventListener('mousedown', onClic);
    };
  }, [entree, fermer]);

  if (!entree) return null;
  const largeur = 340;
  const gauche = Math.max(8, Math.min(x, window.innerWidth - largeur - 8));
  const haut = Math.min(y + 6, window.innerHeight - 220);
  return (
    <div
      ref={ref}
      role="tooltip"
      aria-live="polite"
      className="fixed z-[60] rounded-xl border border-bordure bg-surface p-4 text-sm shadow-2xl"
      style={{ left: gauche, top: Math.max(8, haut), width: largeur }}
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-doux">{entree.categorie}</p>
      <p className="mb-1 text-base font-bold">{entree.terme}</p>
      <p>{entree.definition}</p>
      {entree.formule && (
        <p className="mt-2 rounded-md bg-surface-2 px-2 py-1 font-mono text-xs">{entree.formule}</p>
      )}
      {entree.exemple && <p className="mt-2 italic text-doux">Exemple : {entree.exemple}</p>}
      <p className="mt-2 text-xs text-doux">Échap ou I pour fermer</p>
    </div>
  );
}
