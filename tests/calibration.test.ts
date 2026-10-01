/**
 * Outil d'équilibrage (pas un vrai test) : affiche les résultats de quelques stratégies.
 * Lancer avec : CALIBRATION=1 npx vitest run tests/calibration.test.ts --silent=false
 */
import { describe, it } from 'vitest';
import { secteurParId } from '../src/data';
import { etatsFinanciers } from '../src/engine/rapports';
import { congedier, embaucher, modifierDecisions, simulerMois } from '../src/engine/simulation';
import type { Decisions, EtatPartie } from '../src/engine/types';
import { nouvellePartie } from './helpers';

const actif = process.env.CALIBRATION === '1';

/** Gestion de base du personnel : embaucher si des clients sont perdus, réduire si sous-utilisé. */
function gererPersonnel(etat: EtatPartie): EtatPartie {
  const ent = etat.entreprises[0];
  const i = ent.archives.at(-1)?.indicateurs;
  if (!i) return etat;
  if (i.demande > 0 && i.perduesCapacite / i.demande > 0.02) return embaucher(etat, ent.id, 28);
  if (i.utilisation < 0.6 && ent.employes.length > 2)
    return congedier(etat, ent.id, ent.employes[0].id);
  return etat;
}

function jouer(
  graine: number,
  changements: Partial<Decisions>,
  multPrix: number,
  gerer: boolean,
): EtatPartie {
  let etat = nouvellePartie(graine, 36);
  const prix: Record<string, number> = {};
  for (const l of secteurParId('cafe').lignes) prix[l.id] = l.prixReference * multPrix;
  etat = modifierDecisions(etat, etat.entreprises[0].id, { prix, ...changements });
  let premier = true;
  while (!etat.terminee) {
    etat = simulerMois(etat);
    if (premier) {
      etat = modifierDecisions(etat, etat.entreprises[0].id, {
        budgetPublicite: changements.budgetPublicite ?? 1000,
      });
      premier = false;
    }
    if (gerer) etat = gererPersonnel(etat);
  }
  return etat;
}

describe.runIf(actif)('calibration', () => {
  it('affiche les résultats', () => {
    const strategies: [string, Partial<Decisions>, number, boolean][] = [
      ['Défaut (aucune gestion)', {}, 1, false],
      ['Gestionnaire actif', {}, 1, true],
      ['Actif, prix +15 %', {}, 1.15, true],
      ['Actif, prix −15 %', {}, 0.85, true],
      ['Actif, qualité supérieure +8 %', { qualiteId: 'superieure' }, 1.08, true],
      ['Actif, économique −10 %', { qualiteId: 'economique' }, 0.9, true],
      ['Actif, sans pub', { budgetPublicite: 0 }, 1, true],
      ['Actif, pub 4000', { budgetPublicite: 4000 }, 1, true],
      ['Actif, salaire 19 $', { salaireHoraire: 19 }, 1, true],
    ];
    for (const [nom, changements, multPrix, gerer] of strategies) {
      const lignes: string[] = [];
      let total = 0;
      let faillites = 0;
      for (let g = 1; g <= 10; g++) {
        const etat = jouer(g, changements, multPrix, gerer);
        const ent = etat.entreprises[0];
        if (ent.enFaillite) faillites++;
        total += etatsFinanciers(ent, { type: 'cumul' }).resultats.beneficeNet;
        if (g === 1) {
          for (const a of ent.archives.filter((x) => x.index % 6 === 5 || x.index < 3)) {
            const i = a.indicateurs;
            lignes.push(
              `  m${a.index + 1}: CA ${Math.round(i.chiffreAffaires)} BN ${Math.round(i.beneficeNet)} part ${(i.partMarche * 100).toFixed(1)}% notor ${(i.notoriete * 100).toFixed(0)}% note ${i.note.toFixed(2)} sat ${(i.satisfaction * 100).toFixed(0)} visites/j ${Math.round(i.servies / 30)} perdues ${i.perduesCapacite} util ${(i.utilisation * 100).toFixed(0)}% MB ${(i.tauxMargeBrute * 100).toFixed(1)}% MO ${(i.tauxMainOeuvre * 100).toFixed(1)}% encaisse ${Math.round(i.encaisse)} marge ${Math.round(i.margeCreditUtilisee)} moral ${Math.round(i.moral)} emp ${i.nbEmployes}`,
            );
          }
          const c = etat.concurrents.map(
            (x) =>
              `${x.surnom}: part ${(x.partMarche * 100).toFixed(1)}% CA ${x.ventesMois} profit ${x.profitMois} tréso ${x.tresorerie} notor ${(x.notoriete * 100).toFixed(0)}% note ${x.note.toFixed(2)}`,
          );
          lignes.push('  ' + c.join(' | '));
        }
      }
      console.log(
        `\n=== ${nom} : BN cumulé moyen ${Math.round(total / 10)} $, faillites ${faillites}/10\n${lignes.join('\n')}`,
      );
    }
  });
});
