/**
 * Outil d'équilibrage (pas un vrai test) : affiche les résultats de quelques stratégies.
 * Lancer avec : CALIBRATION=1 npx vitest run tests/calibration.test.ts --silent=false
 * Options : SECTEURS=cafe,atelier (secteurs à jouer), STRATEGIES=1 (stratégies variées du café),
 * VILLES=1 (gestionnaire actif dans les 8 villes), PARTIES=10 (nombre de graines).
 */
import { describe, it } from 'vitest';
import { SECTEURS, VILLES, dilemmeParId, posteParId, secteurParId } from '../src/data';
import { etatsFinanciers } from '../src/engine/rapports';
import {
  augmentationGenerale,
  congedier,
  embaucher,
  lancerProduit,
  modifierDecisions,
  repondreDilemme,
  simulerMois,
  soumettre,
} from '../src/engine/simulation';
import type { Decisions, EtatPartie } from '../src/engine/types';
import { configScenario, creerPartie, rapportFinPartie, SCENARIOS } from '../src/engine/simulation';
import { demarrageSecteur, nouvellePartie } from './helpers';

const actif = process.env.CALIBRATION === '1';
const N = Number(process.env.PARTIES ?? 10);

/**
 * Gestion de base du personnel : embaucher si des clients sont perdus (service) ou si la
 * production déborde; réduire l'équipe quand elle est sous-utilisée (saison creuse). Les
 * événements sont tranchés avec le choix par défaut.
 */
function gererPersonnel(etat: EtatPartie, idx = 0): EtatPartie {
  const ent = etat.entreprises[idx];
  if (ent.enFaillite || ent.vente) return etat;
  const i = ent.archives.at(-1)?.indicateurs;
  if (!i || etat.terminee) return etat;
  const secteur = secteurParId(etat.config.secteurId);
  const service = secteur.postes.find((p) => posteParId(p).role === 'service');
  const production = secteur.postes.find((p) => posteParId(p).role === 'production');
  let e = etat;
  for (const d of ent.dilemmes)
    e = repondreDilemme(e, ent.id, d.id, dilemmeParId(d.defId).choixParDefaut);
  const de = (poste?: string) => e.entreprises[idx].employes.filter((x) => x.posteId === poste);
  if (service && i.demande > 0 && i.perduesCapacite / i.demande > 0.02) {
    const n = i.perduesCapacite / i.demande > 0.15 ? 2 : 1;
    for (let k = 0; k < n; k++) e = embaucher(e, ent.id, undefined, service);
    return e;
  }
  if (production && i.demandeProduction > i.capaciteProduction * 1.03 && i.perduesProduction > 0) {
    // Embaucher assez de personnel pour combler l'écart (jusqu'à 4 à la fois en haute saison).
    const parEmploye = posteParId(production).heuresSemaineDefaut * 4.33 * 0.9;
    const n = Math.min(4, Math.ceil((i.demandeProduction - i.capaciteProduction) / parEmploye));
    for (let k = 0; k < n; k++) e = embaucher(e, ent.id, undefined, production);
    return e;
  }
  if (production && i.demandeProduction < 0.6 * i.capaciteProduction && de(production).length > 1) {
    // Saison creuse : mises à pied (jusqu'à 2 à la fois).
    e = congedier(e, ent.id, de(production)[0].id);
    if (i.demandeProduction < 0.4 * i.capaciteProduction && de(production).length > 1)
      e = congedier(e, ent.id, de(production)[0].id);
    return e;
  }
  if (service && i.utilisation < 0.5 && de(service).length > 1)
    return congedier(e, ent.id, de(service)[0].id);
  return e;
}

interface Strategie {
  nom: string;
  decisions: Partial<Decisions>;
  multPrix: number;
  gerer: boolean;
  /** Action supplémentaire appliquée chaque mois. */
  chaqueMois?: (e: EtatPartie, index: number) => EtatPartie;
}

function jouer(graine: number, s: Strategie, secteurId = 'cafe', villeId = 'montreal'): EtatPartie {
  let etat = nouvellePartie(graine, 36, secteurId, villeId);
  const id = etat.entreprises[0].id;
  const prix: Record<string, number> = {};
  for (const l of secteurParId(secteurId).lignes) prix[l.id] = l.prixReference * s.multPrix;
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

function resume(nom: string, parties: EtatPartie[], details: boolean): string {
  const lignes: string[] = [];
  let total = 0;
  let faillites = 0;
  for (const [g, etat] of parties.entries()) {
    const ent = etat.entreprises[0];
    if (ent.enFaillite) faillites++;
    total += etatsFinanciers(ent, { type: 'cumul' }).resultats.beneficeNet;
    if (g === 0 && details) {
      for (const a of ent.archives.filter((x) => x.index % 6 === 5 || x.index < 2)) {
        const i = a.indicateurs;
        lignes.push(
          `  m${a.index + 1}: CA ${Math.round(i.chiffreAffaires)} BN ${Math.round(i.beneficeNet)} part ${(i.partMarche * 100).toFixed(1)}% notor ${(i.notoriete * 100).toFixed(0)}% servies ${i.servies} perdues ${i.perduesCapacite}/${i.perduesRupture}/${i.perduesProduction} prod ${i.capaciteProduction}/${i.demandeProduction}h util ${(i.utilisation * 100).toFixed(0)}% MB ${(i.tauxMargeBrute * 100).toFixed(1)}% MO ${(i.tauxMainOeuvre * 100).toFixed(1)}% encaisse ${Math.round(i.encaisse)} marge ${Math.round(i.margeCreditUtilisee)} emp ${i.nbEmployes}`,
        );
      }
      lignes.push(
        '  ' +
          etat.concurrents
            .map(
              (x) =>
                `${x.surnom} [${x.statut}] part ${(x.partMarche * 100).toFixed(1)}% CA ${x.ventesMois} profit ${x.profitMois} tréso ${x.tresorerie}`,
            )
            .join(' | '),
      );
    }
  }
  return `\n=== ${nom} : BN cumulé moyen ${Math.round(total / parties.length)} $, faillites ${faillites}/${parties.length}\n${lignes.join('\n')}`;
}

const ACTIF: Strategie = { nom: 'actif', decisions: {}, multPrix: 1, gerer: true };
const PASSIF: Strategie = { nom: 'aucune gestion', decisions: {}, multPrix: 1, gerer: false };

describe.runIf(actif)('calibration', () => {
  it('gestionnaire actif dans chaque secteur (Montréal)', () => {
    const choisis = process.env.SECTEURS?.split(',') ?? SECTEURS.map((s) => s.id);
    for (const secteurId of choisis) {
      const parties = Array.from({ length: N }, (_, g) => jouer(g + 1, ACTIF, secteurId));
      console.log(resume(`${secteurId} – gestionnaire actif`, parties, true));
      const sans = Array.from({ length: N }, (_, g) => jouer(g + 1, PASSIF, secteurId));
      console.log(resume(`${secteurId} – aucune gestion`, sans, false));
    }
  });

  it.runIf(process.env.VILLES === '1')('gestionnaire actif dans chaque ville', () => {
    const choisis = process.env.SECTEURS?.split(',') ?? ['cafe'];
    for (const secteurId of choisis)
      for (const ville of VILLES) {
        const parties = Array.from({ length: N }, (_, g) =>
          jouer(g + 1, ACTIF, secteurId, ville.id),
        );
        console.log(resume(`${secteurId} à ${ville.nom}`, parties, false));
      }
  });

  it.runIf(process.env.STRATEGIES === '1')('stratégies variées (café)', () => {
    const strategies: Strategie[] = [
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
          return x;
        },
      },
    ];
    for (const s of strategies) {
      const parties = Array.from({ length: N }, (_, g) => jouer(g + 1, s));
      console.log(resume(s.nom, parties, false));
    }
  });
});

/** Joue une partie où chaque équipe suit la stratégie du gestionnaire actif. */
function jouerEquipes(etat0: EtatPartie): EtatPartie {
  let etat = etat0;
  while (!etat.terminee) {
    etat = simulerMois(etat);
    for (let k = 0; k < etat.entreprises.length; k++) etat = gererPersonnel(etat, k);
  }
  return etat;
}

describe.runIf(process.env.EQUIPES === '1')('calibration du mode équipes', () => {
  it('2 à 4 équipes sur le même marché', () => {
    const choisis = process.env.SECTEURS?.split(',') ?? ['cafe', 'vetements'];
    for (const secteurId of choisis)
      for (const n of [1, 2, 3, 4]) {
        let total = 0;
        let faillites = 0;
        let concurrentsFermes = 0;
        for (let g = 1; g <= N; g++) {
          const params = Array.from({ length: n }, (_, k) => ({
            ...demarrageSecteur(secteurId),
            nomEntreprise: `Équipe ${k + 1}`,
          }));
          const config = { ...nouvellePartie(g, 36, secteurId).config };
          const etat = jouerEquipes(creerPartie(config, params));
          for (const ent of etat.entreprises) {
            total += etatsFinanciers(ent, { type: 'cumul' }).resultats.beneficeNet;
            if (ent.enFaillite) faillites++;
          }
          concurrentsFermes += etat.concurrents.filter(
            (c) => c.statut === 'faillite' || c.statut === 'rachete',
          ).length;
        }
        console.log(
          `${secteurId} – ${n} équipe(s) : BN moyen par équipe ${Math.round(total / (N * n))} $, faillites ${faillites}/${N * n}, concurrents fermés ${(concurrentsFermes / N).toFixed(1)} par partie`,
        );
      }
  });
});

describe.runIf(process.env.SCENARIOS === '1')('calibration des scénarios', () => {
  it('objectifs atteints par le gestionnaire actif', () => {
    for (const sc of SCENARIOS) {
      const atteints = sc.objectifs.map(() => 0);
      let notes = 0;
      const valeurs: string[] = [];
      for (let g = 1; g <= N; g++) {
        const etat = jouerEquipes(
          creerPartie(configScenario(sc, g), demarrageSecteur(sc.secteurId)),
        );
        const r = rapportFinPartie(etat, etat.entreprises[0]);
        r.scenario?.objectifs.forEach((o, k) => (atteints[k] += o.atteint ? 1 : 0));
        if (g <= 3)
          valeurs.push(
            r.scenario?.objectifs.map((o) => Math.round(o.valeur * 100) / 100).join('/') ?? '',
          );
        notes += r.note;
      }
      console.log(
        `${sc.id} : ${sc.objectifs.map((o, k) => `${o.type} ${atteints[k]}/${N}`).join(', ')} · note moyenne ${Math.round(notes / N)} · valeurs ${valeurs.join(' | ')}`,
      );
    }
  });
});
