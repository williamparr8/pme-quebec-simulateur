/**
 * Dilemmes à trancher avant la fin du mois. Après un choix, l'explication et la leçon
 * d'affaires restent affichées.
 */
import { useState } from 'react';
import { dilemmeParId } from '../../data';
import { texteDilemme } from '../../engine/events';
import { repondreDilemme } from '../../engine/simulation';
import { useJeu } from '../../store/jeu';
import { Bouton } from '../composants/Bouton';
import { useJeuCourant } from './contexte';

interface Reponse {
  titre: string;
  choix: string;
  explication: string;
  lecon: string;
}

export function CarteDilemmes() {
  const { ent } = useJeuCourant();
  const agir = useJeu((s) => s.agir);
  const [reponse, setReponse] = useState<Reponse | null>(null);

  if (ent.dilemmes.length === 0 && !reponse) return null;

  return (
    <section
      className="rounded-xl border-2 border-alerte bg-alerte-doux p-4"
      aria-labelledby="titre-dilemmes"
    >
      <h3 id="titre-dilemmes" className="mb-2 text-base font-bold">
        {ent.dilemmes.length > 0 ? 'À décider avant la fin du mois' : 'Décision prise'}
      </h3>
      {ent.dilemmes.map((d) => {
        const def = dilemmeParId(d.defId);
        return (
          <div key={d.id} className="space-y-2">
            <p className="font-semibold">{def.titre}</p>
            <p className="text-sm">{texteDilemme(def.description, d.nomEmploye)}</p>
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
              {def.choix.map((c) => (
                <Bouton
                  key={c.id}
                  petit
                  onClick={() => {
                    agir((e, id) => repondreDilemme(e, id, d.id, c.id));
                    setReponse({
                      titre: def.titre,
                      choix: texteDilemme(c.libelle, d.nomEmploye),
                      explication: c.explication,
                      lecon: def.lecon,
                    });
                  }}
                >
                  {texteDilemme(c.libelle, d.nomEmploye)}
                </Bouton>
              ))}
            </div>
            <p className="text-xs text-doux">
              Si tu ne décides pas, le choix par défaut s’appliquera au début du mois prochain.
            </p>
          </div>
        );
      })}
      {reponse && (
        <div className="mt-3 rounded-lg bg-surface p-3 text-sm" role="status">
          <p>
            <strong>{reponse.titre}</strong> — ton choix : {reponse.choix}
          </p>
          <p className="mt-1">{reponse.explication}</p>
          <p className="mt-1 text-doux">
            <strong>Leçon d’affaires :</strong> {reponse.lecon}
          </p>
          {ent.dilemmes.length === 0 && (
            <Bouton petit variante="discret" className="mt-2" onClick={() => setReponse(null)}>
              Masquer
            </Bouton>
          )}
        </div>
      )}
    </section>
  );
}
