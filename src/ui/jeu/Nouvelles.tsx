/**
 * Nouvelles du mois : conjoncture économique, marché du travail de la région, saison qui
 * vient et nouvelles des concurrents (étape 1 de chaque tour : lire les nouvelles).
 */
import { chomageVille, PHASES } from '../../engine/economy';
import { decimal, moisAnnee, pourcentage } from '../../i18n/format';
import { PHASES_TEXTE } from '../../i18n/messages-jalon4';
import { texteMessage } from '../../i18n/fr-CA';
import { Carte } from '../composants/Carte';
import { Terme } from '../composants/Terme';
import { useJeuCourant } from './contexte';

const CODES_NOUVELLES = [
  'phaseEconomique',
  'tauxDirecteurHausse',
  'tauxDirecteurBaisse',
  'hausseSalaireMinimum',
  'concurrentArrive',
  'concurrentFaillite',
  'concurrentRachete',
  'concurrentPrix',
  'concurrentPublicite',
  'concurrentQualite',
  'concurrentCopie',
];

/** Comment se présente la saison du mois qui vient pour le secteur. */
function saison(indice: number): string {
  if (indice >= 1.15) return 'très forte';
  if (indice >= 1.04) return 'forte';
  if (indice > 0.96) return 'normale';
  if (indice > 0.85) return 'creuse';
  return 'très creuse';
}

export function CarteNouvelles() {
  const { etat, secteur, ville, derniere, date } = useJeuCourant();
  const conj = etat.conjoncture;
  const phase = conj.phase ?? 'stable';
  const nouvelles = (derniere?.messages ?? []).filter((m) => CODES_NOUVELLES.includes(m.code));
  const actifs = etat.concurrents.filter((c) => c.actif).length;
  const indiceSaison = secteur.saisonnalite[date.mois - 1];
  const ton =
    phase === 'recession'
      ? 'text-danger'
      : phase === 'ralentissement'
        ? 'text-alerte'
        : 'text-succes';
  return (
    <Carte titre={`Nouvelles de ${moisAnnee(date.annee, date.mois)}`}>
      <div className="grid gap-4 text-sm md:grid-cols-2">
        <div className="space-y-1">
          <p>
            <Terme id="cycleEconomique">Conjoncture</Terme> :{' '}
            <strong className={ton}>{PHASES_TEXTE[phase]?.nom ?? phase}</strong>
          </p>
          <p className="text-doux">{PHASES_TEXTE[phase]?.explication}</p>
          <dl className="chiffres grid grid-cols-[1fr_auto] gap-x-3">
            <dt>
              <Terme id="tauxChomage">Chômage</Terme> ({ville.region})
            </dt>
            <dd className="text-right">{pourcentage(chomageVille(ville.chomage, conj), 1)}</dd>
            <dt>
              <Terme id="inflation">Inflation</Terme> annuelle
            </dt>
            <dd className="text-right">{pourcentage(conj.inflationAnnuelle, 1)}</dd>
            <dt>
              <Terme id="tauxDirecteur">Taux directeur</Terme>
            </dt>
            <dd className="text-right">{pourcentage(conj.tauxDirecteur, 2)}</dd>
            <dt>Confiance des consommateurs</dt>
            <dd className="text-right">
              {decimal((conj.confiance / PHASES.stable.confiance) * 100, 0)}
            </dd>
          </dl>
        </div>
        <div className="space-y-1">
          <p>
            <Terme id="saisonnalite">Saison</Terme> du mois qui vient pour {secteur.commerce} :{' '}
            <strong>{saison(indiceSaison)}</strong>
          </p>
          <p>
            Concurrents en activité : <strong>{actifs}</strong>
          </p>
          {nouvelles.length > 0 ? (
            <ul className="list-disc space-y-1 pl-5">
              {nouvelles.map((m, k) => (
                <li key={`${m.code}-${k}`}>{texteMessage(m).titre}</li>
              ))}
            </ul>
          ) : (
            <p className="text-doux">Rien de nouveau du côté des concurrents et de l’économie.</p>
          )}
        </div>
      </div>
    </Carte>
  );
}
