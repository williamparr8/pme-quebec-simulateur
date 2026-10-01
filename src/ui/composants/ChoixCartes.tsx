/**
 * Groupe de boutons radio présentés en cartes. Les flèches du clavier passent
 * d'une option à l'autre (comportement natif des boutons radio).
 */
import type { ReactNode } from 'react';

export interface OptionCarte {
  id: string;
  titre: ReactNode;
  description?: ReactNode;
  detail?: ReactNode;
  desactive?: boolean;
}

interface Props {
  legende: string;
  nom: string;
  options: OptionCarte[];
  valeur: string;
  onChange: (id: string) => void;
  colonnes?: 1 | 2 | 3 | 4;
}

const GRILLE = {
  1: '',
  2: 'sm:grid-cols-2',
  3: 'sm:grid-cols-2 lg:grid-cols-3',
  4: 'sm:grid-cols-2 lg:grid-cols-4',
};

export function ChoixCartes({ legende, nom, options, valeur, onChange, colonnes = 3 }: Props) {
  return (
    <fieldset>
      <legend className="mb-2 font-bold">{legende}</legend>
      <div className={`grid gap-3 ${GRILLE[colonnes]}`}>
        {options.map((o) => {
          const choisi = o.id === valeur;
          return (
            <label
              key={o.id}
              className={`relative flex cursor-pointer flex-col gap-1 rounded-xl border-2 p-3 transition-colors has-[:focus-visible]:outline has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-[var(--focus)] ${
                o.desactive
                  ? 'cursor-not-allowed border-bordure opacity-55'
                  : choisi
                    ? 'border-accent bg-accent-doux'
                    : 'border-bordure bg-surface hover:border-accent'
              }`}
            >
              <span className="flex items-start gap-2">
                <input
                  type="radio"
                  name={nom}
                  value={o.id}
                  checked={choisi}
                  disabled={o.desactive}
                  onChange={() => onChange(o.id)}
                  className="mt-1 accent-[var(--accent)]"
                />
                <span className="font-semibold">{o.titre}</span>
              </span>
              {o.description && <span className="text-sm text-doux">{o.description}</span>}
              {o.detail && <span className="chiffres text-sm font-semibold">{o.detail}</span>}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
