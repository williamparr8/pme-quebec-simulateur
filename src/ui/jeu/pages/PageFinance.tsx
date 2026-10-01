import { lazy, Suspense, useState, type ReactNode } from 'react';
import { PLAN_COMPTABLE } from '../../../engine/accounting';
import { estSocieteActions } from '../../../engine/conformite';
import { tauxPreferentiel } from '../../../engine/economy';
import { tableauAmortissement } from '../../../engine/loans';
import {
  etatsFinanciers,
  exercicesJoues,
  ratios,
  seuilRentabilite,
  type Periode,
  type Ratio,
} from '../../../engine/rapports';
import type { Bilan, EtatFlux, EtatResultats } from '../../../engine/statements';
import type { MoisArchive } from '../../../engine/types';
import {
  argent,
  argentRond,
  decimal,
  finDeMois,
  moisAnnee,
  pourcentage,
} from '../../../i18n/format';
import { useJeu } from '../../../store/jeu';
import { Bouton } from '../../composants/Bouton';
import { Astuce, Carte } from '../../composants/Carte';
import { Curseur } from '../../composants/Curseur';
import { Terme } from '../../composants/Terme';
import { TitrePage } from '../../composants/TitrePage';
import { useJeuCourant } from '../contexte';

const GraphiqueSeuil = lazy(() =>
  import('../../graphiques/Graphiques').then((m) => ({ default: m.GraphiqueSeuil })),
);

type Vue = 'resultats' | 'bilan' | 'flux' | 'journal' | 'ratios' | 'financement';
const VUES: { id: Vue; nom: string }[] = [
  { id: 'resultats', nom: 'État des résultats' },
  { id: 'bilan', nom: 'Bilan' },
  { id: 'flux', nom: 'Flux de trésorerie' },
  { id: 'journal', nom: 'Journal général' },
  { id: 'ratios', nom: 'Ratios et seuil' },
  { id: 'financement', nom: 'Financement' },
];

/** Montant comptable : les négatifs entre parenthèses, comme dans les vrais états financiers. */
function m(x: number): string {
  return x < 0 ? `(${argent(-x)})` : argent(x);
}

function Ligne({
  libelle,
  montant,
  total,
  retrait,
  terme,
}: {
  libelle: ReactNode;
  montant: number;
  total?: boolean;
  retrait?: boolean;
  terme?: string;
}) {
  return (
    <tr className={total ? 'border-t-2 border-texte/60 font-bold' : 'border-b border-bordure/60'}>
      <td className={`py-1 ${retrait ? 'pl-6' : ''}`}>
        {terme ? <Terme id={terme}>{libelle}</Terme> : libelle}
      </td>
      <td className="chiffres py-1 text-right">{m(montant)}</td>
    </tr>
  );
}

function TableEtat({ titre, children }: { titre: string; children: ReactNode }) {
  return (
    <table className="w-full max-w-2xl text-sm">
      <caption className="mb-2 text-left font-bold">{titre}</caption>
      <tbody>{children}</tbody>
    </table>
  );
}

function VueResultats({ r, titre }: { r: EtatResultats; titre: string }) {
  return (
    <TableEtat titre={titre}>
      <Ligne libelle="Ventes" montant={r.ventes} />
      <Ligne libelle="Coût des marchandises vendues" montant={-r.coutMarchandises} terme="cmv" />
      <Ligne
        libelle={`Marge brute (${pourcentage(r.tauxMargeBrute)})`}
        montant={r.margeBrute}
        total
        terme="margeBrute"
      />
      {r.chargesExploitation.map((c) => (
        <Ligne key={c.compte} libelle={c.libelle} montant={-c.montant} retrait />
      ))}
      <Ligne libelle="Total des charges d’exploitation" montant={-r.totalChargesExploitation} />
      <Ligne libelle="BAIIA" montant={r.baiia} total terme="baiia" />
      <Ligne libelle="Amortissement" montant={-r.amortissement} terme="amortissement" />
      <Ligne libelle="Bénéfice d’exploitation (BAII)" montant={r.baii} total />
      <Ligne libelle="Intérêts et frais financiers" montant={-r.interets} />
      {r.impots !== 0 && (
        <>
          <Ligne libelle="Bénéfice avant impôts" montant={r.beneficeAvantImpot} total />
          <Ligne libelle="Impôts sur le revenu (société)" montant={-r.impots} />
        </>
      )}
      <Ligne libelle="Bénéfice net" montant={r.beneficeNet} total />
      <tr>
        <td colSpan={2} className="pt-2 text-xs text-doux">
          Entreprise individuelle et société de personnes : aucun impôt n’apparaît ici, le bénéfice
          est imposé chez les propriétaires (T1 et TP-1). Société par actions : l’impôt des sociétés
          (T2 et CO-17) est inscrit à la fin de l’exercice.
        </td>
      </tr>
    </TableEtat>
  );
}

function VueBilan({ b, titre }: { b: Bilan; titre: string }) {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <TableEtat titre={`${titre} — Actif`}>
        <tr>
          <td colSpan={2} className="pt-1 font-semibold text-doux">
            Actif à court terme
          </td>
        </tr>
        {b.actifCourt.map((l) => (
          <Ligne key={l.compte} libelle={l.libelle} montant={l.montant} retrait />
        ))}
        <Ligne libelle="Total de l’actif à court terme" montant={b.totalActifCourt} />
        <tr>
          <td colSpan={2} className="pt-2 font-semibold text-doux">
            Actif à long terme
          </td>
        </tr>
        {b.actifLong.map((l) => (
          <Ligne key={l.compte} libelle={l.libelle} montant={l.montant} retrait />
        ))}
        {b.immobilisations.map((i) => (
          <Ligne
            key={i.libelle}
            libelle={`${i.libelle} (coût ${argentRond(i.cout)} − amortissement cumulé ${argentRond(i.amortCumule)})`}
            montant={i.net}
            retrait
          />
        ))}
        <Ligne libelle="Total de l’actif à long terme" montant={b.totalActifLong} />
        <Ligne libelle="TOTAL DE L’ACTIF" montant={b.totalActif} total terme="actif" />
      </TableEtat>
      <TableEtat titre={`${titre} — Passif et capitaux propres`}>
        <tr>
          <td colSpan={2} className="pt-1 font-semibold text-doux">
            Passif à court terme
          </td>
        </tr>
        {b.passifCourt.map((l) => (
          <Ligne key={l.libelle} libelle={l.libelle} montant={l.montant} retrait />
        ))}
        <Ligne libelle="Total du passif à court terme" montant={b.totalPassifCourt} />
        <tr>
          <td colSpan={2} className="pt-2 font-semibold text-doux">
            Passif à long terme
          </td>
        </tr>
        {b.passifLong.map((l) => (
          <Ligne key={l.libelle} libelle={l.libelle} montant={l.montant} retrait />
        ))}
        <Ligne libelle="Total du passif" montant={b.totalPassif} terme="passif" />
        <tr>
          <td colSpan={2} className="pt-2 font-semibold text-doux">
            Capitaux propres
          </td>
        </tr>
        {b.capitaux.lignes.map((l) => (
          <Ligne key={l.libelle} libelle={l.libelle} montant={l.montant} retrait />
        ))}
        <Ligne
          libelle="Total des capitaux propres"
          montant={b.capitaux.total}
          terme="capitauxPropres"
        />
        <Ligne
          libelle="TOTAL DU PASSIF ET DES CAPITAUX PROPRES"
          montant={b.totalPassifEtCapitaux}
          total
        />
        <tr>
          <td
            colSpan={2}
            className={`pt-2 text-xs font-semibold ${b.ecart === 0 ? 'text-succes' : 'text-danger'}`}
          >
            {b.ecart === 0
              ? '✓ Le bilan est équilibré : Actif = Passif + Capitaux propres.'
              : `Écart : ${argent(b.ecart)}`}
          </td>
        </tr>
      </TableEtat>
    </div>
  );
}

const NOMS_ACTIVITES = {
  exploitation: 'Activités d’exploitation',
  investissement: 'Activités d’investissement',
  financement: 'Activités de financement',
};

function VueFlux({ f, titre }: { f: EtatFlux; titre: string }) {
  return (
    <TableEtat titre={`${titre} (méthode directe)`}>
      {f.sections.map((s) => (
        <FragmentFlux
          key={s.activite}
          nom={NOMS_ACTIVITES[s.activite]}
          lignes={s.lignes}
          total={s.total}
        />
      ))}
      <Ligne libelle="Variation nette de l’encaisse" montant={f.variationNette} total />
    </TableEtat>
  );
}

function FragmentFlux({
  nom,
  lignes,
  total,
}: {
  nom: string;
  lignes: { flux: string; libelle: string; montant: number }[];
  total: number;
}) {
  return (
    <>
      <tr>
        <td colSpan={2} className="pt-2 font-semibold text-doux">
          {nom}
        </td>
      </tr>
      {lignes.map((l) => (
        <Ligne key={l.flux} libelle={l.libelle} montant={l.montant} retrait />
      ))}
      <Ligne libelle={`Flux net : ${nom.toLowerCase()}`} montant={total} />
    </>
  );
}

function VueJournal({ archive }: { archive: MoisArchive | undefined }) {
  const { ent } = useJeuCourant();
  const ecritures = archive ? archive.ecritures : ent.livre.ecrituresMois;
  return (
    <div className="overflow-x-auto">
      <table className="chiffres w-full min-w-[640px] text-sm">
        <caption className="mb-2 text-left font-bold">
          Journal général{' '}
          {archive ? `de ${moisAnnee(archive.annee, archive.mois)}` : '(écritures d’ouverture)'}
        </caption>
        <thead>
          <tr className="border-b border-bordure text-left text-doux">
            <th className="py-1 font-semibold">Compte</th>
            <th className="py-1 text-right font-semibold">Débit</th>
            <th className="py-1 text-right font-semibold">Crédit</th>
          </tr>
        </thead>
        <tbody>
          {ecritures.map((e, i) => (
            <FragmentEcriture key={i} libelle={e.libelle} lignes={e.lignes} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function FragmentEcriture({
  libelle,
  lignes,
}: {
  libelle: string;
  lignes: { compte: keyof typeof PLAN_COMPTABLE; debit?: number; credit?: number }[];
}) {
  return (
    <>
      {lignes.map((l, j) => (
        <tr key={j} className={j === lignes.length - 1 ? '' : ''}>
          <td className={`py-0.5 ${l.credit ? 'pl-8' : ''}`}>
            {PLAN_COMPTABLE[l.compte].numero} {PLAN_COMPTABLE[l.compte].nom}
          </td>
          <td className="py-0.5 text-right">{l.debit ? argent(l.debit / 100) : ''}</td>
          <td className="py-0.5 text-right">{l.credit ? argent(l.credit / 100) : ''}</td>
        </tr>
      ))}
      <tr className="border-b border-bordure">
        <td colSpan={3} className="pb-2 text-xs italic text-doux">
          {libelle}
        </td>
      </tr>
    </>
  );
}

const RATIOS_TEXTE: Record<Ratio['id'], { nom: string; terme: string }> = {
  liquidite: { nom: 'Liquidité générale', terme: 'liquidite' },
  endettement: { nom: 'Ratio d’endettement', terme: 'endettement' },
  margeBrute: { nom: 'Marge brute', terme: 'margeBrute' },
  margeNette: { nom: 'Marge nette', terme: 'margeNette' },
  couvertureInterets: { nom: 'Couverture des intérêts', terme: 'couvertureInterets' },
  rendementActif: { nom: 'Rendement de l’actif (annualisé)', terme: 'rendementActif' },
};

function formatRatio(r: Ratio, v: number): string {
  return r.format === 'pourcentage' ? pourcentage(v) : `${decimal(v)} fois`;
}

function VueRatios({ periode }: { periode: Periode }) {
  const { ent, secteur } = useJeuCourant();
  const etats = etatsFinanciers(ent, periode);
  const liste = ratios(etats, secteur.margeBruteCible, secteur.margeNetteCible);
  const archive =
    periode.type === 'mois'
      ? ent.archives.find((a) => a.index === periode.index)
      : ent.archives.at(-1);
  const seuil = archive ? seuilRentabilite(archive.mouvements) : null;
  return (
    <div className="space-y-4">
      <table className="w-full max-w-3xl text-sm">
        <thead>
          <tr className="border-b border-bordure text-left text-doux">
            <th className="py-1 font-semibold">Ratio</th>
            <th className="py-1 text-right font-semibold">Valeur</th>
            <th className="py-1 text-right font-semibold">Zone visée</th>
            <th className="py-1 text-right font-semibold">Évaluation</th>
          </tr>
        </thead>
        <tbody>
          {liste.map((r) => {
            const t = RATIOS_TEXTE[r.id];
            const dansCible = r.valeur !== null && r.valeur >= r.cible[0] && r.valeur <= r.cible[1];
            return (
              <tr key={r.id} className="border-b border-bordure/60">
                <td className="py-1">
                  <Terme id={t.terme}>{t.nom}</Terme>
                </td>
                <td className="chiffres py-1 text-right font-semibold">
                  {r.valeur === null ? '—' : formatRatio(r, r.valeur)}
                </td>
                <td className="chiffres py-1 text-right text-doux">
                  {formatRatio(r, r.cible[0])} à {formatRatio(r, r.cible[1])}
                </td>
                <td
                  className={`py-1 text-right font-semibold ${r.valeur === null ? 'text-doux' : dansCible ? 'text-succes' : 'text-alerte'}`}
                >
                  {r.valeur === null ? 'n. d.' : dansCible ? '✓ Dans la cible' : '⚠ Hors cible'}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {seuil && archive && (
        <div className="grid gap-4 lg:grid-cols-[1fr_1.3fr]">
          <Carte
            titre={<Terme id="seuilRentabilite">Seuil de rentabilité</Terme>}
            sousTitre={`Mois de ${moisAnnee(archive.annee, archive.mois)}`}
          >
            <dl className="chiffres grid grid-cols-2 gap-x-2 gap-y-1 text-sm">
              <dt className="text-doux">Charges fixes du mois</dt>
              <dd className="text-right">{argentRond(seuil.chargesFixes)}</dd>
              <dt className="text-doux">Marge sur coûts variables</dt>
              <dd className="text-right">{pourcentage(seuil.tauxMargeContribution)}</dd>
              <dt className="text-doux">Seuil de rentabilité</dt>
              <dd className="text-right font-bold">
                {seuil.seuil === null ? '—' : argentRond(seuil.seuil)}
              </dd>
              <dt className="text-doux">Tes ventes</dt>
              <dd className="text-right">{argentRond(seuil.ventes)}</dd>
              <dt className="text-doux">Marge de sécurité</dt>
              <dd
                className={`text-right font-semibold ${seuil.margeSecurite !== null && seuil.margeSecurite < 0 ? 'text-danger' : 'text-succes'}`}
              >
                {seuil.margeSecurite === null ? '—' : pourcentage(seuil.margeSecurite)}
              </dd>
            </dl>
            <p className="mt-2 text-xs text-doux">
              Coûts variables : marchandises, pertes et frais de cartes. Tout le reste (loyer,
              salaires, publicité, amortissement, intérêts) est traité comme fixe à court terme.
            </p>
          </Carte>
          <Suspense
            fallback={<div className="h-72 rounded-xl border border-bordure bg-surface-2" />}
          >
            <GraphiqueSeuil seuil={seuil} />
          </Suspense>
        </div>
      )}
    </div>
  );
}

function VueFinancement() {
  const { etat, ent } = useJeuCourant();
  const changer = useJeu((s) => s.changerDecisions);
  const [apport, setApport] = useState(0);
  const [remboursement, setRemboursement] = useState(0);
  const [dividende, setDividende] = useState(0);
  const d = ent.decisions;
  const pret = ent.prets.find((p) => p.solde > 0);
  const marge = ent.margeCredit;
  const tableau = pret ? tableauAmortissement(pret) : [];
  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-2">
        {estSocieteActions(ent.formeJuridique) ? (
          <Carte titre="Ta rémunération : salaire et dividendes">
            <p className="mb-2 text-sm">
              Salaire de dirigeant : <strong>{argentRond(d.salaireDirigeant)}</strong> par mois (à
              régler dans RH).
            </p>
            <p className="mb-2 text-sm text-doux">
              Dividende à verser au début du prochain mois. Il n’est pas déductible pour la société
              et sera imposé dans ta déclaration personnelle (dividende non déterminé, majoré de 15
              %).
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="number"
                min={0}
                step={1000}
                value={dividende}
                onChange={(e) => setDividende(Number(e.target.value))}
                aria-label="Montant du dividende"
                className="chiffres w-32 rounded-md border border-bordure bg-surface-2 px-2 py-1"
              />
              <Bouton
                petit
                variante="primaire"
                onClick={() => changer({ dividendePonctuel: dividende })}
              >
                Déclarer le dividende
              </Bouton>
            </div>
            {d.dividendePonctuel > 0 && (
              <p className="mt-2 text-sm font-semibold">
                Dividende prévu : {argentRond(d.dividendePonctuel)}
              </p>
            )}
          </Carte>
        ) : (
          <Carte titre="Ta rémunération : prélèvements">
            <Curseur
              libelle="Prélèvements mensuels"
              valeur={d.prelevements}
              min={0}
              max={15_000}
              decimales={0}
              format={argentRond}
              terme="prelevements"
              onChange={(v) => changer({ prelevements: v })}
              aide={
                ent.associe
                  ? `L’argent que tu retires pour vivre. ${ent.associe.nom} retire en proportion de sa part (${pourcentage(ent.associe.part, 0)}).`
                  : 'L’argent que tu retires chaque mois pour vivre. Ce n’est pas une charge : il réduit ton capital et ton encaisse.'
              }
            />
          </Carte>
        )}
        <Carte titre={<Terme id="margeCredit">Marge de crédit</Terme>}>
          <dl className="chiffres grid grid-cols-2 gap-x-2 gap-y-1 text-sm">
            <dt className="text-doux">Limite autorisée</dt>
            <dd className="text-right">{argentRond(marge.limite / 100)}</dd>
            <dt className="text-doux">Montant utilisé</dt>
            <dd className="text-right font-semibold">
              {argentRond(-ent.livre.soldes.margeCredit / 100)}
            </dd>
            <dt className="text-doux">Taux (préférentiel + {pourcentage(marge.ecartTaux, 1)})</dt>
            <dd className="text-right">
              {pourcentage(tauxPreferentiel(etat.conjoncture) + marge.ecartTaux, 2)}
            </dd>
          </dl>
          <label className="mt-3 flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={d.remboursementAutoMarge}
              onChange={(e) => changer({ remboursementAutoMarge: e.target.checked })}
            />
            Rembourser automatiquement quand l’encaisse dépasse 5 000 $
          </label>
          <p className="mt-2 text-xs text-doux">
            La banque avance automatiquement l’argent si ton encaisse devient négative, jusqu’à la
            limite.
          </p>
        </Carte>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Carte titre="Apport additionnel du propriétaire">
          <p className="mb-2 text-sm text-doux">
            Injecter ton épargne personnelle dans l’entreprise (au début du prochain mois).
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="number"
              min={0}
              step={1000}
              value={apport}
              onChange={(e) => setApport(Number(e.target.value))}
              aria-label="Montant de l’apport"
              className="chiffres w-32 rounded-md border border-bordure bg-surface-2 px-2 py-1"
            />
            <Bouton petit variante="primaire" onClick={() => changer({ apportPonctuel: apport })}>
              Prévoir l’apport
            </Bouton>
          </div>
          {d.apportPonctuel > 0 && (
            <p className="mt-2 text-sm font-semibold">
              Apport prévu ce mois-ci : {argentRond(d.apportPonctuel)}
            </p>
          )}
        </Carte>
        <Carte titre="Remboursement anticipé de l’emprunt">
          <p className="mb-2 text-sm text-doux">
            Réduit la dette et les intérêts futurs, mais diminue ton encaisse.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="number"
              min={0}
              step={1000}
              value={remboursement}
              onChange={(e) => setRemboursement(Number(e.target.value))}
              aria-label="Montant du remboursement anticipé"
              className="chiffres w-32 rounded-md border border-bordure bg-surface-2 px-2 py-1"
              disabled={!pret}
            />
            <Bouton
              petit
              onClick={() => changer({ remboursementAnticipe: remboursement })}
              disabled={!pret}
            >
              Prévoir le remboursement
            </Bouton>
          </div>
          {d.remboursementAnticipe > 0 && (
            <p className="mt-2 text-sm font-semibold">
              Remboursement prévu : {argentRond(d.remboursementAnticipe)}
            </p>
          )}
        </Carte>
      </div>

      {pret ? (
        <Carte
          titre={pret.nom}
          sousTitre={`Capital emprunté ${argentRond(pret.capitalInitial / 100)} · taux fixe ${pourcentage(pret.tauxAnnuel, 2)} · ${pret.dureeMois} mois · versement ${argent(pret.versementMensuel / 100)}/mois · solde ${argentRond(pret.solde / 100)}`}
        >
          <details>
            <summary className="cursor-pointer font-semibold text-accent">
              Voir le <Terme id="tableauAmortissement">tableau d’amortissement</Terme> (
              {tableau.length} versements restants)
            </summary>
            <div className="mt-2 max-h-80 overflow-auto">
              <table className="chiffres w-full text-sm">
                <thead className="sticky top-0 bg-surface">
                  <tr className="border-b border-bordure text-left text-doux">
                    <th className="py-1 font-semibold">N°</th>
                    <th className="py-1 text-right font-semibold">Versement</th>
                    <th className="py-1 text-right font-semibold">Intérêts</th>
                    <th className="py-1 text-right font-semibold">Capital</th>
                    <th className="py-1 text-right font-semibold">Solde</th>
                  </tr>
                </thead>
                <tbody>
                  {tableau.map((l) => (
                    <tr key={l.numero} className="border-b border-bordure/50">
                      <td className="py-0.5">{l.numero}</td>
                      <td className="py-0.5 text-right">{argent(l.versement / 100)}</td>
                      <td className="py-0.5 text-right">{argent(l.interets / 100)}</td>
                      <td className="py-0.5 text-right">{argent(l.capital / 100)}</td>
                      <td className="py-0.5 text-right">{argent(l.solde / 100)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </Carte>
      ) : (
        <Carte titre="Emprunt">
          <p className="text-sm text-doux">Aucun emprunt en cours.</p>
        </Carte>
      )}
    </div>
  );
}

export function PageFinance() {
  const { ent, derniere } = useJeuCourant();
  const [vue, setVue] = useState<Vue>('resultats');
  const [periode, setPeriode] = useState<Periode>(
    derniere ? { type: 'mois', index: derniere.index } : { type: 'cumul' },
  );
  const etats = etatsFinanciers(ent, periode);
  const exercices = exercicesJoues(ent);

  const archiveFin =
    periode.type === 'mois'
      ? ent.archives.find((a) => a.index === periode.index)
      : periode.type === 'exercice'
        ? ent.archives.filter((a) => a.annee === periode.annee).at(-1)
        : ent.archives.at(-1);
  const titrePeriode =
    periode.type === 'mois' && archiveFin
      ? `pour le mois de ${moisAnnee(archiveFin.annee, archiveFin.mois)}`
      : periode.type === 'exercice'
        ? `pour l’exercice ${periode.annee}${archiveFin && archiveFin.mois !== 12 ? ` (en cours, jusqu’à ${moisAnnee(archiveFin.annee, archiveFin.mois)})` : ''}`
        : 'depuis l’ouverture';
  const dateBilan = archiveFin
    ? `au ${finDeMois(archiveFin.annee, archiveFin.mois)}`
    : 'd’ouverture';
  const valeurPeriode =
    periode.type === 'mois'
      ? `m${periode.index}`
      : periode.type === 'exercice'
        ? `e${periode.annee}`
        : 'cumul';

  return (
    <div className="space-y-4">
      <TitrePage titre="Finance et comptabilité" touche="F">
        Tes états financiers sont produits automatiquement à partir d’une comptabilité en partie
        double : chaque opération touche au moins deux comptes et le bilan est toujours équilibré.
      </TitrePage>

      <div className="flex flex-wrap items-end gap-3">
        <div role="group" aria-label="Rapport financier" className="flex flex-wrap gap-1">
          {VUES.map((v) => (
            <Bouton
              key={v.id}
              petit
              variante={vue === v.id ? 'primaire' : 'secondaire'}
              aria-pressed={vue === v.id}
              onClick={() => setVue(v.id)}
            >
              {v.nom}
            </Bouton>
          ))}
        </div>
        {vue !== 'financement' && (
          <label className="flex items-center gap-2 text-sm">
            Période
            <select
              className="rounded-md border border-bordure bg-surface px-2 py-1"
              value={valeurPeriode}
              onChange={(e) => {
                const v = e.target.value;
                if (v === 'cumul') setPeriode({ type: 'cumul' });
                else if (v.startsWith('e'))
                  setPeriode({ type: 'exercice', annee: Number(v.slice(1)) });
                else setPeriode({ type: 'mois', index: Number(v.slice(1)) });
              }}
            >
              <option value="cumul">Depuis l’ouverture</option>
              {exercices.map((a) => (
                <option key={a} value={`e${a}`}>
                  Exercice {a}
                </option>
              ))}
              {[...ent.archives].reverse().map((a) => (
                <option key={a.index} value={`m${a.index}`}>
                  {moisAnnee(a.annee, a.mois)}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      <Carte>
        {vue === 'resultats' &&
          (etats.nbMois === 0 ? (
            <p className="text-sm text-doux">
              Aucun mois terminé. Seuls les frais de démarrage sont enregistrés pour l’instant.
            </p>
          ) : (
            <VueResultats r={etats.resultats} titre={`État des résultats ${titrePeriode}`} />
          ))}
        {vue === 'bilan' && <VueBilan b={etats.bilan} titre={`Bilan ${dateBilan}`} />}
        {vue === 'flux' && (
          <VueFlux f={etats.flux} titre={`État des flux de trésorerie ${titrePeriode}`} />
        )}
        {vue === 'journal' && (
          <VueJournal
            archive={
              periode.type === 'mois'
                ? archiveFin
                : ent.archives.length === 0
                  ? undefined
                  : ent.archives.at(-1)
            }
          />
        )}
        {vue === 'ratios' &&
          (etats.nbMois === 0 ? (
            <p className="text-sm text-doux">
              Les ratios seront disponibles après le premier mois.
            </p>
          ) : (
            <VueRatios periode={periode} />
          ))}
        {vue === 'financement' && <VueFinancement />}
      </Carte>

      <Astuce>
        Le <Terme id="bilan">bilan</Terme> est une photo à une date; l’
        <Terme id="etatResultats">état des résultats</Terme> est un film sur une période. Un
        bénéfice n’est pas de l’argent en banque : l’
        <Terme id="fluxTresorerie">état des flux de trésorerie</Terme> explique la différence
        (achats d’équipement, remboursements d’emprunt, prélèvements…).
      </Astuce>
    </div>
  );
}
