import { useState } from 'react';
import {
  PARAMETRES_MARKETING,
  TYPES_ETUDES,
  initiativesSecteur,
  personaParId,
} from '../../../data';
import type { IdTypeEtude } from '../../../engine/data-types';
import { margeErreur } from '../../../engine/etudes';
import { effetsInvestissements } from '../../../engine/immobilisations';
import { indicePrixOffre, prixReference } from '../../../engine/market';
import {
  promotionsRecentes,
  resumeCanaux,
  scoreEco,
  scoreLocal,
  totalPublicite,
} from '../../../engine/marketing';
import { lignesVente, probabiliteSucces } from '../../../engine/produits';
import {
  commanderEtude,
  coutUnitaireLigne,
  lancerProduit,
  qualiteDe,
  retirerProduit,
} from '../../../engine/simulation';
import type { Estimation, EtudeMarche } from '../../../engine/types';
import { FACTEUR_TAXES } from '../../../engine/tax';
import { argent, argentRond, decimal, moisAnnee, nombre, pourcentage } from '../../../i18n/format';
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

type Vue = 'produits' | 'promotion' | 'clientele' | 'etudes' | 'indicateurs';

const CRITERES: Record<string, string> = {
  prix: 'le prix',
  qualite: 'la qualité',
  service: 'le service rapide et aimable',
  ambiance: 'l’ambiance',
  heures: 'les heures d’ouverture',
  eco: 'l’écoresponsabilité',
  local: 'l’achat local',
};

function Barre({ valeur, libelle }: { valeur: number; libelle: string }) {
  return (
    <div className="flex items-center gap-2">
      <div
        className="h-2.5 w-28 overflow-hidden rounded-full bg-surface-2"
        role="img"
        aria-label={`${libelle} : ${pourcentage(valeur, 0)}`}
      >
        <div className="h-full bg-accent" style={{ width: `${Math.min(100, valeur * 100)}%` }} />
      </div>
      <span className="chiffres text-sm">{pourcentage(valeur, 0)}</span>
    </div>
  );
}

function est(e: Estimation | undefined, format: (x: number) => string): string {
  if (!e) return '—';
  return e.marge > 0 ? `${format(e.valeur)} ± ${format(e.marge)}` : format(e.valeur);
}

// ---------------------------------------------------------------------------
// Produits et prix
// ---------------------------------------------------------------------------

function VueProduits() {
  const { etat, ent, secteur } = useJeuCourant();
  const changer = useJeu((s) => s.changerDecisions);
  const agir = useJeu((s) => s.agir);
  const d = ent.decisions;
  const conj = etat.conjoncture;
  const qualite = qualiteDe(secteur, d.qualiteId);
  const effets = effetsInvestissements(ent, secteur);
  const lignes = lignesVente(ent, secteur);
  const recentes = promotionsRecentes(ent.marketing, etat.moisCourant);
  const etudeGroupe = ent.marketing.etudes.find((x) => x.typeId === 'groupeDiscussion');

  return (
    <div className="space-y-5">
      <Carte
        titre="Prix de vente (avant taxes)"
        sousTitre="Les prix des concurrents sont publics : tu les vois sur leurs menus."
      >
        <div className="grid gap-6 lg:grid-cols-3">
          {lignes.map((ligne) => {
            const prix = d.prix[ligne.id] ?? prixReference(ligne, conj.indicePrix);
            const ref = prixReference(ligne, conj.indicePrix);
            const fournisseurId =
              d.approvisionnement[ligne.id]?.fournisseurId ??
              secteur.fournisseursDefaut[ligne.categorieAppro];
            const cout = coutUnitaireLigne(
              ligne,
              fournisseurId,
              qualite,
              conj,
              effets.coutLignes[ligne.id] ?? 1,
            );
            const marge = prix > 0 ? (prix - cout) / prix : 0;
            return (
              <div key={ligne.id} className="space-y-2">
                <Curseur
                  libelle={ligne.nom}
                  valeur={prix}
                  min={Math.round(ref * 0.4 * 100) / 100}
                  max={Math.round(ref * 3 * 100) / 100}
                  base="valeur"
                  decimales={2}
                  format={argent}
                  terme="elasticitePrix"
                  onChange={(v) => changer({ prix: { ...d.prix, [ligne.id]: v } })}
                  aide={ligne.detail}
                />
                <dl className="chiffres grid grid-cols-2 gap-x-2 text-sm">
                  <dt className="text-doux">
                    {ent.fiscal.inscritTaxes ? 'Prix payé (TPS + TVQ)' : 'Prix payé (aucune taxe)'}
                  </dt>
                  <dd className="text-right">
                    {argent(prix * (ent.fiscal.inscritTaxes ? FACTEUR_TAXES : 1))}
                  </dd>
                  <dt className="text-doux">Prix du marché</dt>
                  <dd className="text-right">{argent(ref)}</dd>
                  <dt className="text-doux">Coût unitaire</dt>
                  <dd className="text-right">{argent(cout)}</dd>
                  <dt className="text-doux">Marge brute unitaire</dt>
                  <dd className={`text-right font-semibold ${marge < 0.5 ? 'text-alerte' : ''}`}>
                    {pourcentage(marge)}
                  </dd>
                  {secteur.lignes.some((l) => l.id === ligne.id) &&
                    etat.concurrents.map((c) => (
                      <div key={c.id} className="contents">
                        <dt className="truncate text-doux">{c.nom}</dt>
                        <dd className="text-right">{argent(c.prix[ligne.id])}</dd>
                      </div>
                    ))}
                </dl>
              </div>
            );
          })}
        </div>
      </Carte>

      <div className="grid gap-4 lg:grid-cols-2">
        <Carte titre={<Terme id="promotion">Promotion du mois (rabais sur tous les prix)</Terme>}>
          <Curseur
            libelle="Rabais promotionnel ce mois-ci"
            valeur={d.promotion}
            min={0}
            max={PARAMETRES_MARKETING.promotion.rabaisMax}
            decimales={2}
            format={(v) => pourcentage(v, 0)}
            onChange={(v) => changer({ promotion: v })}
            aide="La promotion attire des clients sensibles au prix et fait parler de toi, mais elle réduit ta marge. Elle ne dure qu’un mois."
          />
          <p
            className={`mt-2 text-sm ${recentes >= PARAMETRES_MARKETING.promotion.moisFatigue ? 'font-semibold text-alerte' : 'text-doux'}`}
          >
            {recentes} promotion{recentes > 1 ? 's' : ''} dans les 6 derniers mois.{' '}
            {recentes >= PARAMETRES_MARKETING.promotion.moisFatigue
              ? 'Tes clients commencent à attendre les rabais avant d’acheter : sans promotion, ils viennent moins.'
              : 'Au-delà de 3 promotions en 6 mois, les clients s’habituent aux rabais.'}
          </p>
        </Carte>
        <Carte titre="Produit : qualité des ingrédients">
          <ChoixCartes
            legende="Niveau de qualité"
            nom="qualite"
            valeur={d.qualiteId}
            onChange={(id) => changer({ qualiteId: id })}
            colonnes={2}
            options={secteur.qualites.map((q) => ({
              id: q.id,
              titre: q.nom,
              description: q.description,
              detail: `Coût ×${decimal(q.multiplicateurCout)} · qualité ${Math.round(q.score * 100)}/100`,
            }))}
          />
          <p className="mt-3 text-sm text-doux">
            La qualité dépend aussi de tes fournisseurs (O), de ton équipement et de la formation de
            ton équipe (R). La qualité perçue rattrape la qualité réelle en quelques mois.
          </p>
        </Carte>
      </div>

      <Carte
        titre={<Terme id="cycleVieProduit">Gamme : développer de nouveaux produits</Terme>}
        sousTitre="Le développement coûte de l’argent (recettes, essais, emballages, formation) et un nouveau produit peut ne pas trouver son public."
      >
        <ul className="grid gap-3 md:grid-cols-2">
          {secteur.nouveauxProduits.map((p) => {
            const lance = ent.marketing.produits.find((x) => x.ligneId === p.id);
            const proba = probabiliteSucces(p, qualite.score, ent.marketing.image);
            const rang = etudeGroupe?.produitsPrometteurs?.indexOf(p.id) ?? -1;
            return (
              <li key={p.id} className="rounded-lg border border-bordure p-3 text-sm">
                <p className="font-semibold">
                  {p.nom}
                  {rang === 0 && (
                    <span className="ml-2 rounded bg-succes-doux px-1.5 text-xs font-bold text-succes">
                      Le plus prometteur selon ton groupe de discussion
                    </span>
                  )}
                </p>
                <p className="text-doux">{p.description}</p>
                <p className="chiffres mt-1">
                  Développement : {argentRond(p.coutDeveloppement)} · {p.delaiMois} mois
                  {p.b2b
                    ? ''
                    : ` · prix suggéré ${argent(p.prixReference * etat.conjoncture.indicePrix)}`}
                </p>
                {!lance || lance.statut === 'retire' ? (
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <Bouton
                      petit
                      variante="primaire"
                      onClick={() => agir((e, id) => lancerProduit(e, id, p.id))}
                    >
                      Développer ({argentRond(p.coutDeveloppement)})
                    </Bouton>
                    {!p.b2b && (
                      <span className="text-doux">
                        Chance de succès estimée : {pourcentage(proba, 0)}
                      </span>
                    )}
                  </div>
                ) : lance.statut === 'developpement' ? (
                  <p className="mt-2 font-semibold text-info">
                    En développement : lancement le mois {lance.moisDisponible + 1}.
                  </p>
                ) : (
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span
                      className={`font-semibold ${lance.succes ? 'text-succes' : 'text-alerte'}`}
                    >
                      {p.b2b
                        ? 'Offert aux entreprises (V)'
                        : lance.succes
                          ? `Succès (demande ×${decimal(lance.facteur)})`
                          : `Échec commercial (demande ×${decimal(lance.facteur)})`}
                    </span>
                    <Bouton
                      petit
                      variante="danger"
                      onClick={() => agir((e, id) => retirerProduit(e, id, p.id))}
                    >
                      Retirer de la gamme
                    </Bouton>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </Carte>

      <Astuce titre="Stratégies de prix">
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <strong>Écrémage</strong> : prix élevés pour une clientèle qui valorise la qualité.
            Exige une image et une qualité à la hauteur.
          </li>
          <li>
            <strong>Pénétration</strong> : prix bas pour gagner des clients vite. Réduit la marge et
            peut déclencher une guerre de prix.
          </li>
          <li>
            <strong>Alignement</strong> : prix proches du marché; on se distingue par autre chose
            (service, ambiance, écoresponsabilité).
          </li>
        </ul>
        <p className="mt-2">
          Une <Terme id="imageMarque">image de marque</Terme> forte rend tes clients moins sensibles
          au prix : c’est ce qui permet aux commerces réputés de vendre plus cher.
        </p>
      </Astuce>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Promotion : canaux
// ---------------------------------------------------------------------------

function VuePromotion() {
  const { ent, secteur, derniere } = useJeuCourant();
  const changer = useJeu((s) => s.changerDecisions);
  const d = ent.decisions;
  const heuresMarketing = ent.employes
    .filter((e) => e.posteId === 'marketeur')
    .reduce((a, e) => a + e.heuresSemaine, 0);
  const bonus = 0.25 * Math.min(1, heuresMarketing / 15);
  const canaux = resumeCanaux(secteur, d.publicite, bonus);
  const total = totalPublicite(d.publicite);
  const ventes = derniere?.indicateurs.chiffreAffaires ?? 0;
  const fid = PARAMETRES_MARKETING.fidelite;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Indicateur
          libelle="Budget du mois"
          valeur={argentRond(total)}
          detail={ventes > 0 ? `${pourcentage(total / ventes)} des ventes` : undefined}
        />
        <Indicateur
          libelle="Notoriété"
          valeur={pourcentage(ent.clientele.notoriete, 0)}
          terme="notoriete"
        />
        <Indicateur
          libelle="Coût d’acquisition (CAC)"
          valeur={
            derniere && derniere.indicateurs.nouveauxClients > 0
              ? argent(derniere.indicateurs.cac)
              : '—'
          }
          terme="cac"
        />
        <Indicateur
          libelle="Responsable marketing"
          valeur={bonus > 0 ? `+${pourcentage(bonus, 0)}` : 'aucun'}
          detail="efficacité des canaux"
        />
      </div>

      <Carte
        titre="Canaux de promotion"
        sousTitre="Chaque canal a un coût par mille impressions (CPM), une audience, un taux de conversion et un délai d’effet. Diversifier est souvent plus efficace que tout mettre au même endroit (rendements décroissants)."
      >
        <ul className="grid gap-5 lg:grid-cols-2">
          {canaux.map(({ canal, budget, impressions, portee, gainMoyen }) => {
            const cibles = Object.entries(canal.affinites)
              .filter(([, v]) => v >= 1.25)
              .map(([k]) => personaParId(k).nom.toLowerCase());
            const sousMin = budget > 0 && budget < canal.budgetMinimum;
            const efficacite = secteur.canaux?.[canal.id] ?? 1;
            return (
              <li key={canal.id} className="space-y-1 rounded-lg border border-bordure p-3">
                <Curseur
                  libelle={canal.nom}
                  valeur={budget}
                  min={0}
                  max={15_000}
                  decimales={0}
                  format={argentRond}
                  terme="cpm"
                  onChange={(v) =>
                    changer({ publicite: { ...d.publicite, [canal.id]: Math.round(v / 10) * 10 } })
                  }
                  aide={canal.description}
                />
                <p className="chiffres text-xs text-doux">
                  CPM {argent(canal.cpm)} · achat minimal {argentRond(canal.budgetMinimum)}
                  {canal.delaiMois > 0 ? ` · effet dans ${canal.delaiMois} mois` : ''}
                  {canal.dureeEffetMois > 1
                    ? ` · effet réparti sur ${canal.dureeEffetMois} mois`
                    : ''}
                  {cibles.length > 0 ? ` · surtout : ${cibles.join(', ')}` : ''}
                  {efficacite >= 1.25
                    ? ' · très efficace dans ton secteur'
                    : efficacite <= 0.7
                      ? ' · peu efficace dans ton secteur'
                      : ''}
                </p>
                {budget > 0 && (
                  <p className={`chiffres text-sm ${sousMin ? 'font-semibold text-danger' : ''}`}>
                    {sousMin
                      ? `Sous l’achat minimal : aucun effet.`
                      : `${nombre(impressions)} impressions · portée ${pourcentage(portee, 0)} de l’audience · notoriété +${decimal(gainMoyen * 100, 1)} pts (avant oubli)`}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      </Carte>

      <Carte titre={<Terme id="programmeFidelite">Programme de fidélité</Terme>}>
        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            className="mt-1"
            checked={d.programmeFidelite}
            onChange={(e) => changer({ programmeFidelite: e.target.checked })}
          />
          <span>
            Offrir une carte de fidélité numérique : {pourcentage(fid.rabais, 0)} en récompenses aux
            membres et {argentRond(fid.coutLogicielMensuel)} par mois de logiciel. Les membres
            reviennent plus souvent et restent fidèles plus longtemps.
          </span>
        </label>
        <p className="chiffres mt-2 text-sm text-doux">
          Membres : {pourcentage(ent.marketing.adhesionFidelite, 0)} de la clientèle (maximum
          d’environ {pourcentage(fid.adhesionMax, 0)}).
        </p>
      </Carte>

      <Astuce>
        La <Terme id="portee">portée</Terme> mesure combien de personnes voient ton message assez
        souvent pour s’en souvenir; la <Terme id="tauxConversion">conversion</Terme>, combien
        d’entre elles deviennent des clients potentiels. Un CPM bas ne veut pas dire un canal
        rentable : la radio rejoint beaucoup de gens qui habitent loin de ton commerce.
      </Astuce>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Clientèle : personas, écoresponsabilité, livraison
// ---------------------------------------------------------------------------

function VueClientele() {
  const { ent, secteur, derniere } = useJeuCourant();
  const changer = useJeu((s) => s.changerDecisions);
  const d = ent.decisions;
  const servies = derniere?.indicateurs.serviesSegments ?? {};
  const totalServies = Object.values(servies).reduce((a, x) => a + x, 0);

  return (
    <div className="space-y-5">
      <Carte
        titre={<Terme id="segmentation">Tes segments de clientèle (personas)</Terme>}
        sousTitre="Chaque persona a ses propres sensibilités. La notoriété se mesure par segment : un canal qui plaît aux étudiants ne rejoint pas forcément les retraités."
      >
        <ul className="grid gap-3 md:grid-cols-2">
          {secteur.segments.map((s) => {
            const p = personaParId(s.personaId);
            const top = Object.entries(p.sensibilites)
              .map(([k, v]) => ({
                k,
                v: v * (secteur.sensibilites[k as keyof typeof secteur.sensibilites] ?? 0),
              }))
              .sort((a, b) => b.v - a.v)
              .slice(0, 2)
              .map((x) => CRITERES[x.k]);
            return (
              <li key={p.id} className="space-y-1 rounded-lg border border-bordure p-3 text-sm">
                <p className="font-semibold">
                  {p.nom}{' '}
                  <span className="font-normal text-doux">
                    ({pourcentage(s.part, 0)} du marché)
                  </span>
                </p>
                <p className="text-doux">{p.description}</p>
                <p>Ce qui compte le plus : {top.join(' et ')}.</p>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                  <span>Notoriété</span>
                  <Barre
                    valeur={ent.marketing.notorieteSegments[p.id] ?? 0}
                    libelle={`Notoriété auprès des ${p.nom.toLowerCase()}`}
                  />
                </div>
                {totalServies > 0 && (
                  <p className="chiffres text-doux">
                    Clients servis le mois dernier : {nombre(servies[p.id] ?? 0)} (
                    {pourcentage((servies[p.id] ?? 0) / totalServies, 0)})
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      </Carte>

      <div className="grid gap-4 lg:grid-cols-2">
        <Carte
          titre={<Terme id="ecoresponsabilite">Écoresponsabilité et achat local</Terme>}
          sousTitre={`Écoresponsabilité perçue : ${pourcentage(scoreEco(d), 0)} · achat local : ${pourcentage(scoreLocal(d, secteur), 0)}`}
        >
          <fieldset className="space-y-2 text-sm">
            <legend className="mb-1 font-semibold">Initiatives</legend>
            {initiativesSecteur(secteur).map((i) => (
              <label key={i.id} className="flex items-start gap-2">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={d.initiativesEco.includes(i.id)}
                  onChange={(e) =>
                    changer({
                      initiativesEco: e.target.checked
                        ? [...d.initiativesEco, i.id]
                        : d.initiativesEco.filter((x) => x !== i.id),
                    })
                  }
                />
                <span>
                  <strong>{i.nom}</strong> — {i.description}
                  {i.coutInitial > 0 &&
                    ent.marketing.initiativesPayees.includes(i.id) &&
                    ' (déjà payée)'}
                </span>
              </label>
            ))}
            <label className="flex items-start gap-2">
              <input
                type="checkbox"
                className="mt-1"
                checked={d.panierBleu}
                onChange={(e) => changer({ panierBleu: e.target.checked })}
              />
              <span>
                <strong>Inscription au répertoire de l’achat local (Panier Bleu)</strong> —
                gratuite; l’achat local dépend surtout de tes fournisseurs (O).
              </span>
            </label>
          </fieldset>
        </Carte>

        {secteur.partLivraison <= 0 ? (
          <Carte titre={<Terme id="distribution">Place : distribution</Terme>}>
            <p className="text-sm">
              {ent.emplacementId === 'enLigne'
                ? 'Ton canal de distribution est ton site Web : les commandes sont expédiées par la poste ou par messagerie. Les frais d’expédition réduisent ta marge sur chaque commande.'
                : ent.emplacementId === 'industriel'
                  ? 'Tes clients te trouvent surtout par la publicité, le bouche-à-oreille et le Web : ton local n’attire presque pas de passants.'
                  : 'Tes clients viennent sur place. Il n’existe pas de plateforme de livraison importante dans ce secteur; un site Web (Finance) peut ajouter la commande en ligne.'}
            </p>
          </Carte>
        ) : (
          <Carte titre={<Terme id="distribution">Place : livraison par une plateforme</Terme>}>
            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                className="mt-1"
                checked={d.livraison}
                onChange={(e) => changer({ livraison: e.target.checked })}
              />
              <span>
                Offrir mes produits sur une plateforme de livraison. Tu rejoins les clients qui
                commandent de chez eux, mais la plateforme garde{' '}
                {pourcentage(PARAMETRES_MARKETING.livraison.commission, 0)} de chaque vente et les
                commandes occupent ton personnel.
              </span>
            </label>
            {derniere && derniere.indicateurs.ventesLivraison > 0 && (
              <p className="chiffres mt-2 text-sm">
                Ventes livrées le mois dernier : {argentRond(derniere.indicateurs.ventesLivraison)}{' '}
                (commission d’environ{' '}
                {argentRond(
                  derniere.indicateurs.ventesLivraison * PARAMETRES_MARKETING.livraison.commission,
                )}
                )
              </p>
            )}
            <p className="mt-2 text-sm text-doux">
              La commande en ligne pour emporter (site Web) est un investissement (Finance) : pas de
              commission, mais un coût de départ.
            </p>
          </Carte>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Études de marché
// ---------------------------------------------------------------------------

function ResultatEtude({ etude }: { etude: EtudeMarche }) {
  const { etat, ent, secteur } = useJeuCourant();
  const type = TYPES_ETUDES.find((t) => t.id === etude.typeId);
  const lignes = [...secteur.lignes, ...secteur.nouveauxProduits];
  const nomLigne = (id: string) => lignes.find((l) => l.id === id)?.nom ?? id;
  return (
    <article className="space-y-2 rounded-lg border border-bordure p-3 text-sm">
      <h4 className="font-bold">
        {type?.nom}{' '}
        <span className="font-normal text-doux">— {moisAnnee(etude.annee, etude.mois)}</span>
      </h4>
      {etude.potentiel && (
        <p>
          Taille du marché : {est(etude.potentiel, nombre)} visites par mois dans ta zone (moyenne
          annuelle).
        </p>
      )}
      {etude.partsSegments && (
        <p>
          Profil des clients :{' '}
          {Object.entries(etude.partsSegments)
            .map(([k, v]) => `${personaParId(k).nom} ${pourcentage(v, 0)}`)
            .join(' · ')}
        </p>
      )}
      {etude.notoriete && (
        <div>
          <p>
            Notoriété globale : <strong>{est(etude.notoriete, (x) => pourcentage(x, 0))}</strong>
          </p>
          <ul className="chiffres mt-1 grid grid-cols-2 gap-x-3">
            {Object.entries(etude.notorieteSegments ?? {}).map(([k, v]) => (
              <li key={k}>
                {personaParId(k).nom} : {est(v, (x) => pourcentage(x, 0))}
              </li>
            ))}
          </ul>
        </div>
      )}
      {etude.satisfaction && (
        <p>Clients satisfaits : {est(etude.satisfaction, (x) => pourcentage(x, 0))}</p>
      )}
      {etude.prixAcceptable && (
        <ul className="chiffres">
          {Object.entries(etude.prixAcceptable).map(([k, v]) => (
            <li key={k}>
              Prix jugé acceptable pour {nomLigne(k).toLowerCase()} : {est(v, argent)} (ton prix :{' '}
              {argent(ent.decisions.prix[k] ?? 0)})
            </li>
          ))}
        </ul>
      )}
      {etude.criteres && (
        <ul>
          {Object.entries(etude.criteres).map(([k, v]) => (
            <li key={k}>
              <strong>{personaParId(k).nom}</strong> : « Ce qui compte pour moi, c’est{' '}
              {v
                .slice(0, 3)
                .map((c) => CRITERES[c])
                .join(', puis ')}
              . »
            </li>
          ))}
        </ul>
      )}
      {etude.perception && (
        <p>
          Perception de ton commerce : qualité {Math.round(etude.perception.qualite * 100)}/100,
          service {Math.round(etude.perception.service * 100)}/100, ambiance{' '}
          {Math.round(etude.perception.ambiance * 100)}/100, prix jugés{' '}
          {etude.perception.prix > 1.08
            ? 'élevés'
            : etude.perception.prix < 0.93
              ? 'bas'
              : 'dans la moyenne'}
          .
        </p>
      )}
      {etude.produitsPrometteurs && etude.produitsPrometteurs.length > 0 && (
        <p>
          Nouveaux produits qui intéressent le plus les participants :{' '}
          {etude.produitsPrometteurs.map(nomLigne).join(', puis ')}.
        </p>
      )}
      {etude.concurrents && (
        <table className="chiffres w-full">
          <thead>
            <tr className="text-left text-doux">
              <th className="font-semibold">Concurrent</th>
              <th className="text-right font-semibold">Part de marché</th>
              <th className="text-right font-semibold">Publicité/mois</th>
              <th className="text-right font-semibold">Ventes/mois</th>
            </tr>
          </thead>
          <tbody>
            {etude.concurrents.map((c) => (
              <tr key={c.id}>
                <td>{etat.concurrents.find((x) => x.id === c.id)?.nom ?? c.id}</td>
                <td className="text-right">{est(c.part, (x) => pourcentage(x, 1))}</td>
                <td className="text-right">{argentRond(c.budgetPublicite)}</td>
                <td className="text-right">{argentRond(c.ventesMensuelles)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {etude.taille && (
        <p className="text-xs text-doux">
          Échantillon de {etude.taille} répondants : marge d’erreur d’environ ±
          {pourcentage(margeErreur(0.5, etude.taille), 1)} (19 fois sur 20).
        </p>
      )}
    </article>
  );
}

function VueEtudes() {
  const { ent } = useJeuCourant();
  const agir = useJeu((s) => s.agir);
  return (
    <div className="space-y-5">
      <Carte
        titre={<Terme id="etudeMarche">Commander une étude de marché</Terme>}
        sousTitre="Sans étude, tu ne connais que l’information publique. Plus l’échantillon est grand, plus la marge d’erreur est petite… et plus l’étude coûte cher."
      >
        <ul className="grid gap-3 md:grid-cols-2">
          {TYPES_ETUDES.map((t) => (
            <li
              key={t.id}
              className="flex flex-col gap-2 rounded-lg border border-bordure p-3 text-sm"
            >
              <p className="font-semibold">{t.nom}</p>
              <p className="text-doux">{t.description}</p>
              <div className="mt-auto flex flex-wrap items-center gap-2">
                <Bouton
                  petit
                  variante="primaire"
                  onClick={() => agir((e, id) => commanderEtude(e, id, t.id as IdTypeEtude))}
                >
                  Commander ({argentRond(t.cout)})
                </Bouton>
                {t.taille && (
                  <span className="chiffres text-doux">
                    marge d’erreur ±{pourcentage(margeErreur(0.5, t.taille), 1)}
                  </span>
                )}
              </div>
            </li>
          ))}
        </ul>
      </Carte>
      {ent.marketing.etudes.length > 0 ? (
        <div className="space-y-3">
          <h3 className="font-bold">Résultats (du plus récent au plus ancien)</h3>
          {ent.marketing.etudes.map((e) => (
            <ResultatEtude key={e.id} etude={e} />
          ))}
        </div>
      ) : (
        <p className="text-sm text-doux">Aucune étude commandée pour l’instant.</p>
      )}
      <Astuce titre="Échantillon et marge d’erreur">
        On interroge un <Terme id="echantillon">échantillon</Terme> plutôt que tous les clients. La{' '}
        <Terme id="margeErreur">marge d’erreur</Terme> d’une proportion vaut environ 1,96 × √(p × (1
        − p) / n) : avec 100 répondants, ±9,8 points; avec 400, ±4,9 points. Quadrupler
        l’échantillon ne réduit la marge d’erreur que de moitié. Un groupe de discussion donne des
        idées, mais il n’est pas représentatif.
      </Astuce>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Indicateurs marketing
// ---------------------------------------------------------------------------

function VueIndicateurs() {
  const { ent } = useJeuCourant();
  const derniers = ent.archives.slice(-6);
  const i = derniers.at(-1)?.indicateurs;
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Indicateur
          libelle="Net Promoter Score"
          valeur={i ? String(i.nps) : '—'}
          terme="nps"
          detail="de −100 à +100"
        />
        <Indicateur
          libelle="Rétention mensuelle"
          valeur={i ? pourcentage(i.retention, 0) : '—'}
          terme="retention"
        />
        <Indicateur
          libelle="Valeur à vie d’un client"
          valeur={i ? argentRond(i.clv) : '—'}
          terme="clv"
        />
        <Indicateur
          libelle="Coût d’acquisition"
          valeur={i && i.nouveauxClients > 0 ? argent(i.cac) : '—'}
          terme="cac"
        />
        <Indicateur
          libelle="Clients actifs"
          valeur={i ? nombre(i.clientsActifs) : '—'}
          detail={i ? `${nombre(i.nouveauxClients)} nouveaux` : undefined}
        />
        <Indicateur
          libelle="Image de marque"
          valeur={`${Math.round(ent.marketing.image * 100)}/100`}
          terme="imageMarque"
        />
        <Indicateur
          libelle="Note en ligne"
          valeur={ent.clientele.nbAvis > 0 ? `${decimal(ent.clientele.note, 1)} ★` : '—'}
          detail={`${nombre(ent.clientele.nbAvis)} avis`}
          terme="avisEnLigne"
        />
        <Indicateur
          libelle="Notoriété"
          valeur={pourcentage(ent.clientele.notoriete, 0)}
          terme="notoriete"
        />
      </div>
      {derniers.length > 0 && (
        <Carte titre="Évolution des 6 derniers mois">
          <div
            tabIndex={0}
            role="region"
            aria-label="Tableau (défilement horizontal possible)"
            className="overflow-x-auto"
          >
            <table className="chiffres w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-bordure text-left text-doux">
                  <th className="py-1 font-semibold">Mois</th>
                  <th className="py-1 text-right font-semibold">Publicité</th>
                  <th className="py-1 text-right font-semibold">Nouveaux clients</th>
                  <th className="py-1 text-right font-semibold">CAC</th>
                  <th className="py-1 text-right font-semibold">CLV</th>
                  <th className="py-1 text-right font-semibold">Rétention</th>
                  <th className="py-1 text-right font-semibold">NPS</th>
                </tr>
              </thead>
              <tbody>
                {derniers.map((a) => (
                  <tr key={a.index} className="border-b border-bordure/60">
                    <td className="py-1">{moisAnnee(a.annee, a.mois)}</td>
                    <td className="py-1 text-right">
                      {argentRond(a.indicateurs.depensesMarketing)}
                    </td>
                    <td className="py-1 text-right">{nombre(a.indicateurs.nouveauxClients)}</td>
                    <td className="py-1 text-right">
                      {a.indicateurs.nouveauxClients > 0 ? argent(a.indicateurs.cac) : '—'}
                    </td>
                    <td className="py-1 text-right">{argentRond(a.indicateurs.clv)}</td>
                    <td className="py-1 text-right">{pourcentage(a.indicateurs.retention, 0)}</td>
                    <td className="py-1 text-right">{a.indicateurs.nps}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Carte>
      )}
      <Astuce>
        Un client vaut ce qu’il rapporte pendant toute sa relation avec toi : la{' '}
        <Terme id="clv">valeur à vie</Terme> (marge mensuelle ÷ (1 − rétention)). Tant que le{' '}
        <Terme id="cac">coût d’acquisition</Terme> reste bien sous la valeur à vie, ta publicité est
        rentable. Le <Terme id="nps">NPS</Terme> mesure la part de clients prêts à te recommander
        moins celle des détracteurs.
      </Astuce>
    </div>
  );
}

export function PageMarketing() {
  const { etat, ent, secteur } = useJeuCourant();
  const [vue, setVue] = useState<Vue>('produits');
  const ip = indicePrixOffre(ent.decisions.prix, secteur, etat.conjoncture.indicePrix);
  return (
    <div className="space-y-5">
      <TitrePage titre="Marketing" touche="M">
        Les 4P (produit, prix, place, promotion), tes segments de clientèle et les études de marché.
        Indice de prix actuel : {decimal(ip)} (1,00 = prix du marché).
      </TitrePage>
      <SousOnglets
        libelle="Sections du marketing"
        actif={vue}
        onChange={setVue}
        onglets={[
          { id: 'produits', nom: 'Produits et prix' },
          { id: 'promotion', nom: 'Promotion' },
          { id: 'clientele', nom: 'Clientèle et place' },
          { id: 'etudes', nom: 'Études de marché' },
          { id: 'indicateurs', nom: 'Indicateurs' },
        ]}
      >
        {vue === 'produits' && <VueProduits />}
        {vue === 'promotion' && <VuePromotion />}
        {vue === 'clientele' && <VueClientele />}
        {vue === 'etudes' && <VueEtudes />}
        {vue === 'indicateurs' && <VueIndicateurs />}
      </SousOnglets>
    </div>
  );
}
