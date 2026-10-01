import { lazy, Suspense, useState } from 'react';
import { personaParId } from '../../../data';
import { PONCTUALITE, RISQUE_DEFAUT, ageComptesClients } from '../../../engine/b2b';
import { indicePrixOffre } from '../../../engine/market';
import { produitActif } from '../../../engine/produits';
import { coutUnitaireLigne, qualiteDe, soumettre } from '../../../engine/simulation';
import type { AppelOffres, ReponseAvis } from '../../../engine/types';
import { argent, argentRond, decimal, nombre, pourcentage } from '../../../i18n/format';
import { useJeu } from '../../../store/jeu';
import { Bouton } from '../../composants/Bouton';
import { Astuce, Carte } from '../../composants/Carte';
import { ChoixCartes } from '../../composants/ChoixCartes';
import { Indicateur } from '../../composants/Indicateur';
import { SousOnglets } from '../../composants/SousOnglets';
import { Terme } from '../../composants/Terme';
import { TitrePage } from '../../composants/TitrePage';
import { useJeuCourant } from '../contexte';

const GraphiquePartsMarche = lazy(() =>
  import('../../graphiques/Graphiques').then((m) => ({ default: m.GraphiquePartsMarche })),
);

type Vue = 'ventes' | 'b2b' | 'service' | 'concurrence';

const TYPES_CLIENTS: Record<string, string> = {
  bureau: 'bureau',
  clinique: 'clinique',
  ecole: 'école',
  organisme: 'organisme',
  garderie: 'garderie',
  residence: 'résidence pour aînés',
};

/** Veille concurrentielle : sans étude de marché, la part d'un concurrent n'est connue qu'à 5 points près. */
function estimation(part: number): string {
  const arrondie = Math.round((part * 100) / 5) * 5;
  return `≈ ${arrondie} %`;
}

function VueVentes() {
  const { secteur, derniere } = useJeuCourant();
  const i = derniere?.indicateurs;
  const lignes = [...secteur.lignes, ...secteur.nouveauxProduits];
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Indicateur libelle="Clients (demande)" valeur={i ? nombre(i.demande) : '—'} />
        <Indicateur libelle="Clients servis" valeur={i ? nombre(i.servies) : '—'} />
        <Indicateur
          libelle="Clients perdus"
          valeur={i ? nombre(i.perduesCapacite + i.perduesRupture) : '—'}
          detail={
            i
              ? `${nombre(i.perduesCapacite)} attente · ${nombre(i.perduesRupture)} rupture`
              : undefined
          }
          ton={i && i.perduesCapacite + i.perduesRupture > 0 ? 'alerte' : 'neutre'}
        />
        <Indicateur
          libelle="Panier moyen"
          valeur={i ? argent(i.ticketMoyen) : '—'}
          terme="ticketMoyen"
        />
      </div>
      {i ? (
        <>
          <Carte titre="Ventes par canal (dernier mois)">
            <dl className="chiffres grid max-w-xl grid-cols-[1fr_auto] gap-x-3 gap-y-1 text-sm">
              <dt>En magasin (au prix courant)</dt>
              <dd className="text-right">{argentRond(i.ventesMagasin)}</dd>
              <dt>Livraison par plateforme</dt>
              <dd className="text-right">{argentRond(i.ventesLivraison)}</dd>
              <dt>Entreprises (traiteur, à crédit)</dt>
              <dd className="text-right">{argentRond(i.ventesB2B)}</dd>
              <dt>Moins : rabais, promotions et fidélité</dt>
              <dd className="text-right">({argentRond(i.rabais)})</dd>
              <dt className="font-bold">Ventes nettes</dt>
              <dd className="text-right font-bold">{argentRond(i.chiffreAffaires)}</dd>
            </dl>
          </Carte>
          <Carte titre="Ventes par ligne de produits (magasin et livraison)">
            <table className="chiffres w-full text-sm">
              <thead>
                <tr className="border-b border-bordure text-left text-doux">
                  <th className="py-1 font-semibold">Ligne</th>
                  <th className="py-1 text-right font-semibold">Prix</th>
                  <th className="py-1 text-right font-semibold">Unités vendues</th>
                  <th className="py-1 text-right font-semibold">% des clients qui en achètent</th>
                  <th className="py-1 text-right font-semibold">Ventes (prix courant)</th>
                </tr>
              </thead>
              <tbody>
                {i.ventesParLigne
                  .filter((v) => v.unites > 0 || secteur.lignes.some((l) => l.id === v.ligneId))
                  .map((v) => (
                    <tr key={v.ligneId} className="border-b border-bordure">
                      <td className="py-1">
                        {lignes.find((l) => l.id === v.ligneId)?.nom ?? v.ligneId}
                      </td>
                      <td className="py-1 text-right">
                        {v.unites > 0 ? argent(v.chiffreAffaires / v.unites) : '—'}
                      </td>
                      <td className="py-1 text-right">{nombre(v.unites)}</td>
                      <td className="py-1 text-right">
                        {i.servies > 0 ? pourcentage(v.unites / i.servies, 0) : '—'}
                      </td>
                      <td className="py-1 text-right">{argentRond(v.chiffreAffaires)}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </Carte>
          <Carte titre="Clients servis par segment">
            <ul className="chiffres grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-5">
              {Object.entries(i.serviesSegments).map(([k, v]) => (
                <li key={k} className="rounded-lg bg-surface-2 p-2">
                  <p className="text-doux">
                    {k === 'livraison' ? 'Livraison' : personaParId(k).nom}
                  </p>
                  <p className="text-lg font-bold">{nombre(v)}</p>
                </li>
              ))}
            </ul>
          </Carte>
        </>
      ) : (
        <p className="text-sm text-doux">Aucune vente pour l’instant : termine ton premier mois.</p>
      )}
    </div>
  );
}

function CarteAppel({ a }: { a: AppelOffres }) {
  const { etat, ent, secteur } = useJeuCourant();
  const agir = useJeu((s) => s.agir);
  const [prix, setPrix] = useState(a.soumission ?? 15);
  const traiteur = secteur.nouveauxProduits.find((p) => p.id === 'traiteur');
  const fournisseurId =
    ent.decisions.approvisionnement.traiteur?.fournisseurId ?? secteur.fournisseursDefaut.cuisine;
  const cout = traiteur
    ? coutUnitaireLigne(
        traiteur,
        fournisseurId,
        qualiteDe(secteur, ent.decisions.qualiteId),
        etat.conjoncture,
      )
    : 0;
  const marge = prix > 0 ? (prix - cout) / prix : 0;
  return (
    <li className="space-y-2 rounded-lg border border-bordure p-3 text-sm">
      <p className="font-semibold">
        {a.client}{' '}
        <span className="font-normal text-doux">
          ({TYPES_CLIENTS[a.typeClient] ?? a.typeClient})
        </span>
      </p>
      <p className="chiffres">
        {a.repasParMois} boîtes à lunch par mois pendant {a.dureeMois} mois · paiement à{' '}
        {a.delaiPaiementJours} jours · cote de crédit <strong>{a.cote}</strong> (paie à temps
        environ {pourcentage(PONCTUALITE[a.cote], 0)} du temps, risque de défaut{' '}
        {pourcentage(RISQUE_DEFAUT[a.cote], 1)} par mois) · {a.nbConcurrents} autre
        {a.nbConcurrents > 1 ? 's' : ''} soumissionnaire{a.nbConcurrents > 1 ? 's' : ''}
      </p>
      <div className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col text-xs">
          Prix par boîte (avant taxes)
          <input
            type="number"
            step={0.25}
            min={1}
            value={prix}
            onChange={(e) => setPrix(Number(e.target.value))}
            className="chiffres w-24 rounded-md border border-bordure bg-surface-2 px-2 py-1"
          />
        </label>
        <Bouton
          petit
          variante="primaire"
          onClick={() => agir((s, id) => soumettre(s, id, a.id, prix))}
        >
          {a.soumission === null ? 'Déposer la soumission' : 'Modifier la soumission'}
        </Bouton>
        {a.soumission !== null && (
          <Bouton petit onClick={() => agir((s, id) => soumettre(s, id, a.id, null))}>
            Retirer
          </Bouton>
        )}
      </div>
      <p className="chiffres text-xs text-doux">
        Coût des ingrédients ≈ {argent(cout)} par boîte → marge brute {pourcentage(marge, 0)} ·
        revenu potentiel {argentRond(prix * a.repasParMois * a.dureeMois)} sur la durée du contrat.
        {a.soumission !== null && ` Soumission déposée : ${argent(a.soumission)}.`}
      </p>
    </li>
  );
}

function VueB2B() {
  const { etat, ent } = useJeuCourant();
  const changerOnglet = useJeu((s) => s.changerOnglet);
  if (!produitActif(ent, 'traiteur')) {
    const enDev = ent.marketing.produits.some(
      (p) => p.ligneId === 'traiteur' && p.statut === 'developpement',
    );
    return (
      <Carte titre="Ventes aux entreprises (B2B)">
        <p className="text-sm">
          {enDev
            ? 'Ton service de traiteur est en développement : les premiers appels d’offres arriveront après son lancement.'
            : 'Pour vendre aux entreprises (boîtes à lunch, plateaux pour les réunions), développe le service de traiteur dans le département Marketing.'}
        </p>
        {!enDev && (
          <Bouton petit className="mt-2" onClick={() => changerOnglet('marketing')}>
            Aller au Marketing (M)
          </Bouton>
        )}
      </Carte>
    );
  }
  const age = ageComptesClients(ent.b2b.factures, etat.moisCourant);
  const ouvertes = ent.b2b.factures.filter((f) => f.statut === 'ouverte');
  const radiees = ent.b2b.factures.filter((f) => f.statut === 'radiee');
  const solde = ent.livre.soldes.comptesClients / 100;
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Indicateur libelle="Comptes clients" valeur={argentRond(solde)} terme="comptesClients" />
        <Indicateur
          libelle="En retard"
          valeur={argentRond(age.retard1 + age.retard2)}
          ton={age.retard1 + age.retard2 > 0 ? 'alerte' : 'neutre'}
        />
        <Indicateur libelle="Contrats en cours" valeur={nombre(ent.b2b.contrats.length)} />
        <Indicateur
          libelle="Créances radiées"
          valeur={nombre(radiees.length)}
          detail="12 derniers mois"
          terme="creancesIrrecouvrables"
          ton={radiees.length > 0 ? 'danger' : 'neutre'}
        />
      </div>
      {ent.b2b.resultats.length > 0 && (
        <Carte titre="Résultat de tes dernières soumissions">
          <ul className="text-sm">
            {ent.b2b.resultats.map((r) => (
              <li key={r.client} className={r.gagne ? 'text-succes' : 'text-doux'}>
                {r.gagne ? '✓ Contrat gagné' : '✗ Soumission perdue'} : {r.client} à{' '}
                {argent(r.prix)}
              </li>
            ))}
          </ul>
        </Carte>
      )}
      <Carte
        titre={<Terme id="appelOffres">Appels d’offres de ce mois</Terme>}
        sousTitre="Les soumissions sont évaluées à la fin du mois. Trop cher : tu perds le contrat; trop bas : tu travailles pour rien."
      >
        {ent.b2b.appels.length === 0 ? (
          <p className="text-sm text-doux">
            Aucun appel d’offres ce mois-ci. Il y en a davantage à la rentrée et avant les Fêtes.
          </p>
        ) : (
          <ul className="grid gap-3 lg:grid-cols-2">
            {ent.b2b.appels.map((a) => (
              <CarteAppel key={a.id} a={a} />
            ))}
          </ul>
        )}
      </Carte>
      <Carte titre="Contrats en cours">
        {ent.b2b.contrats.length === 0 ? (
          <p className="text-sm text-doux">Aucun contrat.</p>
        ) : (
          <table className="chiffres w-full text-sm">
            <thead>
              <tr className="border-b border-bordure text-left text-doux">
                <th className="py-1 font-semibold">Client</th>
                <th className="py-1 text-right font-semibold">Boîtes/mois</th>
                <th className="py-1 text-right font-semibold">Prix</th>
                <th className="py-1 text-right font-semibold">Mois restants</th>
                <th className="py-1 text-right font-semibold">Satisfaction</th>
              </tr>
            </thead>
            <tbody>
              {ent.b2b.contrats.map((c) => (
                <tr key={c.id} className="border-b border-bordure/60">
                  <td className="py-1">
                    {c.client} (cote {c.cote})
                  </td>
                  <td className="py-1 text-right">{c.repasParMois}</td>
                  <td className="py-1 text-right">{argent(c.prixUnitaire)}</td>
                  <td className="py-1 text-right">{c.moisRestants}</td>
                  <td className={`py-1 text-right ${c.satisfaction < 0.6 ? 'text-danger' : ''}`}>
                    {pourcentage(c.satisfaction, 0)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Carte>
      <Carte
        titre={
          <Terme id="classementChronologique">Classement chronologique des comptes clients</Terme>
        }
      >
        <dl className="chiffres grid max-w-md grid-cols-[1fr_auto] gap-x-3 text-sm">
          <dt>Pas encore échus</dt>
          <dd className="text-right">{argentRond(age.courant)}</dd>
          <dt>En retard de moins de 30 jours</dt>
          <dd className="text-right">{argentRond(age.retard1)}</dd>
          <dt>En retard de plus de 30 jours</dt>
          <dd className={`text-right ${age.retard2 > 0 ? 'font-semibold text-danger' : ''}`}>
            {argentRond(age.retard2)}
          </dd>
        </dl>
        {ouvertes.length > 0 && (
          <p className="mt-2 text-xs text-doux">
            {ouvertes.length} facture{ouvertes.length > 1 ? 's' : ''} ouverte
            {ouvertes.length > 1 ? 's' : ''}.
          </p>
        )}
      </Carte>
      <Astuce>
        Une vente à crédit est un produit dès la facturation, mais l’argent n’entre qu’au paiement :
        les comptes clients financent tes clients avec ta trésorerie. La TPS et la TVQ sont dues sur
        la facture, même avant d’être encaissées; si un client ne paie jamais, la créance est radiée
        (créance irrécouvrable) et les taxes peuvent être récupérées.
      </Astuce>
    </div>
  );
}

function VueService() {
  const { ent, derniere } = useJeuCourant();
  const changer = useJeu((s) => s.changerDecisions);
  const d = ent.decisions;
  const i = derniere?.indicateurs;
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Indicateur
          libelle="Note en ligne"
          valeur={ent.clientele.nbAvis > 0 ? `${decimal(ent.clientele.note, 1)} ★` : '—'}
          detail={`${nombre(ent.clientele.nbAvis)} avis`}
          terme="avisEnLigne"
        />
        <Indicateur
          libelle="Satisfaction"
          valeur={pourcentage(ent.clientele.satisfaction, 0)}
          terme="satisfaction"
        />
        <Indicateur libelle="NPS" valeur={i ? String(i.nps) : '—'} terme="nps" />
        <Indicateur
          libelle="Plaintes du mois"
          valeur={i ? nombre(i.plaintes) : '—'}
          detail={i ? `défauts ${pourcentage(i.tauxDefauts, 1)}` : undefined}
        />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Carte titre="Gestion des avis en ligne">
          <ChoixCartes
            legende="Que fais-tu des avis négatifs?"
            nom="avis"
            colonnes={1}
            valeur={d.reponseAvis}
            onChange={(id) => changer({ reponseAvis: id as ReponseAvis })}
            options={[
              {
                id: 'ignorer',
                titre: 'Les ignorer',
                description: 'Aucun effort, mais les lecteurs voient des plaintes sans réponse.',
              },
              {
                id: 'repondre',
                titre: 'Répondre poliment',
                description:
                  'Environ 1 h par semaine de ton temps : les avis négatifs nuisent moins à ta note.',
              },
              {
                id: 'compenser',
                titre: 'Répondre et offrir un geste',
                description:
                  'Produit gratuit ou remboursement (environ 0,8 % des ventes) : la note s’améliore davantage.',
              },
            ]}
          />
        </Carte>
        <Carte titre="Politique de retour et de satisfaction">
          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              className="mt-1"
              checked={d.satisfactionGarantie}
              onChange={(e) => changer({ satisfactionGarantie: e.target.checked })}
            />
            <span>
              <strong>Satisfaction garantie</strong> : un produit raté est remplacé sans discussion.
              Les plaintes et les mauvais avis diminuent; les produits refaits coûtent un peu plus
              cher.
            </span>
          </label>
          <p className="mt-3 text-xs text-doux">
            La Loi sur la protection du consommateur n’oblige pas un commerçant à reprendre un bien
            non défectueux, mais il doit respecter la politique qu’il affiche et les garanties
            légales.
          </p>
        </Carte>
      </div>
    </div>
  );
}

function VueConcurrence() {
  const { etat, ent, secteur, derniere } = useJeuCourant();
  const i = derniere?.indicateurs;
  const analyse = ent.marketing.etudes.find((e) => e.typeId === 'analyseConcurrence');
  return (
    <div className="space-y-5">
      <Carte
        titre="Veille concurrentielle"
        sousTitre="Information publique seulement : prix affichés, avis en ligne, publicité visible. Une analyse de la concurrence (M) révèle le reste."
      >
        <div className="overflow-x-auto">
          <table className="chiffres w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-bordure text-left text-doux">
                <th className="py-1 font-semibold">Commerce</th>
                <th className="py-1 font-semibold">Stratégie observée</th>
                <th className="py-1 text-right font-semibold">
                  <Terme id="indicePrix">Indice de prix</Terme>
                </th>
                <th className="py-1 text-right font-semibold">Note en ligne</th>
                <th className="py-1 text-right font-semibold">Livraison</th>
                <th className="py-1 text-right font-semibold">
                  <Terme id="partMarche">Part de marché</Terme>
                </th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-bordure font-semibold">
                <td className="py-1">{ent.nom} (toi)</td>
                <td className="py-1">—</td>
                <td className="py-1 text-right">
                  {decimal(
                    indicePrixOffre(ent.decisions.prix, secteur, etat.conjoncture.indicePrix),
                  )}
                </td>
                <td className="py-1 text-right">
                  {ent.clientele.nbAvis > 0 ? `${decimal(ent.clientele.note, 1)} ★` : '—'}
                </td>
                <td className="py-1 text-right">{ent.decisions.livraison ? 'oui' : 'non'}</td>
                <td className="py-1 text-right">{i ? pourcentage(i.partMarche) : '—'}</td>
              </tr>
              {etat.concurrents.map((c) => {
                const etude = analyse?.concurrents?.find((x) => x.id === c.id);
                return (
                  <tr key={c.id} className="border-b border-bordure">
                    <td className="py-1">
                      <span
                        className="mr-2 inline-block h-3 w-3 rounded-sm align-middle"
                        style={{ background: c.couleur }}
                        aria-hidden="true"
                      />
                      {c.nom}
                    </td>
                    <td className="py-1">{c.surnom}</td>
                    <td className="py-1 text-right">
                      {decimal(indicePrixOffre(c.prix, secteur, etat.conjoncture.indicePrix))}
                    </td>
                    <td className="py-1 text-right">{decimal(c.note, 1)} ★</td>
                    <td className="py-1 text-right">{c.livraison ? 'oui' : 'non'}</td>
                    <td className="py-1 text-right">
                      {etude
                        ? `${pourcentage(etude.part.valeur)} (étude)`
                        : derniere
                          ? estimation(c.partMarche)
                          : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Carte>
      {ent.archives.length >= 2 && (
        <Suspense fallback={<div className="h-72 rounded-xl border border-bordure bg-surface-2" />}>
          <GraphiquePartsMarche
            archives={ent.archives}
            nomJoueur={ent.nom}
            concurrents={etat.concurrents.map((c) => ({ id: c.id, nom: c.nom }))}
          />
        </Suspense>
      )}
      <Astuce>
        Les concurrents réagissent à tes décisions avec un délai, comme dans la vraie vie : il leur
        faut le temps de remarquer le changement, puis de décider. Une baisse de prix importante
        peut déclencher une riposte du Géant 1 ou 2 mois plus tard.
      </Astuce>
    </div>
  );
}

export function PageVentes() {
  const { ent } = useJeuCourant();
  const [vue, setVue] = useState<Vue>('ventes');
  const appelsSansReponse = ent.b2b.appels.filter((a) => a.soumission === null).length;
  return (
    <div className="space-y-5">
      <TitrePage titre="Ventes et service à la clientèle" touche="V">
        Qui achète quoi et par quel canal, tes clients d’affaires, la gestion des avis et ce que tu
        sais de tes concurrents.
      </TitrePage>
      <SousOnglets
        libelle="Sections des ventes"
        actif={vue}
        onChange={setVue}
        onglets={[
          { id: 'ventes', nom: 'Ventes' },
          { id: 'b2b', nom: 'Entreprises (B2B)', badge: appelsSansReponse },
          { id: 'service', nom: 'Service et avis' },
          { id: 'concurrence', nom: 'Concurrence' },
        ]}
      >
        {vue === 'ventes' && <VueVentes />}
        {vue === 'b2b' && <VueB2B />}
        {vue === 'service' && <VueService />}
        {vue === 'concurrence' && <VueConcurrence />}
      </SousOnglets>
    </div>
  );
}
