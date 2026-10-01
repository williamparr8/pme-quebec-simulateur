import type { ReactNode } from 'react';
import { pourcentage } from '../../i18n/format';

export type Ton = 'neutre' | 'succes' | 'alerte' | 'danger';

const TONS: Record<Ton, string> = {
  neutre: 'text-texte',
  succes: 'text-succes',
  alerte: 'text-alerte',
  danger: 'text-danger',
};

interface Props {
  libelle: ReactNode;
  valeur: string;
  /** Variation relative par rapport au mois précédent (ex. 0.12 = +12 %). */
  variation?: number | null;
  /** Une hausse est-elle une bonne nouvelle? (faux pour les coûts) */
  hausseFavorable?: boolean;
  ton?: Ton;
  detail?: ReactNode;
  terme?: string;
}

export function Indicateur({
  libelle,
  valeur,
  variation,
  hausseFavorable = true,
  ton = 'neutre',
  detail,
  terme,
}: Props) {
  let fleche: ReactNode = null;
  if (
    variation !== undefined &&
    variation !== null &&
    Number.isFinite(variation) &&
    Math.abs(variation) >= 0.005
  ) {
    const bon = variation > 0 === hausseFavorable;
    fleche = (
      <span className={`text-sm font-semibold ${bon ? 'text-succes' : 'text-danger'}`}>
        <span aria-hidden="true">{variation > 0 ? '▲' : '▼'}</span>
        <span className="sr-only">{variation > 0 ? 'hausse de' : 'baisse de'}</span>{' '}
        {pourcentage(Math.abs(variation), 0)}
      </span>
    );
  }
  return (
    <div
      className="rounded-xl border border-bordure bg-surface p-3 shadow-carte"
      data-terme={terme}
      tabIndex={terme ? 0 : undefined}
    >
      <p className="text-sm font-medium text-doux">{libelle}</p>
      <p className={`chiffres text-2xl font-extrabold ${TONS[ton]}`}>{valeur}</p>
      <div className="flex flex-wrap items-center gap-2 text-sm text-doux">
        {fleche}
        {detail}
      </div>
    </div>
  );
}
