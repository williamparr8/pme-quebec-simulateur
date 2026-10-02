/** Quiz optionnel entre les trimestres : 3 questions, correction expliquée et bonus. */
import { useState } from 'react';
import { questionsQuiz, repondreQuiz } from '../../engine/simulation';
import { useJeu } from '../../store/jeu';
import { Bouton } from '../composants/Bouton';
import { Modale } from '../composants/Modale';
import { jouerSon } from '../sons';
import { useJeuCourant } from './contexte';

export function ModaleQuiz() {
  const { etat, ent } = useJeuCourant();
  const fermer = useJeu((s) => s.fermerModale);
  const agir = useJeu((s) => s.agir);
  const annoncer = useJeu((s) => s.annoncer);
  // Les questions sont figées à l'ouverture (la correction change l'état de la partie).
  const [questions] = useState(() => questionsQuiz(etat, ent));
  const [reponses, setReponses] = useState<Record<string, number>>({});
  const [corrige, setCorrige] = useState(false);
  const bonnes = questions.filter((q) => reponses[q.id] === q.bonne).length;
  const complet = questions.every((q) => reponses[q.id] !== undefined);

  const corriger = () => {
    agir((e, id) => repondreQuiz(e, id, reponses));
    setCorrige(true);
    jouerSon(bonnes >= 2 ? 'reussite' : 'erreur');
    annoncer(`${bonnes} bonne${bonnes > 1 ? 's' : ''} réponse${bonnes > 1 ? 's' : ''} sur 3.`);
  };

  return (
    <Modale
      titre="Quiz du trimestre"
      onFermer={fermer}
      taille="lg"
      pied={
        corrige ? (
          <Bouton variante="primaire" onClick={fermer}>
            Continuer
          </Bouton>
        ) : (
          <>
            <Bouton onClick={fermer}>Plus tard</Bouton>
            <Bouton variante="primaire" disabled={!complet} onClick={corriger}>
              Corriger
            </Bouton>
          </>
        )
      }
    >
      <div className="space-y-5">
        {corrige && (
          <p className="rounded-lg bg-surface-2 p-3 font-semibold" role="status">
            {bonnes} bonne{bonnes > 1 ? 's' : ''} réponse{bonnes > 1 ? 's' : ''} sur 3
            {bonnes > 0
              ? ` : ${bonnes * 10} % de rabais sur ta prochaine formation ou étude de marché.`
              : '. Relis les explications : le prochain quiz arrive dans 3 mois.'}
          </p>
        )}
        {questions.map((q, i) => (
          <fieldset key={q.id} className="space-y-2">
            <legend className="font-semibold">
              {i + 1}. {q.question}{' '}
              <span className="text-xs font-normal text-doux">({q.categorie})</span>
            </legend>
            {q.choix.map((c, k) => {
              const choisi = reponses[q.id] === k;
              const style = !corrige
                ? 'border-bordure'
                : k === q.bonne
                  ? 'border-succes bg-succes-doux'
                  : choisi
                    ? 'border-danger bg-danger-doux'
                    : 'border-bordure opacity-70';
              return (
                <label
                  key={c}
                  className={`flex cursor-pointer items-start gap-2 rounded-lg border p-2 text-sm ${style}`}
                >
                  <input
                    type="radio"
                    name={q.id}
                    checked={choisi}
                    disabled={corrige}
                    onChange={() => setReponses({ ...reponses, [q.id]: k })}
                    className="mt-1"
                  />
                  <span>
                    {c}
                    {corrige && k === q.bonne && <strong> (bonne réponse)</strong>}
                  </span>
                </label>
              );
            })}
            {corrige && <p className="text-sm text-doux">{q.explication}</p>}
          </fieldset>
        ))}
      </div>
    </Modale>
  );
}
