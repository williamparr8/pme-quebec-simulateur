/**
 * Fiches de personnage : le propriétaire (compétences, effets, formations) et chaque
 * employé (compétence, expérience, moral, trait, formations).
 */
import { FORMATIONS, posteParId, traitParId } from '../../../data';
import {
  DOMAINES,
  FORMATIONS_PROPRIETAIRE,
  INFOS_DOMAINES,
  formerProprietaire,
  niveauCompetence,
  rabaisPedagogique,
} from '../../../engine/simulation';
import type { Employe } from '../../../engine/types';
import { argentRond, nombre } from '../../../i18n/format';
import { useJeu } from '../../../store/jeu';
import { Bouton } from '../../composants/Bouton';
import { Astuce, Carte } from '../../composants/Carte';
import { useJeuCourant } from '../contexte';

const PEAUX = ['#f1c27d', '#c68642', '#8d5524', '#e0ac69', '#ffdbac'];
const CHEVEUX = ['#2b2118', '#6b4423', '#c9a227', '#1c1c1c', '#8d5524', '#b55a30'];

function teinte(id: string, liste: string[]): string {
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return liste[h % liste.length];
}

/** Petit personnage en blocs (le même style que la scène). */
export function Avatar({
  id,
  couleur,
  taille = 56,
}: {
  id: string;
  couleur: string;
  taille?: number;
}) {
  return (
    <svg width={taille} height={taille} viewBox="0 0 40 40" aria-hidden="true" className="shrink-0">
      <rect width="40" height="40" rx="8" fill="var(--color-surface-2)" />
      <rect x="13" y="7" width="14" height="14" rx="3" fill={teinte(id, PEAUX)} />
      <rect x="12" y="5" width="16" height="5" rx="2" fill={teinte(id + 'c', CHEVEUX)} />
      <rect x="16" y="13" width="2" height="2" fill="#212529" />
      <rect x="22" y="13" width="2" height="2" fill="#212529" />
      <rect x="10" y="22" width="20" height="16" rx="3" fill={couleur} />
    </svg>
  );
}

function Barre({
  libelle,
  valeur,
  max = 100,
  texte,
}: {
  libelle: string;
  valeur: number;
  max?: number;
  texte: string;
}) {
  const pct = Math.round(Math.max(0, Math.min(1, valeur / max)) * 100);
  return (
    <div className="grid grid-cols-[8.5rem_1fr_3.5rem] items-center gap-2 text-sm">
      <span>{libelle}</span>
      <span
        className="h-2.5 overflow-hidden rounded-full bg-surface-2"
        role="meter"
        aria-label={libelle}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuenow={Math.round(valeur)}
      >
        <span className="block h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
      </span>
      <span className="chiffres text-right font-semibold">{texte}</span>
    </div>
  );
}

function FicheProprietaire() {
  const { ent } = useJeuCourant();
  const agir = useJeu((s) => s.agir);
  const suivies = ent.formationsProprietaire ?? [];
  const rabais = rabaisPedagogique(ent);
  return (
    <Carte
      titre={`${ent.proprietaire}, propriétaire`}
      sousTitre="Tes compétences progressent avec l’expérience, les formations et les quiz"
    >
      <div className="flex flex-wrap gap-5">
        <Avatar id={`proprio-${ent.proprietaire}`} couleur={ent.couleur} taille={72} />
        <div className="min-w-[16rem] flex-1 space-y-2">
          {DOMAINES.map((d) => {
            const info = INFOS_DOMAINES.find((x) => x.id === d);
            const n = niveauCompetence(ent, d);
            return (
              <div key={d}>
                <Barre libelle={info?.nom ?? d} valeur={n} texte={`${nombre(n)}/100`} />
                <p className="ml-[9rem] text-xs text-doux">{info?.effet}</p>
              </div>
            );
          })}
        </div>
      </div>
      <h3 className="mt-4 font-semibold">Formations pour toi</h3>
      {rabais > 0 && (
        <p className="text-sm text-succes">
          Bonus du quiz : {Math.round(rabais * 100)} % de rabais sur la prochaine formation.
        </p>
      )}
      <ul className="mt-2 grid gap-2 md:grid-cols-2">
        {FORMATIONS_PROPRIETAIRE.map((f) => {
          const faite = suivies.includes(f.id);
          const niveau = niveauCompetence(ent, f.domaine);
          const bloquee = niveau < f.niveauRequis;
          return (
            <li
              key={f.id}
              className="flex items-center justify-between gap-2 rounded-lg border border-bordure p-2 text-sm"
            >
              <span>
                <span className="font-semibold">{f.nom}</span>
                <br />
                <span className="text-doux">
                  {INFOS_DOMAINES.find((x) => x.id === f.domaine)?.nom} +{f.gain} ·{' '}
                  {argentRond(f.cout)}
                  {bloquee && ` · niveau ${f.niveauRequis} requis`}
                </span>
              </span>
              {faite ? (
                <span className="text-succes">Suivie</span>
              ) : (
                <Bouton
                  petit
                  disabled={bloquee}
                  onClick={() => agir((s, id) => formerProprietaire(s, id, f.id))}
                >
                  S’inscrire
                </Bouton>
              )}
            </li>
          );
        })}
      </ul>
    </Carte>
  );
}

function FicheEmploye({ e, couleur }: { e: Employe; couleur: string }) {
  const poste = posteParId(e.posteId);
  const trait = traitParId(e.trait);
  const annees = Math.floor(e.moisAnciennete / 12);
  const mois = e.moisAnciennete % 12;
  return (
    <li className="rounded-xl border border-bordure bg-surface p-3">
      <div className="flex gap-3">
        <Avatar id={e.id} couleur={couleur} />
        <div className="min-w-0">
          <p className="font-bold">
            {e.prenom} {e.nom}
          </p>
          <p className="text-sm text-doux">
            {poste.nom} · {annees > 0 ? `${annees} an${annees > 1 ? 's' : ''} ` : ''}
            {mois} mois d’ancienneté
          </p>
          <p className="text-sm">
            <span className="font-semibold">{trait.nom}</span> : {trait.description}
          </p>
        </div>
      </div>
      <div className="mt-2 space-y-1">
        <Barre
          libelle="Compétence"
          valeur={e.competence - 0.5}
          max={0.9}
          texte={`${Math.round(e.competence * 100)} %`}
        />
        <Barre
          libelle="Expérience"
          valeur={e.experience}
          max={10}
          texte={`${nombre(e.experience)} an${e.experience > 1 ? 's' : ''}`}
        />
        <Barre libelle="Moral" valeur={e.moral} texte={`${nombre(e.moral)}/100`} />
      </div>
      {e.formations.length > 0 && (
        <p className="mt-2 text-xs text-doux">
          Formations :{' '}
          {e.formations.map((f) => FORMATIONS.find((x) => x.id === f)?.nom ?? f).join(', ')}
        </p>
      )}
    </li>
  );
}

export function VuePersonnages() {
  const { ent } = useJeuCourant();
  return (
    <div className="space-y-5">
      <FicheProprietaire />
      <Carte titre="Ton équipe">
        {ent.employes.length === 0 ? (
          <p className="text-sm text-doux">Tu n’as pas encore d’employés.</p>
        ) : (
          <ul className="grid gap-3 md:grid-cols-2">
            {ent.employes.map((e) => (
              <FicheEmploye key={e.id} e={e} couleur={ent.couleur} />
            ))}
          </ul>
        )}
        <Astuce>
          La compétence d’un employé (de 50 % à 140 %) change le nombre de clients qu’il sert et la
          qualité du service. Elle progresse avec l’expérience et la formation. Son trait de
          personnalité influence son absentéisme et ses risques de départ.
        </Astuce>
      </Carte>
    </div>
  );
}
