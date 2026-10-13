/** Capital (sociofinancement, capital de risque, conseil) et transmission de l'entreprise. */
import { useState } from 'react';
import {
  CAPITAL_RISQUE,
  MOIS_PREPARATION_RELEVE,
  ROUTES,
  SOCIO,
  annulerReleve,
  chancesSociofinancement,
  evaluerEntreprise,
  lancerSociofinancement,
  leverCapitalRisque,
  offreVente,
  preparerReleve,
  termesCapitalRisque,
  vendreEntreprise,
  verifierSociofinancement,
  type RouteVente,
} from '../../../engine/simulation';
import { argentRond, pourcentage } from '../../../i18n/format';
import { useJeu } from '../../../store/jeu';
import { Bouton } from '../../composants/Bouton';
import { Astuce, Carte } from '../../composants/Carte';
import { Terme } from '../../composants/Terme';
import { useJeuCourant } from '../contexte';

const CHAMP = 'chiffres w-36 rounded-md border border-bordure bg-surface-2 px-2 py-1';
const m = (x: number): string => (x < 0 ? `(${argentRond(-x)})` : argentRond(x));

const TYPES_ACTIONNAIRE = {
  fondateur: 'fondateur',
  ange: 'Investisseur providentiel',
  risque: 'Fonds de capital de risque',
} as const;

export function VueCapital() {
  const { etat, ent } = useJeuCourant();
  const agir = useJeu((s) => s.agir);
  const index = Math.min(etat.moisCourant, etat.config.dureeMois - 1);
  const [objectif, setObjectif] = useState(10_000);
  const [montant, setMontant] = useState<number>(CAPITAL_RISQUE.montantMin);
  const cap = ent.capital;
  const verif = verifierSociofinancement(ent, index);
  const chances = chancesSociofinancement(ent, objectif);
  const etiquette = chances >= 0.7 ? 'bonnes' : chances >= 0.4 ? 'moyennes' : 'faibles';
  const termes = termesCapitalRisque(ent, montant);
  const conseil = cap?.conseil;

  return (
    <div className="space-y-4">
      <Carte
        titre={<Terme id="dilution">Qui possède l’entreprise?</Terme>}
        sousTitre="Chaque investisseur reçoit des actions : ta part diminue (dilution), mais le gâteau peut grossir."
      >
        <ul className="space-y-1 text-sm">
          {ent.finance.actionnaires.map((a, i) => (
            <li key={i} className="flex justify-between gap-3 border-b border-bordure py-1">
              <span>
                {a.type === 'fondateur' ? ent.proprietaire : a.nom}{' '}
                <span className="text-doux">({TYPES_ACTIONNAIRE[a.type]})</span>
              </span>
              <span className="chiffres font-semibold">{pourcentage(a.part, 1)}</span>
            </li>
          ))}
          {ent.associe && (
            <li className="flex justify-between gap-3 border-b border-bordure py-1">
              <span>
                {ent.associe.nom} <span className="text-doux">(associé)</span>
              </span>
              <span className="chiffres font-semibold">{pourcentage(ent.associe.part, 1)}</span>
            </li>
          )}
        </ul>
      </Carte>

      <div className="grid gap-4 lg:grid-cols-2">
        <Carte
          titre={<Terme id="sociofinancement">Sociofinancement</Terme>}
          sousTitre="Une campagne « tout ou rien » : tes clients te préachètent des contreparties."
        >
          {cap?.campagne ? (
            <p className="text-sm font-semibold">
              Campagne en cours : objectif de {argentRond(cap.campagne.objectif)}. Résultat dans{' '}
              {Math.max(1, cap.campagne.fin - index)} mois.
            </p>
          ) : (
            <>
              <p className="mb-2 text-sm text-doux">
                Lancement : {argentRond(SOCIO.fraisLancement)}. Durée : {SOCIO.moisCampagne} mois.
                Si l’objectif n’est pas atteint, tu ne reçois rien. Sinon, la plateforme garde{' '}
                {pourcentage(SOCIO.fraisPlateforme + SOCIO.fraisPaiement, 0)} et les contreparties
                te coûtent environ {pourcentage(SOCIO.coutContreparties, 0)} des contributions.
              </p>
              <div className="flex flex-wrap items-end gap-2 text-sm">
                <label className="flex flex-col">
                  Objectif
                  <input
                    type="number"
                    min={SOCIO.objectifMin}
                    max={SOCIO.objectifMax}
                    step={1000}
                    value={objectif}
                    onChange={(e) => setObjectif(Number(e.target.value))}
                    className={CHAMP}
                  />
                </label>
                <Bouton
                  petit
                  variante="primaire"
                  disabled={!verif.ok}
                  onClick={() => agir((e, id) => lancerSociofinancement(e, id, objectif))}
                >
                  Lancer la campagne
                </Bouton>
              </div>
              <p className="mt-2 text-sm">
                Chances de réussite estimées : <strong>{etiquette}</strong> (selon ta notoriété, ta
                satisfaction client et la taille de l’objectif par rapport à tes ventes).
              </p>
              {!verif.ok && (
                <p className="mt-1 text-sm font-semibold text-alerte">{verif.raison}</p>
              )}
            </>
          )}
          {cap && cap.historique.length > 0 && (
            <ul className="mt-3 space-y-1 text-sm">
              {cap.historique.slice(-4).map((h, i) => (
                <li key={i}>
                  Mois {h.index + 1} : objectif {argentRond(h.objectif)} →{' '}
                  {h.reussie ? `réussie, ${argentRond(h.montant)} amassés` : 'objectif non atteint'}
                </li>
              ))}
            </ul>
          )}
        </Carte>

        <Carte
          titre={<Terme id="capitalRisque">Capital de risque</Terme>}
          sousTitre="Un fonds investit gros, prend un siège au conseil et exige de la croissance."
        >
          {conseil ? (
            <p className="text-sm text-doux">
              Un fonds siège déjà à ton conseil : voir « Conseil d’administration » ci-dessous.
            </p>
          ) : (
            <>
              <p className="mb-2 text-sm text-doux">
                Pour une société par actions de plus de {argentRond(CAPITAL_RISQUE.ventesMin)} de
                ventes (ou devenue une PME). Entre {argentRond(CAPITAL_RISQUE.montantMin)} et{' '}
                {argentRond(CAPITAL_RISQUE.montantMax)}, sans dépasser{' '}
                {pourcentage(CAPITAL_RISQUE.partMax, 0)} de l’entreprise.
              </p>
              <div className="flex flex-wrap items-end gap-2 text-sm">
                <label className="flex flex-col">
                  Montant investi
                  <input
                    type="number"
                    min={CAPITAL_RISQUE.montantMin}
                    max={CAPITAL_RISQUE.montantMax}
                    step={25_000}
                    value={montant}
                    onChange={(e) => setMontant(Number(e.target.value))}
                    className={CHAMP}
                  />
                </label>
                <Bouton
                  petit
                  variante="primaire"
                  disabled={!termes.ok}
                  onClick={() => agir((e, id) => leverCapitalRisque(e, id, montant))}
                >
                  Accepter l’offre du fonds
                </Bouton>
              </div>
              <dl className="chiffres mt-2 grid grid-cols-2 gap-x-3 text-sm">
                <dt>Valeur avant la ronde</dt>
                <dd className="text-right">{argentRond(termes.valorisationAvant)}</dd>
                <dt>Valeur après la ronde</dt>
                <dd className="text-right">{argentRond(termes.valorisationApres)}</dd>
                <dt>Part du fonds</dt>
                <dd className="text-right">{pourcentage(termes.part, 1)}</dd>
                <dt>Ta part après</dt>
                <dd className="text-right">{pourcentage(termes.partFondateur, 1)}</dd>
                <dt>Frais juridiques et de diligence</dt>
                <dd className="text-right">{argentRond(termes.frais)}</dd>
              </dl>
              {!termes.ok && (
                <p className="mt-2 text-sm font-semibold text-alerte">{termes.raison}</p>
              )}
              <p className="mt-2 text-sm text-doux">
                En échange : un siège au conseil, un objectif de croissance de{' '}
                {pourcentage(CAPITAL_RISQUE.objectifCroissance, 0)} par an, aucun dividende, et la
                possibilité de forcer la vente après {CAPITAL_RISQUE.avertissementsMax}{' '}
                avertissements.
              </p>
            </>
          )}
        </Carte>
      </div>

      {conseil && (
        <Carte titre="Conseil d’administration">
          <ul className="mb-2 list-disc pl-5 text-sm">
            {conseil.sieges.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
          <p className="text-sm">
            Objectif : {pourcentage(conseil.objectifCroissance, 0)} de croissance des ventes par an
            (ventes de référence : {argentRond(conseil.ventesRef)}). Prochaine revue dans{' '}
            {Math.max(0, conseil.prochaineRevue - index)} mois. Avertissements :{' '}
            <strong>
              {conseil.avertissements} sur {CAPITAL_RISQUE.avertissementsMax}
            </strong>
            . Dividendes : interdits tant que le fonds est actionnaire.
          </p>
        </Carte>
      )}

      <Astuce>
        Le sociofinancement ne dilue personne, mais il faut livrer ce qu’on a promis. Un
        investisseur t’apporte plus d’argent et des conseils, mais tu gardes une part plus petite
        d’une entreprise (<Terme id="dilution">dilution</Terme>) et tu rends des comptes.
      </Astuce>
    </div>
  );
}

const PRENOMS_FAMILLE = ['Léa', 'Noah', 'Zoé', 'Émile', 'Chloé', 'Thomas'];

export function VueTransmission() {
  const { etat, ent } = useJeuCourant();
  const agir = useJeu((s) => s.agir);
  const [employeId, setEmployeId] = useState(ent.employes[0]?.id ?? '');
  const [prenom, setPrenom] = useState(PRENOMS_FAMILLE[0]);
  const index = Math.min(etat.moisCourant, etat.config.dureeMois - 1);
  const ev = evaluerEntreprise(ent);
  const rel = ent.releve;
  const restant = rel ? Math.max(0, rel.debut + MOIS_PREPARATION_RELEVE - index) : 0;

  return (
    <div className="space-y-4">
      <Carte
        titre="Combien vaut ton entreprise?"
        sousTitre={
          ev.suffisant
            ? 'Évaluation par le rendement (multiple du BAIIA), comme le fait un acheteur.'
            : 'Il faut au moins 6 mois d’historique pour évaluer le rendement.'
        }
      >
        <table className="w-full text-sm">
          <tbody>
            {ev.lignes.map((l) => (
              <tr key={l.libelle} className="border-b border-bordure align-top">
                <td className="py-1 pr-3">
                  <span className="font-semibold">{l.libelle}</span>
                  <span className="block text-doux">{l.explication}</span>
                </td>
                <td className="chiffres whitespace-nowrap py-1 text-right font-semibold">
                  {m(l.valeur)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Carte>

      <Carte
        titre="Préparer la relève"
        sousTitre={`Une relève a besoin de ${MOIS_PREPARATION_RELEVE} mois de préparation : plan de transmission, formation, présentation aux fournisseurs.`}
      >
        {rel ? (
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <p>
              Relève désignée : <strong>{rel.nom}</strong> (
              {rel.type === 'employe' ? 'employé de confiance' : 'famille'}).{' '}
              {restant > 0 ? `Prête dans ${restant} mois.` : 'Elle est prête à prendre la relève.'}
            </p>
            <Bouton
              petit
              variante="danger"
              onClick={() => {
                if (window.confirm('Abandonner la relève? Les honoraires déjà payés sont perdus.'))
                  agir((e, id) => annulerReleve(e, id));
              }}
            >
              Abandonner
            </Bouton>
          </div>
        ) : (
          <div className="flex flex-wrap items-end gap-4 text-sm">
            <div className="flex flex-wrap items-end gap-2">
              <label className="flex flex-col">
                Un employé de confiance
                <select
                  value={employeId}
                  onChange={(e) => setEmployeId(e.target.value)}
                  className={CHAMP}
                  disabled={ent.employes.length === 0}
                >
                  {ent.employes.map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.prenom} {x.nom}
                    </option>
                  ))}
                </select>
              </label>
              <Bouton
                petit
                disabled={!employeId}
                onClick={() =>
                  agir((e, id) => preparerReleve(e, id, { type: 'employe', employeId }))
                }
              >
                Désigner (2 500 $)
              </Bouton>
            </div>
            <div className="flex flex-wrap items-end gap-2">
              <label className="flex flex-col">
                Un membre de la famille
                <select
                  value={prenom}
                  onChange={(e) => setPrenom(e.target.value)}
                  className={CHAMP}
                >
                  {PRENOMS_FAMILLE.map((p) => (
                    <option key={p}>{p}</option>
                  ))}
                </select>
              </label>
              <Bouton
                petit
                onClick={() => agir((e, id) => preparerReleve(e, id, { type: 'famille', prenom }))}
              >
                Désigner (2 500 $)
              </Bouton>
            </div>
          </div>
        )}
      </Carte>

      <div className="grid gap-4 lg:grid-cols-3">
        {(['tiers', 'releve', 'famille'] as RouteVente[]).map((route) => {
          const o = offreVente(etat, ent, route);
          return (
            <Carte key={route} titre={ROUTES[route].nom} sousTitre={o.acheteur}>
              <p className="mb-2 text-sm text-doux">{ROUTES[route].description}</p>
              {ev.suffisant && (
                <dl className="chiffres grid grid-cols-2 gap-x-3 text-sm">
                  <dt>Prix pour toi</dt>
                  <dd className="text-right">{argentRond(o.prixProprietaire)}</dd>
                  <dt>Comptant</dt>
                  <dd className="text-right">{argentRond(o.comptant)}</dd>
                  {o.solde > 0 && (
                    <>
                      <dt>Solde ({o.moisSolde} mois)</dt>
                      <dd className="text-right">
                        {argentRond(o.solde)} ({argentRond(o.versementMensuel)}/mois)
                      </dd>
                      <dt>Solde, valeur actuelle</dt>
                      <dd className="text-right">{argentRond(o.valeurActuelleSolde)}</dd>
                    </>
                  )}
                  <dt>Frais de vente</dt>
                  <dd className="text-right">{m(-o.frais)}</dd>
                  <dt>Gain en capital</dt>
                  <dd className="text-right">{argentRond(o.gain)}</dd>
                  <dt>Exemption (1 250 000 $)</dt>
                  <dd className="text-right">{argentRond(o.exemption)}</dd>
                  <dt>Impôt</dt>
                  <dd className="text-right">{m(-o.impot)}</dd>
                  <dt className="font-bold">Net pour toi</dt>
                  <dd className="text-right font-bold">{argentRond(o.net)}</dd>
                </dl>
              )}
              {!o.disponible && (
                <p className="mt-2 text-sm font-semibold text-alerte">{o.raison}</p>
              )}
              <Bouton
                className="mt-3"
                petit
                variante="primaire"
                disabled={!o.disponible}
                onClick={() => {
                  if (
                    window.confirm(
                      `Vendre l’entreprise à ${o.acheteur}? Tu recevras ${argentRond(o.net)} net, et la partie se termine pour toi.`,
                    )
                  )
                    agir((e, id) => vendreEntreprise(e, id, route));
                }}
              >
                Vendre
              </Bouton>
            </Carte>
          );
        })}
      </div>

      <Astuce titre="Impôt sur la vente">
        Seule la moitié du gain en capital est imposable. Les actions d’une société par actions de
        petite entreprise donnent droit à une exemption cumulative de 1 250 000 $ : en entreprise
        non incorporée, tu ne l’as pas. Un solde de prix de vente vaut moins qu’un paiement comptant
        (risque et délai) : c’est la valeur actuelle qui compte.
      </Astuce>
    </div>
  );
}
