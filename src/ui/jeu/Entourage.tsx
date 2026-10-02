/** Personnages récurrents : ce que ton entourage te dit ce mois-ci. */
import { dialoguesDuMois, personnage } from '../../engine/simulation';
import { REPLIQUES } from '../../i18n/messages-croissance';
import { Carte } from '../composants/Carte';
import { useJeuCourant } from './contexte';
import { Avatar } from './pages/Personnages';

export function CarteEntourage() {
  const { etat, ent } = useJeuCourant();
  const repliques = dialoguesDuMois(etat, ent);
  if (repliques.length === 0) return null;
  return (
    <Carte titre="Ton entourage" sousTitre="Ce qu’on te dit ce mois-ci">
      <ul className="space-y-3">
        {repliques.map((r) => {
          const p = personnage(r.personnage);
          return (
            <li key={r.code} className="flex gap-3">
              <Avatar id={`perso-${p.id}`} couleur={p.couleur} taille={48} />
              <div className="min-w-0 rounded-xl rounded-tl-none border border-bordure bg-surface-2 px-3 py-2">
                <p className="text-sm font-semibold">
                  {p.nom} <span className="font-normal text-doux">· {p.role}</span>
                </p>
                <p className="text-sm">{REPLIQUES[r.code]?.(r.params ?? {}) ?? r.code}</p>
              </div>
            </li>
          );
        })}
      </ul>
    </Carte>
  );
}
