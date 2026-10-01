/** Glossaire complet et consultable, avec recherche (touche G en jeu). */
import { useMemo, useState } from 'react';
import { Bouton } from './Bouton';
import { GLOSSAIRE } from './glossaire';
import { Modale } from './Modale';

/** Retire les accents et met en minuscules (recherche tolérante). */
function normaliser(texte: string): string {
  return texte.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

export function ModaleGlossaire({ onFermer }: { onFermer: () => void }) {
  const [recherche, setRecherche] = useState('');
  const [categorie, setCategorie] = useState('');
  const categories = useMemo(
    () => [...new Set(GLOSSAIRE.map((t) => t.categorie))].sort((a, b) => a.localeCompare(b, 'fr')),
    [],
  );
  const q = normaliser(recherche.trim());
  const termes = GLOSSAIRE.filter(
    (t) =>
      (!categorie || t.categorie === categorie) &&
      (!q || normaliser(`${t.terme} ${t.definition}`).includes(q)),
  ).sort((a, b) => a.terme.localeCompare(b.terme, 'fr'));

  return (
    <Modale
      titre={`Glossaire (${GLOSSAIRE.length} termes)`}
      onFermer={onFermer}
      taille="lg"
      pied={<Bouton onClick={onFermer}>Fermer</Bouton>}
    >
      <div className="mb-4 flex flex-wrap gap-3">
        <label className="min-w-0 flex-1 space-y-1">
          <span className="block text-sm font-semibold">Rechercher un terme</span>
          <input
            type="search"
            data-focus-initial
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
            placeholder="ex. marge brute, TVQ, persona…"
            className="w-full rounded-md border border-bordure bg-surface-2 px-3 py-2"
          />
        </label>
        <label className="space-y-1">
          <span className="block text-sm font-semibold">Catégorie</span>
          <select
            value={categorie}
            onChange={(e) => setCategorie(e.target.value)}
            className="rounded-md border border-bordure bg-surface-2 px-3 py-2"
          >
            <option value="">Toutes</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
      </div>
      <p className="mb-2 text-sm text-doux" role="status">
        {termes.length} terme{termes.length > 1 ? 's' : ''}
      </p>
      <dl className="space-y-3">
        {termes.map((t) => (
          <div key={t.id} className="rounded-lg border border-bordure p-3">
            <dt className="font-bold">
              {t.terme} <span className="text-xs font-normal text-doux">· {t.categorie}</span>
            </dt>
            <dd className="mt-1 text-sm">{t.definition}</dd>
            {t.formule && (
              <dd className="mt-1 text-sm">
                <span className="font-semibold">Formule : </span>
                {t.formule}
              </dd>
            )}
            {t.exemple && (
              <dd className="mt-1 text-sm text-doux">
                <span className="font-semibold">Exemple : </span>
                {t.exemple}
              </dd>
            )}
          </div>
        ))}
      </dl>
    </Modale>
  );
}
