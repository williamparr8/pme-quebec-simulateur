/**
 * Mode équipes : écran « Passez le clavier à l'équipe suivante ». Il cache entièrement les
 * décisions de l'équipe précédente jusqu'à ce que la nouvelle équipe confirme.
 */
import { useEffect, useRef } from 'react';
import { moisAnnee } from '../../i18n/format';
import { useJeu } from '../../store/jeu';
import { Bouton } from '../composants/Bouton';
import { Logo } from '../composants/Logo';
import { jouerSon } from '../sons';
import { useJeuCourant } from './contexte';

export function EcranPassage() {
  const { etat, ent, date } = useJeuCourant();
  const commencerTour = useJeu((s) => s.commencerTour);
  const bouton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    bouton.current?.focus();
    jouerSon('passage');
  }, [ent.id]);
  const index = etat.entreprises.findIndex((e) => e.id === ent.id);

  return (
    <main
      id="contenu"
      className="flex min-h-screen flex-col items-center justify-center gap-6 px-4 text-center"
    >
      <Logo taille={64} />
      <p className="text-lg text-doux">
        {moisAnnee(date.annee, date.mois)} · équipe {index + 1} sur {etat.entreprises.length}
      </p>
      <h1 className="text-3xl font-extrabold sm:text-4xl">Passez le clavier à l’équipe suivante</h1>
      <div className="flex items-center gap-3 rounded-2xl border border-bordure bg-surface px-6 py-4">
        <span
          className="inline-block h-10 w-10 rounded-lg"
          style={{ background: ent.couleur }}
          aria-hidden="true"
        />
        <div className="text-left">
          <p className="text-xl font-bold">{ent.equipe ?? `Équipe ${index + 1}`}</p>
          <p className="text-doux">{ent.nom}</p>
        </div>
      </div>
      <p className="max-w-lg text-doux">
        Les décisions de l’équipe précédente sont cachées. Quand ton équipe est prête, appuie sur le
        bouton{etat.moisCourant > 0 ? ' : tu verras d’abord le rapport du dernier mois.' : '.'}
        {ent.enFaillite && ' Ton entreprise a fait faillite : consulte ton dernier rapport.'}
      </p>
      <Bouton ref={bouton} variante="primaire" onClick={commencerTour}>
        Commencer le tour de {ent.equipe ?? `l’équipe ${index + 1}`}
      </Bouton>
    </main>
  );
}
