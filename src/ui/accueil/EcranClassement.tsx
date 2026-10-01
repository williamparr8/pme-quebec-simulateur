/** Classement local des meilleures parties jouées dans ce navigateur. */
import { useEffect, useRef, useState } from 'react';
import { scenarioParId, secteurParId, villeParId } from '../../data';
import { argentRond, dateJJMMAAAA, nombre, pourcentage } from '../../i18n/format';
import { lireClassement, viderClassement, type EntreeClassement } from '../../store/classement';
import { useJeu } from '../../store/jeu';
import { Bouton } from '../composants/Bouton';

type Critere = 'note' | 'valeur' | 'profit' | 'moral' | 'satisfaction';

const CRITERES: { id: Critere; nom: string }[] = [
  { id: 'note', nom: 'Note' },
  { id: 'valeur', nom: 'Valeur de l’entreprise' },
  { id: 'profit', nom: 'Profit cumulé' },
  { id: 'moral', nom: 'Satisfaction des employés' },
  { id: 'satisfaction', nom: 'Satisfaction des clients' },
];

export function EcranClassement() {
  const allerA = useJeu((s) => s.allerA);
  const [critere, setCritere] = useState<Critere>('note');
  const [liste, setListe] = useState<EntreeClassement[]>(() => lireClassement());
  const titre = useRef<HTMLHeadingElement>(null);
  useEffect(() => titre.current?.focus(), []);
  const triee = [...liste].sort((a, b) => b[critere] - a[critere]);

  return (
    <main
      id="contenu"
      className="mx-auto max-w-5xl space-y-5 px-4 py-8"
      onKeyDown={(e) => {
        if (e.key === 'Escape') allerA('accueil');
      }}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 ref={titre} tabIndex={-1} className="text-3xl font-extrabold">
          Classement local
        </h1>
        <Bouton onClick={() => allerA('accueil')} raccourci="Échap">
          Retour à l’accueil
        </Bouton>
      </div>
      <p className="text-doux">
        Les parties terminées sur cet ordinateur (dans ce navigateur seulement). Les parties en
        équipes ajoutent une ligne par équipe.
      </p>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Trier par">
        {CRITERES.map((c) => (
          <Bouton
            key={c.id}
            petit
            variante={c.id === critere ? 'primaire' : 'secondaire'}
            aria-pressed={c.id === critere}
            onClick={() => setCritere(c.id)}
          >
            {c.nom}
          </Bouton>
        ))}
      </div>
      {triee.length === 0 ? (
        <p>Aucune partie terminée pour l’instant. Termine une partie pour y apparaître!</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-bordure bg-surface">
          <table className="chiffres w-full text-sm">
            <thead>
              <tr className="border-b border-bordure text-left">
                <th className="p-2">Rang</th>
                <th className="p-2">Entreprise</th>
                <th className="p-2">Partie</th>
                <th className="p-2 text-right">Note</th>
                <th className="p-2 text-right">Valeur</th>
                <th className="p-2 text-right">Profit cumulé</th>
                <th className="p-2 text-right">Employés</th>
                <th className="p-2 text-right">Clients</th>
              </tr>
            </thead>
            <tbody>
              {triee.map((x, i) => (
                <tr key={x.id} className="border-b border-bordure/60">
                  <td className="p-2 font-bold">{i + 1}</td>
                  <td className="p-2">
                    <span className="font-semibold">{x.nom}</span>
                    {x.equipe && <span className="text-doux"> ({x.equipe})</span>}
                    {x.faillite && <span className="text-danger"> · faillite</span>}
                  </td>
                  <td className="p-2 text-doux">
                    {x.scenarioId ? `Scénario : ${scenarioParId(x.scenarioId).nom}` : ''}
                    {!x.scenarioId &&
                      `${secteurParId(x.secteurId).nom}, ${villeParId(x.villeId).nom}`}{' '}
                    · {x.dureeMois} mois · {dateJJMMAAAA(new Date(x.date))}
                  </td>
                  <td className="p-2 text-right font-bold">{x.note}</td>
                  <td className="p-2 text-right">{argentRond(x.valeur)}</td>
                  <td className="p-2 text-right">{argentRond(x.profit)}</td>
                  <td className="p-2 text-right">{nombre(x.moral)}/100</td>
                  <td className="p-2 text-right">{pourcentage(x.satisfaction, 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {triee.length > 0 && (
        <Bouton
          variante="danger"
          petit
          onClick={() => {
            if (window.confirm('Effacer tout le classement de ce navigateur?')) {
              viderClassement();
              setListe([]);
            }
          }}
        >
          Effacer le classement
        </Bouton>
      )}
    </main>
  );
}
