/** Mode histoire et croissance (étapes A1 à A5 du plan de la suite). */
import { describe, expect, it } from 'vitest';
import { evaluerCredit } from '../src/engine/financement';
import {
  FORMATIONS_PROPRIETAIRE,
  creerPartie,
  facteurFraisComptables,
  formerProprietaire,
  maitrise,
  niveauCompetence,
  questionsQuiz,
  repondreQuiz,
} from '../src/engine/simulation';
import { configTest, demarrageSecteur, jouerMois } from './helpers';

const partie = (profil?: 'gestion' | 'finance' | 'marketing' | 'rh' | 'fiscalite', graine = 3) =>
  creerPartie(configTest(graine, 36), { ...demarrageSecteur('cafe'), profil });

describe('A1 : compétences du propriétaire', () => {
  it('le parcours fixe les compétences de départ', () => {
    const finance = partie('finance').entreprises[0];
    const marketing = partie('marketing').entreprises[0];
    expect(niveauCompetence(finance, 'finance')).toBe(55);
    expect(niveauCompetence(marketing, 'marketing')).toBe(55);
    expect(niveauCompetence(partie().entreprises[0], 'gestion')).toBe(55);
  });

  it('les compétences progressent avec l’expérience', () => {
    const debut = partie().entreprises[0];
    const fin = jouerMois(partie(), 12).entreprises[0];
    expect(niveauCompetence(fin, 'gestion')).toBeGreaterThan(niveauCompetence(debut, 'gestion'));
    expect(niveauCompetence(fin, 'rh')).toBeGreaterThan(niveauCompetence(debut, 'rh'));
  });

  it('une formation coûte de l’argent, fait progresser et ne se suit qu’une fois', () => {
    const etat = partie('marketing');
    const f = FORMATIONS_PROPRIETAIRE.find((x) => x.id === 'fiscalite1')!;
    const avant = etat.entreprises[0];
    const apres = formerProprietaire(etat, 'joueur-1', f.id);
    const ent = apres.entreprises[0];
    expect(niveauCompetence(ent, 'fiscalite')).toBeGreaterThan(
      niveauCompetence(avant, 'fiscalite'),
    );
    expect((ent.livre.soldes.formation - avant.livre.soldes.formation) / 100).toBeCloseTo(
      f.cout,
      0,
    );
    const encore = formerProprietaire(apres, 'joueur-1', f.id);
    expect(encore.entreprises[0].livre.soldes.formation).toBe(ent.livre.soldes.formation);
    // Formation avancée : niveau 45 requis (le profil marketing part à 20 en fiscalité).
    const avancee = formerProprietaire(etat, 'joueur-1', 'fiscalite2');
    expect(avancee.entreprises[0].formationsProprietaire).toEqual([]);
  });

  it('la finance donne un meilleur taux et la fiscalité réduit les honoraires', () => {
    const etat = jouerMois(partie('finance'), 4);
    const expert = structuredClone(etat.entreprises[0]);
    const novice = structuredClone(etat.entreprises[0]);
    expert.competences!.finance = 100;
    novice.competences!.finance = 20;
    const t = (e: typeof expert) => evaluerCredit(e, 20_000, 60, 'fixe', etat.conjoncture).taux;
    expect(t(expert)).toBeLessThan(t(novice));
    expert.competences!.fiscalite = 100;
    novice.competences!.fiscalite = 20;
    expect(facteurFraisComptables(expert)).toBeLessThan(facteurFraisComptables(novice));
    expect(maitrise(novice, 'fiscalite')).toBe(0);
  });

  it('les bonnes réponses au quiz font progresser le domaine de la question', () => {
    let etat = jouerMois(partie(), 3);
    const ent = etat.entreprises[0];
    const questions = questionsQuiz(etat, ent);
    const total = (e: typeof ent) => Object.values(e.competences ?? {}).reduce((a, x) => a + x, 0);
    etat = repondreQuiz(etat, ent.id, Object.fromEntries(questions.map((q) => [q.id, q.bonne])));
    expect(total(etat.entreprises[0])).toBeGreaterThan(total(ent));
  });
});
