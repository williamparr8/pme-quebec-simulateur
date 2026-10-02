import { useEffect, useRef, useState } from 'react';
import { useJeu } from '../../store/jeu';
import { charger, resume } from '../../store/sauvegarde';
import { argentRond } from '../../i18n/format';
import { Bouton } from '../composants/Bouton';
import { Carte } from '../composants/Carte';
import { ChoixTheme } from '../composants/ChoixTheme';
import { GestionSauvegardes } from '../composants/GestionSauvegardes';
import { Logo } from '../composants/Logo';
import { ModaleGlossaire } from '../composants/ModaleGlossaire';

export function EcranAccueil() {
  const allerA = useJeu((s) => s.allerA);
  const choisirMode = useJeu((s) => s.choisirModeCreation);
  const chargerPartie = useJeu((s) => s.chargerPartie);
  const auto = resume('auto');
  const premier = useRef<HTMLButtonElement>(null);
  const [equipes, setEquipes] = useState(2);
  const [glossaire, setGlossaire] = useState(false);

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

      {auto && !auto.terminee && (
        <div className="mb-6">
          <Bouton
            ref={premier}
            variante="primaire"
            onClick={() => {
              const e = charger('auto');
              if (e) chargerPartie(e, null);
            }}
          >
            Continuer : {auto.nomEntreprise} (mois {auto.moisJoues}/{auto.dureeMois},{' '}
            {argentRond(auto.encaisse)})
          </Bouton>
        </div>
      )}

      <div className="mb-8 grid gap-4 md:grid-cols-3">
        <Carte titre="Solo">
          <p className="mb-3 text-sm">
            Ton entreprise contre 5 concurrents gérés par l’ordinateur. Tutoriel guidé offert.
          </p>
          <Bouton
            ref={auto && !auto.terminee ? undefined : premier}
            variante={auto && !auto.terminee ? 'secondaire' : 'primaire'}
            onClick={() => choisirMode({ type: 'solo' })}
          >
            Nouvelle partie
          </Bouton>
        </Carte>
        <Carte titre="En équipes">
          <p className="mb-3 text-sm">
            2 à 4 équipes jouent à tour de rôle sur le même ordinateur, dans le même marché.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-2 text-sm">
              <span>Équipes</span>
              <select
                value={equipes}
                onChange={(e) => setEquipes(Number(e.target.value))}
                className="rounded-md border border-bordure bg-surface-2 px-2 py-1.5"
              >
                {[2, 3, 4].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
            <Bouton onClick={() => choisirMode({ type: 'equipes', nombre: equipes })}>
              Créer les entreprises
            </Bouton>
          </div>
        </Carte>
        <Carte titre="Scénarios">
          <p className="mb-3 text-sm">
            Des défis avec une situation de départ et des objectifs notés (mode Prof).
          </p>
          <Bouton onClick={() => allerA('scenarios')}>Choisir un scénario</Bouton>
        </Carte>
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
              le terme sélectionné, <kbd>G</kbd> ouvre le glossaire.
            </li>
          </ul>
          <div className="mt-3 flex flex-wrap gap-2">
            <Bouton petit onClick={() => setGlossaire(true)}>
              Glossaire
            </Bouton>
            <Bouton petit onClick={() => allerA('classement')}>
              Classement local
            </Bouton>
          </div>
          <p className="mt-3 text-sm text-doux">
            Version 1.0 (Jalon 6) : scène animée, sons, mode équipes, scénarios, conseillère,
            tutoriel, quiz, rapport de fin et classement. 7 secteurs, 8 villes du Québec, 5
            concurrents et plus de 70 événements.
          </p>
        </Carte>
      </div>
      {glossaire && <ModaleGlossaire onFermer={() => setGlossaire(false)} />}
    </main>
  );
}
