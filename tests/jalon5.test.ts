import { describe, expect, it } from 'vitest';
import { QUESTIONS_QUIZ, SCENARIOS, secteurParId, villeParId } from '../src/data';
import { totalBalance } from '../src/engine/accounting';
import {
  MAX_EQUIPES,
  choixEvenements,
  comparaisonMarche,
  configScenario,
  conseils,
  creerPartie,
  decisionsMarquantes,
  evaluerScenario,
  facteurMarcheEquipes,
  formerEmploye,
  mention,
  modifierDecisions,
  questionsQuiz,
  quizDisponible,
  rapportFinPartie,
  repondreDilemme,
  repondreQuiz,
  simulerMois,
} from '../src/engine/simulation';
import type { EtatPartie, ParametresDemarrage } from '../src/engine/types';
import { texteMessage } from '../src/i18n/fr-CA';
import { configTest, demarrageSecteur, jouerMois, nouvellePartie } from './helpers';

function partieEquipes(n: number, graine = 7): EtatPartie {
  const params: ParametresDemarrage[] = Array.from({ length: n }, (_, k) => ({
    ...demarrageSecteur('cafe'),
    nomEntreprise: `Café ${k + 1}`,
    nomEquipe: k === 0 ? 'Les Lève-tôt' : '',
  }));
  return creerPartie(configTest(graine, 12), params);
}

describe('mode équipes en alternance', () => {
  it('crée une entreprise par équipe sur le même marché', () => {
    const etat = partieEquipes(3);
    expect(etat.entreprises.map((e) => e.id)).toEqual(['joueur-1', 'joueur-2', 'joueur-3']);
    expect(etat.entreprises.map((e) => e.equipe)).toEqual(['Les Lève-tôt', 'Équipe 2', 'Équipe 3']);
    for (const ent of etat.entreprises) expect(totalBalance(ent.livre.soldes)).toBe(0);
    expect(nouvellePartie(1).entreprises[0].equipe).toBeUndefined();
  });

  it('refuse plus de 4 équipes', () => {
    expect(() => partieEquipes(MAX_EQUIPES + 1)).toThrow();
    expect(facteurMarcheEquipes(1)).toBe(1);
    expect(facteurMarcheEquipes(4)).toBeGreaterThan(facteurMarcheEquipes(2));
  });

  it('les décisions d’une équipe influencent les ventes des autres', () => {
    const base = simulerMois(partieEquipes(2));
    const prix: Record<string, number> = {};
    const avant = partieEquipes(2);
    for (const [k, v] of Object.entries(avant.entreprises[0].decisions.prix)) prix[k] = v * 0.8;
    const baisse = simulerMois(modifierDecisions(avant, 'joueur-1', { prix }));
    const ventes = (e: EtatPartie, i: number) => e.entreprises[i].archives[0].indicateurs.servies;
    expect(ventes(baisse, 0)).toBeGreaterThan(ventes(base, 0));
    expect(ventes(baisse, 1)).toBeLessThan(ventes(base, 1));
    const parts = base.entreprises.reduce((s, e) => s + e.archives[0].indicateurs.partMarche, 0);
    expect(parts).toBeLessThan(1);
  });

  it('la comparaison finale inclut les équipes et les concurrents', () => {
    const etat = jouerMois(partieEquipes(2), 4);
    const comp = comparaisonMarche(etat, etat.entreprises[1]);
    expect(comp.filter((l) => l.type === 'joueur')).toHaveLength(1);
    expect(comp.filter((l) => l.type === 'equipe')).toHaveLength(1);
    expect(comp.some((l) => l.type === 'concurrent')).toBe(true);
    expect(comp[0].part).toBeGreaterThanOrEqual(comp.at(-1)?.part ?? 0);
  });
});

describe('scénarios', () => {
  it('les données des scénarios sont valides', () => {
    expect(SCENARIOS.length).toBeGreaterThanOrEqual(5);
    for (const sc of SCENARIOS) {
      const secteur = secteurParId(sc.secteurId);
      const ville = villeParId(sc.villeId);
      expect(ville.emplacements.some((e) => secteur.emplacements.includes(e.id))).toBe(true);
      expect(sc.objectifs.length).toBeGreaterThan(0);
    }
  });

  it('applique la situation de départ', () => {
    const relance = SCENARIOS.find((s) => s.id === 'cafe-relance')!;
    const etat = creerPartie(configScenario(relance, 3), demarrageSecteur('cafe'));
    expect(etat.config.scenarioId).toBe('cafe-relance');
    expect(etat.entreprises[0].clientele.notoriete).toBe(0.05);
    expect(etat.entreprises[0].clientele.note).toBe(2.9);

    const recession = SCENARIOS.find((s) => s.id === 'recession')!;
    const e2 = creerPartie(configScenario(recession, 3), demarrageSecteur('vetements'));
    expect(e2.conjoncture.phase).toBe('ralentissement');

    const geant = SCENARIOS.find((s) => s.id === 'epicerie-geant')!;
    const e3 = creerPartie(configScenario(geant, 3), demarrageSecteur('epicerie'));
    expect(e3.concurrents.find((c) => c.personnaliteId === 'geant')?.notoriete).toBe(0.85);
  });

  it('évalue les objectifs et donne une note', () => {
    const sc = SCENARIOS.find((s) => s.id === 'paysagement-saison')!;
    const etat = jouerMois(creerPartie(configScenario(sc, 2), demarrageSecteur('paysagement')), 12);
    const ev = evaluerScenario(etat.entreprises[0], sc);
    expect(ev.objectifs).toHaveLength(sc.objectifs.length);
    expect(ev.note).toBeGreaterThanOrEqual(0);
    expect(ev.note).toBeLessThanOrEqual(100);
    expect(ev.objectifs[0].type).toBe('survie');
    const faillite = structuredClone(etat.entreprises[0]);
    faillite.enFaillite = true;
    expect(evaluerScenario(faillite, sc).note).toBeLessThan(ev.note);
    expect(rapportFinPartie(etat, etat.entreprises[0]).scenario?.note).toBe(ev.note);
  });
});

describe('quiz entre les trimestres', () => {
  it('la banque de questions est valide', () => {
    expect(QUESTIONS_QUIZ.length).toBeGreaterThanOrEqual(40);
    expect(new Set(QUESTIONS_QUIZ.map((q) => q.id)).size).toBe(QUESTIONS_QUIZ.length);
    for (const q of QUESTIONS_QUIZ) {
      expect(q.choix.length).toBeGreaterThanOrEqual(3);
      expect(q.bonne).toBeGreaterThanOrEqual(0);
      expect(q.bonne).toBeLessThan(q.choix.length);
      expect(q.explication.length).toBeGreaterThan(20);
    }
  });

  it('un quiz reproductible est offert au début de chaque trimestre', () => {
    let etat = nouvellePartie(5, 12);
    expect(quizDisponible(etat, etat.entreprises[0])).toBe(false);
    etat = jouerMois(etat, 3);
    const ent = etat.entreprises[0];
    expect(quizDisponible(etat, ent)).toBe(true);
    const q1 = questionsQuiz(etat, ent);
    expect(q1).toHaveLength(3);
    expect(new Set(q1.map((q) => q.id)).size).toBe(3);
    expect(questionsQuiz(etat, ent).map((q) => q.id)).toEqual(q1.map((q) => q.id));

    // Deux bonnes réponses sur trois : 20 % de rabais.
    const reponses = Object.fromEntries(
      q1.map((q, k) => [q.id, k < 2 ? q.bonne : (q.bonne + 1) % q.choix.length]),
    );
    etat = repondreQuiz(etat, ent.id, reponses);
    const apres = etat.entreprises[0];
    expect(apres.pedagogie?.rabais).toBe(0.2);
    expect(quizDisponible(etat, apres)).toBe(false);
    // Répondre deux fois ne donne rien de plus.
    expect(repondreQuiz(etat, ent.id, reponses).entreprises[0].pedagogie?.rabais).toBe(0.2);

    // Le trimestre suivant évite les questions déjà posées.
    etat = jouerMois(etat, 3);
    const q2 = questionsQuiz(etat, etat.entreprises[0]).map((q) => q.id);
    expect(q2.some((id) => q1.some((q) => q.id === id))).toBe(false);
  });

  it('le rabais s’applique à la prochaine formation puis disparaît', () => {
    let etat = jouerMois(nouvellePartie(5, 12), 3);
    const ent = etat.entreprises[0];
    const reponses = Object.fromEntries(questionsQuiz(etat, ent).map((q) => [q.id, q.bonne]));
    etat = repondreQuiz(etat, ent.id, reponses);
    expect(etat.entreprises[0].pedagogie?.rabais).toBe(0.3);
    const employe = etat.entreprises[0].employes[0];
    const avant = etat.entreprises[0].livre.soldes.formation;
    etat = formerEmploye(etat, ent.id, employe.id, 'service');
    const cout = (etat.entreprises[0].livre.soldes.formation - avant) / 100;
    expect(cout).toBeCloseTo(300 * 0.7, 0);
    expect(etat.entreprises[0].pedagogie?.rabais).toBe(0);
  });
});

describe('conseiller virtuel', () => {
  it('signale un prix sous le coût en premier', () => {
    const etat = nouvellePartie(4, 12);
    // Viennoiseries au prix plancher (40 % du prix de référence) en qualité supérieure.
    const ligne = secteurParId('cafe').lignes.find((l) => l.id === 'viennoiseries')!;
    const e = modifierDecisions(etat, 'joueur-1', {
      qualiteId: 'superieure',
      prix: { ...etat.entreprises[0].decisions.prix, [ligne.id]: ligne.prixReference * 0.4 },
    });
    const c = conseils(e, e.entreprises[0]);
    expect(c[0].code).toBe('conseilPrixSousCout');
    expect(c[0].niveau).toBe('danger');
  });

  it('rappelle les démarches oubliées et se tait en fin de partie', () => {
    const params = { ...demarrageSecteur('cafe'), demarches: ['req' as const] };
    const etat = creerPartie(configTest(4, 12), params);
    const codes = conseils(etat, etat.entreprises[0]).map((m) => m.code);
    expect(codes).toContain('conseilDemarche');
    expect(conseils({ ...etat, terminee: true }, etat.entreprises[0])).toEqual([]);
  });

  it('chaque conseil a un texte', () => {
    const codes = [
      'conseilDefaut',
      'conseilPrixSousCout',
      'conseilDemarche',
      'conseilInscriptionTaxes',
      'conseilSeuilTaxes',
      'conseilMargeCredit',
      'conseilTresorerie',
      'conseilMargeBrute',
      'conseilMainOeuvre',
      'conseilCapacite',
      'conseilRuptures',
      'conseilPrixEleve',
      'conseilPrixBas',
      'conseilNotoriete',
      'conseilMoral',
      'conseilHeuresSup',
      'conseilDilemmes',
      'conseilQuiz',
      'conseilBravo',
      'conseilRien',
    ];
    for (const code of codes) {
      const t = texteMessage({ code, niveau: 'info', params: { demarche: 'req', ligne: 'Café' } });
      expect(t.titre).not.toBe(code);
      expect(t.texte.length).toBeGreaterThan(20);
    }
  });

  it('commente les résultats du mois précédent', () => {
    const etat = jouerMois(nouvellePartie(4, 12), 4);
    const c = conseils(etat, etat.entreprises[0]);
    expect(c.length).toBeGreaterThan(0);
    const ordre = { danger: 0, alerte: 1, info: 2, succes: 3 };
    for (let k = 1; k < c.length; k++)
      expect(ordre[c[k].niveau]).toBeGreaterThanOrEqual(ordre[c[k - 1].niveau]);
  });
});

describe('rapport de fin de partie', () => {
  it('mesure l’effet des décisions marquantes', () => {
    let etat = jouerMois(nouvellePartie(6, 12), 5);
    const prix: Record<string, number> = {};
    for (const [k, v] of Object.entries(etat.entreprises[0].decisions.prix)) prix[k] = v * 1.15;
    etat = jouerMois(modifierDecisions(etat, 'joueur-1', { prix }), 7);
    const d = decisionsMarquantes(etat.entreprises[0]);
    const hausse = d.find((x) => x.type === 'prixHausse');
    expect(hausse?.index).toBe(5);
    expect(hausse?.effet).toBe(Math.round(hausse!.apres - hausse!.avant - hausse!.attendu));
  });

  it('produit un rapport complet', () => {
    let etat = jouerMois(nouvellePartie(8, 12), 6);
    const ent = etat.entreprises[0];
    if (ent.dilemmes.length === 0)
      ent.dilemmes.push({
        id: 'dil-test',
        defId: 'conflitHoraire',
        employeId: ent.employes[0].id,
        nomEmploye: ent.employes[0].prenom,
        index: 6,
      });
    const d = etat.entreprises[0].dilemmes[0];
    etat = repondreDilemme(etat, ent.id, d.id, 'anciennete');
    etat = jouerMois(etat, 6);
    const r = rapportFinPartie(etat, etat.entreprises[0]);
    expect(r.departements.map((x) => x.id)).toEqual([
      'marketing',
      'rh',
      'operations',
      'finance',
      'conformite',
    ]);
    for (const x of r.departements) {
      expect(x.note).toBeGreaterThanOrEqual(0);
      expect(x.note).toBeLessThanOrEqual(100);
    }
    expect(r.note).toBe(r.bilan.note);
    expect(r.scenario).toBeNull();
    expect(choixEvenements(etat.entreprises[0]).length).toBeGreaterThan(0);
    expect(r.comparaison.length).toBeGreaterThan(1);
    expect(etat.entreprises[0].archives.every((a) => a.resume !== undefined)).toBe(true);
  });

  it('attribue une mention selon la note', () => {
    expect(mention(90)).toBe('excellent');
    expect(mention(75)).toBe('tresBien');
    expect(mention(60)).toBe('bien');
    expect(mention(50)).toBe('passable');
    expect(mention(10)).toBe('aRetravailler');
  });
});
