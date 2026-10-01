/**
 * Curseur accessible au clavier :
 *   ← → (ou ↑ ↓) : ±1 %     Maj + ← → ou Page préc./suiv. : ±10 %     Début/Fin : minimum/maximum
 * Le pourcentage s'applique à la valeur actuelle (prix) ou à la plage (budgets).
 */
import { useId, useState, type KeyboardEvent } from 'react';

interface Props {
  libelle: string;
  valeur: number;
  min: number;
  max: number;
  onChange: (valeur: number) => void;
  format: (valeur: number) => string;
  /** Base du pas de 1 % : la valeur actuelle (prix) ou la plage min-max (budgets). */
  base?: 'valeur' | 'plage';
  decimales?: number;
  /** Identifiant d'un terme du glossaire (touche I). */
  terme?: string;
  aide?: string;
  desactive?: boolean;
}

function arrondir(x: number, decimales: number): number {
  const f = 10 ** decimales;
  return Math.round(x * f) / f;
}

export function Curseur({
  libelle,
  valeur,
  min,
  max,
  onChange,
  format,
  base = 'plage',
  decimales = 0,
  terme,
  aide,
  desactive,
}: Props) {
  const id = useId();
  const [saisie, setSaisie] = useState(String(valeur));
  // Quand la valeur change (curseur, clavier), la zone de saisie suit.
  const [valeurAffichee, setValeurAffichee] = useState(valeur);
  if (valeur !== valeurAffichee) {
    setValeurAffichee(valeur);
    setSaisie(String(valeur));
  }

  const borne = (x: number) => Math.min(max, Math.max(min, arrondir(x, decimales)));

  const pas = (fraction: number) => {
    const reference = base === 'valeur' && valeur !== 0 ? Math.abs(valeur) : max - min;
    const minimal = 1 / 10 ** decimales;
    return Math.max(minimal, reference * fraction);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    let nouvelle: number;
    const fraction = e.shiftKey ? 0.1 : 0.01;
    switch (e.key) {
      case 'ArrowRight':
      case 'ArrowUp':
        nouvelle = valeur + pas(fraction);
        break;
      case 'ArrowLeft':
      case 'ArrowDown':
        nouvelle = valeur - pas(fraction);
        break;
      case 'PageUp':
        nouvelle = valeur + pas(0.1);
        break;
      case 'PageDown':
        nouvelle = valeur - pas(0.1);
        break;
      case 'Home':
        nouvelle = min;
        break;
      case 'End':
        nouvelle = max;
        break;
      default:
        return;
    }
    e.preventDefault();
    onChange(borne(nouvelle));
  };

  const valider = () => {
    const x = Number(saisie.replace(',', '.').replace(/\s/g, ''));
    if (Number.isFinite(x)) onChange(borne(x));
    else setSaisie(String(valeur));
  };

  return (
    <div className="space-y-1" data-terme={terme}>
      <div className="flex items-baseline justify-between gap-2">
        <label htmlFor={id} className="font-semibold">
          {libelle}
        </label>
        <span className="chiffres font-bold text-accent" aria-hidden="true">
          {format(valeur)}
        </span>
      </div>
      <div className="flex items-center gap-3">
        <input
          id={id}
          type="range"
          className="w-full"
          min={min}
          max={max}
          step="any"
          value={valeur}
          disabled={desactive}
          aria-valuetext={format(valeur)}
          aria-describedby={aide ? `${id}-aide` : undefined}
          onKeyDown={onKeyDown}
          onChange={(e) => onChange(borne(Number(e.target.value)))}
        />
        <input
          type="text"
          inputMode="decimal"
          aria-label={`${libelle} (saisie)`}
          className="chiffres w-24 rounded-md border border-bordure bg-surface-2 px-2 py-1 text-right"
          value={saisie}
          disabled={desactive}
          onChange={(e) => setSaisie(e.target.value)}
          onBlur={valider}
          onKeyDown={(e) => {
            if (e.key === 'Enter') valider();
            if (e.key === 'Escape') setSaisie(String(valeur));
          }}
        />
      </div>
      {aide && (
        <p id={`${id}-aide`} className="text-sm text-doux">
          {aide}
        </p>
      )}
    </div>
  );
}
