/**
 * Sous-onglets d'une page (motif « tablist ») : ← → passent d'un onglet à l'autre,
 * Début et Fin vont au premier et au dernier. Le contenu est affiché dans un tabpanel.
 */
import { useId, useRef, type KeyboardEvent, type ReactNode } from 'react';

export interface SousOnglet<T extends string> {
  id: T;
  nom: string;
  /** Pastille (ex. nombre d'éléments à traiter). */
  badge?: number;
}

interface Props<T extends string> {
  libelle: string;
  onglets: SousOnglet<T>[];
  actif: T;
  onChange: (id: T) => void;
  children: ReactNode;
}

export function SousOnglets<T extends string>({
  libelle,
  onglets,
  actif,
  onChange,
  children,
}: Props<T>) {
  const base = useId();
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  const aller = (index: number) => {
    const n = onglets.length;
    const i = ((index % n) + n) % n;
    onChange(onglets[i].id);
    refs.current[i]?.focus();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (e.key === 'ArrowRight') aller(index + 1);
    else if (e.key === 'ArrowLeft') aller(index - 1);
    else if (e.key === 'Home') aller(0);
    else if (e.key === 'End') aller(onglets.length - 1);
    else return;
    e.preventDefault();
  };

  return (
    <div className="space-y-4">
      <div
        role="tablist"
        aria-label={libelle}
        className="flex flex-wrap gap-1 border-b border-bordure"
      >
        {onglets.map((o, i) => {
          const choisi = o.id === actif;
          return (
            <button
              key={o.id}
              ref={(el) => {
                refs.current[i] = el;
              }}
              type="button"
              role="tab"
              id={`${base}-onglet-${o.id}`}
              aria-selected={choisi}
              aria-controls={`${base}-panneau`}
              tabIndex={choisi ? 0 : -1}
              onClick={() => onChange(o.id)}
              onKeyDown={(e) => onKeyDown(e, i)}
              className={`-mb-px flex items-center gap-1.5 rounded-t-lg border border-b-0 px-3 py-2 text-sm font-semibold ${
                choisi
                  ? 'border-bordure bg-surface text-accent'
                  : 'border-transparent text-doux hover:text-texte'
              }`}
            >
              {o.nom}
              {o.badge !== undefined && o.badge > 0 && (
                <span className="rounded-full bg-alerte px-1.5 text-xs font-bold text-fond">
                  {o.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>
      <div role="tabpanel" id={`${base}-panneau`} aria-labelledby={`${base}-onglet-${actif}`}>
        {children}
      </div>
    </div>
  );
}
