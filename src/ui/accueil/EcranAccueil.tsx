import { useEffect, useRef } from 'react';
import { useJeu } from '../../store/jeu';
import { charger, resume } from '../../store/sauvegarde';
import { argentRond } from '../../i18n/format';
import { Bouton } from '../composants/Bouton';
import { Carte } from '../composants/Carte';
import { ChoixTheme } from '../composants/ChoixTheme';
import { GestionSauvegardes } from '../composants/GestionSauvegardes';
import { Logo } from '../composants/Logo';

export function EcranAccueil() {
  const allerA = useJeu((s) => s.allerA);
  const chargerPartie = useJeu((s) => s.chargerPartie);
  const auto = resume('auto');
  const premier = useRef<HTMLButtonElement>(null);

  useEffect(() => premier.current?.focus(), []);

  return (
    <main id="contenu" className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-2 flex justify-end">
        <ChoixTheme />
      </div>
      <header className="mb-8 flex flex-wrap items-center gap-4">
        <Logo taille={72} />
        <div>
          <h1 className="text-3xl font-extrabold sm:text-4xl">PME Québec</h1>
          <p className="text-lg text-doux">Le Simulateur d’affaires</p>
        </div>
      </header>

      <p className="mb-6 max-w-2xl text-lg">
        Lance ta propre entreprise au Québec, fixe tes prix, embauche ton équipe, gère ta trésorerie
        et affronte la concurrence. Chaque décision a des conséquences réelles sur tes états
        financiers.
      </p>

      <div className="mb-8 flex flex-wrap gap-3">
        <Bouton ref={premier} variante="primaire" onClick={() => allerA('creation')}>
          Nouvelle partie
        </Bouton>
        {auto && !auto.terminee && (
          <Bouton
            onClick={() => {
              const e = charger('auto');
              if (e) chargerPartie(e, null);
            }}
          >
            Continuer : {auto.nomEntreprise} (mois {auto.moisJoues}/{auto.dureeMois},{' '}
            {argentRond(auto.encaisse)})
          </Bouton>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Carte titre="Charger une partie">
          <GestionSauvegardes enJeu={false} />
        </Carte>
        <Carte titre="Comment jouer">
          <ul className="list-disc space-y-1 pl-5 text-sm">
            <li>
              1 tour = 1 mois. Prends tes décisions dans chaque département, puis termine le mois.
            </li>
            <li>
              Tout se joue au clavier : <kbd>Tab</kbd> pour naviguer, <kbd>Entrée</kbd> pour
              valider, <kbd>Échap</kbd> pour revenir.
            </li>
            <li>
              Départements : <kbd>T</kbd> tableau de bord, <kbd>M</kbd> marketing, <kbd>R</kbd> RH,{' '}
              <kbd>O</kbd> opérations, <kbd>V</kbd> ventes, <kbd>F</kbd> finance, <kbd>J</kbd>{' '}
              juridique.
            </li>
            <li>
              <kbd>Espace</kbd> termine le mois, <kbd>?</kbd> affiche l’aide, <kbd>I</kbd> explique
              le terme sélectionné.
            </li>
          </ul>
          <p className="mt-3 text-sm text-doux">
            Version Jalon 4 : 7 secteurs (café, boutique de vêtements, commerce en ligne, salon de
            coiffure, paysagement, atelier d’ébénisterie, épicerie fine) dans 8 villes du Québec, 5
            concurrents aux personnalités différentes, plus de 70 événements avec des choix et une
            leçon d’affaires, et une conjoncture économique qui évolue (croissance, récession,
            chômage, taux d’intérêt). Le mode équipes et le tutoriel arrivent au prochain jalon.
          </p>
        </Carte>
      </div>
    </main>
  );
}
