/** Liste des messages du rapport mensuel, triés par importance (icône + libellé : jamais la couleur seule). */
import type { Message } from '../../engine/types';
import { ORDRE_NIVEAUX, texteMessage } from '../../i18n/fr-CA';

const STYLE: Record<Message['niveau'], { classe: string; icone: string; libelle: string }> = {
  danger: { classe: 'border-danger bg-danger-doux', icone: '⛔', libelle: 'Urgent' },
  alerte: { classe: 'border-alerte bg-alerte-doux', icone: '⚠️', libelle: 'Attention' },
  succes: { classe: 'border-succes bg-succes-doux', icone: '✅', libelle: 'Bonne nouvelle' },
  info: { classe: 'border-info bg-info-doux', icone: 'ℹ️', libelle: 'Information' },
};

export function ListeMessages({ messages, max }: { messages: Message[]; max?: number }) {
  const tries = [...messages].sort((a, b) => ORDRE_NIVEAUX[a.niveau] - ORDRE_NIVEAUX[b.niveau]);
  const affiches = max ? tries.slice(0, max) : tries;
  if (affiches.length === 0) return <p className="text-sm text-doux">Rien à signaler.</p>;
  return (
    <ul className="space-y-2">
      {affiches.map((m, i) => {
        const t = texteMessage(m);
        const s = STYLE[m.niveau];
        return (
          <li key={`${m.code}-${i}`} className={`rounded-lg border-l-4 p-3 ${s.classe}`}>
            <p className="font-bold">
              <span aria-hidden="true">{s.icone} </span>
              <span className="sr-only">{s.libelle} : </span>
              {t.titre}
            </p>
            {t.texte && <p className="text-sm">{t.texte}</p>}
          </li>
        );
      })}
    </ul>
  );
}
