/**
 * Équilibrage : des stratégies automatiques jouent dans les mêmes mondes (même secteur, même
 * ville, même difficulté, même graine). On vérifie qu'aucune stratégie unique ne gagne
 * toujours et qu'une bonne gestion est récompensée.
 *
 * Version complète (1 000 parties, quelques minutes) :
 *   EQUILIBRAGE=1 npx vitest run tests/equilibrage.test.ts --silent=false
 * Options : PARTIES=1000 (nombre total de parties), DUREE=36.
 */
import { describe, expect, it } from 'vitest';
import { SECTEURS, VILLES, initiativesSecteur, secteurParId } from '../src/data';
import { publiciteParDefaut } from '../src/engine/marketing';
import {
  augmentationGenerale,
  modifierDecisions,
  rapportFinPartie,
  simulerMois,
} from '../src/engine/simulation';
import type { Decisions, Difficulte, DureePartie, EtatPartie } from '../src/engine/types';
import { configTest, creerPartieTest, gererPersonnel } from './helpers';

interface Strategie {
  id: string;
  nom: string;
  /** Décisions de départ (selon le secteur). */
  decisions: (e: EtatPartie) => Partial<Decisions>;
  multPrix: number;
  gerer: boolean;
  hausseSalaires?: number;
}

const STRATEGIES: Strategie[] = [
  { id: 'passif', nom: 'Aucune gestion', decisions: () => ({}), multPrix: 1, gerer: false },
  { id: 'actif', nom: 'Gestion du personnel', decisions: () => ({}), multPrix: 1, gerer: true },
  { id: 'prixBas', nom: 'Prix bas (−15 %)', decisions: () => ({}), multPrix: 0.85, gerer: true },
  {
    id: 'prixHaut',
    nom: 'Prix élevés (+15 %)',
    decisions: () => ({}),
    multPrix: 1.15,
    gerer: true,
  },
  {
    id: 'qualite',
    nom: 'Qualité supérieure (+8 %)',
    decisions: () => ({ qualiteId: 'superieure' }),
    multPrix: 1.08,
    gerer: true,
  },
  {
    id: 'publicite',
    nom: 'Publicité doublée',
    decisions: (e) => {
      const pub = publiciteParDefaut(secteurParId(e.config.secteurId));
      return { publicite: Object.fromEntries(Object.entries(pub).map(([k, v]) => [k, v * 2])) };
    },
    multPrix: 1,
    gerer: true,
  },
  {
    id: 'fidelisation',
    nom: 'Fidélité et écoresponsabilité',
    decisions: (e) => ({
      programmeFidelite: true,
      initiativesEco: initiativesSecteur(secteurParId(e.config.secteurId)).map((i) => i.id),
    }),
    multPrix: 1,
    gerer: true,
  },
  {
    id: 'equipe',
    nom: 'Salaires +10 %',
    decisions: () => ({}),
    multPrix: 1,
    gerer: true,
    hausseSalaires: 0.1,
  },
  {
    id: 'complete',
    nom: 'Gestion complète (qualité, fidélité, salaires +5 %)',
    decisions: (e) => ({
      qualiteId: 'superieure',
      programmeFidelite: true,
      initiativesEco: initiativesSecteur(secteurParId(e.config.secteurId)).map((i) => i.id),
    }),
    multPrix: 1.08,
    gerer: true,
    hausseSalaires: 0.05,
  },
];

const DIFFICULTES: Difficulte[] = ['facile', 'realiste', 'expert'];

/** Monde n : secteur, ville et difficulté varient d'un monde à l'autre. */
function monde(n: number, duree: DureePartie): EtatPartie {
  const secteurId = SECTEURS[n % SECTEURS.length].id;
  const villeId = VILLES[(n * 3) % VILLES.length].id;
  return creerPartieTest({
    ...configTest(n + 1, duree, secteurId),
    villeId,
    difficulte: DIFFICULTES[Math.floor(n / SECTEURS.length) % DIFFICULTES.length],
  });
}

interface Resultat {
  note: number;
  benefice: number;
  faillite: boolean;
}

function jouer(depart: EtatPartie, s: Strategie): Resultat {
  const id = depart.entreprises[0].id;
  const prix: Record<string, number> = {};
  for (const l of secteurParId(depart.config.secteurId).lignes)
    prix[l.id] = l.prixReference * s.multPrix;
  let etat = modifierDecisions(depart, id, { prix, ...s.decisions(depart) });
  if (s.hausseSalaires) etat = augmentationGenerale(etat, id, s.hausseSalaires);
  while (!etat.terminee) {
    etat = simulerMois(etat);
    if (s.gerer) etat = gererPersonnel(etat);
  }
  const r = rapportFinPartie(etat, etat.entreprises[0]);
  return {
    note: r.note,
    benefice: r.bilan.beneficeCumule,
    faillite: etat.entreprises[0].enFaillite,
  };
}

interface Bilan {
  note: number;
  benefice: number;
  faillites: number;
  victoires: number;
  parties: number;
}

function equilibrer(mondes: number, duree: DureePartie): Map<string, Bilan> {
  const bilans = new Map<string, Bilan>(
    STRATEGIES.map((s) => [s.id, { note: 0, benefice: 0, faillites: 0, victoires: 0, parties: 0 }]),
  );
  for (let n = 0; n < mondes; n++) {
    const depart = monde(n, duree);
    const resultats = STRATEGIES.map((s) => ({ s, r: jouer(depart, s) }));
    const meilleure = resultats.reduce((a, b) => (b.r.note > a.r.note ? b : a));
    for (const { s, r } of resultats) {
      const b = bilans.get(s.id) as Bilan;
      b.note += r.note;
      b.benefice += r.benefice;
      b.faillites += r.faillite ? 1 : 0;
      b.parties += 1;
    }
    (bilans.get(meilleure.s.id) as Bilan).victoires += 1;
  }
  return bilans;
}

describe('équilibrage', () => {
  it('une gestion active fait mieux que l’absence de gestion', () => {
    const bilans = equilibrer(3, 24);
    const passif = bilans.get('passif') as Bilan;
    const actif = bilans.get('actif') as Bilan;
    expect(actif.note).toBeGreaterThan(passif.note);
  }, 120_000);

  it.runIf(process.env.EQUILIBRAGE === '1')(
    '1 000 parties : aucune stratégie ne gagne toujours',
    () => {
      const total = Number(process.env.PARTIES ?? 1000);
      const duree = Number(process.env.DUREE ?? 36) as DureePartie;
      const mondes = Math.ceil(total / STRATEGIES.length);
      const debut = Date.now();
      const bilans = equilibrer(mondes, duree);
      const lignes = STRATEGIES.map((s) => {
        const b = bilans.get(s.id) as Bilan;
        return `| ${s.nom} | ${(b.note / b.parties).toFixed(1)} | ${Math.round(b.benefice / b.parties)} $ | ${b.faillites}/${b.parties} | ${b.victoires} (${((100 * b.victoires) / mondes).toFixed(0)} %) |`;
      });
      console.log(
        `\n${mondes * STRATEGIES.length} parties de ${duree} mois en ${Math.round((Date.now() - debut) / 1000)} s\n| Stratégie | Note moyenne | Bénéfice cumulé moyen | Faillites | Victoires |\n|---|---|---|---|---|\n${lignes.join('\n')}`,
      );
      const victoiresMax = Math.max(...[...bilans.values()].map((b) => b.victoires));
      expect(victoiresMax / mondes).toBeLessThan(0.5);
      const note = (id: string) => (bilans.get(id) as Bilan).note;
      expect(note('actif')).toBeGreaterThan(note('passif'));
      expect(note('complete')).toBeGreaterThan(note('passif'));
    },
    3_600_000,
  );
});
