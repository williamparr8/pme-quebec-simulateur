/** Vues du département Finance ajoutées au Jalon 3 : budget, trésorerie, investissements, financement. */
import { useState } from 'react';
import { TYPES_PLACEMENTS } from '../../../data';
import { DPA } from '../../../data/fiscalite';
import { CLASSES_DPA } from '../../../engine/annuel';
import { estSocieteActions } from '../../../engine/conformite';
import { tauxPreferentiel } from '../../../engine/economy';
import {
  evaluerCredit,
  limiteMargeMax,
  tauxPlacement,
  type RaisonRefus,
} from '../../../engine/financement';
import { possede, valeurNette } from '../../../engine/immobilisations';
import { comparerTaux, tableauAmortissement, type Pret } from '../../../engine/loans';
import { ecartsPrevisions, estimerMois, precisionPrevisions } from '../../../engine/previsions';
import { bilan } from '../../../engine/statements';
import {
  DIFFICULTES,
  accueillirInvestisseur,
  demanderHausseMarge,
  demanderPret,
  investir,
  placer,
  rembourserPret,
  retirerPlacement,
  valorisationEnCours,
  type ModeFinancement,
} from '../../../engine/simulation';
import { versCents } from '../../../engine/util';
import { argent, argentRond, decimal, moisAnnee, nombre, pourcentage } from '../../../i18n/format';
import { useJeu } from '../../../store/jeu';
import { Bouton } from '../../composants/Bouton';
import { Astuce, Carte } from '../../composants/Carte';
import { Curseur } from '../../composants/Curseur';
import { Indicateur } from '../../composants/Indicateur';
import { Terme } from '../../composants/Terme';
import { useJeuCourant } from '../contexte';

const CHAMP = 'chiffres w-32 rounded-md border border-bordure bg-surface-2 px-2 py-1';

const RAISONS_REFUS: Record<RaisonRefus, string> = {
  historiqueInsuffisant: 'La banque veut au moins 3 mois d’historique financier.',
  rcsdFaible:
    'Tes flux d’exploitation (BAIIA) ne couvrent pas 1,25 fois les versements de toutes tes dettes.',
  endettementEleve:
    'Ton entreprise serait trop endettée (plus de 75 % de l’actif financé par des dettes).',
  decouvert: 'Ton compte est à découvert : la banque ne prête pas dans ces conditions.',
};

// ---------------------------------------------------------------------------
// Budget et prévisions
// ---------------------------------------------------------------------------

export function VueBudget() {
  const { ent, secteur, date } = useJeuCourant();
  const changer = useJeu((s) => s.changerDecisions);
  const estimation = estimerMois(ent, secteur, date.mois);
  const [ventes, setVentes] = useState(ent.decisions.prevision?.ventes ?? estimation?.ventes ?? 0);
  const [benefice, setBenefice] = useState(
    ent.decisions.prevision?.benefice ?? estimation?.benefice ?? 0,
  );
  const ecarts = ecartsPrevisions(ent.archives).slice(-12).reverse();
  const precision = precisionPrevisions(ecarts);
  return (
    <div className="space-y-4">
      <Carte
        titre={`Ta prévision pour ${moisAnnee(date.annee, date.mois)}`}
        sousTitre="Faire un budget, c’est s’engager sur des chiffres, puis comparer le prévu au réel pour comprendre les écarts."
      >
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col text-sm">
            Ventes prévues ($)
            <input
              type="number"
              step={500}
              value={ventes}
              onChange={(e) => setVentes(Number(e.target.value))}
              className={CHAMP}
            />
          </label>
          <label className="flex flex-col text-sm">
            Bénéfice net prévu ($)
            <input
              type="number"
              step={500}
              value={benefice}
              onChange={(e) => setBenefice(Number(e.target.value))}
              className={CHAMP}
            />
          </label>
          <Bouton
            variante="primaire"
            petit
            onClick={() => changer({ prevision: { ventes, benefice } })}
          >
            Enregistrer la prévision
          </Bouton>
          {estimation && (
            <Bouton
              petit
              onClick={() => {
                setVentes(estimation.ventes);
                setBenefice(estimation.benefice);
              }}
            >
              Partir de l’estimation ({argentRond(estimation.ventes)})
            </Bouton>
          )}
        </div>
        <p className="mt-2 text-sm text-doux">
          {ent.decisions.prevision
            ? `Prévision enregistrée : ventes ${argentRond(ent.decisions.prevision.ventes)}, bénéfice ${argentRond(ent.decisions.prevision.benefice)}.`
            : 'Aucune prévision enregistrée pour ce mois.'}{' '}
          L’estimation se base sur le dernier mois et la saisonnalité du secteur; à toi de tenir
          compte de tes décisions (prix, publicité, embauches).
        </p>
      </Carte>
      {ecarts.length > 0 && (
        <Carte
          titre={<Terme id="ecartBudgetaire">Prévu et réel</Terme>}
          sousTitre={
            precision !== null
              ? `Erreur moyenne de tes prévisions de ventes : ${pourcentage(precision)}`
              : undefined
          }
        >
          <div className="overflow-x-auto">
            <table className="chiffres w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-bordure text-left text-doux">
                  <th className="py-1 font-semibold">Mois</th>
                  <th className="py-1 text-right font-semibold">Ventes prévues</th>
                  <th className="py-1 text-right font-semibold">Ventes réelles</th>
                  <th className="py-1 text-right font-semibold">Écart</th>
                  <th className="py-1 text-right font-semibold">Bénéfice prévu</th>
                  <th className="py-1 text-right font-semibold">Bénéfice réel</th>
                </tr>
              </thead>
              <tbody>
                {ecarts.map((e) => (
                  <tr key={e.index} className="border-b border-bordure/60">
                    <td className="py-1">{moisAnnee(e.annee, e.mois)}</td>
                    <td className="py-1 text-right">{argentRond(e.prevu.ventes)}</td>
                    <td className="py-1 text-right">{argentRond(e.reel.ventes)}</td>
                    <td
                      className={`py-1 text-right font-semibold ${Math.abs(e.ecartVentes) > 0.1 ? 'text-alerte' : 'text-succes'}`}
                    >
                      {e.ecartVentes >= 0 ? '+' : ''}
                      {pourcentage(e.ecartVentes)}
                    </td>
                    <td className="py-1 text-right">{argentRond(e.prevu.benefice)}</td>
                    <td className="py-1 text-right">{argentRond(e.reel.benefice)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Carte>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Trésorerie et placements
// ---------------------------------------------------------------------------

export function VueTresorerie() {
  const { etat, ent } = useJeuCourant();
  const agir = useJeu((s) => s.agir);
  const [typeId, setTypeId] = useState(TYPES_PLACEMENTS[0].id);
  const [montant, setMontant] = useState(5000);
  const b = bilan(ent.livre.soldes, ent.archives.at(-1)?.portionCouranteDette ?? 0);
  const s = ent.livre.soldes;
  const encaisse = s.encaisse / 100;
  const disponibleMarge = (ent.margeCredit.limite + s.margeCredit) / 100;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Indicateur
          libelle="Encaisse"
          valeur={argentRond(encaisse)}
          terme="encaisse"
          ton={encaisse < 0 ? 'danger' : 'neutre'}
        />
        <Indicateur
          libelle="Fonds de roulement"
          valeur={argentRond(b.totalActifCourt - b.totalPassifCourt)}
          terme="fondsRoulement"
        />
        <Indicateur
          libelle="Marge de crédit disponible"
          valeur={argentRond(disponibleMarge)}
          terme="margeCredit"
        />
        <Indicateur
          libelle="Placements"
          valeur={argentRond(s.placements / 100)}
          terme="placements"
        />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Carte titre="Ce que l’on te doit et ce que tu dois">
          <dl className="chiffres grid grid-cols-[1fr_auto] gap-x-3 gap-y-1 text-sm">
            <dt>
              <Terme id="comptesClients">Comptes clients</Terme> (ventes aux entreprises)
            </dt>
            <dd className="text-right">{argentRond(s.comptesClients / 100)}</dd>
            <dt>
              <Terme id="comptesFournisseurs">Comptes fournisseurs</Terme> (payables le mois
              prochain)
            </dt>
            <dd className="text-right">{argentRond(-s.comptesFournisseurs / 100)}</dd>
            <dt>TPS et TVQ nettes à remettre</dt>
            <dd className="text-right">
              {argentRond(-(s.tpsAPayer + s.tvqAPayer + s.ctiARecouvrer + s.rtiARecouvrer) / 100)}
            </dd>
            <dt>Retenues et cotisations à remettre</dt>
            <dd className="text-right">
              {argentRond(-(s.retenuesAPayer + s.cotisationsAPayer) / 100)}
            </dd>
          </dl>
          <p className="mt-2 text-xs text-doux">
            Escompte 2/10 net 30 :{' '}
            {ent.decisions.prendreEscomptes ? 'tu le prends (O).' : 'tu ne le prends pas (O).'}
          </p>
        </Carte>
        <Carte titre={<Terme id="placements">Placer tes surplus</Terme>}>
          <div className="flex flex-wrap items-end gap-2">
            <label className="flex flex-col text-sm">
              Produit
              <select
                className="rounded-md border border-bordure bg-surface px-2 py-1"
                value={typeId}
                onChange={(e) => setTypeId(e.target.value)}
              >
                {TYPES_PLACEMENTS.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.nom} ({pourcentage(tauxPlacement(t.id, etat.conjoncture), 2)})
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col text-sm">
              Montant
              <input
                type="number"
                step={500}
                min={0}
                value={montant}
                onChange={(e) => setMontant(Number(e.target.value))}
                className={CHAMP}
              />
            </label>
            <Bouton
              petit
              variante="primaire"
              disabled={versCents(montant) > s.encaisse || montant <= 0}
              onClick={() => agir((x, id) => placer(x, id, typeId, montant))}
            >
              Placer
            </Bouton>
          </div>
          <p className="mt-1 text-xs text-doux">
            {TYPES_PLACEMENTS.find((t) => t.id === typeId)?.description}
          </p>
          {ent.finance.placements.length > 0 && (
            <ul className="chiffres mt-3 space-y-1 text-sm">
              {ent.finance.placements.map((p) => {
                const t = TYPES_PLACEMENTS.find((x) => x.id === p.typeId);
                const bloque = p.echeance !== null && p.echeance > etat.moisCourant;
                return (
                  <li
                    key={p.id}
                    className="flex flex-wrap items-center justify-between gap-2 border-b border-bordure/60 py-1"
                  >
                    <span>
                      {t?.nom} : {argentRond(p.montant / 100)} à {pourcentage(p.taux, 2)}
                      {p.echeance !== null ? ` · échéance au mois ${p.echeance + 1}` : ''}
                    </span>
                    <Bouton
                      petit
                      disabled={bloque}
                      onClick={() => agir((x, id) => retirerPlacement(x, id, p.id))}
                    >
                      {bloque ? 'Bloqué' : 'Retirer'}
                    </Bouton>
                  </li>
                );
              })}
            </ul>
          )}
        </Carte>
      </div>
      <Astuce>
        Le <Terme id="fondsRoulement">fonds de roulement</Terme> (actif à court terme − passif à
        court terme) est le coussin qui paie les factures pendant que l’argent des ventes arrive. Un
        surplus d’encaisse peut rapporter des intérêts, mais un placement bloqué n’est plus
        disponible en cas d’imprévu.
      </Astuce>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Investissements et immobilisations
// ---------------------------------------------------------------------------

export function VueInvestissements() {
  const { etat, ent, secteur } = useJeuCourant();
  const agir = useJeu((s) => s.agir);
  const fixe = evaluerCredit(ent, 20_000, 60, 'fixe', etat.conjoncture);
  const derniereDecl = ent.fiscal.declarations.at(-1);
  return (
    <div className="space-y-4">
      <Carte
        titre="Investir dans l’entreprise"
        sousTitre="Paie comptant ou avec un prêt d’équipement de 5 ans (sous réserve de l’accord de la banque)."
      >
        <ul className="grid gap-3 lg:grid-cols-2">
          {secteur.investissements.map((inv) => {
            const acquis = inv.unique && possede(ent, inv.id);
            const ev = evaluerCredit(ent, inv.cout, 60, 'fixe', etat.conjoncture);
            const acheter = (mode: ModeFinancement) =>
              agir((e, id) => investir(e, id, inv.id, mode));
            return (
              <li key={inv.id} className="space-y-1 rounded-lg border border-bordure p-3 text-sm">
                <p className="font-semibold">{inv.nom}</p>
                <p className="text-doux">{inv.description}</p>
                <p className="chiffres">
                  {argentRond(inv.cout)} · amortissement comptable sur{' '}
                  {Math.round(inv.dureeVieMois / 12)} ans · {DPA.noms[inv.classeDpa]}
                  {inv.fraisMensuels ? ` · ${argentRond(inv.fraisMensuels)}/mois de frais` : ''}
                </p>
                {acquis ? (
                  <p className="font-semibold text-succes">✓ Acquis</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    <Bouton
                      petit
                      variante="primaire"
                      disabled={versCents(inv.cout) > ent.livre.soldes.encaisse}
                      onClick={() => acheter('comptant')}
                    >
                      Payer comptant
                    </Bouton>
                    <Bouton petit disabled={!ev.accepte} onClick={() => acheter('pretFixe')}>
                      Prêt à taux fixe ({pourcentage(ev.taux, 2)})
                    </Bouton>
                    <Bouton petit disabled={!ev.accepte} onClick={() => acheter('pretVariable')}>
                      Prêt à taux variable
                    </Bouton>
                  </div>
                )}
                {!acquis && !ev.accepte && (
                  <p className="text-xs text-alerte">
                    Prêt refusé : {ev.raisons.map((r) => RAISONS_REFUS[r]).join(' ')}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
        {!fixe.accepte && fixe.raisons.includes('historiqueInsuffisant') && (
          <p className="mt-2 text-sm text-doux">
            Après 3 mois d’activité, la banque pourra étudier une demande de prêt.
          </p>
        )}
      </Carte>
      <Carte titre="Registre des immobilisations (comptabilité)">
        <div className="overflow-x-auto">
          <table className="chiffres w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-bordure text-left text-doux">
                <th className="py-1 font-semibold">Bien</th>
                <th className="py-1 text-right font-semibold">Coût</th>
                <th className="py-1 text-right font-semibold">Amortissement cumulé</th>
                <th className="py-1 text-right font-semibold">Valeur comptable nette</th>
                <th className="py-1 text-right font-semibold">Durée</th>
                <th className="py-1 text-right font-semibold">Catégorie fiscale</th>
              </tr>
            </thead>
            <tbody>
              {ent.immobilisations.map((i) => (
                <tr key={i.id} className="border-b border-bordure/60">
                  <td className="py-1">{i.nom}</td>
                  <td className="py-1 text-right">{argentRond(i.cout)}</td>
                  <td className="py-1 text-right">{argentRond(i.amortCumule / 100)}</td>
                  <td className="py-1 text-right">{argentRond(valeurNette(i))}</td>
                  <td className="py-1 text-right">{Math.round(i.dureeVieMois / 12)} ans</td>
                  <td className="py-1 text-right">{i.classeDpa}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Carte>
      <Carte titre={<Terme id="dpa">Valeurs fiscales (DPA)</Terme>}>
        <table className="chiffres w-full max-w-2xl text-sm">
          <thead>
            <tr className="border-b border-bordure text-left text-doux">
              <th className="py-1 font-semibold">Catégorie</th>
              <th className="py-1 text-right font-semibold">
                <Terme id="fnacc">FNACC</Terme> actuelle
              </th>
              <th className="py-1 text-right font-semibold">Ajouts de l’année</th>
              <th className="py-1 text-right font-semibold">DPA de la dernière déclaration</th>
            </tr>
          </thead>
          <tbody>
            {CLASSES_DPA.filter(
              (c) => (ent.fiscal.fnacc[c] ?? 0) > 0 || (derniereDecl?.dpaParClasse[c] ?? 0) > 0,
            ).map((c) => (
              <tr key={c} className="border-b border-bordure/60">
                <td className="py-1">{DPA.noms[c]}</td>
                <td className="py-1 text-right">{argentRond(ent.fiscal.fnacc[c] ?? 0)}</td>
                <td className="py-1 text-right">{argentRond(ent.fiscal.ajoutsAnnee[c] ?? 0)}</td>
                <td className="py-1 text-right">
                  {derniereDecl ? argentRond(derniereDecl.dpaParClasse[c] ?? 0) : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Carte>
      <Astuce titre="Amortissement comptable ou DPA?">
        Aux états financiers, l’<Terme id="amortissement">amortissement</Terme> répartit le coût
        d’un bien sur sa durée de vie utile (ici en ligne droite). Pour l’impôt, on remplace cet
        amortissement par la <Terme id="dpa">DPA</Terme>, calculée selon des catégories et des taux
        fixés par la loi (dégressifs). Les deux montants diffèrent : c’est normal. L’incitatif à
        l’investissement accéléré permet une DPA 1,5 fois plus élevée l’année d’acquisition des
        biens mis en service avant 2030.
      </Astuce>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Financement
// ---------------------------------------------------------------------------

function CartePret({ pret }: { pret: Pret }) {
  const agir = useJeu((s) => s.agir);
  const [montant, setMontant] = useState(0);
  const tableau = tableauAmortissement(pret);
  return (
    <li className="space-y-2 rounded-lg border border-bordure p-3 text-sm">
      <p className="font-semibold">
        {pret.nom} <span className="font-normal text-doux">— {pret.preteur}</span>
      </p>
      <p className="chiffres">
        Taux {pret.type === 'variable' ? 'variable' : 'fixe'} de {pourcentage(pret.tauxAnnuel, 2)} ·
        capital {argentRond(pret.capitalInitial / 100)} · solde{' '}
        <strong>{argentRond(pret.solde / 100)}</strong> ·{' '}
        {pret.moisDiffere > 0
          ? `intérêts seulement encore ${pret.moisDiffere} mois`
          : `versement ${argent(pret.versementMensuel / 100)}/mois`}
      </p>
      <div className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col text-xs">
          Remboursement anticipé
          <input
            type="number"
            step={1000}
            min={0}
            value={montant}
            onChange={(e) => setMontant(Number(e.target.value))}
            className={CHAMP}
          />
        </label>
        <Bouton
          petit
          disabled={montant <= 0}
          onClick={() => agir((e, id) => rembourserPret(e, id, pret.id, montant))}
        >
          Rembourser maintenant
        </Bouton>
      </div>
      <details>
        <summary className="cursor-pointer font-semibold text-accent">
          <Terme id="tableauAmortissement">Tableau d’amortissement</Terme> ({tableau.length}{' '}
          versements restants)
        </summary>
        <div className="mt-2 max-h-72 overflow-auto">
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
    </li>
  );
}

function ComparateurTaux() {
  const { etat } = useJeuCourant();
  const [montant, setMontant] = useState(50_000);
  const [duree, setDuree] = useState(60);
  const prime = tauxPreferentiel(etat.conjoncture);
  const scenarios = [
    { nom: 'Le taux préférentiel baisse de 1 point', variation: -0.01 },
    { nom: 'Le taux préférentiel ne change pas', variation: 0 },
    { nom: 'Le taux préférentiel monte de 2 points', variation: 0.02 },
  ];
  return (
    <Carte titre={<Terme id="tauxFixeVariable">Comparer taux fixe et taux variable</Terme>}>
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col text-sm">
          Montant
          <input
            type="number"
            step={5000}
            min={1000}
            value={montant}
            onChange={(e) => setMontant(Number(e.target.value))}
            className={CHAMP}
          />
        </label>
        <label className="flex flex-col text-sm">
          Durée (mois)
          <input
            type="number"
            step={12}
            min={12}
            max={120}
            value={duree}
            onChange={(e) => setDuree(Number(e.target.value))}
            className={CHAMP}
          />
        </label>
      </div>
      <table className="chiffres mt-3 w-full max-w-2xl text-sm">
        <thead>
          <tr className="border-b border-bordure text-left text-doux">
            <th className="py-1 font-semibold">Scénario</th>
            <th className="py-1 text-right font-semibold">
              Intérêts à taux fixe ({pourcentage(prime + 0.025, 2)})
            </th>
            <th className="py-1 text-right font-semibold">
              Intérêts à taux variable (départ {pourcentage(prime + 0.02, 2)})
            </th>
          </tr>
        </thead>
        <tbody>
          {scenarios.map((s) => {
            const c = comparerTaux(
              versCents(Math.max(0, montant)),
              Math.max(12, duree),
              prime + 0.025,
              prime + 0.02,
              s.variation,
            );
            return (
              <tr key={s.nom} className="border-b border-bordure/60">
                <td className="py-1">{s.nom}</td>
                <td className="py-1 text-right">{argentRond(c.interetsFixe / 100)}</td>
                <td
                  className={`py-1 text-right font-semibold ${c.interetsVariable < c.interetsFixe ? 'text-succes' : 'text-alerte'}`}
                >
                  {argentRond(c.interetsVariable / 100)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="mt-2 text-xs text-doux">
        Le taux variable est plus bas au départ, mais tu assumes le risque d’une hausse des taux. Le
        taux fixe coûte un peu plus cher, mais tes versements sont prévisibles.
      </p>
    </Carte>
  );
}

export function VueFinancement() {
  const { etat, ent } = useJeuCourant();
  const changer = useJeu((s) => s.changerDecisions);
  const agir = useJeu((s) => s.agir);
  const [apport, setApport] = useState(0);
  const [dividende, setDividende] = useState(0);
  const [montantPret, setMontantPret] = useState(20_000);
  const [dureePret, setDureePret] = useState(60);
  const [typePret, setTypePret] = useState<'fixe' | 'variable'>('fixe');
  const [limite, setLimite] = useState(ent.margeCredit.limite / 100);
  const [ange, setAnge] = useState(30_000);
  const d = ent.decisions;
  const societe = estSocieteActions(ent.formeJuridique);
  const prets = ent.prets.filter((p) => p.solde > 0);
  const ev = evaluerCredit(ent, montantPret, dureePret, typePret, etat.conjoncture);
  const maxMarge = limiteMargeMax(ent, DIFFICULTES[etat.config.difficulte].limiteMarge);
  const pre = societe ? valorisationEnCours(ent) : 0;
  const partAnge = ange / (pre + ange);
  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-2">
        {societe ? (
          <Carte titre="Ta rémunération : salaire et dividendes">
            <p className="mb-2 text-sm">
              Salaire de dirigeant : <strong>{argentRond(d.salaireDirigeant)}</strong> par mois (à
              régler dans RH).
            </p>
            <p className="mb-2 text-sm text-doux">
              Un dividende n’est pas déductible pour la société; il est réparti entre les
              actionnaires selon leurs actions.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="number"
                min={0}
                step={1000}
                value={dividende}
                onChange={(e) => setDividende(Number(e.target.value))}
                aria-label="Montant du dividende"
                className={CHAMP}
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
            <ul className="chiffres mt-3 text-sm">
              {ent.finance.actionnaires.map((a) => (
                <li key={`${a.nom}-${a.part}`}>
                  {a.nom} : {pourcentage(a.part, 1)} des actions
                </li>
              ))}
            </ul>
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
            <dd className="text-right">{argentRond(ent.margeCredit.limite / 100)}</dd>
            <dt className="text-doux">Montant utilisé</dt>
            <dd className="text-right font-semibold">
              {argentRond(-ent.livre.soldes.margeCredit / 100)}
            </dd>
            <dt className="text-doux">
              Taux (préférentiel + {pourcentage(ent.margeCredit.ecartTaux, 1)})
            </dt>
            <dd className="text-right">
              {pourcentage(tauxPreferentiel(etat.conjoncture) + ent.margeCredit.ecartTaux, 2)}
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
          <div className="mt-3 flex flex-wrap items-end gap-2 text-sm">
            <label className="flex flex-col">
              Nouvelle limite demandée
              <input
                type="number"
                step={1000}
                min={0}
                value={limite}
                onChange={(e) => setLimite(Number(e.target.value))}
                className={CHAMP}
              />
            </label>
            <Bouton
              petit
              disabled={limite > maxMarge || ent.moisEnDefaut > 0}
              onClick={() => agir((e, id) => demanderHausseMarge(e, id, limite))}
            >
              Demander à la banque
            </Bouton>
          </div>
          <p className="mt-1 text-xs text-doux">
            La banque accepterait jusqu’à environ {argentRond(maxMarge)} selon tes ventes, tes
            comptes clients et tes stocks.
          </p>
        </Carte>
      </div>

      <Carte titre="Tes emprunts">
        {prets.length === 0 ? (
          <p className="text-sm text-doux">Aucun emprunt en cours.</p>
        ) : (
          <ul className="grid gap-3 lg:grid-cols-2">
            {prets.map((p) => (
              <CartePret key={p.id} pret={p} />
            ))}
          </ul>
        )}
      </Carte>

      <div className="grid gap-4 lg:grid-cols-2">
        <Carte titre="Demander un nouveau prêt à terme">
          <div className="flex flex-wrap items-end gap-2 text-sm">
            <label className="flex flex-col">
              Montant
              <input
                type="number"
                step={1000}
                min={1000}
                value={montantPret}
                onChange={(e) => setMontantPret(Number(e.target.value))}
                className={CHAMP}
              />
            </label>
            <label className="flex flex-col">
              Durée (mois)
              <input
                type="number"
                step={12}
                min={12}
                max={120}
                value={dureePret}
                onChange={(e) => setDureePret(Number(e.target.value))}
                className={CHAMP}
              />
            </label>
            <label className="flex flex-col">
              Taux
              <select
                className="rounded-md border border-bordure bg-surface px-2 py-1"
                value={typePret}
                onChange={(e) => setTypePret(e.target.value === 'variable' ? 'variable' : 'fixe')}
              >
                <option value="fixe">Fixe</option>
                <option value="variable">Variable</option>
              </select>
            </label>
          </div>
          <dl className="chiffres mt-3 grid grid-cols-[1fr_auto] gap-x-3 text-sm">
            <dt className="text-doux">Taux offert</dt>
            <dd className="text-right">{pourcentage(ev.taux, 2)}</dd>
            <dt className="text-doux">Versement mensuel</dt>
            <dd className="text-right">{argent(ev.versement)}</dd>
            <dt className="text-doux">
              <Terme id="rcsd">Couverture du service de la dette</Terme>
            </dt>
            <dd className="text-right">
              {ev.rcsd === null ? '—' : `${decimal(ev.rcsd)} fois (minimum 1,25)`}
            </dd>
            <dt className="text-doux">Endettement après le prêt</dt>
            <dd className="text-right">{pourcentage(ev.endettement, 0)} (maximum 75 %)</dd>
          </dl>
          {ev.accepte ? (
            <Bouton
              className="mt-3"
              variante="primaire"
              petit
              onClick={() => agir((e, id) => demanderPret(e, id, montantPret, dureePret, typePret))}
            >
              Accepter le prêt
            </Bouton>
          ) : (
            <p className="mt-3 text-sm font-semibold text-alerte">
              Demande refusée : {ev.raisons.map((r) => RAISONS_REFUS[r]).join(' ')}
            </p>
          )}
        </Carte>
        <ComparateurTaux />
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
              className={CHAMP}
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
        {societe ? (
          <Carte titre={<Terme id="investisseurProvidentiel">Investisseur providentiel</Terme>}>
            <p className="text-sm text-doux">
              Un investisseur évalue ta société à environ {argentRond(pre)} avant son investissement
              (capitaux propres ou 4 fois le bénéfice des 12 derniers mois). Il reçoit des actions :
              ta part diminue (dilution).
            </p>
            <div className="mt-2 flex flex-wrap items-end gap-2 text-sm">
              <label className="flex flex-col">
                Montant investi
                <input
                  type="number"
                  step={5000}
                  min={10_000}
                  value={ange}
                  onChange={(e) => setAnge(Number(e.target.value))}
                  className={CHAMP}
                />
              </label>
              <Bouton
                petit
                disabled={partAnge > 0.49}
                onClick={() => agir((e, id) => accueillirInvestisseur(e, id, ange))}
              >
                Accepter l’investissement
              </Bouton>
            </div>
            <p className="chiffres mt-1 text-sm">
              Il recevrait {pourcentage(partAnge, 1)} des actions
              {partAnge > 0.49 ? ' : trop, il ne prendra pas plus de 49 %.' : '.'}
            </p>
          </Carte>
        ) : (
          <Carte titre="Investisseur providentiel">
            <p className="text-sm text-doux">
              Un investisseur providentiel reçoit des actions en échange de son argent : il faut
              d’abord être une société par actions (département Juridique).
            </p>
          </Carte>
        )}
      </div>
      <p className="text-xs text-doux">
        Prêts en cours : {nombre(prets.length)} · solde total{' '}
        {argentRond(prets.reduce((a, p) => a + p.solde, 0) / 100)}.
      </p>
    </div>
  );
}
