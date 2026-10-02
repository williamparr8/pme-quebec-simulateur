import { usePreferences, type Theme } from '../../store/preferences';

const OPTIONS: { id: Theme; nom: string }[] = [
  { id: 'systeme', nom: 'Système' },
  { id: 'clair', nom: 'Clair' },
  { id: 'sombre', nom: 'Sombre' },
];

/** Thème, sons et animations (préférences conservées dans le navigateur). */
export function ChoixTheme() {
  const { theme, setTheme, sons, setSons, animations, setAnimations } = usePreferences();
  return (
    <div className="flex flex-wrap items-center gap-3 text-sm">
      <label className="flex items-center gap-2">
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
      <label className="flex items-center gap-1.5">
        <input type="checkbox" checked={sons} onChange={(e) => setSons(e.target.checked)} />
        <span>Sons</span>
      </label>
      <label className="flex items-center gap-1.5">
        <input
          type="checkbox"
          checked={animations}
          onChange={(e) => setAnimations(e.target.checked)}
        />
        <span>Animations</span>
      </label>
    </div>
  );
}
