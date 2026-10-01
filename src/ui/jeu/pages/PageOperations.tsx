import { tauxPerte, tauxRupture } from '../../../engine/inventory';
import { SEMAINES_PAR_MOIS } from '../../../engine/util';
import { argentRond, decimal, nombre, pourcentage } from '../../../i18n/format';
import { useJeu } from '../../../store/jeu';
import { Astuce, Carte } from '../../composants/Carte';
import { Curseur } from '../../composants/Curseur';
import { Indicateur } from '../../composants/Indicateur';
import { Terme } from '../../composants/Terme';
import { TitrePage } from '../../composants/TitrePage';
import { useJeuCourant } from '../contexte';

export function PageOperations() {
  const { etat, ent, secteur, derniere } = useJeuCourant();
  const changer = useJeu((s) => s.changerDecisions);
  const d = ent.decisions;
  const i = derniere?.indicateurs;
  const heuresPersonnel =
    ent.employes.reduce((a, x) => a + x.heuresSemaine, 0) + d.heuresProprietaire;
  const heuresCouvertes = Math.min(d.heuresOuverture, heuresPersonnel);
  const stock = ent.livre.soldes.stocks / 100;
  const rupture = tauxRupture(d.stockJoursCible);

  return (
    <div className="space-y-5">
      <TitrePage titre="Opérations" touche="O">
        Les heures d’ouverture, la capacité de service et les stocks. Bien gérées, les opérations
        évitent de perdre des ventes… et de payer pour rien.
      </TitrePage>

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
                : i.utilisation > 0.9
                  ? 'alerte'
                  : i.utilisation < 0.5
                    ? 'alerte'
                    : 'succes'
          }
        />
        <Indicateur
          libelle="Clients perdus (attente)"
          valeur={i ? nombre(i.perduesCapacite) : '—'}
          ton={i && i.perduesCapacite > 0 ? 'alerte' : 'neutre'}
        />
        <Indicateur libelle="Valeur du stock" valeur={argentRond(stock)} terme="stocks" />
        <Indicateur
          libelle="Coût des fournisseurs"
          valeur={`× ${decimal(etat.conjoncture.indiceCouts, 3)}`}
          detail="Inflation depuis le début"
          terme="inflation"
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
            className={`mt-3 text-sm ${heuresCouvertes < d.heuresOuverture ? 'font-semibold text-danger' : 'text-doux'}`}
          >
            {heuresCouvertes < d.heuresOuverture
              ? `Attention : ton personnel ne couvre que ${heuresCouvertes} h par semaine (il faut au moins une personne sur place). Embauche ou augmente les heures (R).`
              : `Ton personnel (${heuresPersonnel} h/semaine au total) couvre toutes les heures d’ouverture.`}
          </p>
          <p className="mt-2 text-sm text-doux">
            Capacité maximale : environ{' '}
            {nombre(heuresPersonnel * SEMAINES_PAR_MOIS * secteur.transactionsParHeureEmploye)}{' '}
            clients par mois ({secteur.transactionsParHeureEmploye} clients par heure travaillée, en
            moyenne sur la journée).
          </p>
        </Carte>

        <Carte titre="Gestion des stocks">
          <Curseur
            libelle="Stock cible (jours de ventes)"
            valeur={d.stockJoursCible}
            min={1}
            max={21}
            decimales={0}
            format={(v) => `${v} jour${v > 1 ? 's' : ''}`}
            terme="rupture"
            onChange={(v) => changer({ stockJoursCible: v })}
            aide="Les achats sont faits automatiquement pour garder ce stock. Les fournisseurs sont payés 30 jours plus tard."
          />
          <dl className="chiffres mt-3 grid grid-cols-2 gap-x-2 text-sm">
            <dt className="text-doux">Clients perdus par rupture</dt>
            <dd className={`text-right font-semibold ${rupture > 0 ? 'text-danger' : ''}`}>
              {pourcentage(rupture, 0)}
            </dd>
            <dt className="text-doux">Pertes (produits périmés)</dt>
            <dd className="text-right font-semibold">
              {pourcentage(tauxPerte(d.stockJoursCible))} des périssables
            </dd>
          </dl>
          <p className="mt-2 text-sm text-doux">
            Le point de commande, le stock de sécurité, la quantité économique (QEC) et le choix des
            fournisseurs arrivent au Jalon 3.
          </p>
        </Carte>
      </div>

      <Astuce>
        Un stock, c’est de l’argent immobilisé sur une tablette. Trop peu : des{' '}
        <Terme id="rupture">ruptures</Terme> et des clients déçus. Trop : des produits périmés jetés
        et de l’encaisse qui dort. Le bon niveau dépend de la durée de conservation et du délai de
        livraison.
      </Astuce>
    </div>
  );
}
