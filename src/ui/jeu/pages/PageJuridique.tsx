import { useState } from 'react';
import { IMPOT_SOCIETES, TAXES_VENTE } from '../../../data/fiscalite';
import {
  demarchesSecteur,
  coutDemarche,
  estObligatoire,
  estSocieteActions,
  fraisImmatriculation,
  fraisMiseAJourAnnuelle,
} from '../../../engine/conformite';
import { tauxPreferentiel } from '../../../engine/economy';
import { majAnnuelleExigee } from '../../../engine/simulation';
import { scenarioRemuneration } from '../../../engine/tax';
import type { DeclarationAnnuelle, FrequenceTaxes } from '../../../engine/types';
import { argent, argentRond, nombre, pourcentage } from '../../../i18n/format';
import { useJeu } from '../../../store/jeu';
import { Bouton } from '../../composants/Bouton';
import { Astuce, Carte } from '../../composants/Carte';
import { Curseur } from '../../composants/Curseur';
import { Terme } from '../../composants/Terme';
import { TitrePage } from '../../composants/TitrePage';
import { FORMES } from '../../creation/formes';
import { useJeuCourant } from '../contexte';

const FREQUENCES: { id: FrequenceTaxes; nom: string }[] = [
  { id: 'mensuelle', nom: 'Mensuelle' },
  { id: 'trimestrielle', nom: 'Trimestrielle' },
  { id: 'annuelle', nom: 'Annuelle (remise en avril)' },
];

function Montant({ libelle, valeur, gras }: { libelle: string; valeur: number; gras?: boolean }) {
  return (
    <>
      <dt className="text-doux">{libelle}</dt>
      <dd className={`chiffres text-right ${gras ? 'font-bold' : ''}`}>{argent(valeur)}</dd>
    </>
  );
}

function CarteForme() {
  const { etat, ent, date } = useJeuCourant();
  const planifier = useJeu((s) => s.planifierIncorporationSociete);
  const info = FORMES.find((f) => f.id === ent.formeJuridique) ?? FORMES[0];
  const prevue = ent.fiscal.incorporationPrevue;
  const anneeEffet = date.mois === 1 && etat.moisCourant === 0 ? date.annee : date.annee + 1;
  return (
    <Carte titre={`Forme juridique : ${info.nom}`}>
      <dl className="grid gap-x-3 gap-y-1 text-sm sm:grid-cols-[10rem_1fr]">
        <dt className="font-semibold">Responsabilité</dt>
        <dd>{info.responsabilite}</dd>
        <dt className="font-semibold">Imposition</dt>
        <dd>{info.imposition}</dd>
        <dt className="font-semibold">Ta rémunération</dt>
        <dd>{info.remuneration}</dd>
        {ent.associe && (
          <>
            <dt className="font-semibold">Associé</dt>
            <dd>
              {ent.associe.nom} : {pourcentage(ent.associe.part, 0)} des bénéfices
            </dd>
          </>
        )}
      </dl>
      {ent.formeJuridique === 'individuelle' && (
        <div className="mt-4 rounded-lg border border-bordure p-3">
          <p className="font-semibold">S’incorporer</p>
          {prevue ? (
            <p className="mt-1 text-sm">
              Incorporation prévue le 1er janvier {anneeEffet} (
              {prevue === 'inc-qc' ? 'société du Québec' : 'société fédérale'}).{' '}
              <Bouton petit variante="discret" onClick={() => planifier(null)}>
                Annuler
              </Bouton>
            </p>
          ) : (
            <>
              <p className="mb-2 text-sm text-doux">
                La société prend effet au début du prochain exercice. Ton capital est converti en
                actions (roulement) et la société paiera son propre impôt (11,2 % avec la DPE au
                lieu de ton taux personnel).
              </p>
              <div className="flex flex-wrap gap-2">
                <Bouton petit onClick={() => planifier('inc-qc')}>
                  Société du Québec ({argentRond(fraisImmatriculation('inc-qc'))})
                </Bouton>
                <Bouton petit onClick={() => planifier('inc-federal')}>
                  Société fédérale ({argentRond(fraisImmatriculation('inc-federal'))})
                </Bouton>
              </div>
            </>
          )}
        </div>
      )}
    </Carte>
  );
}

function CarteDemarches() {
  const { ent, secteur } = useJeuCourant();
  const regulariser = useJeu((s) => s.regulariser);
  return (
    <Carte
      titre="Démarches et permis"
      sousTitre="Une démarche obligatoire oubliée peut être découverte chaque mois."
    >
      <ul className="space-y-2 text-sm">
        {demarchesSecteur(secteur).map((d) => {
          const fait = ent.demarches[d.id];
          const obligatoire = estObligatoire(d.id, secteur, ent.employes.length);
          const cout = coutDemarche(d.id, ent.formeJuridique);
          return (
            <li
              key={d.id}
              className="flex flex-wrap items-center justify-between gap-2 border-b border-bordure/60 pb-2"
            >
              <span>
                <span aria-hidden="true">{fait ? '✅ ' : obligatoire ? '⚠️ ' : '○ '}</span>
                <span className="font-semibold">{d.nom}</span>
                <span className="block text-doux">
                  {fait
                    ? 'Fait'
                    : obligatoire
                      ? `Obligatoire, non faite : risque d’amende de ${argentRond(d.amende)}`
                      : 'Facultative, non faite'}
                </span>
              </span>
              {!fait && (
                <Bouton petit onClick={() => regulariser(d.id)}>
                  Faire maintenant ({cout > 0 ? argentRond(cout) : 'sans frais'})
                </Bouton>
              )}
            </li>
          );
        })}
      </ul>
    </Carte>
  );
}

function CarteTaxes() {
  const { ent } = useJeuCourant();
  const inscrire = useJeu((s) => s.inscrireAuxTaxes);
  const changerFrequence = useJeu((s) => s.changerFrequence);
  const f = ent.fiscal;
  const s = ent.livre.soldes;
  const ventes12 = f.ventesTaxablesMois.reduce((a, x) => a + x, 0);
  const tps = -s.tpsAPayer / 100;
  const tvq = -s.tvqAPayer / 100;
  const cti = s.ctiARecouvrer / 100;
  const rti = s.rtiARecouvrer / 100;
  return (
    <Carte titre={<Terme id="tpsTvq">TPS et TVQ</Terme>}>
      {f.inscritTaxes ? (
        <>
          <p className="mb-2 text-sm">
            ✅ Inscrite : tu perçois 5 % de TPS et 9,975 % de TVQ sur tes ventes et tu récupères les
            taxes payées sur tes achats.
          </p>
          <label className="mb-3 flex items-center gap-2 text-sm">
            Fréquence des déclarations
            <select
              className="rounded-md border border-bordure bg-surface px-2 py-1"
              value={f.frequenceTaxes}
              onChange={(e) => changerFrequence(e.target.value as FrequenceTaxes)}
            >
              {FREQUENCES.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.nom}
                </option>
              ))}
            </select>
          </label>
          <dl className="grid grid-cols-2 gap-x-2 gap-y-1 text-sm">
            <Montant libelle="TPS perçue à remettre" valeur={tps} />
            <Montant libelle="TVQ perçue à remettre" valeur={tvq} />
            <Montant libelle="Moins : CTI (TPS payée sur les achats)" valeur={cti} />
            <Montant libelle="Moins : RTI (TVQ payée sur les achats)" valeur={rti} />
            <Montant
              libelle={tps + tvq - cti - rti >= 0 ? 'Prochaine remise' : 'Prochain remboursement'}
              valeur={Math.abs(tps + tvq - cti - rti)}
              gras
            />
          </dl>
        </>
      ) : (
        <>
          <p className={`mb-2 text-sm ${f.doitSInscrire ? 'font-semibold text-danger' : ''}`}>
            {f.doitSInscrire
              ? '⚠️ Tu as dépassé le seuil de 30 000 $ : l’inscription est obligatoire. Chaque vente sans taxes pourra t’être réclamée avec une pénalité.'
              : 'Petit fournisseur non inscrit : tu ne perçois pas de taxes et tu ne récupères pas celles payées sur tes achats.'}
          </p>
          <p className="mb-1 text-sm">
            Ventes taxables des 12 derniers mois :{' '}
            <strong className="chiffres">{argentRond(ventes12)}</strong> sur{' '}
            {argentRond(TAXES_VENTE.seuilPetitFournisseur)}
          </p>
          <div className="mb-3 h-2.5 overflow-hidden rounded-full bg-surface-2" aria-hidden="true">
            <div
              className={`h-full ${ventes12 > TAXES_VENTE.seuilPetitFournisseur ? 'bg-danger' : 'bg-accent'}`}
              style={{
                width: `${Math.min(100, (ventes12 / TAXES_VENTE.seuilPetitFournisseur) * 100)}%`,
              }}
            />
          </div>
          <Bouton variante="primaire" petit onClick={inscrire}>
            M’inscrire à la TPS et à la TVQ
          </Bouton>
        </>
      )}
      <p className="mt-3 text-xs text-doux">
        Cette année : TPS perçue {argent(f.taxesAnnee.tpsPercue)}, TVQ perçue{' '}
        {argent(f.taxesAnnee.tvqPercue)}, CTI {argent(f.taxesAnnee.cti)}, RTI{' '}
        {argent(f.taxesAnnee.rti)}.
      </p>
    </Carte>
  );
}

function CarteReq() {
  const { etat, ent, date } = useJeuCourant();
  const produire = useJeu((s) => s.produireDeclarationReq);
  const exigee = majAnnuelleExigee(etat.config.anneeDepart, ent, date.annee);
  const faite = ent.fiscal.majAnnuelles.includes(date.annee);
  return (
    <Carte titre="Registraire des entreprises (REQ)">
      <p className="mb-2 text-sm">
        Statut : {ent.demarches.req ? '✅ immatriculée (NEQ attribué)' : '⚠️ non immatriculée'}
      </p>
      <p className="mb-2 text-sm font-semibold">Déclaration de mise à jour annuelle {date.annee}</p>
      {!exigee ? (
        <p className="text-sm text-doux">Pas exigée cette année (année de l’immatriculation).</p>
      ) : faite ? (
        <p className="text-sm">✅ Produite.</p>
      ) : (
        <>
          <p className="mb-2 text-sm text-doux">
            À produire avant le 30 juin. En retard : pénalité de 50 % des droits annuels.
          </p>
          <Bouton petit variante="primaire" onClick={produire}>
            Produire la déclaration ({argentRond(fraisMiseAJourAnnuelle(ent.formeJuridique))})
          </Bouton>
        </>
      )}
    </Carte>
  );
}

function Declaration({ d }: { d: DeclarationAnnuelle }) {
  const societe = d.societe;
  return (
    <details className="rounded-lg border border-bordure p-3">
      <summary className="cursor-pointer font-semibold">
        Exercice {d.annee} —{' '}
        {societe
          ? `T2 et CO-17 : impôt de ${argentRond(societe.total)}`
          : `T1 et TP-1 : impôt et cotisations de ${argentRond(d.personnel.total)}`}
      </summary>
      <dl className="chiffres mt-2 grid grid-cols-2 gap-x-2 gap-y-1 text-sm">
        <Montant libelle="Bénéfice comptable avant impôts" valeur={d.beneficeComptable} />
        <Montant libelle="Plus : amortissement comptable" valeur={d.amortissementComptable} />
        <Montant
          libelle="Plus : amendes et pénalités (non déductibles)"
          valeur={d.nonDeductibles}
        />
        <Montant libelle="Moins : déduction pour amortissement (DPA)" valeur={d.dpa} />
        <Montant libelle="Revenu fiscal" valeur={d.revenuFiscal} gras />
        {societe ? (
          <>
            <Montant libelle="Pertes reportées utilisées" valeur={d.pertesUtilisees} />
            <Montant libelle="Revenu imposable" valeur={societe.revenuImposable} />
            <dt className="text-doux">Heures rémunérées (DPE du Québec)</dt>
            <dd className="text-right">
              {nombre(d.heuresRemunerees)} h ({pourcentage(societe.facteurDpeQuebec, 0)} de la DPE)
            </dd>
            <Montant libelle="Impôt fédéral" valeur={societe.impotFederal} />
            <Montant libelle="Impôt du Québec" valeur={societe.impotQuebec} />
            <Montant libelle="Moins : acomptes versés" valeur={societe.acomptesVerses} />
            <Montant
              libelle={societe.solde >= 0 ? 'Solde à payer (mars)' : 'Remboursement (mars)'}
              valeur={Math.abs(societe.solde)}
              gras
            />
            <Montant libelle="Ton salaire de dirigeant" valeur={d.personnel.salaire} />
            <Montant libelle="Tes dividendes" valeur={d.personnel.dividendes} />
            <Montant libelle="Ton impôt personnel (T1 et TP-1)" valeur={d.personnel.total} />
          </>
        ) : (
          <>
            <Montant
              libelle="Ta part du revenu d’entreprise"
              valeur={d.personnel.revenuEntreprise}
            />
            <Montant
              libelle="Impôt fédéral (après abattement de 16,5 %)"
              valeur={d.personnel.impotFederal}
            />
            <Montant libelle="Impôt du Québec" valeur={d.personnel.impotQuebec} />
            <Montant
              libelle="RRQ et RQAP de travailleur autonome"
              valeur={d.personnel.cotisations}
            />
            <Montant
              libelle="Total à payer personnellement (30 avril)"
              valeur={d.personnel.total}
              gras
            />
          </>
        )}
      </dl>
      {d.feuillets.length > 0 && (
        <div className="mt-3 overflow-x-auto">
          <table className="chiffres w-full min-w-[620px] text-xs">
            <caption className="mb-1 text-left font-semibold">
              Relevés T4 (fédéral) et RL-1 (Québec)
            </caption>
            <thead>
              <tr className="border-b border-bordure text-left text-doux">
                <th className="py-1">Salarié</th>
                <th className="py-1 text-right">Revenu d’emploi</th>
                <th className="py-1 text-right">Impôt fédéral</th>
                <th className="py-1 text-right">Impôt du Québec</th>
                <th className="py-1 text-right">RRQ</th>
                <th className="py-1 text-right">RQAP</th>
                <th className="py-1 text-right">AE</th>
              </tr>
            </thead>
            <tbody>
              {d.feuillets.map((x) => (
                <tr key={x.nom} className="border-b border-bordure/50">
                  <td className="py-0.5">{x.nom}</td>
                  <td className="py-0.5 text-right">{argent(x.brut)}</td>
                  <td className="py-0.5 text-right">{argent(x.impotFederal)}</td>
                  <td className="py-0.5 text-right">{argent(x.impotQuebec)}</td>
                  <td className="py-0.5 text-right">{argent(x.rrq)}</td>
                  <td className="py-0.5 text-right">{argent(x.rqap)}</td>
                  <td className="py-0.5 text-right">{argent(x.assuranceEmploi)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="mt-2 text-xs text-doux">
        Taxes de l’année : TPS perçue {argent(d.taxes.tpsPercue)}, TVQ perçue{' '}
        {argent(d.taxes.tvqPercue)}, CTI {argent(d.taxes.cti)}, RTI {argent(d.taxes.rti)}.
      </p>
    </details>
  );
}

function CarteDeclarations() {
  const { ent } = useJeuCourant();
  const f = ent.fiscal;
  const societe = estSocieteActions(ent.formeJuridique);
  return (
    <Carte titre="Impôts et déclarations de fin d’exercice">
      {societe && (
        <dl className="mb-3 grid grid-cols-2 gap-x-2 gap-y-1 text-sm">
          <Montant libelle="Acompte provisionnel mensuel" valeur={f.acompteMensuel} />
          <Montant libelle="Acomptes versés cette année" valeur={f.acomptesVersesAnnee} />
          <dt className="text-doux">Heures rémunérées cette année (DPE : 5 500 h)</dt>
          <dd className="chiffres text-right">{nombre(f.heuresRemunereesAnnee)} h</dd>
          <Montant libelle="Pertes fiscales reportées" valeur={f.pertesReportees} />
        </dl>
      )}
      {f.declarations.length === 0 ? (
        <p className="text-sm text-doux">
          Les déclarations seront produites à la fin de l’exercice (31 décembre).
        </p>
      ) : (
        <div className="space-y-2">
          {[...f.declarations].reverse().map((d) => (
            <Declaration key={d.annee} d={d} />
          ))}
        </div>
      )}
    </Carte>
  );
}

function OutilRemuneration() {
  const { ent } = useJeuCourant();
  const derniere = ent.fiscal.declarations.at(-1);
  const [benefice, setBenefice] = useState(() =>
    Math.max(
      40_000,
      Math.round(
        ((derniere?.beneficeComptable ?? 60_000) + (derniere?.personnel.salaire ?? 0)) / 1000,
      ) * 1000,
    ),
  );
  const [partSalaire, setPartSalaire] = useState(0.5);
  const heures = 4_000;
  const scenarios = [
    { nom: '100 % salaire', s: scenarioRemuneration(benefice, 1, heures) },
    {
      nom: `Ton choix (${pourcentage(partSalaire, 0)} salaire)`,
      s: scenarioRemuneration(benefice, partSalaire, heures),
    },
    { nom: '100 % dividendes', s: scenarioRemuneration(benefice, 0, heures) },
  ];
  const lignes: [string, (s: ReturnType<typeof scenarioRemuneration>) => string][] = [
    ['Salaire brut', (s) => argentRond(s.salaire)],
    ['Dividendes (non déterminés)', (s) => argentRond(s.dividendes)],
    ['Impôt de la société', (s) => argentRond(s.impotSociete)],
    ['Impôt personnel', (s) => argentRond(s.impotPersonnel)],
    ['RRQ et RQAP (employé + employeur)', (s) => argentRond(s.cotisationsTotales)],
    ['Argent en poche', (s) => argentRond(s.argentEnPoche)],
    ['Droits REER créés', (s) => argentRond(s.droitsReer)],
    ['Rente du RRQ à la retraite', (s) => (s.cotiseAuRrq ? 'Oui' : 'Non')],
  ];
  return (
    <Carte
      titre="Outil : salaire ou dividendes?"
      sousTitre="Pour le propriétaire d’une société par actions (simulation sur une année)."
    >
      <div className="mb-4 grid gap-4 md:grid-cols-2">
        <Curseur
          libelle="Bénéfice de la société avant ta rémunération"
          valeur={benefice}
          min={10_000}
          max={300_000}
          format={argentRond}
          onChange={setBenefice}
        />
        <Curseur
          libelle="Part versée en salaire"
          valeur={partSalaire}
          min={0}
          max={1}
          decimales={2}
          format={(v) => pourcentage(v, 0)}
          onChange={setPartSalaire}
        />
      </div>
      <div className="overflow-x-auto">
        <table className="chiffres w-full min-w-[560px] text-sm">
          <thead>
            <tr className="border-b border-bordure text-left text-doux">
              <th className="py-1" />
              {scenarios.map((x) => (
                <th key={x.nom} className="py-1 text-right font-semibold">
                  {x.nom}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {lignes.map(([nom, f]) => (
              <tr
                key={nom}
                className={`border-b border-bordure/60 ${nom === 'Argent en poche' ? 'font-bold' : ''}`}
              >
                <td className="py-1">{nom}</td>
                {scenarios.map((x) => (
                  <td key={x.nom} className="py-1 text-right">
                    {f(x.s)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-doux">
        Hypothèses : les autres employés comptent pour {nombre(heures)} heures rémunérées; le
        salaire ajoute 2 080 heures pour la DPE du Québec (
        {nombre(IMPOT_SOCIETES.quebec.heuresCompletes)} h exigées). Aucun autre revenu personnel. Le
        salaire coûte des cotisations, mais crée des droits REER et une rente du RRQ; les dividendes
        sont plus simples et souvent plus avantageux à court terme. C’est de la{' '}
        <strong>planification fiscale légale</strong>.
      </p>
    </Carte>
  );
}

export function PageJuridique() {
  const { etat, ent } = useJeuCourant();
  const conj = etat.conjoncture;
  return (
    <div className="space-y-5">
      <TitrePage titre="Juridique et fiscalité" touche="J">
        Forme juridique, démarches et permis, taxes de vente, Registraire des entreprises, impôts et
        déclarations.
      </TitrePage>

      <div className="grid gap-4 lg:grid-cols-2">
        <CarteForme />
        <CarteTaxes />
        <CarteDemarches />
        <div className="space-y-4">
          <CarteReq />
          <Carte titre="Taux en vigueur">
            <dl className="chiffres grid grid-cols-2 gap-x-2 gap-y-1 text-sm">
              <dt className="text-doux">Salaire minimum</dt>
              <dd className="text-right font-semibold">{argent(etat.salaireMinimum)}/h</dd>
              <dt className="text-doux">
                <Terme id="tauxDirecteur">Taux directeur</Terme>
              </dt>
              <dd className="text-right">{pourcentage(conj.tauxDirecteur, 2)}</dd>
              <dt className="text-doux">
                <Terme id="tauxPreferentiel">Taux préférentiel</Terme>
              </dt>
              <dd className="text-right">{pourcentage(tauxPreferentiel(conj), 2)}</dd>
              <dt className="text-doux">
                Loyer mensuel (bail indexé de {pourcentage(ent.bail.indexation)} par an)
              </dt>
              <dd className="text-right">{argent(ent.bail.loyerMensuel / 100)}</dd>
            </dl>
          </Carte>
        </div>
      </div>

      <CarteDeclarations />
      <OutilRemuneration />

      <Astuce titre="Planification fiscale ou évasion fiscale?">
        Choisir sa forme juridique, le moment de s’incorporer ou le dosage salaire-dividendes, c’est
        de la planification fiscale <strong>légale</strong>. Ne pas déclarer des ventes au comptant
        ou passer des dépenses personnelles dans l’entreprise, c’est de l’
        <strong>évasion fiscale</strong> : illégal, et sévèrement puni (impôt, intérêts, pénalités
        et poursuites).
      </Astuce>
    </div>
  );
}
