/** Cartes pédagogiques du tableau de bord : conseillère, quiz du trimestre, objectifs. */
import { useState } from 'react';
import {
  conseils,
  evaluerScenario,
  quizDisponible,
  rabaisPedagogique,
  scenarioParId,
} from '../../engine/simulation';
import { pourcentage } from '../../i18n/format';
import { MENTORE, OBJECTIFS_TEXTE, valeurObjectifTexte } from '../../i18n/messages-jalon5';
import { useJeu } from '../../store/jeu';
import { usePreferences } from '../../store/preferences';
import { Bouton } from '../composants/Bouton';
import { Carte } from '../composants/Carte';
import { ListeMessages } from '../composants/ListeMessages';
import { useJeuCourant } from './contexte';

export function CarteConseiller() {
  const { etat, ent } = useJeuCourant();
  const actif = usePreferences((s) => s.conseiller);
  const setConseiller = usePreferences((s) => s.setConseiller);
  const [tout, setTout] = useState(false);
  if (!actif)
    return (
      <p className="text-sm text-doux">
        Conseillère désactivée.{' '}
        <button type="button" className="underline" onClick={() => setConseiller(true)}>
          La réactiver
        </button>
      </p>
    );
  const liste = conseils(etat, ent);
  return (
    <Carte
      titre={`${MENTORE.nom} te conseille`}
      sousTitre={MENTORE.role}
      actions={
        <Bouton petit variante="discret" onClick={() => setConseiller(false)}>
          Masquer la conseillère
        </Bouton>
      }
    >
      <div className="flex gap-3">
        <span
          aria-hidden="true"
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-accent text-xl font-bold text-accent-texte"
        >
          MG
        </span>
        <div className="min-w-0 flex-1 space-y-2">
          <ListeMessages messages={liste} max={tout ? undefined : 3} />
          {liste.length > 3 && (
            <Bouton petit onClick={() => setTout(!tout)}>
              {tout ? 'Voir moins' : `Voir les ${liste.length} conseils`}
            </Bouton>
          )}
        </div>
      </div>
    </Carte>
  );
}

export function CarteQuiz() {
  const { etat, ent } = useJeuCourant();
  const ouvrirModale = useJeu((s) => s.ouvrirModale);
  const rabais = rabaisPedagogique(ent);
  const disponible = quizDisponible(etat, ent);
  if (!disponible && rabais <= 0) return null;
  return (
    <Carte titre="Quiz du trimestre">
      {disponible ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm">
            3 questions sur la gestion d’une PME. Chaque bonne réponse donne 10 % de rabais sur ta
            prochaine formation ou étude de marché.
          </p>
          <Bouton variante="primaire" onClick={() => ouvrirModale('quiz')}>
            Faire le quiz
          </Bouton>
        </div>
      ) : (
        <p className="text-sm">
          Bonus du quiz : <strong>{pourcentage(rabais, 0)} de rabais</strong> sur ta prochaine
          formation (R) ou étude de marché (M).
        </p>
      )}
    </Carte>
  );
}

export function CarteObjectifs() {
  const { etat, ent } = useJeuCourant();
  if (!etat.config.scenarioId) return null;
  const sc = scenarioParId(etat.config.scenarioId);
  const ev = evaluerScenario(ent, sc);
  return (
    <Carte titre={`Scénario : ${sc.nom}`} sousTitre={sc.resume}>
      <p className="mb-2 text-sm">{sc.description}</p>
      <ul className="space-y-1 text-sm">
        {ev.objectifs.map((o) => (
          <li key={o.type} className="flex flex-wrap justify-between gap-2">
            <span>
              <span aria-hidden="true">{o.atteint ? '✓ ' : '○ '}</span>
              <span className="sr-only">{o.atteint ? 'Atteint : ' : 'Pas encore atteint : '}</span>
              {OBJECTIFS_TEXTE[o.type](o.cible)}
            </span>
            <span className={`chiffres font-semibold ${o.atteint ? 'text-succes' : 'text-doux'}`}>
              {ent.archives.length > 0 ? valeurObjectifTexte(o.type, o.valeur) : '—'}
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-doux">
        Les objectifs sont évalués à la fin de la partie (mois {etat.config.dureeMois}).
      </p>
    </Carte>
  );
}
