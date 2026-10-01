import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';

type Variante = 'primaire' | 'secondaire' | 'danger' | 'discret';

const STYLES: Record<Variante, string> = {
  primaire:
    'bg-accent text-accent-texte hover:bg-accent-fort border-transparent shadow-sm disabled:opacity-50',
  secondaire: 'bg-surface text-texte border-bordure hover:bg-surface-2 disabled:opacity-50',
  danger: 'bg-surface text-danger border-danger hover:bg-danger-doux disabled:opacity-50',
  discret: 'bg-transparent text-accent border-transparent hover:bg-accent-doux disabled:opacity-50',
};

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variante?: Variante;
  /** Touche de raccourci affichée à droite du libellé. */
  raccourci?: string;
  petit?: boolean;
  children: ReactNode;
}

export const Bouton = forwardRef<HTMLButtonElement, Props>(function Bouton(
  { variante = 'secondaire', raccourci, petit, className = '', children, ...reste },
  ref,
) {
  return (
    <button
      ref={ref}
      type="button"
      className={`inline-flex items-center justify-center gap-2 rounded-lg border font-semibold transition-colors disabled:cursor-not-allowed ${
        petit ? 'px-2.5 py-1 text-sm' : 'px-4 py-2'
      } ${STYLES[variante]} ${className}`}
      {...reste}
    >
      {children}
      {raccourci && (
        <kbd className="rounded border border-current/30 px-1.5 text-xs font-medium opacity-80">
          {raccourci}
        </kbd>
      )}
    </button>
  );
});
