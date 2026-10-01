import { usePreferences, type Theme } from '../../store/preferences';

const OPTIONS: { id: Theme; nom: string }[] = [
  { id: 'systeme', nom: 'Système' },
  { id: 'clair', nom: 'Clair' },
  { id: 'sombre', nom: 'Sombre' },
];

export function ChoixTheme() {
  const { theme, setTheme } = usePreferences();
  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="text-doux">Thème</span>
      <select
        className="rounded-md border border-bordure bg-surface px-2 py-1"
        value={theme}
        onChange={(e) => setTheme(e.target.value as Theme)}
      >
        {OPTIONS.map((o) => (
          <option key={o.id} value={o.id}>
            {o.nom}
          </option>
        ))}
      </select>
    </label>
  );
}
