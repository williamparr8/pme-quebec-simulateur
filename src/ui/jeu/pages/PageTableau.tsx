import { lazy, Suspense } from 'react';
import { SceneCommerce } from '../../../scene/SceneCommerce';
import { argentRond, decimal, moisAnnee, nombre, pourcentage } from '../../../i18n/format';
import { useJeu } from '../../../store/jeu';
import { Astuce, Carte } from '../../composants/Carte';
import { Indicateur, type Ton } from '../../composants/Indicateur';
import { ListeMessages } from '../../composants/ListeMessages';
import { Terme } from '../../composants/Terme';
import { TitrePage } from '../../composants/TitrePage';
import { useJeuCourant, variation } from '../contexte';

const GraphiqueVentesBenefice = lazy(() =>
  import('../../graphiques/Graphiques').then((m) => ({ default: m.GraphiqueVentesBenefice })),
);
const GraphiqueEncaisse = lazy(() =>
  import('../../graphiques/Graphiques').then((m) => ({ default: m.GraphiqueEncaisse })),
);
const GraphiquePartsMarche = lazy(() =>
  import('../../graphiques/Graphiques').then((m) => ({ default: m.GraphiquePartsMarche })),
);

function Chargement() {
  return (
    <div
      className="h-72 animate-pulse rounded-xl border border-bordure bg-surface-2"
      aria-label="Chargement du graphique"
    />
  );
}

export function PageTableau() {
  const { etat, ent, derniere, precedente, date } = useJeuCourant();
  const changerOnglet = useJeu((s) => s.changerOnglet);
  const i = derniere?.indicateurs;
  const p = precedente?.indicateurs;
  const encaisse = ent.livre.soldes.encaisse / 100;

  const tonMoral: Ton =
    !i || i.nbEmployes === 0
      ? 'neutre'
      : i.moral < 45
        ? 'danger'
        : i.moral < 60
          ? 'alerte'
          : 'succes';
  const tonSatisfaction: Ton = !i
    ? 'neutre'
    : i.satisfaction < 0.5
      ? 'danger'
      : i.satisfaction < 0.65
        ? 'alerte'
        : 'succes';

  return (
    <div className="space-y-5">
      <TitrePage titre="Tableau de bord" touche="T">
        {derniere
          ? `Résultats de ${moisAnnee(derniere.annee, derniere.mois)}. Prépare maintenant tes décisions pour ${moisAnnee(date.annee, date.mois)}.`
          : `Bienvenue! Prépare tes décisions pour ton premier mois, ${moisAnnee(date.annee, date.mois)}, puis termine le mois.`}
      </TitrePage>

      <SceneCommerce
        nom={ent.nom}
        couleur={ent.couleur}
        mois={date.mois}
        clientsParJour={i ? i.servies / 30 : 25}
        nbEmployes={ent.employes.length}
        concurrents={etat.concurrents.map((c) => ({ nom: c.nom, couleur: c.couleur }))}
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Indicateur
          libelle="Encaisse"
          valeur={argentRond(encaisse)}
          ton={encaisse < 0 ? 'danger' : encaisse < 3000 ? 'alerte' : 'neutre'}
          terme="encaisse"
        />
        <Indicateur
          libelle="Ventes du mois"
          valeur={i ? argentRond(i.chiffreAffaires) : '—'}
          variation={variation(i?.chiffreAffaires, p?.chiffreAffaires)}
        />
        <Indicateur
          libelle="Bénéfice net du mois"
          valeur={i ? argentRond(i.beneficeNet) : '—'}
          ton={!i ? 'neutre' : i.beneficeNet < 0 ? 'danger' : 'succes'}
          terme="etatResultats"
        />
        <Indicateur
          libelle="Part de marché"
          valeur={i ? pourcentage(i.partMarche) : '—'}
          variation={variation(i?.partMarche, p?.partMarche)}
          terme="partMarche"
        />
        <Indicateur
          libelle="Clients servis par jour"
          valeur={i ? nombre(i.servies / 30) : '—'}
          detail={
            i && i.perduesCapacite + i.perduesRupture > 0
              ? `${nombre((i.perduesCapacite + i.perduesRupture) / 30)} perdus/jour`
              : undefined
          }
          variation={variation(i?.servies, p?.servies)}
        />
        <Indicateur
          libelle="Note en ligne"
          valeur={i && i.nbAvis > 0 ? `${decimal(i.note, 1)} ★` : '—'}
          detail={i ? `${nombre(i.nbAvis)} avis` : undefined}
          terme="avisEnLigne"
        />
        <Indicateur
          libelle="Satisfaction des clients"
          valeur={i ? pourcentage(i.satisfaction, 0) : '—'}
          ton={tonSatisfaction}
          terme="satisfaction"
        />
        <Indicateur
          libelle="Moral de l’équipe"
          valeur={i && i.nbEmployes > 0 ? `${nombre(i.moral)}/100` : '—'}
          ton={tonMoral}
          detail={`${ent.employes.length} employé${ent.employes.length > 1 ? 's' : ''}`}
          terme="moral"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_1.2fr]">
        <Carte
          titre={
            derniere
              ? `Rapport de ${moisAnnee(derniere.annee, derniere.mois)}`
              : 'Avant de commencer'
          }
        >
          {derniere ? (
            <ListeMessages messages={derniere.messages} max={6} />
          ) : (
            <div className="space-y-3 text-sm">
              <p>Quelques vérifications avant ton premier mois :</p>
              <ol className="list-decimal space-y-1 pl-5">
                <li>
                  <button
                    type="button"
                    className="font-semibold text-accent underline"
                    onClick={() => changerOnglet('marketing')}
                  >
                    Marketing (M)
                  </button>{' '}
                  : tes prix, ta qualité et ton budget de publicité d’ouverture.
                </li>
                <li>
                  <button
                    type="button"
                    className="font-semibold text-accent underline"
                    onClick={() => changerOnglet('rh')}
                  >
                    Ressources humaines (R)
                  </button>{' '}
                  : ton équipe de départ, les salaires et tes propres heures.
                </li>
                <li>
                  <button
                    type="button"
                    className="font-semibold text-accent underline"
                    onClick={() => changerOnglet('operations')}
                  >
                    Opérations (O)
                  </button>{' '}
                  : tes heures d’ouverture et ton stock.
                </li>
                <li>
                  <button
                    type="button"
                    className="font-semibold text-accent underline"
                    onClick={() => changerOnglet('finance')}
                  >
                    Finance (F)
                  </button>{' '}
                  : ton bilan d’ouverture et tes prélèvements pour vivre.
                </li>
              </ol>
              <Astuce>
                Les premiers mois d’un commerce sont presque toujours déficitaires. Ce qui fait
                faillir une jeune entreprise, ce n’est pas une perte : c’est le manque d’
                <Terme id="encaisse">encaisse</Terme>.
              </Astuce>
            </div>
          )}
        </Carte>
        {ent.archives.length >= 2 ? (
          <Suspense fallback={<Chargement />}>
            <GraphiqueVentesBenefice archives={ent.archives} />
          </Suspense>
        ) : (
          <Carte titre="Graphiques">
            <p className="text-sm text-doux">
              Les graphiques apparaîtront après deux mois d’activité.
            </p>
          </Carte>
        )}
      </div>

      {ent.archives.length >= 2 && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Suspense fallback={<Chargement />}>
            <GraphiqueEncaisse archives={ent.archives} />
          </Suspense>
          <Suspense fallback={<Chargement />}>
            <GraphiquePartsMarche
              archives={ent.archives}
              nomJoueur={ent.nom}
              concurrents={etat.concurrents.map((c) => ({ id: c.id, nom: c.nom }))}
            />
          </Suspense>
        </div>
      )}
    </div>
  );
}
