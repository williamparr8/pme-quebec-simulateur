/** Mode Prof / Scénario : choix d'une mise en situation avec des objectifs. */
import { useEffect, useRef } from 'react';
import { SCENARIOS } from '../../engine/simulation';
import { OBJECTIFS_TEXTE } from '../../i18n/messages-jalon5';
import { useJeu } from '../../store/jeu';
import { Bouton } from '../composants/Bouton';
import { Carte } from '../composants/Carte';

export function EcranScenarios() {
  const allerA = useJeu((s) => s.allerA);
  const choisir = useJeu((s) => s.choisirModeCreation);
  const titre = useRef<HTMLHeadingElement>(null);
  useEffect(() => titre.current?.focus(), []);

  return (
    <main
      id="contenu"
      className="mx-auto max-w-4xl space-y-5 px-4 py-8"
      onKeyDown={(e) => {
        if (e.key === 'Escape') allerA('accueil');
      }}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 ref={titre} tabIndex={-1} className="text-3xl font-extrabold">
          Scénarios
        </h1>
        <Bouton onClick={() => allerA('accueil')} raccourci="Échap">
          Retour à l’accueil
        </Bouton>
      </div>
      <p className="max-w-2xl text-doux">
        Chaque scénario impose un secteur, une ville, une durée et une situation de départ, avec des
        objectifs précis. La note finale combine les objectifs atteints (70 points) et la note de
        gestion (30 points). Idéal pour comparer les équipes d’une classe sur un même défi.
      </p>
      <div className="grid gap-4 md:grid-cols-2">
        {SCENARIOS.map((sc) => (
          <Carte key={sc.id} titre={sc.nom} sousTitre={sc.resume}>
            <p className="text-sm">{sc.description}</p>
            <p className="mt-3 text-sm font-semibold">Objectifs</p>
            <ul className="list-disc pl-5 text-sm">
              {sc.objectifs.map((o) => (
                <li key={o.type}>{OBJECTIFS_TEXTE[o.type](o.cible)}</li>
              ))}
            </ul>
            <div className="mt-4">
              <Bouton
                variante="primaire"
                onClick={() => choisir({ type: 'scenario', scenarioId: sc.id })}
              >
                Relever ce défi
              </Bouton>
            </div>
          </Carte>
        ))}
      </div>
    </main>
  );
}
