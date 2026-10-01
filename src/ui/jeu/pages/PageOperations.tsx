import { useState } from 'react';
import { fournisseursCategorie, fournisseurParId, posteParId } from '../../../data';
import type { LigneProduit } from '../../../engine/data-types';
import { effetsInvestissements } from '../../../engine/immobilisations';
import {
  FRAIS_PETITE_COMMANDE,
  TAUX_POSSESSION,
  politiqueRecommandee,
  unitesEnStock,
  valeurStock,
} from '../../../engine/inventory';
import { lignesStock } from '../../../engine/produits';
import { changerFournisseur, coutUnitaireLigne, qualiteDe } from '../../../engine/simulation';
import { SEMAINES_PAR_MOIS } from '../../../engine/util';
import { argent, argentRond, decimal, nombre, pourcentage } from '../../../i18n/format';
import { useJeu } from '../../../store/jeu';
import { Bouton } from '../../composants/Bouton';
import { Astuce, Carte } from '../../composants/Carte';
import { ChoixCartes } from '../../composants/ChoixCartes';
import { Curseur } from '../../composants/Curseur';
import { Indicateur } from '../../composants/Indicateur';
import { SousOnglets } from '../../composants/SousOnglets';
import { Terme } from '../../composants/Terme';
import { TitrePage } from '../../composants/TitrePage';
import { useJeuCourant } from '../contexte';

type Vue = 'capacite' | 'approvisionnement' | 'stocks';

const CONDITIONS: Record<string, string> = {
  comptant: 'payé à la livraison',
  net30: 'net 30 jours',
  '2/10 net 30': '2/10 net 30 (escompte de 2 % si payé en 10 jours)',
};

const CHAMP = 'chiffres w-24 rounded-md border border-bordure bg-surface-2 px-2 py-1';

function VueCapacite() {
  const { ent, secteur, derniere } = useJeuCourant();
  const changer = useJeu((s) => s.changerDecisions);
  const d = ent.decisions;
  const i = derniere?.indicateurs;
  const heuresService =
    ent.employes
      .filter((e) => posteParId(e.posteId).productiviteService >= 0.25)
      .reduce((a, x) => a + x.heuresSemaine, 0) + d.heuresProprietaire;
  const cuisiniers = ent.employes.filter((e) => posteParId(e.posteId).productiviteCuisine > 0);
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Indicateur
          libelle="Utilisation de la capacité"
          valeur={i ? pourcentage(i.utilisation, 0) : '—'}
          terme="utilisation"
          ton={
            !i
              ? 'neutre'
              : i.utilisation > 1
                ? 'danger'
                : i.utilisation > 0.9 || i.utilisation < 0.5
                  ? 'alerte'
                  : 'succes'
          }
        />
        <Indicateur
          libelle="Capacité de service"
          valeur={i ? `${nombre(i.capacite)} clients` : '—'}
          terme="capacite"
          detail="par mois"
        />
        <Indicateur
          libelle="Capacité de la cuisine"
          valeur={i ? `${nombre(i.capaciteCuisine)} plats` : '—'}
          detail={cuisiniers.length === 0 ? 'sans cuisinier' : 'par mois'}
          ton={i && i.perduesCuisine > 0 ? 'alerte' : 'neutre'}
        />
        <Indicateur
          libelle="Taux de défauts"
          valeur={i ? pourcentage(i.tauxDefauts, 1) : '—'}
          detail={i ? `${nombre(i.plaintes)} plaintes` : undefined}
          terme="tauxDefauts"
          ton={i && i.tauxDefauts > 0.05 ? 'alerte' : 'neutre'}
        />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Carte titre="Heures d’ouverture">
          <Curseur
            libelle="Heures d’ouverture par semaine"
            valeur={d.heuresOuverture}
            min={20}
            max={112}
            decimales={0}
            format={(v) => `${v} h`}
            onChange={(v) => changer({ heuresOuverture: v })}
            aide={`Référence du secteur : ${secteur.heuresOuvertureReference} h (7 jours × 12 h). Plus d’heures attirent plus de clients, avec des rendements décroissants.`}
          />
          <p
            className={`mt-3 text-sm ${heuresService < d.heuresOuverture ? 'font-semibold text-danger' : 'text-doux'}`}
          >
            {heuresService < d.heuresOuverture
              ? `Attention : ton personnel au comptoir ne couvre que ${heuresService} h par semaine (il faut au moins une personne sur place). Embauche ou augmente les heures (R).`
              : `Ton personnel au comptoir (${heuresService} h par semaine au total) couvre toutes les heures d’ouverture.`}
          </p>
        </Carte>
        <Carte titre={<Terme id="capacite">Comment se calcule ta capacité</Terme>}>
          <ul className="list-disc space-y-1 pl-5 text-sm">
            <li>
              Service : heures travaillées × compétence × moral ×{' '}
              {decimal(secteur.transactionsParHeureEmploye, 1)} clients par heure ×{' '}
              {decimal(SEMAINES_PAR_MOIS, 2)} semaines. L’absentéisme et le premier mois d’un nouvel
              employé la réduisent.
            </li>
            <li>
              Cuisine : un cuisinier prépare environ {secteur.unitesCuisineParHeure} plats par
              heure. Sans cuisinier, ton équipe assemble les repas lentement et la qualité baisse.
            </li>
            <li>
              Les défauts augmentent quand l’équipe est peu compétente, surchargée ou que
              l’équipement vieillit.
            </li>
          </ul>
        </Carte>
      </div>
    </div>
  );
}

function CarteLigne({ ligne }: { ligne: LigneProduit }) {
  const { etat, ent, secteur, derniere } = useJeuCourant();
  const changer = useJeu((s) => s.changerDecisions);
  const agir = useJeu((s) => s.agir);
  const d = ent.decisions;
  const politique = d.approvisionnement[ligne.id];
  const [point, setPoint] = useState(politique?.pointCommande ?? 0);
  const [quantite, setQuantite] = useState(politique?.quantite ?? 1);
  if (!politique) return null;
  const f = fournisseurParId(politique.fournisseurId);
  const qualite = qualiteDe(secteur, d.qualiteId);
  const effets = effetsInvestissements(ent, secteur);
  const cout = coutUnitaireLigne(
    ligne,
    f.id,
    qualite,
    etat.conjoncture,
    effets.coutLignes[ligne.id] ?? 1,
  );
  const conservation = f.conservationJours ?? ligne.conservationJours;
  const stock = ent.operations.stocks[ligne.id];
  const demande = stock?.demandeRecente ?? 0;
  const calc = politiqueRecommandee(
    demande,
    cout,
    f,
    conservation,
    effets.pertesStocks < 1 ? 0.6 : 1,
  );
  const rapport = derniere?.stocks.find((s) => s.ligneId === ligne.id);
  const fournisseurs = fournisseursCategorie(ligne.categorieAppro);

  const appliquer = (auto: boolean, p = point, q = quantite) =>
    changer({
      approvisionnement: {
        ...d.approvisionnement,
        [ligne.id]: {
          ...politique,
          auto,
          pointCommande: Math.max(0, Math.round(p)),
          quantite: Math.max(1, Math.round(q)),
        },
      },
    });

  return (
    <Carte
      titre={`${ligne.nom} (${ligne.unite})`}
      sousTitre={`Coût actuel : ${argent(cout)} par unité · se conserve ${conservation} jour${conservation > 1 ? 's' : ''}`}
    >
      <div className="space-y-4">
        <ChoixCartes
          legende="Fournisseur"
          nom={`fournisseur-${ligne.id}`}
          valeur={f.id}
          colonnes={3}
          onChange={(id) => agir((e, eid) => changerFournisseur(e, eid, ligne.id, id))}
          options={fournisseurs.map((x) => ({
            id: x.id,
            titre: x.nom,
            description: x.description,
            detail: `Prix ×${decimal(x.indicePrix)}${x.devise === 'USD' ? ' en $ US' : ''} · qualité ${x.bonusQualite >= 0 ? '+' : ''}${Math.round(x.bonusQualite * 100)} · délai ${x.delaiJours} j · fiabilité ${pourcentage(x.fiabilite, 0)} · ${x.local ? 'local' : 'non local'} · ${CONDITIONS[x.conditions]} · livraison ${argentRond(x.fraisCommande)} par commande${x.minimumCommande > 0 ? ` · minimum ${argentRond(x.minimumCommande)} (sinon frais de ${argentRond(FRAIS_PETITE_COMMANDE * x.minimumCommande)})` : ''}`,
          }))}
        />
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-2 text-sm">
            <label className="flex items-center gap-2 font-semibold">
              <input
                type="checkbox"
                checked={politique.auto}
                onChange={(e) => appliquer(e.target.checked)}
              />
              Calcul automatique (recalculé chaque semaine selon les ventes)
            </label>
            <div className="flex flex-wrap items-end gap-2">
              <label className="flex flex-col text-xs">
                <Terme id="pointCommande">Point de commande</Terme>
                <input
                  type="number"
                  min={0}
                  disabled={politique.auto}
                  value={politique.auto ? politique.pointCommande : point}
                  onChange={(e) => setPoint(Number(e.target.value))}
                  className={CHAMP}
                />
              </label>
              <label className="flex flex-col text-xs">
                Quantité commandée
                <input
                  type="number"
                  min={1}
                  disabled={politique.auto}
                  value={politique.auto ? politique.quantite : quantite}
                  onChange={(e) => setQuantite(Number(e.target.value))}
                  className={CHAMP}
                />
              </label>
              {!politique.auto && (
                <>
                  <Bouton petit variante="primaire" onClick={() => appliquer(false)}>
                    Appliquer
                  </Bouton>
                  <Bouton
                    petit
                    onClick={() => {
                      setPoint(calc.pointCommande);
                      setQuantite(calc.quantite);
                      appliquer(false, calc.pointCommande, calc.quantite);
                    }}
                  >
                    Utiliser la recommandation
                  </Bouton>
                </>
              )}
            </div>
          </div>
          <dl className="chiffres grid grid-cols-[1fr_auto] gap-x-3 text-sm">
            <dt className="text-doux">Demande du dernier mois</dt>
            <dd className="text-right">
              {nombre(demande)} ({decimal(calc.demandeJour, 1)} par jour)
            </dd>
            <dt className="text-doux">
              <Terme id="stockSecurite">Stock de sécurité</Terme>
            </dt>
            <dd className="text-right">{nombre(calc.stockSecurite)}</dd>
            <dt className="text-doux">Point de commande recommandé</dt>
            <dd className="text-right">{nombre(calc.pointCommande)}</dd>
            <dt className="text-doux">
              <Terme id="qec">Quantité économique (QEC)</Terme>
            </dt>
            <dd className="text-right">{nombre(calc.qec)}</dd>
            <dt className="text-doux">Maximum avant péremption</dt>
            <dd className="text-right">{nombre(calc.quantiteMaxPeremption)}</dd>
            <dt className="text-doux">Minimum du fournisseur</dt>
            <dd className="text-right">{nombre(calc.quantiteMinFournisseur)}</dd>
          </dl>
        </div>
        {rapport && (
          <p className="chiffres text-sm">
            Le mois dernier : {nombre(rapport.vendues)} vendus,{' '}
            <span className={rapport.perdues > 0 ? 'font-semibold text-danger' : ''}>
              {nombre(rapport.perdues)} ventes perdues
            </span>
            ,{' '}
            <span className={rapport.perimees > 0 ? 'font-semibold text-alerte' : ''}>
              {nombre(rapport.perimees)} périmés
            </span>
            , {nombre(rapport.refaites)} refaits · {rapport.commandes} commande
            {rapport.commandes > 1 ? 's' : ''} · stock final {nombre(rapport.stockFinUnites)} (
            {argentRond(rapport.valeurFin)})
            {stock ? ` · en stock maintenant : ${nombre(unitesEnStock(stock))}` : ''}
          </p>
        )}
      </div>
    </Carte>
  );
}

function VueApprovisionnement() {
  const { etat, ent, secteur } = useJeuCourant();
  const changer = useJeu((s) => s.changerDecisions);
  const d = ent.decisions;
  return (
    <div className="space-y-5">
      <div className="grid gap-4 lg:grid-cols-2">
        <Carte titre={<Terme id="escompte">Conditions de paiement</Terme>}>
          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              className="mt-1"
              checked={d.prendreEscomptes}
              onChange={(e) => changer({ prendreEscomptes: e.target.checked })}
            />
            <span>
              Payer en 10 jours les fournisseurs qui offrent 2/10 net 30. Renoncer à 2 % pour garder
              son argent 20 jours de plus revient à emprunter à environ 37 % par année : il vaut
              presque toujours mieux prendre l’escompte (même avec la marge de crédit).
            </span>
          </label>
        </Carte>
        <Carte titre={<Terme id="methodeInventaire">Méthode d’évaluation des stocks</Terme>}>
          <ChoixCartes
            legende="Méthode"
            nom="methode"
            colonnes={2}
            valeur={d.methodeInventaire}
            onChange={(id) => changer({ methodeInventaire: id === 'peps' ? 'peps' : 'coutMoyen' })}
            options={[
              {
                id: 'coutMoyen',
                titre: 'Coût moyen pondéré',
                description: 'Chaque unité vaut le coût moyen des achats.',
              },
              {
                id: 'peps',
                titre: 'PEPS (premier entré, premier sorti)',
                description: 'Les plus vieux coûts passent au coût des ventes en premier.',
              },
            ]}
          />
          <p className="mt-2 text-xs text-doux">
            La méthode change la valeur du stock et le coût des ventes quand les prix montent, pas
            le nombre d’unités. Par souci de permanence des méthodes, on en change rarement.
          </p>
        </Carte>
      </div>
      <p className="text-sm text-doux">
        Taux de change : 1 $ US = {decimal(etat.conjoncture.tauxChange, 3)} $ CA. Les prix des
        fournisseurs importés suivent le taux de change.
      </p>
      {lignesStock(ent, secteur).map((l) => (
        <CarteLigne key={`${l.id}-${d.approvisionnement[l.id]?.fournisseurId}`} ligne={l} />
      ))}
    </div>
  );
}

function VueStocks() {
  const { ent, secteur } = useJeuCourant();
  const d = ent.decisions;
  const lignes = lignesStock(ent, secteur);
  const total = Object.values(ent.operations.stocks).reduce(
    (a, s) => a + valeurStock(s, d.methodeInventaire),
    0,
  );
  return (
    <div className="space-y-5">
      <Carte
        titre="Stocks en main"
        sousTitre={`Valeur totale : ${argentRond(total)} (méthode : ${d.methodeInventaire === 'peps' ? 'PEPS' : 'coût moyen'})`}
      >
        <div className="overflow-x-auto">
          <table className="chiffres w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-bordure text-left text-doux">
                <th className="py-1 font-semibold">Ligne</th>
                <th className="py-1 text-right font-semibold">Unités</th>
                <th className="py-1 text-right font-semibold">Valeur</th>
                <th className="py-1 text-right font-semibold">Jours de ventes</th>
                <th className="py-1 text-right font-semibold">Lots (âge)</th>
                <th className="py-1 text-right font-semibold">En commande</th>
              </tr>
            </thead>
            <tbody>
              {lignes.map((l) => {
                const s = ent.operations.stocks[l.id];
                if (!s) return null;
                const unites = unitesEnStock(s);
                const jours = s.demandeRecente > 0 ? unites / (s.demandeRecente / 30) : 0;
                return (
                  <tr key={l.id} className="border-b border-bordure/60">
                    <td className="py-1">{l.nom}</td>
                    <td className="py-1 text-right">{nombre(unites)}</td>
                    <td className="py-1 text-right">
                      {argentRond(valeurStock(s, d.methodeInventaire))}
                    </td>
                    <td className="py-1 text-right">{decimal(jours, 1)}</td>
                    <td className="py-1 text-right">
                      {s.lots
                        .map((x) => `${nombre(x.quantite)} (péremption dans ${x.joursRestants} j)`)
                        .join(' · ') || '—'}
                    </td>
                    <td className="py-1 text-right">
                      {nombre(s.commandes.reduce((a, c) => a + c.quantite, 0))}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Carte>
      <Astuce>
        Un stock, c’est de l’argent immobilisé sur une tablette : environ{' '}
        {pourcentage(TAUX_POSSESSION, 0)} de sa valeur par année en financement, espace, assurance
        et pertes (le coût de possession). Trop peu : des <Terme id="rupture">ruptures</Terme> et
        des clients déçus. Trop : des produits périmés jetés. La{' '}
        <Terme id="qec">quantité économique</Terme> équilibre le coût de commander souvent et le
        coût de garder du stock, mais elle ignore la péremption : pour des croissants qui se gardent
        2 jours, on commande chaque jour.
      </Astuce>
    </div>
  );
}

export function PageOperations() {
  const { etat } = useJeuCourant();
  const [vue, setVue] = useState<Vue>('capacite');
  return (
    <div className="space-y-5">
      <TitrePage titre="Opérations" touche="O">
        Capacité, qualité, fournisseurs et stocks. Bien gérées, les opérations évitent de perdre des
        ventes… et de payer pour rien. Coût des fournisseurs : ×
        {decimal(etat.conjoncture.indiceCouts, 3)} depuis le début (inflation).
      </TitrePage>
      <SousOnglets
        libelle="Sections des opérations"
        actif={vue}
        onChange={setVue}
        onglets={[
          { id: 'capacite', nom: 'Capacité et qualité' },
          { id: 'approvisionnement', nom: 'Fournisseurs et commandes' },
          { id: 'stocks', nom: 'Stocks' },
        ]}
      >
        {vue === 'capacite' && <VueCapacite />}
        {vue === 'approvisionnement' && <VueApprovisionnement />}
        {vue === 'stocks' && <VueStocks />}
      </SousOnglets>
    </div>
  );
}
