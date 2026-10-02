import { useState } from 'react';
import {
  AVANTAGES,
  FORMATIONS,
  FORMATION_GESTIONNAIRE_HYGIENE,
  PLATEFORMES,
  formationsSecteur,
  plateformeParId,
  posteParId,
  traitParId,
} from '../../../data';
import { estSocieteActions } from '../../../engine/conformite';
import {
  JOURS_FERIES_PAR_MOIS,
  NOMS_JOURS_FERIES,
  semainesPreavis,
  tauxVacances,
} from '../../../engine/hr';
import { coutAnnuelEmploye, salaireMensuel } from '../../../engine/payroll';
import {
  BORNES_DECISIONS,
  affecterEmploye,
  afficherPoste,
  augmentationGenerale,
  congedier,
  conformeHygiene,
  embaucherCandidat,
  evaluerEmploye,
  formerEmploye,
  formerProprietaireHygiene,
  modifierHeuresEmploye,
  modifierSalaireEmploye,
  retirerCandidat,
  salaireMarche,
} from '../../../engine/simulation';
import type { Candidat, Employe } from '../../../engine/types';
import { argent, argentRond, nombre, pourcentage } from '../../../i18n/format';
import { useJeu } from '../../../store/jeu';
import { Bouton } from '../../composants/Bouton';
import { Astuce, Carte } from '../../composants/Carte';
import { Curseur } from '../../composants/Curseur';
import { Indicateur } from '../../composants/Indicateur';
import { SousOnglets } from '../../composants/SousOnglets';
import { Terme } from '../../composants/Terme';
import { TitrePage } from '../../composants/TitrePage';
import { useJeuCourant } from '../contexte';
import { CarteDilemmes } from '../Dilemmes';
import { VuePersonnages } from './Personnages';

type Vue = 'equipe' | 'personnages' | 'recrutement' | 'conditions' | 'cout';

const CHAMP = 'chiffres rounded-md border border-bordure bg-surface-2 px-2 py-1';

function BarreMoral({ moral }: { moral: number }) {
  const couleur = moral < 45 ? 'bg-danger' : moral < 60 ? 'bg-alerte' : 'bg-succes';
  const libelle = moral < 45 ? 'bas' : moral < 60 ? 'moyen' : 'bon';
  return (
    <div className="flex items-center gap-2">
      <div className="h-2.5 w-16 overflow-hidden rounded-full bg-surface-2" aria-hidden="true">
        <div className={`h-full ${couleur}`} style={{ width: `${moral}%` }} />
      </div>
      <span className="chiffres text-sm">
        {nombre(moral)} <span className="text-doux">({libelle})</span>
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Équipe
// ---------------------------------------------------------------------------

function LigneEmploye({ e }: { e: Employe }) {
  const { etat, ent, secteur } = useJeuCourant();
  const agir = useJeu((s) => s.agir);
  const [formation, setFormation] = useState('');
  const poste = posteParId(e.posteId);
  const trait = traitParId(e.trait);
  const preavis = semainesPreavis(e.moisAnciennete);
  const indemnite = preavis * e.heuresSemaine * e.salaireHoraire;
  const nom = `${e.prenom} ${e.nom}`;
  const marche = salaireMarche(etat, e.posteId);
  const formations = formationsSecteur(secteur).filter(
    (f) => !e.formations.includes(f.id) && (!f.postes || f.postes.includes(e.posteId)),
  );
  const evaluable = e.derniereEvaluation === null || etat.moisCourant - e.derniereEvaluation >= 6;
  return (
    <tr className="border-b border-bordure align-top">
      <td className="py-2 pr-2">
        <p className="font-semibold">{nom}</p>
        <p className="text-xs text-doux" title={trait.description}>
          {poste.nom} · {trait.nom}
        </p>
        {(ent.succursales?.length ?? 0) > 0 && (
          <label className="mt-1 flex items-center gap-1 text-xs">
            <span className="text-doux">Établissement</span>
            <select
              value={e.site ?? ''}
              onChange={(ev) =>
                agir((s, id) => affecterEmploye(s, id, e.id, ev.target.value || null))
              }
              className="rounded border border-bordure bg-surface-2 px-1 py-0.5"
            >
              <option value="">{ent.nom}</option>
              {ent.succursales?.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nom}
                </option>
              ))}
            </select>
          </label>
        )}
        {e.formations.length > 0 && (
          <p className="text-xs text-doux">
            Formé :{' '}
            {e.formations.map((f) => FORMATIONS.find((x) => x.id === f)?.nom ?? f).join(', ')}
          </p>
        )}
      </td>
      <td className="py-2 pr-2">
        <div className="flex items-center gap-1">
          <Bouton
            petit
            aria-label={`Réduire les heures de ${nom}`}
            onClick={() => agir((s, id) => modifierHeuresEmploye(s, id, e.id, e.heuresSemaine - 2))}
          >
            −
          </Bouton>
          <span className="chiffres w-10 text-center">{e.heuresSemaine} h</span>
          <Bouton
            petit
            aria-label={`Augmenter les heures de ${nom}`}
            onClick={() => agir((s, id) => modifierHeuresEmploye(s, id, e.id, e.heuresSemaine + 2))}
          >
            +
          </Bouton>
        </div>
      </td>
      <td className="py-2 pr-2">
        <div className="flex items-center gap-1">
          <Bouton
            petit
            aria-label={`Baisser le salaire de ${nom}`}
            onClick={() =>
              agir((s, id) => modifierSalaireEmploye(s, id, e.id, e.salaireHoraire - 0.25))
            }
          >
            −
          </Bouton>
          <span className="chiffres w-16 text-center">{argent(e.salaireHoraire)}</span>
          <Bouton
            petit
            aria-label={`Augmenter le salaire de ${nom}`}
            onClick={() =>
              agir((s, id) => modifierSalaireEmploye(s, id, e.id, e.salaireHoraire + 0.25))
            }
          >
            +
          </Bouton>
        </div>
        <p
          className={`chiffres text-xs ${e.salaireHoraire < marche ? 'text-alerte' : 'text-doux'}`}
        >
          marché : {argent(marche)}
        </p>
      </td>
      <td className="py-2 pr-2">
        <BarreMoral moral={e.moral} />
        {e.absenteisme > 0.06 && (
          <p className="chiffres text-xs text-alerte">
            absent {pourcentage(e.absenteisme, 0)} du temps
          </p>
        )}
      </td>
      <td className="chiffres py-2 pr-2">{Math.round(e.competence * 100)}/100</td>
      <td className="chiffres py-2 pr-2">
        {e.moisAnciennete} mois
        <p className="text-xs text-doux">
          vacances {pourcentage(tauxVacances(e.moisAnciennete), 0)}
        </p>
      </td>
      <td className="space-y-1 py-2 text-right">
        <Bouton
          petit
          disabled={!evaluable}
          onClick={() => agir((s, id) => evaluerEmploye(s, id, e.id))}
        >
          {evaluable ? 'Évaluer' : 'Évalué récemment'}
        </Bouton>
        {formations.length > 0 && (
          <div className="flex justify-end gap-1">
            <select
              aria-label={`Formation pour ${nom}`}
              className="max-w-40 rounded-md border border-bordure bg-surface px-1 py-1 text-xs"
              value={formation}
              onChange={(ev) => setFormation(ev.target.value)}
            >
              <option value="">Former…</option>
              {formations.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.nom} ({argentRond(f.cout)})
                </option>
              ))}
            </select>
            <Bouton
              petit
              disabled={!formation}
              onClick={() => {
                agir((s, id) => formerEmploye(s, id, e.id, formation));
                setFormation('');
              }}
            >
              OK
            </Bouton>
          </div>
        )}
        <Bouton
          petit
          variante="danger"
          onClick={() => {
            const texte =
              preavis > 0
                ? `Mettre fin à l’emploi de ${nom}? Sans préavis écrit, tu dois verser une indemnité de ${preavis} semaine${preavis > 1 ? 's' : ''} de salaire (environ ${argentRond(indemnite)}).`
                : `Mettre fin à l’emploi de ${nom}? Moins de 3 mois de service : aucun préavis n’est exigé.`;
            if (window.confirm(texte)) agir((s, id) => congedier(s, id, e.id));
          }}
        >
          Fin d’emploi
        </Bouton>
      </td>
    </tr>
  );
}

function VueEquipe() {
  const { etat, ent, derniere } = useJeuCourant();
  const changer = useJeu((s) => s.changerDecisions);
  const agir = useJeu((s) => s.agir);
  const [hausse, setHausse] = useState(3);
  const d = ent.decisions;
  const masse = ent.employes.reduce(
    (a, x) =>
      a + salaireMensuel(x.salaireHoraire, x.heuresSemaine) * (1 + tauxVacances(x.moisAnciennete)),
    0,
  );
  const departs = ent.rh.departs.filter((x) => x.index > etat.moisCourant - 12).length;
  const roulement = ent.employes.length > 0 ? departs / Math.max(1, ent.employes.length) : 0;
  const i = derniere?.indicateurs;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Indicateur
          libelle="Employés"
          valeur={nombre(ent.employes.length)}
          detail={`masse salariale ≈ ${argentRond(masse)}/mois`}
        />
        <Indicateur
          libelle="Moral moyen"
          valeur={i && i.nbEmployes > 0 ? `${nombre(i.moral)}/100` : '—'}
          terme="moral"
          ton={i && i.moral < 45 ? 'danger' : 'neutre'}
        />
        <Indicateur
          libelle="Absentéisme"
          valeur={i ? pourcentage(i.absenteisme, 1) : '—'}
          terme="absenteisme"
        />
        <Indicateur
          libelle="Roulement (12 mois)"
          valeur={pourcentage(roulement, 0)}
          detail={`${departs} départ${departs > 1 ? 's' : ''}`}
          terme="roulement"
        />
      </div>

      <Carte
        titre="Ton équipe"
        actions={
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <label className="flex items-center gap-1">
              Augmentation générale
              <input
                type="number"
                min={0}
                max={30}
                step={0.5}
                value={hausse}
                onChange={(e) => setHausse(Number(e.target.value))}
                className={`${CHAMP} w-16`}
              />
              %
            </label>
            <Bouton
              petit
              onClick={() => agir((s, id) => augmentationGenerale(s, id, hausse / 100))}
            >
              Appliquer
            </Bouton>
          </div>
        }
      >
        {ent.employes.length === 0 ? (
          <p className="text-sm text-doux">
            Aucun employé : tu travailles seul. Recrute (onglet Recrutement).
          </p>
        ) : (
          <div
            tabIndex={0}
            role="region"
            aria-label="Tableau (défilement horizontal possible)"
            className="overflow-x-auto"
          >
            <table className="w-full min-w-[920px] text-left text-sm">
              <thead>
                <tr className="border-b border-bordure text-doux">
                  <th className="py-1 pr-2 font-semibold">Employé</th>
                  <th className="py-1 pr-2 font-semibold">Heures/sem.</th>
                  <th className="py-1 pr-2 font-semibold">Salaire</th>
                  <th className="py-1 pr-2 font-semibold">
                    <Terme id="moral">Moral</Terme>
                  </th>
                  <th className="py-1 pr-2 font-semibold">Compétence</th>
                  <th className="py-1 pr-2 font-semibold">Ancienneté</th>
                  <th className="py-1 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {ent.employes.map((e) => (
                  <LigneEmploye key={e.id} e={e} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Carte>

      <Carte titre="Ton temps et ta rémunération">
        <div className="grid gap-5 lg:grid-cols-2">
          <Curseur
            libelle="Tes heures de travail par semaine"
            valeur={d.heuresProprietaire}
            min={0}
            max={80}
            decimales={0}
            format={(v) => `${v} h`}
            onChange={(v) => changer({ heuresProprietaire: v })}
            aide={
              estSocieteActions(ent.formeJuridique)
                ? 'Si tu te verses un salaire, tes heures (40 h max par semaine) comptent pour les 5 500 heures de la DPE du Québec.'
                : 'Tu n’as pas de salaire : tu te paies par tes prélèvements (Finance). Un gérant peut te remplacer.'
            }
          />
          {estSocieteActions(ent.formeJuridique) && (
            <Curseur
              libelle="Ton salaire de dirigeant (brut mensuel)"
              valeur={d.salaireDirigeant}
              min={0}
              max={BORNES_DECISIONS.salaireDirigeant.max}
              format={argentRond}
              onChange={(v) => changer({ salaireDirigeant: v })}
              aide="Salaire déductible pour la société, avec retenues à la source et cotisations (sans AE : tu contrôles plus de 40 % des actions)."
            />
          )}
        </div>
      </Carte>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Recrutement
// ---------------------------------------------------------------------------

function CarteCandidat({ c }: { c: Candidat }) {
  const { etat } = useJeuCourant();
  const agir = useJeu((s) => s.agir);
  const [salaire, setSalaire] = useState(c.attentes);
  const [heures, setHeures] = useState(c.heuresSouhaitees);
  const poste = posteParId(c.posteId);
  const trait = traitParId(c.trait);
  const plateforme = plateformeParId(c.plateformeId);
  return (
    <li className="space-y-1 rounded-lg border border-bordure p-3 text-sm">
      <p className="font-semibold">
        {c.prenom} {c.nom} <span className="font-normal text-doux">— {poste.nom}</span>
      </p>
      <p>
        {c.experience} an{c.experience > 1 ? 's' : ''} d’expérience · compétence estimée{' '}
        {Math.round(c.competence * 100)}/100 · personnalité : <strong>{trait.nom}</strong> (
        {trait.description.charAt(0).toLowerCase() + trait.description.slice(1)})
      </p>
      <p className="chiffres">
        Attentes : {argent(c.attentes)}/h · disponible {c.heuresSouhaitees} h/sem. · via{' '}
        {plateforme.nom.toLowerCase()}
        {plateforme.pourcentageSalaire > 0 &&
          ` (frais d’agence de ${pourcentage(plateforme.pourcentageSalaire, 0)} du salaire annuel)`}
      </p>
      {c.statut === 'refuse' ? (
        <p className="font-semibold text-danger">
          A refusé ton offre : le salaire était trop bas pour ses attentes.
        </p>
      ) : (
        <div className="flex flex-wrap items-end gap-2">
          <label className="flex flex-col text-xs">
            Salaire offert ($/h)
            <input
              type="number"
              step={0.25}
              min={etat.salaireMinimum}
              value={salaire}
              onChange={(e) => setSalaire(Number(e.target.value))}
              className={`${CHAMP} w-24`}
            />
          </label>
          <label className="flex flex-col text-xs">
            Heures/sem.
            <input
              type="number"
              min={8}
              max={45}
              value={heures}
              onChange={(e) => setHeures(Number(e.target.value))}
              className={`${CHAMP} w-20`}
            />
          </label>
          <Bouton
            petit
            variante="primaire"
            onClick={() => agir((s, id) => embaucherCandidat(s, id, c.id, salaire, heures))}
          >
            Faire une offre
          </Bouton>
          <Bouton petit onClick={() => agir((s, id) => retirerCandidat(s, id, c.id))}>
            Refuser
          </Bouton>
        </div>
      )}
      <p className="text-xs text-doux">
        {c.expire <= etat.moisCourant
          ? 'Disponible ce mois-ci seulement.'
          : 'Disponible jusqu’au mois prochain.'}
      </p>
    </li>
  );
}

function VueRecrutement() {
  const { etat, ent, secteur } = useJeuCourant();
  const agir = useJeu((s) => s.agir);
  const [posteId, setPosteId] = useState(secteur.postes[0]);
  const [plateformeId, setPlateformeId] = useState(PLATEFORMES[1].id);
  const poste = posteParId(posteId);
  const plateforme = plateformeParId(plateformeId);
  const candidats = ent.rh.candidats;
  return (
    <div className="space-y-5">
      <Carte
        titre="Afficher un poste"
        sousTitre="Choisis le poste et la plateforme : coût, délai et nombre de candidats varient. En pénurie de main-d’œuvre, les candidats sont plus rares et plus exigeants."
      >
        <div className="grid gap-4 md:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm font-semibold">
            Poste
            <select
              className="rounded-md border border-bordure bg-surface px-2 py-1.5 font-normal"
              value={posteId}
              onChange={(e) => setPosteId(e.target.value)}
            >
              {secteur.postes.map((id) => {
                const p = posteParId(id);
                return (
                  <option key={id} value={id}>
                    {p.nom} (médiane {argent(salaireMarche(etat, id))}/h)
                  </option>
                );
              })}
            </select>
            <span className="font-normal text-doux">{poste.description}</span>
          </label>
          <label className="flex flex-col gap-1 text-sm font-semibold">
            Plateforme
            <select
              className="rounded-md border border-bordure bg-surface px-2 py-1.5 font-normal"
              value={plateformeId}
              onChange={(e) => setPlateformeId(e.target.value)}
            >
              {PLATEFORMES.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nom}
                </option>
              ))}
            </select>
            <span className="font-normal text-doux">
              {plateforme.description} Coût :{' '}
              {plateforme.pourcentageSalaire > 0
                ? `${pourcentage(plateforme.pourcentageSalaire, 0)} du salaire annuel à l’embauche`
                : argentRond(plateforme.cout)}{' '}
              · candidats {plateforme.delaiMois === 0 ? 'tout de suite' : 'le mois prochain'} ·
              environ {plateforme.candidatsMoyens} candidats.
            </span>
          </label>
        </div>
        <Bouton
          className="mt-3"
          variante="primaire"
          onClick={() => agir((s, id) => afficherPoste(s, id, posteId, plateformeId))}
        >
          Publier l’offre d’emploi
        </Bouton>
        {ent.rh.affichages.length > 0 && (
          <ul className="mt-3 list-disc pl-5 text-sm">
            {ent.rh.affichages.map((a) => (
              <li key={a.id}>
                {posteParId(a.posteId).nom} sur {plateformeParId(a.plateformeId).nom.toLowerCase()}{' '}
                : candidatures attendues le mois {a.moisCandidats + 1}.
              </li>
            ))}
          </ul>
        )}
      </Carte>
      <Carte titre={`Candidats (${candidats.length})`}>
        {candidats.length === 0 ? (
          <p className="text-sm text-doux">
            Aucun candidat pour l’instant. Publie une offre d’emploi.
          </p>
        ) : (
          <ul className="grid gap-3 lg:grid-cols-2">
            {candidats.map((c) => (
              <CarteCandidat key={c.id} c={c} />
            ))}
          </ul>
        )}
      </Carte>
      <Astuce>
        Un candidat accepte si ton offre respecte ses attentes; sous ses attentes, il risque de
        refuser. Le premier mois, un nouvel employé est moins productif (période d’intégration). Les
        postes de gérant, de commis comptable et de responsable marketing ne servent pas les
        clients, mais ils allègent ton travail, réduisent les honoraires du comptable ou rendent ta
        publicité plus efficace. Les employés de production (
        {secteur.libelleProduction.toLowerCase()}) déterminent combien de produits ou de services tu
        peux livrer chaque mois.
      </Astuce>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Conditions de travail
// ---------------------------------------------------------------------------

function VueConditions() {
  const { ent, secteur, date } = useJeuCourant();
  const changer = useJeu((s) => s.changerDecisions);
  const agir = useJeu((s) => s.agir);
  const d = ent.decisions;
  const feries = JOURS_FERIES_PAR_MOIS[date.mois - 1];
  const hygiene = conformeHygiene(ent);
  return (
    <div className="space-y-5">
      <div className="grid gap-4 lg:grid-cols-2">
        <Carte titre={<Terme id="avantagesSociaux">Avantages sociaux</Terme>}>
          <fieldset className="space-y-2 text-sm">
            <legend className="sr-only">Avantages offerts</legend>
            {AVANTAGES.map((a) => (
              <label key={a.id} className="flex items-start gap-2">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={d.avantages.includes(a.id)}
                  onChange={(e) =>
                    changer({
                      avantages: e.target.checked
                        ? [...d.avantages, a.id]
                        : d.avantages.filter((x) => x !== a.id),
                    })
                  }
                />
                <span>
                  <strong>{a.nom}</strong> (
                  {a.coutMensuelParEmploye > 0
                    ? `${argentRond(a.coutMensuelParEmploye)} par employé par mois`
                    : 'aucun coût'}
                  , moral +{a.gainMoral}) — {a.description}
                </span>
              </label>
            ))}
          </fieldset>
        </Carte>
        <Carte titre="Conformité">
          <div className="space-y-3 text-sm">
            {secteur.alimentation && (
              <div>
                <p className="font-semibold">
                  <Terme id="hygieneMapaq">Hygiène et salubrité alimentaires (MAPAQ)</Terme> :{' '}
                  <span className={hygiene ? 'text-succes' : 'text-danger'}>
                    {hygiene ? '✓ conforme' : '✗ non conforme'}
                  </span>
                </p>
                <p className="text-doux">
                  Il faut une personne formée comme gestionnaire d’établissement alimentaire ou au
                  moins 10 % du personnel formé comme manipulateur d’aliments. Sans cela, une
                  inspection peut mener à un constat d’infraction.
                </p>
                {!ent.rh.gestionnaireHygiene && (
                  <Bouton
                    petit
                    className="mt-1"
                    onClick={() => agir((s, id) => formerProprietaireHygiene(s, id))}
                  >
                    Suivre la formation de gestionnaire (
                    {argentRond(FORMATION_GESTIONNAIRE_HYGIENE.cout)}, 12 h)
                  </Bouton>
                )}
              </div>
            )}
            <div>
              <p className="font-semibold">
                <Terme id="syndicalisation">Syndicat</Terme> :{' '}
                {ent.rh.syndicat.statut === 'accredite' ? 'ton personnel est syndiqué' : 'aucun'}
              </p>
              <p className="text-doux">
                {ent.rh.syndicat.statut === 'accredite'
                  ? 'Une convention collective encadre les salaires et les horaires. Les mesures disciplinaires peuvent être contestées par grief.'
                  : ent.rh.moisMoralBas > 0
                    ? `Moral très bas depuis ${ent.rh.moisMoralBas} mois : les employés pourraient demander l’accréditation d’un syndicat.`
                    : 'Un moral très bas pendant plusieurs mois peut mener à une requête en accréditation syndicale.'}
              </p>
            </div>
          </div>
        </Carte>
      </div>
      <Astuce titre="Loi sur les normes du travail">
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <Terme id="vacances">Vacances</Terme> : 4 % du salaire, puis 6 % après 3 ans de service
            continu.
          </li>
          <li>
            <Terme id="joursFeries">Jours fériés</Terme> : 8 par année; chacun donne droit à une
            indemnité d’environ une journée de salaire.{' '}
            {feries > 0
              ? `Ce mois-ci : ${NOMS_JOURS_FERIES[date.mois]}.`
              : 'Aucun jour férié ce mois-ci.'}
          </li>
          <li>
            Heures supplémentaires : au-delà de 40 heures par semaine, le salaire est majoré de 50
            %.
          </li>
          <li>Obligations familiales : jusqu’à 10 jours par année, dont 2 rémunérés.</li>
          <li>
            <Terme id="preavis">Préavis</Terme> de fin d’emploi ou indemnité : 1 à 8 semaines selon
            le service; recours possible après 2 ans de service en cas de congédiement sans cause
            juste et suffisante.
          </li>
          <li>Politique de prévention du harcèlement psychologique et sexuel obligatoire.</li>
        </ul>
      </Astuce>
    </div>
  );
}

function VueCout() {
  const { etat, secteur } = useJeuCourant();
  const [posteId, setPosteId] = useState(secteur.postes[0]);
  const poste = posteParId(posteId);
  const salaire = Math.max(etat.salaireMinimum, salaireMarche(etat, posteId));
  const cout = coutAnnuelEmploye(salaire, poste.heuresSemaineDefaut, secteur.tauxCnesst);
  return (
    <Carte
      titre={<Terme id="vraiCoutEmploye">Le vrai coût d’un employé</Terme>}
      sousTitre={`À ${argent(salaire)}/h, ${poste.heuresSemaineDefaut} h par semaine, pendant un an`}
      actions={
        <select
          aria-label="Poste"
          className="rounded-md border border-bordure bg-surface px-2 py-1 text-sm"
          value={posteId}
          onChange={(e) => setPosteId(e.target.value)}
        >
          {secteur.postes.map((id) => (
            <option key={id} value={id}>
              {posteParId(id).nom}
            </option>
          ))}
        </select>
      }
    >
      <table className="chiffres w-full max-w-xl text-sm">
        <tbody>
          {[
            ['Salaire brut', cout.salaireAnnuel],
            ['Indemnité de vacances (4 %)', cout.vacances],
            ['RRQ (part de l’employeur)', cout.cotisations.rrq],
            ['RQAP (part de l’employeur)', cout.cotisations.rqap],
            ['Assurance-emploi (1,4 × l’employé)', cout.cotisations.assuranceEmploi],
            ['Fonds des services de santé (FSS)', cout.cotisations.fss],
            ['CNESST (accidents du travail)', cout.cotisations.cnesst],
            ['Normes du travail (CNT)', cout.cotisations.cnt],
          ].map(([nom, montant]) => (
            <tr key={nom as string} className="border-b border-bordure">
              <td className="py-1">{nom}</td>
              <td className="py-1 text-right">{argent(montant as number)}</td>
            </tr>
          ))}
          <tr className="font-bold">
            <td className="py-1">Coût total pour l’employeur</td>
            <td className="py-1 text-right">{argent(cout.coutTotal)}</td>
          </tr>
        </tbody>
      </table>
      <p className="mt-2 text-sm">
        Soit <strong>{argent(cout.coutHoraireReel)}</strong> l’heure,{' '}
        {pourcentage(cout.facteur - 1)} de plus que le salaire affiché, sans compter les jours
        fériés, les avantages sociaux, la formation et le recrutement.
      </p>
    </Carte>
  );
}

export function PageRH() {
  const { ent } = useJeuCourant();
  const [vue, setVue] = useState<Vue>('equipe');
  const disponibles = ent.rh.candidats.filter((c) => c.statut === 'disponible').length;
  return (
    <div className="space-y-5">
      <TitrePage titre="Ressources humaines" touche="R">
        Ton équipe détermine combien de clients tu peux servir et la qualité du service. Un salaire
        juste, de la reconnaissance et une charge de travail raisonnable gardent le moral élevé.
      </TitrePage>
      <CarteDilemmes />
      <SousOnglets
        libelle="Sections des ressources humaines"
        actif={vue}
        onChange={setVue}
        onglets={[
          { id: 'equipe', nom: 'Équipe' },
          { id: 'personnages', nom: 'Personnages' },
          { id: 'recrutement', nom: 'Recrutement', badge: disponibles },
          { id: 'conditions', nom: 'Conditions de travail' },
          { id: 'cout', nom: 'Vrai coût d’un employé' },
        ]}
      >
        {vue === 'equipe' && <VueEquipe />}
        {vue === 'personnages' && <VuePersonnages />}
        {vue === 'recrutement' && <VueRecrutement />}
        {vue === 'conditions' && <VueConditions />}
        {vue === 'cout' && <VueCout />}
      </SousOnglets>
    </div>
  );
}
