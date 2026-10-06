/**
 * Mode chef de département : mandats du mois (documents sources, aide selon le niveau,
 * réponse du joueur) et rapport d'évaluation (corrigé étape par étape).
 */
import { useState } from 'react';
import {
  FRAIS_ENJEU,
  aideMandat,
  cadenceRapport,
  confianceConnue,
  documentsVisibles,
  lireRapportMandats,
  repondreMandat,
  resultatsARapporter,
  titreChef,
  type MandatDuMois,
  type ResultatMandat,
  type UniteMandat,
} from '../../engine/mandats';
import { argent, argentRond, decimal } from '../../i18n/format';
import { NOMS_DEPARTEMENTS, TITRES_CHEF } from '../../i18n/mandats';
import { useJeu } from '../../store/jeu';
import { Bouton } from '../composants/Bouton';
import { Carte } from '../composants/Carte';
import { useJeuCourant } from './contexte';

const SUFFIXE: Record<UniteMandat, string> = { dollars: '$', pourcent: '%', ratio: '', nombre: '' };

function valeur(unite: UniteMandat, x: number | null): string {
  if (x === null) return 'aucune réponse';
  if (unite === 'dollars') return argent(x);
  if (unite === 'pourcent') return `${decimal(x, 1)} %`;
  return decimal(x, 2);
}

/** Lit un nombre saisi à la française (« 1 234,56 ») ou à l'anglaise. */
function lireNombre(texte: string): number | null {
  // \s couvre aussi l'espace insécable des nombres formatés (« 1 234,56 »).
  const propre = texte.replace(/[\s$%]/g, '').replace(',', '.');
  if (propre === '' || propre === '-') return null;
  const n = Number(propre);
  return Number.isFinite(n) ? n : null;
}

function Mandat({ m }: { m: MandatDuMois }) {
  const { etat } = useJeuCourant();
  const agir = useJeu((s) => s.agir);
  const aide = aideMandat(etat.config.difficulte);
  const [texte, setTexte] = useState(m.reponse === null ? '' : String(m.reponse).replace('.', ','));
  const invalide = texte.trim() !== '' && lireNombre(texte) === null;
  const idChamp = `mandat-${m.id}`;
  return (
    <li className="space-y-3 rounded-xl border border-bordure p-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-bold">{m.titre}</h3>
        <span className="text-xs text-doux">
          {FRAIS_ENJEU[m.enjeu] > 0
            ? `Une erreur coûte ${argentRond(FRAIS_ENJEU[m.enjeu])}`
            : 'Une erreur touche seulement ta réputation'}
        </span>
      </div>
      {documentsVisibles(m, etat.config.difficulte).map((doc) => (
        <table key={doc.titre} className="chiffres w-full text-sm">
          <caption className="pb-1 text-left">
            <span className="font-semibold">{doc.titre}</span>
            <span className="block text-xs text-doux">Source : {doc.provenance}</span>
          </caption>
          <tbody>
            {doc.lignes.map((l) => (
              <tr key={l.libelle} className="border-b border-bordure/60">
                <th scope="row" className="py-1 text-left font-normal">
                  {l.libelle}
                </th>
                <td className="py-1 text-right font-semibold">{l.valeur}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ))}
      {aide.formule && (
        <p className="rounded-lg bg-surface-2 p-2 text-sm">
          <span className="font-semibold">Formule : </span>
          {m.formule}
        </p>
      )}
      {aide.indices && (
        <details className="text-sm">
          <summary className="cursor-pointer font-semibold">Indices</summary>
          <ul className="list-disc pl-5">
            {m.indices.map((i) => (
              <li key={i}>{i}</li>
            ))}
          </ul>
        </details>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <label htmlFor={idChamp} className="font-semibold">
          {m.question}
        </label>
        <span className="flex items-center gap-1">
          <input
            id={idChamp}
            type="text"
            inputMode="decimal"
            value={texte}
            aria-invalid={invalide}
            aria-describedby={invalide ? `${idChamp}-erreur` : undefined}
            onChange={(e) => {
              setTexte(e.target.value);
              agir((s, id) => repondreMandat(s, id, m.id, lireNombre(e.target.value)));
            }}
            className="w-36 rounded-md border border-bordure bg-surface-2 px-2 py-1.5 text-right"
          />
          <span>{SUFFIXE[m.unite]}</span>
        </span>
        {invalide && (
          <span id={`${idChamp}-erreur`} className="text-sm text-danger">
            Entre un nombre (ex. 1 234,56).
          </span>
        )}
      </div>
    </li>
  );
}

function Resultat({ r }: { r: ResultatMandat }) {
  return (
    <li className="rounded-lg border border-bordure p-2 text-sm">
      <p className="flex flex-wrap justify-between gap-2 font-semibold">
        <span>
          <span aria-hidden="true">{r.correct ? '✓ ' : '✗ '}</span>
          <span className="sr-only">{r.correct ? 'Juste : ' : 'Erreur : '}</span>
          Mois {r.index + 1} · {r.titre}
        </span>
        <span className={r.correct ? 'text-succes' : 'text-danger'}>
          {r.correct ? 'Juste' : r.cout > 0 ? `Erreur : ${argentRond(r.cout)} de frais` : 'Erreur'}
        </span>
      </p>
      <p>
        Ta réponse : {valeur(r.unite, r.reponse)} · bonne réponse : {valeur(r.unite, r.attendu)}
      </p>
      {!r.correct && (
        <ol className="mt-1 list-decimal pl-5 text-doux">
          {r.corrige.map((etape) => (
            <li key={etape}>{etape}</li>
          ))}
        </ol>
      )}
    </li>
  );
}

export function CarteMandats() {
  const { etat, ent } = useJeuCourant();
  const agir = useJeu((s) => s.agir);
  const chef = ent.chef;
  if (!chef) return null;
  const rapport = resultatsARapporter(etat, ent);
  const cadence = cadenceRapport(etat.config.difficulte);
  const confiance = confianceConnue(ent);
  const repondus = chef.mandats.filter((m) => m.reponse !== null).length;
  const attente = Math.max(0, cadence - (etat.moisCourant - chef.dernierRapport));
  const justes = rapport.filter((r) => r.correct).length;

  return (
    <Carte
      titre={`${TITRES_CHEF[titreChef(confiance)]} · ${NOMS_DEPARTEMENTS[chef.departement]}`}
      sousTitre={`Confiance de la direction : ${Math.round(confiance)}/100 (selon ton dernier rapport)`}
    >
      {rapport.length > 0 ? (
        <section className="mb-4 space-y-2" aria-label="Rapport d’évaluation">
          <h3 className="font-bold">
            Rapport d’évaluation : {justes} réponse{justes > 1 ? 's' : ''} juste
            {justes > 1 ? 's' : ''} sur {rapport.length}
          </h3>
          <ul className="space-y-2">
            {rapport.map((r) => (
              <Resultat key={`${r.index}-${r.id}`} r={r} />
            ))}
          </ul>
          {!etat.terminee && (
            <Bouton variante="primaire" onClick={() => agir((s, id) => lireRapportMandats(s, id))}>
              J’ai lu mon rapport
            </Bouton>
          )}
        </section>
      ) : (
        !etat.terminee && (
          <p className="mb-3 text-sm text-doux">
            {cadence === 1
              ? 'Tes erreurs te sont expliquées chaque mois.'
              : `Tes erreurs te seront expliquées dans ${attente} mois (rapport ${cadence === 3 ? 'trimestriel' : 'semestriel'}). D’ici là, leurs conséquences sont déjà dans les livres.`}
          </p>
        )
      )}
      {chef.mandats.length > 0 && !etat.terminee && (
        <>
          <p className="mb-2 text-sm" role="status">
            Mandats du mois : {repondus} sur {chef.mandats.length} répondu
            {repondus > 1 ? 's' : ''}. Une réponse manquante compte comme une erreur.
          </p>
          <ul className="space-y-3">
            {chef.mandats.map((m) => (
              <Mandat key={`${etat.moisCourant}-${m.id}`} m={m} />
            ))}
          </ul>
        </>
      )}
    </Carte>
  );
}
