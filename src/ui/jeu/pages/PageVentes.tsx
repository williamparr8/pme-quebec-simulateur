import { lazy, Suspense } from 'react';
import { indicePrixOffre } from '../../../engine/market';
import { argent, argentRond, decimal, nombre, pourcentage } from '../../../i18n/format';
import { Astuce, Carte } from '../../composants/Carte';
import { Indicateur } from '../../composants/Indicateur';
import { Terme } from '../../composants/Terme';
import { TitrePage } from '../../composants/TitrePage';
import { useJeuCourant } from '../contexte';

const GraphiquePartsMarche = lazy(() =>
  import('../../graphiques/Graphiques').then((m) => ({ default: m.GraphiquePartsMarche })),
);

/** Veille concurrentielle : sans étude de marché, la part d'un concurrent n'est connue qu'à 5 points près. */
function estimation(part: number): string {
  const arrondie = Math.round((part * 100) / 5) * 5;
  return `≈ ${arrondie} %`;
}

export function PageVentes() {
  const { etat, ent, secteur, derniere } = useJeuCourant();
  const i = derniere?.indicateurs;

  return (
    <div className="space-y-5">
      <TitrePage titre="Ventes et concurrence" touche="V">
        Qui achète quoi, combien de clients tu as servis ou perdus, et ce que tu sais de tes
        concurrents.
      </TitrePage>

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

      <Carte titre="Ventes par ligne de produits (dernier mois)">
        {i ? (
          <table className="chiffres w-full text-sm">
            <thead>
              <tr className="border-b border-bordure text-left text-doux">
                <th className="py-1 font-semibold">Ligne</th>
                <th className="py-1 text-right font-semibold">Prix</th>
                <th className="py-1 text-right font-semibold">Unités vendues</th>
                <th className="py-1 text-right font-semibold">% des clients qui en achètent</th>
                <th className="py-1 text-right font-semibold">Ventes</th>
              </tr>
            </thead>
            <tbody>
              {i.ventesParLigne.map((v) => {
                const ligne = secteur.lignes.find((l) => l.id === v.ligneId);
                return (
                  <tr key={v.ligneId} className="border-b border-bordure">
                    <td className="py-1">{ligne?.nom ?? v.ligneId}</td>
                    <td className="py-1 text-right">
                      {v.unites > 0 ? argent(v.chiffreAffaires / v.unites) : '—'}
                    </td>
                    <td className="py-1 text-right">{nombre(v.unites)}</td>
                    <td className="py-1 text-right">
                      {i.servies > 0 ? pourcentage(v.unites / i.servies, 0) : '—'}
                    </td>
                    <td className="py-1 text-right">{argentRond(v.chiffreAffaires)}</td>
                  </tr>
                );
              })}
              <tr className="font-bold">
                <td className="py-1" colSpan={4}>
                  Total
                </td>
                <td className="py-1 text-right">{argentRond(i.chiffreAffaires)}</td>
              </tr>
            </tbody>
          </table>
        ) : (
          <p className="text-sm text-doux">
            Aucune vente pour l’instant : termine ton premier mois.
          </p>
        )}
      </Carte>

      <Carte
        titre="Veille concurrentielle"
        sousTitre="Information publique seulement : prix affichés, avis en ligne, publicité visible. Les études de marché (Jalon 3) révéleront le reste."
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
                <td className="py-1 text-right">{i ? pourcentage(i.partMarche) : '—'}</td>
              </tr>
              {etat.concurrents.map((c) => (
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
                  <td className="py-1 text-right">{derniere ? estimation(c.partMarche) : '—'}</td>
                </tr>
              ))}
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
