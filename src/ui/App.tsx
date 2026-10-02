import { lazy, Suspense, useEffect } from 'react';
import { appliquerAnimations, appliquerTheme, usePreferences } from '../store/preferences';
import { useJeu } from '../store/jeu';
import { Infobulle } from './composants/Terme';
import { EcranAccueil } from './accueil/EcranAccueil';

const EcranClassement = lazy(() =>
  import('./accueil/EcranClassement').then((m) => ({ default: m.EcranClassement })),
);
const EcranScenarios = lazy(() =>
  import('./accueil/EcranScenarios').then((m) => ({ default: m.EcranScenarios })),
);
const EcranCreation = lazy(() =>
  import('./creation/EcranCreation').then((m) => ({ default: m.EcranCreation })),
);
const EcranJeu = lazy(() => import('./jeu/EcranJeu').then((m) => ({ default: m.EcranJeu })));

/** Affiché pendant le chargement d'un écran (quelques dixièmes de seconde). */
export function Chargement() {
  return (
    <p className="p-6 text-center text-doux" role="status">
      Chargement…
    </p>
  );
}

export default function App() {
  const ecran = useJeu((s) => s.ecran);
  const annonce = useJeu((s) => s.annonce);
  const theme = usePreferences((s) => s.theme);
  const animations = usePreferences((s) => s.animations);

  useEffect(() => appliquerAnimations(animations), [animations]);

  // Suit le thème du système d'exploitation quand le joueur a choisi « Système ».
  useEffect(() => {
    appliquerTheme(theme);
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const suivre = () => appliquerTheme(usePreferences.getState().theme);
    media.addEventListener('change', suivre);
    return () => media.removeEventListener('change', suivre);
  }, [theme]);

  return (
    <>
      <a
        href="#contenu"
        className="sr-only z-50 rounded-md bg-accent px-3 py-2 text-accent-texte focus:not-sr-only focus:fixed focus:left-2 focus:top-2"
      >
        Aller au contenu principal
      </a>
      {ecran === 'accueil' && <EcranAccueil />}
      <Suspense fallback={<Chargement />}>
        {ecran === 'scenarios' && <EcranScenarios />}
        {ecran === 'classement' && <EcranClassement />}
        {ecran === 'creation' && <EcranCreation />}
        {ecran === 'jeu' && <EcranJeu />}
      </Suspense>
      <Infobulle />
      <div className="sr-only" role="status" aria-live="polite">
        {annonce}
      </div>
    </>
  );
}
