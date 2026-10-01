import { useEffect } from 'react';
import { appliquerTheme, usePreferences } from '../store/preferences';
import { useJeu } from '../store/jeu';
import { Infobulle } from './composants/Terme';
import { EcranAccueil } from './accueil/EcranAccueil';
import { EcranClassement } from './accueil/EcranClassement';
import { EcranScenarios } from './accueil/EcranScenarios';
import { EcranCreation } from './creation/EcranCreation';
import { EcranJeu } from './jeu/EcranJeu';

export default function App() {
  const ecran = useJeu((s) => s.ecran);
  const annonce = useJeu((s) => s.annonce);
  const theme = usePreferences((s) => s.theme);

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
      {ecran === 'scenarios' && <EcranScenarios />}
      {ecran === 'classement' && <EcranClassement />}
      {ecran === 'creation' && <EcranCreation />}
      {ecran === 'jeu' && <EcranJeu />}
      <Infobulle />
      <div className="sr-only" role="status" aria-live="polite">
        {annonce}
      </div>
    </>
  );
}
