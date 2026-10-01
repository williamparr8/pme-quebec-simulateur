import type { ReactNode } from 'react';

/** Titre d'un département. Il reçoit le focus après un raccourci clavier. */
export function TitrePage({
  titre,
  touche,
  children,
}: {
  titre: string;
  touche: string;
  children?: ReactNode;
}) {
  return (
    <div className="mb-4">
      <h2 tabIndex={-1} data-titre-page className="text-2xl font-extrabold">
        {titre}{' '}
        <kbd className="ml-1 rounded border border-bordure px-1.5 align-middle text-sm font-semibold text-doux">
          {touche}
        </kbd>
      </h2>
      {children && <p className="mt-1 max-w-3xl text-doux">{children}</p>}
    </div>
  );
}
