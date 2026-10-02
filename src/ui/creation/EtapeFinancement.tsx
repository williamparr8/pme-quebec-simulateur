/**
 * Étape « Financement » de la création : mise de fonds, prêt bancaire (taux fixe ou
 * variable), autres sources (love money, Futurpreneur, BDC, fonds locaux, Créavenir,
 * investisseur providentiel) et mini plan d'affaires évalué par les prêteurs.
 */
import { PERSONAS, SOURCES_FINANCEMENT, sourceFinancementParId } from '../../data';
import type { IdSourceFinancement, Secteur, Ville } from '../../engine/data-types';
import { conjonctureInitiale } from '../../engine/economy';
import {
  IDS_SOURCES,
  REGLES_BANQUE,
  apportReconnu,
  partAnge,
  pretBancaireMax,
  tauxSource,
  type CodeErreurSource,
  type CommentairePlan,
} from '../../engine/financement';
import { versementMensuel } from '../../engine/loans';
import {
  REGLES_FINANCEMENT,
  apportTotal,
  chargesFixesEstimees,
  erreursSources,
  evaluationPlanDemarrage,
  financementTotal,
  subventionDemarrage,
  type CoutsDemarrage,
} from '../../engine/simulation';
import type { ParametresDemarrage, PlanAffaires } from '../../engine/types';
import { argent, argentRond, pourcentage } from '../../i18n/format';
import { Astuce, Carte } from '../composants/Carte';
import { ChoixCartes } from '../composants/ChoixCartes';
import { Curseur } from '../composants/Curseur';
import { Terme } from '../composants/Terme';

interface Props {
  params: ParametresDemarrage;
  maj: (c: Partial<ParametresDemarrage>) => void;
  secteur: Secteur;
  ville: Ville;
  couts: CoutsDemarrage;
}

const COMMENTAIRES: Record<CommentairePlan, string> = {
  tropOptimiste:
    'Tes ventes prévues sont beaucoup plus élevées que celles des commerces comparables : les prêteurs n’y croient pas.',
  optimiste: 'Tes prévisions de ventes sont optimistes : les prêteurs demanderont des preuves.',
  realiste: 'Tes prévisions de ventes sont réalistes par rapport aux commerces comparables.',
  tropPrudent: 'Tes ventes prévues sont si faibles que le projet semble peu rentable.',
  margeIrrealiste: 'Ta marge brute prévue ne correspond pas à celle du secteur.',
  apportFaible:
    'Ta mise de fonds est faible par rapport au coût du projet (les prêteurs veulent souvent 20 %).',
  apportTresFaible:
    'Ta mise de fonds est très faible : tu ne prends presque aucun risque personnel.',
  fondsRoulementFaible: 'Prévois au moins 3 mois de charges fixes en fonds de roulement.',
  nonRentable: 'Selon ton propre plan, ta marge brute ne couvre pas tes charges fixes.',
};

function messageErreur(code: CodeErreurSource, id: IdSourceFinancement): string {
  const s = sourceFinancementParId(id);
  switch (code) {
    case 'montantMin':
      return `Montant minimal : ${argentRond(s.montantMin)}.`;
    case 'montantMax':
      return `Montant maximal : ${argentRond(s.montantMax)}.`;
    case 'age':
      return `Réservé aux entrepreneurs de ${s.ageMin} à ${s.ageMax} ans.`;
    case 'forme':
      return 'Réservé aux sociétés par actions (l’investisseur reçoit des actions).';
    case 'planRequis':
      return 'Exige un plan d’affaires (plus bas).';
    case 'planInsuffisant':
      return `Ton plan d’affaires n’est pas assez convaincant (score minimal de ${s.scorePlanMin}/100).`;
    case 'apportInsuffisant':
      return `Exige une mise de fonds d’au moins ${pourcentage(s.apportMinPct, 0)} du coût du projet.`;
    case 'partProjet':
      return `Peut financer au plus ${pourcentage(s.partProjetMax ?? 1, 0)} du coût du projet.`;
    case 'reqRequis':
      return 'L’entreprise doit être immatriculée au REQ (étape des démarches).';
    case 'partAngeTropElevee':
      return 'L’investisseur prendrait plus de 49 % des actions : réduis le montant ou améliore ton plan.';
  }
}

function planParDefaut(secteur: Secteur): PlanAffaires {
  // Point de départ volontairement optimiste : l'élève doit confronter ses prévisions au marché.
  return {
    ventesMensuelles: 50_000,
    margeBrute: (secteur.margeBruteCible[0] + secteur.margeBruteCible[1]) / 2,
    clienteleCible: secteur.segments[0]?.personaId ?? 'professionnels',
    moisFondsRoulement: 3,
  };
}

export function EtapeFinancement({ params, maj, secteur, ville, couts }: Props) {
  const conj = conjonctureInitiale();
  const apports = apportTotal(params);
  const maxPret = pretBancaireMax(apportReconnu(params, apports));
  const variable = params.typeTauxPret === 'variable';
  const tauxPret = tauxSource('banque', conj, variable);
  const versement =
    versementMensuel(
      Math.round(params.montantPret * 100),
      tauxPret,
      REGLES_FINANCEMENT.dureePretMois,
    ) / 100;
  const evaluation = evaluationPlanDemarrage(params, secteur, ville);
  const erreurs = erreursSources(params, secteur, ville);
  const total = financementTotal(params);
  const fondsRoulement = total - couts.total;
  const plan = params.planAffaires;
  const majFinancement = (id: IdSourceFinancement, montant: number) =>
    maj({ financements: { ...params.financements, [id]: montant } });
  const majPlan = (c: Partial<PlanAffaires>) =>
    maj({ planAffaires: { ...(plan ?? planParDefaut(secteur)), ...c } });
  const iq = SOURCES_FINANCEMENT.find((s) => s.id === 'investissementQuebec');

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <Carte titre="Ta mise de fonds et la banque">
          <div className="space-y-5">
            <Curseur
              libelle="Mise de fonds personnelle"
              valeur={params.apportPersonnel}
              min={5_000}
              max={100_000}
              decimales={0}
              format={argentRond}
              onChange={(v) => {
                const suivant = { ...params, apportPersonnel: v };
                maj({
                  apportPersonnel: v,
                  montantPret: Math.min(
                    params.montantPret,
                    pretBancaireMax(apportReconnu(suivant, apportTotal(suivant))),
                  ),
                });
              }}
              aide="Ton épargne investie dans l’entreprise. C’est ton capital : tu risques de le perdre."
            />
            <Curseur
              libelle="Prêt bancaire de démarrage"
              valeur={Math.min(params.montantPret, maxPret)}
              min={0}
              max={Math.max(1, maxPret)}
              decimales={0}
              format={argentRond}
              terme="pretTerme"
              onChange={(v) => maj({ montantPret: Math.min(v, maxPret) })}
              aide={`Maximum : ${argentRond(maxPret)} (${REGLES_BANQUE.multipleApport} $ par dollar de mise de fonds; la love money compte à moitié). ${argent(versement)} par mois sur 5 ans.`}
            />
            <ChoixCartes
              legende="Type de taux"
              nom="taux"
              colonnes={2}
              valeur={params.typeTauxPret}
              onChange={(id) => maj({ typeTauxPret: id === 'variable' ? 'variable' : 'fixe' })}
              options={[
                {
                  id: 'fixe',
                  titre: `Fixe : ${pourcentage(tauxSource('banque', conj, false), 2)}`,
                  description: 'Versements connus d’avance pendant 5 ans.',
                },
                {
                  id: 'variable',
                  titre: `Variable : ${pourcentage(tauxSource('banque', conj, true), 2)} au départ`,
                  description:
                    'Suit le taux préférentiel : moins cher aujourd’hui, risqué si les taux montent.',
                },
              ]}
            />
            <p className="text-sm text-doux">
              La banque exige presque toujours ta{' '}
              <Terme id="cautionPersonnelle">caution personnelle</Terme>, même pour une société par
              actions.
            </p>
          </div>
        </Carte>
        <Carte titre="Coûts de démarrage">
          <table className="chiffres w-full text-sm">
            <tbody>
              {[
                ['Équipement', couts.equipement],
                ['Aménagement (améliorations locatives)', couts.amenagement],
                [
                  `Dépôt de garantie (${REGLES_FINANCEMENT.moisDepotGarantie} mois de loyer)`,
                  couts.depotGarantie,
                ],
                ['Stock initial', couts.stockInitial],
                ['Enseigne, inauguration, frais juridiques', couts.fraisDemarrage],
                ['Immatriculation, permis et démarches', couts.fraisJuridiques],
                ...(couts.droitFranchise > 0
                  ? [['Droit d’entrée de la franchise', couts.droitFranchise] as const]
                  : []),
                [
                  params.inscritTaxes
                    ? 'TPS et TVQ sur les achats (récupérables)'
                    : 'TPS et TVQ sur les achats (non récupérables)',
                  couts.taxes,
                ],
              ].map(([nom, montant]) => (
                <tr key={nom as string} className="border-b border-bordure">
                  <td className="py-1">{nom}</td>
                  <td className="py-1 text-right">{argentRond(montant as number)}</td>
                </tr>
              ))}
              <tr className="font-bold">
                <td className="py-1">Total des coûts</td>
                <td className="py-1 text-right">{argentRond(couts.total)}</td>
              </tr>
              <tr>
                <td className="py-1">
                  Financement total (apports, prêts, investisseur
                  {subventionDemarrage(params) > 0 ? ', subvention' : ''})
                </td>
                <td className="py-1 text-right">{argentRond(total)}</td>
              </tr>
              <tr
                className={`font-bold ${fondsRoulement < REGLES_FINANCEMENT.fondsRoulementMin ? 'text-danger' : 'text-succes'}`}
              >
                <td className="py-1">
                  Encaisse à l’ouverture (<Terme id="fondsRoulement">fonds de roulement</Terme>)
                </td>
                <td className="py-1 text-right">{argentRond(fondsRoulement)}</td>
              </tr>
            </tbody>
          </table>
          <p className="mt-3 text-sm text-doux">
            Charges fixes estimées : environ{' '}
            {argentRond(chargesFixesEstimees(params, secteur, ville))} par mois. Prévois un coussin
            : les premiers mois, les ventes ne couvrent pas encore tout.
          </p>
        </Carte>
      </div>

      <Carte
        titre={<Terme id="planAffaires">Mini plan d’affaires</Terme>}
        sousTitre="Exigé par la BDC, Futurpreneur, les fonds locaux, Créavenir et les investisseurs. Les prêteurs comparent tes prévisions à celles des commerces comparables."
      >
        <label className="flex items-center gap-2 text-sm font-semibold">
          <input
            type="checkbox"
            checked={plan !== null}
            onChange={(e) =>
              maj({ planAffaires: e.target.checked ? planParDefaut(secteur) : null })
            }
          />
          Préparer un plan d’affaires
        </label>
        {plan && (
          <div className="mt-4 grid gap-5 lg:grid-cols-2">
            <Curseur
              libelle="Ventes mensuelles moyennes prévues (1re année)"
              valeur={plan.ventesMensuelles}
              min={5_000}
              max={120_000}
              decimales={0}
              format={argentRond}
              onChange={(v) => majPlan({ ventesMensuelles: v })}
            />
            <Curseur
              libelle="Marge brute prévue"
              valeur={plan.margeBrute}
              min={0.2}
              max={0.9}
              decimales={2}
              format={(v) => pourcentage(v, 0)}
              terme="margeBrute"
              onChange={(v) => majPlan({ margeBrute: v })}
            />
            <label className="flex flex-col gap-1 text-sm font-semibold">
              Clientèle visée en priorité
              <select
                className="rounded-md border border-bordure bg-surface px-2 py-1.5 font-normal"
                value={plan.clienteleCible}
                onChange={(e) => majPlan({ clienteleCible: e.target.value })}
              >
                {PERSONAS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nom}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm font-semibold">
              Mois de charges fixes couverts par ton fonds de roulement
              <input
                type="number"
                min={0}
                max={12}
                value={plan.moisFondsRoulement}
                onChange={(e) => majPlan({ moisFondsRoulement: Number(e.target.value) })}
                className="chiffres w-24 rounded-md border border-bordure bg-surface-2 px-2 py-1 font-normal"
              />
            </label>
          </div>
        )}
        {evaluation && (
          <div className="mt-4 rounded-lg bg-surface-2 p-3 text-sm">
            <p className="font-bold">
              Évaluation des prêteurs :{' '}
              <span className={evaluation.score >= 60 ? 'text-succes' : 'text-danger'}>
                {evaluation.score}/100
              </span>
            </p>
            <ul className="mt-1 list-disc pl-5">
              {evaluation.commentaires.map((c) => (
                <li key={c}>{COMMENTAIRES[c]}</li>
              ))}
            </ul>
          </div>
        )}
      </Carte>

      <Carte
        titre="Autres sources de financement"
        sousTitre="Tu peux combiner plusieurs sources. Chacune a ses conditions."
      >
        <ul className="grid gap-3 lg:grid-cols-2">
          {IDS_SOURCES.map((id) => {
            const s = sourceFinancementParId(id);
            const montant = params.financements[id] ?? 0;
            const erreursSource = erreurs.filter((e) => e.source === id);
            const taux = s.type === 'capital' ? null : tauxSource(id, conj);
            return (
              <li key={id} className="space-y-2 rounded-lg border border-bordure p-3 text-sm">
                <p className="font-semibold">
                  {s.nom} <span className="font-normal text-doux">— {s.organisme}</span>
                </p>
                <p className="text-doux">{s.description}</p>
                <Curseur
                  libelle={`Montant demandé (${s.nom})`}
                  valeur={montant}
                  min={0}
                  max={s.montantMax}
                  decimales={0}
                  format={argentRond}
                  onChange={(v) => majFinancement(id, Math.round(v / 500) * 500)}
                />
                <p className="text-xs text-doux">
                  {s.conditions}
                  {taux !== null && ` Taux de départ : ${pourcentage(taux, 2)}.`}
                </p>
                {id === 'ange' && montant > 0 && (
                  <p className="chiffres text-xs font-semibold">
                    L’investisseur recevrait{' '}
                    {pourcentage(
                      partAnge(montant, params.apportPersonnel, evaluation?.score ?? 0),
                      1,
                    )}{' '}
                    des actions (<Terme id="dilution">dilution</Terme> de ta part).
                  </p>
                )}
                {montant > 0 &&
                  erreursSource.map((e) => (
                    <p key={e.code} className="text-xs font-semibold text-danger">
                      ✗ {messageErreur(e.code, id)}
                    </p>
                  ))}
              </li>
            );
          })}
        </ul>
        {iq && (
          <p className="mt-3 text-sm text-doux">
            <strong>{iq.nom}</strong> : {iq.conditions}
          </p>
        )}
      </Carte>

      <Astuce titre="Dette ou capitaux propres?">
        Un prêt doit être remboursé avec intérêts, mais tu restes seul propriétaire. Un investisseur
        providentiel ne demande aucun remboursement, mais il possède une part de ton entreprise et
        de ses profits pour toujours. La love money est souple… tant que l’entreprise va bien : en
        cas d’échec, ce sont tes proches qui perdent leur argent.
      </Astuce>
    </div>
  );
}
