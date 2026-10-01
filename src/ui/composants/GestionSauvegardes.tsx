/** Liste des emplacements de sauvegarde, avec export et import de fichiers .json. */
import { useRef, useState } from 'react';
import { argentRond } from '../../i18n/format';
import { useJeu } from '../../store/jeu';
import {
  EMPLACEMENTS_MANUELS,
  charger,
  exporter,
  importer,
  resume,
  supprimer,
  type IdEmplacement,
} from '../../store/sauvegarde';
import { dateJJMMAAAA, heureMinute } from '../../i18n/format';
import { Bouton } from './Bouton';

interface Props {
  /** En jeu : on peut sauvegarder dans un emplacement. À l'accueil : charger seulement. */
  enJeu: boolean;
}

export function GestionSauvegardes({ enJeu }: Props) {
  const etat = useJeu((s) => s.etat);
  const chargerPartie = useJeu((s) => s.chargerPartie);
  const sauvegarderDans = useJeu((s) => s.sauvegarderDans);
  const [message, setMessage] = useState('');
  const [version, setVersion] = useState(0);
  const fichier = useRef<HTMLInputElement>(null);

  const emplacements: IdEmplacement[] = ['auto', ...EMPLACEMENTS_MANUELS];
  // `version` force la relecture après une sauvegarde ou une suppression.
  const resumes = emplacements.map((e) => ({ id: e, r: version >= 0 ? resume(e) : null }));

  const nomEmplacement = (e: IdEmplacement) =>
    e === 'auto' ? 'Sauvegarde automatique' : `Emplacement ${e}`;

  return (
    <div className="space-y-3">
      <ul className="space-y-2">
        {resumes.map(({ id, r }) => (
          <li
            key={id}
            className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-bordure bg-surface-2 p-3"
          >
            <div>
              <p className="font-semibold">{nomEmplacement(id)}</p>
              {r ? (
                <p className="text-sm text-doux">
                  {r.nomEntreprise} · mois {r.moisJoues}/{r.dureeMois} · encaisse{' '}
                  {argentRond(r.encaisse)} · {dateJJMMAAAA(new Date(r.sauvegardeLe))} à{' '}
                  {heureMinute(new Date(r.sauvegardeLe))}
                  {r.terminee ? ' · partie terminée' : ''}
                </p>
              ) : (
                <p className="text-sm text-doux">Vide</p>
              )}
            </div>
            <div className="flex gap-2">
              {enJeu && id !== 'auto' && (
                <Bouton
                  petit
                  variante="primaire"
                  onClick={() => {
                    const ok = sauvegarderDans(id);
                    setMessage(
                      ok
                        ? `Partie sauvegardée dans l’${nomEmplacement(id).toLowerCase()}.`
                        : 'Sauvegarde impossible : le stockage du navigateur est indisponible.',
                    );
                    setVersion((v) => v + 1);
                  }}
                >
                  Sauvegarder ici
                </Bouton>
              )}
              {r && (
                <Bouton
                  petit
                  onClick={() => {
                    const e = charger(id);
                    if (e) chargerPartie(e, id);
                    else setMessage('Cette sauvegarde est illisible.');
                  }}
                >
                  Charger
                </Bouton>
              )}
              {r && id !== 'auto' && (
                <Bouton
                  petit
                  variante="danger"
                  onClick={() => {
                    if (
                      window.confirm(
                        `Supprimer définitivement la sauvegarde « ${r.nomEntreprise} »?`,
                      )
                    ) {
                      supprimer(id);
                      setVersion((v) => v + 1);
                    }
                  }}
                >
                  Supprimer
                </Bouton>
              )}
            </div>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap gap-2">
        {enJeu && etat && (
          <Bouton onClick={() => exporter(etat)}>Exporter la partie (.json)</Bouton>
        )}
        <Bouton onClick={() => fichier.current?.click()}>Importer une partie (.json)</Bouton>
        <input
          ref={fichier}
          type="file"
          accept="application/json,.json"
          className="sr-only"
          tabIndex={-1}
          aria-hidden="true"
          onChange={async (e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            if (!f) return;
            try {
              chargerPartie(await importer(f), null);
            } catch (err) {
              setMessage(err instanceof Error ? err.message : 'Importation impossible.');
            }
          }}
        />
      </div>
      {message && (
        <p role="status" className="text-sm font-semibold">
          {message}
        </p>
      )}
    </div>
  );
}
