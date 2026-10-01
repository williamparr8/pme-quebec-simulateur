import type { ReactNode } from 'react';

interface Props {
  titre?: ReactNode;
  sousTitre?: ReactNode;
  actions?: ReactNode;
  className?: string;
  children: ReactNode;
}

export function Carte({ titre, sousTitre, actions, className = '', children }: Props) {
  return (
    <section
      className={`rounded-xl border border-bordure bg-surface p-4 shadow-carte ${className}`}
    >
      {(titre || actions) && (
        <header className="mb-3 flex flex-wrap items-start justify-between gap-2">
          <div>
            {titre && <h3 className="text-base font-bold">{titre}</h3>}
            {sousTitre && <p className="text-sm text-doux">{sousTitre}</p>}
          </div>
          {actions}
        </header>
      )}
      {children}
    </section>
  );
}

/** Petit encadré pédagogique. */
export function Astuce({
  children,
  titre = 'Le savais-tu?',
}: {
  children: ReactNode;
  titre?: string;
}) {
  return (
    <aside className="rounded-lg border border-info/40 bg-info-doux p-3 text-sm">
      <p className="mb-1 font-bold text-info">{titre}</p>
      <div>{children}</div>
    </aside>
  );
}
