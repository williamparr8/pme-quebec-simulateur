/**
 * Outil d'équilibrage (pas un vrai test) : affiche les résultats de quelques stratégies.
 * Lancer avec : CALIBRATION=1 npx vitest run tests/calibration.test.ts --silent=false
 */
import { describe, it } from 'vitest';
import { secteurParId } from '../src/data';
import { etatsFinanciers } from '../src/engine/rapports';
import {
  augmentationGenerale,
  congedier,
  embaucher,
  lancerProduit,
  modifierDecisions,
  simulerMois,
  soumettre,
} from '../src/engine/simulation';
import type { Decisions, EtatPartie } from '../src/engine/types';
import { nouvellePartie } from './helpers';

const actif = process.env.CALIBRATION === '1';

/** Gestion de base du personnel : embaucher si des clients sont perdus, réduire si sous-utilisé. */
function gererPersonnel(etat: EtatPartie): EtatPartie {
  const ent = etat.entreprises[0];
  const i = ent.archives.at(-1)?.indicateurs;
  if (!i) return etat;
  if (i.demande > 0 && i.perduesCapacite / i.demande > 0.02) return embaucher(etat, ent.id, 28);
  if (i.perduesCuisine > 50 && !ent.employes.some((e) => e.posteId === 'cuisinier'))
    return embaucher(etat, ent.id, 32, 'cuisinier');
  const baristas = ent.employes.filter((e) => e.posteId === 'barista');
  if (i.utilisation < 0.6 && baristas.length > 2) return congedier(etat, ent.id, baristas[0].id);
  return etat;
}

interface Strategie {
  nom: string;
  decisions: Partial<Decisions>;
  multPrix: number;
  gerer: boolean;
  /** Action supplémentaire appliquée chaque mois. */
  chaqueMois?: (e: EtatPartie, index: number) => EtatPartie;
}

function jouer(graine: number, s: Strategie): EtatPartie {
  let etat = nouvellePartie(graine, 36);
  const id = etat.entreprises[0].id;
  const prix: Record<string, number> = {};
  for (const l of secteurParId('cafe').lignes) prix[l.id] = l.prixReference * s.multPrix;
  etat = modifierDecisions(etat, id, { prix, ...s.decisions });
  while (!etat.terminee) {
    if (s.chaqueMois) etat = s.chaqueMois(etat, etat.moisCourant);
    etat = simulerMois(etat);
    if (s.gerer) etat = gererPersonnel(etat);
  }
  return etat;
}

const pub = (total: number) => ({
  meta: total * 0.45,
  google: total * 0.25,
  journal: total * 0.15,
  flyers: total * 0.15,
});

describe.runIf(actif)('calibration', () => {
  it('affiche les résultats', () => {
    const strategies: Strategie[] = [
      { nom: 'Défaut (aucune gestion)', decisions: {}, multPrix: 1, gerer: false },
      { nom: 'Gestionnaire actif', decisions: {}, multPrix: 1, gerer: true },
      { nom: 'Actif, prix +15 %', decisions: {}, multPrix: 1.15, gerer: true },
      { nom: 'Actif, prix −15 %', decisions: {}, multPrix: 0.85, gerer: true },
      {
        nom: 'Actif, qualité supérieure +8 %',
        decisions: { qualiteId: 'superieure' },
        multPrix: 1.08,
        gerer: true,
      },
      {
        nom: 'Actif, économique −10 %',
        decisions: { qualiteId: 'economique' },
        multPrix: 0.9,
        gerer: true,
      },
      { nom: 'Actif, sans pub', decisions: { publicite: {} }, multPrix: 1, gerer: true },
      { nom: 'Actif, pub 5000', decisions: { publicite: pub(5000) }, multPrix: 1, gerer: true },
      {
        nom: 'Actif, salaires +10 %',
        decisions: {},
        multPrix: 1,
        gerer: true,
        chaqueMois: (e, i) => (i === 0 ? augmentationGenerale(e, e.entreprises[0].id, 0.1) : e),
      },
      {
        nom: 'Actif, fidélité seule',
        decisions: { programmeFidelite: true },
        multPrix: 1,
        gerer: true,
      },
      { nom: 'Actif, livraison seule', decisions: { livraison: true }, multPrix: 1, gerer: true },
      {
        nom: 'Actif, éco (emballages + compost) + Panier Bleu',
        decisions: { initiativesEco: ['emballages', 'compost'], panierBleu: true },
        multPrix: 1,
        gerer: true,
      },
      {
        nom: 'Actif, fidélité + livraison + éco',
        decisions: {
          programmeFidelite: true,
          livraison: true,
          initiativesEco: ['emballages', 'compost'],
          panierBleu: true,
        },
        multPrix: 1,
        gerer: true,
      },
      {
        nom: 'Actif, promotions tous les mois (20 %)',
        decisions: {},
        multPrix: 1,
        gerer: true,
        chaqueMois: (e) => modifierDecisions(e, e.entreprises[0].id, { promotion: 0.2 }),
      },
      {
        nom: 'Actif, traiteur B2B (soumissions au prix cible)',
        decisions: {},
        multPrix: 1,
        gerer: true,
        chaqueMois: (e, i) => {
          const id = e.entreprises[0].id;
          let x = i === 2 ? lancerProduit(e, id, 'traiteur') : e;
          for (const a of x.entreprises[0].b2b.appels) x = soumettre(x, id, a.id, a.prixCible);
          if (i === 3) x = embaucher(x, id, 32, 'cuisinier');
          return x;
        },
      },
    ];
    for (const s of strategies) {
      const lignes: string[] = [];
      let total = 0;
      let faillites = 0;
      for (let g = 1; g <= 10; g++) {
        const etat = jouer(g, s);
        const ent = etat.entreprises[0];
        if (ent.enFaillite) faillites++;
        total += etatsFinanciers(ent, { type: 'cumul' }).resultats.beneficeNet;
        if (g === 1) {
          for (const a of ent.archives.filter((x) => x.index % 6 === 5 || x.index < 3)) {
            const i = a.indicateurs;
            lignes.push(
              `  m${a.index + 1}: CA ${Math.round(i.chiffreAffaires)} (liv ${Math.round(i.ventesLivraison)} b2b ${Math.round(i.ventesB2B)}) BN ${Math.round(i.beneficeNet)} part ${(i.partMarche * 100).toFixed(1)}% notor ${(i.notoriete * 100).toFixed(0)}% note ${i.note.toFixed(2)} sat ${(i.satisfaction * 100).toFixed(0)} NPS ${i.nps} visites/j ${Math.round(i.servies / 30)} perdues ${i.perduesCapacite}/${i.perduesRupture}/${i.perduesCuisine} util ${(i.utilisation * 100).toFixed(0)}% MB ${(i.tauxMargeBrute * 100).toFixed(1)}% MO ${(i.tauxMainOeuvre * 100).toFixed(1)}% encaisse ${Math.round(i.encaisse)} marge ${Math.round(i.margeCreditUtilisee)} moral ${Math.round(i.moral)} emp ${i.nbEmployes} déf ${(i.tauxDefauts * 100).toFixed(1)}% CAC ${Math.round(i.cac)} CLV ${Math.round(i.clv)}`,
            );
          }
          const pertes = ent.archives.reduce(
            (x, a) => x + (a.mouvements.pertesStocks ?? 0) / 100,
            0,
          );
          lignes.push(`  pertes de stocks cumulées ${Math.round(pertes)} $`);
          const c = etat.concurrents.map(
            (x) =>
              `${x.surnom}: part ${(x.partMarche * 100).toFixed(1)}% CA ${x.ventesMois} profit ${x.profitMois} tréso ${x.tresorerie} notor ${(x.notoriete * 100).toFixed(0)}% note ${x.note.toFixed(2)}`,
          );
          lignes.push('  ' + c.join(' | '));
        }
      }
      console.log(
        `\n=== ${s.nom} : BN cumulé moyen ${Math.round(total / 10)} $, faillites ${faillites}/10\n${lignes.join('\n')}`,
      );
    }
  });
});
