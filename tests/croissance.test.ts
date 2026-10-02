/** Mode histoire et croissance (étapes A1 à A5 du plan de la suite). */
import { describe, expect, it } from 'vitest';
import { secteurParId } from '../src/data';
import { ecritureSimple, totalBalance } from '../src/engine/accounting';
import type { EtatPartie } from '../src/engine/types';
import { versCents } from '../src/engine/util';
import { demarchesSecteur, estObligatoire } from '../src/engine/conformite';
import { evaluerCredit } from '../src/engine/financement';
import {
  FORMATIONS_PROPRIETAIRE,
  affecterEmploye,
  creerPartie,
  fermerSuccursale,
  nbEtablissements,
  ouvrirSuccursale,
  embaucher,
  evoluerPalier,
  facteurAchatsPalier,
  honorairesPalier,
  palier,
  simulerMois,
  dialoguesDuMois,
  facteurFraisComptables,
  formerProprietaire,
  maitrise,
  niveauCompetence,
  questionsQuiz,
  repondreQuiz,
} from '../src/engine/simulation';
import { REPLIQUES } from '../src/i18n/messages-croissance';
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

describe('A2 : personnages récurrents et dialogues', () => {
  it('la mentore accueille le joueur au premier mois', () => {
    const etat = partie();
    expect(dialoguesDuMois(etat, etat.entreprises[0])[0]).toMatchObject({
      personnage: 'mentore',
      code: 'mentoreBienvenue',
    });
  });

  it('chaque réplique a un texte, au plus 3 par mois, un personnage à la fois', () => {
    let etat = partie();
    for (let m = 0; m < 30 && !etat.terminee; m++) {
      const r = dialoguesDuMois(etat, etat.entreprises[0]);
      expect(r.length).toBeLessThanOrEqual(3);
      expect(new Set(r.map((x) => x.personnage)).size).toBe(r.length);
      for (const x of r) expect(REPLIQUES[x.code]?.(x.params ?? {}).length).toBeGreaterThan(20);
      etat = jouerMois(etat, 1);
    }
  });

  it('la banquière réagit à la marge de crédit et le comptable aux taxes', () => {
    const etat = structuredClone(jouerMois(partie(), 3));
    const ent = etat.entreprises[0];
    const i = ent.archives.at(-1)!.indicateurs;
    i.margeCreditUtilisee = 0.9 * (ent.margeCredit.limite / 100);
    ent.fiscal.doitSInscrire = true;
    ent.fiscal.inscritTaxes = false;
    const codes = dialoguesDuMois(etat, ent).map((x) => x.code);
    expect(codes).toContain('banquiereMarge');
    expect(codes).toContain('comptableTaxes');
  });
});

describe('A4 : paliers de croissance', () => {
  it('une petite entreprise devient PME en dépassant le seuil d’employés', () => {
    let etat = jouerMois(partie(), 2);
    expect(palier(etat.entreprises[0])).toBe('petite');
    for (let k = 0; k < 14; k++) etat = embaucher(etat, 'joueur-1');
    const limite = etat.entreprises[0].margeCredit.limite;
    etat = simulerMois(etat);
    const ent = etat.entreprises[0];
    expect(palier(ent)).toBe('pme');
    expect(ent.margeCredit.limite).toBe(limite * 2);
    expect(ent.archives.at(-1)!.messages.some((m) => m.code === 'palierAtteint')).toBe(true);
    expect(facteurAchatsPalier(ent)).toBeCloseTo(0.97);
    expect(honorairesPalier(ent)).toBe(400);
  });

  it('les obligations liées au nombre d’employés s’appliquent au bon seuil', () => {
    const secteur = secteurParId('cafe');
    expect(estObligatoire('equiteSalariale', secteur, 9)).toBe(false);
    expect(estObligatoire('equiteSalariale', secteur, 10)).toBe(true);
    expect(estObligatoire('comiteSst', secteur, 20)).toBe(true);
    expect(estObligatoire('francisationOqlf', secteur, 24)).toBe(false);
    // Elles ne font pas partie des démarches de démarrage.
    const ent = partie().entreprises[0];
    expect(ent.demarches.equiteSalariale).toBe(false);
    expect(demarchesSecteur(secteur).some((d) => d.id === 'comiteSst')).toBe(false);
  });

  it('on ne redescend pas de palier', () => {
    const ent = structuredClone(partie().entreprises[0]);
    ent.croissance = { palier: 'pme', depuis: 0 };
    expect(evoluerPalier(ent, 5)).toBeNull();
    expect(palier(ent)).toBe('pme');
  });
});

describe('A5 : succursales', () => {
  /** Ajoute de l'argent (apport du propriétaire) pour pouvoir ouvrir une succursale. */
  const avecApport = (etat: EtatPartie, montant: number): EtatPartie => {
    const e = structuredClone(etat);
    ecritureSimple(e.entreprises[0].livre, 'Apport (test)', 'encaisse', 'capital', versCents(montant), 'apportsProprietaire');
    return e;
  };

  it('il faut assez d’encaisse pour ouvrir une succursale', () => {
    const etat = jouerMois(partie(), 2);
    const apres = ouvrirSuccursale(etat, 'joueur-1', 'residentiel');
    expect(apres.entreprises[0].succursales ?? []).toHaveLength(0);
  });

  it('ouvre une succursale avec son équipe, ses actifs et un bilan équilibré', () => {
    const etat = avecApport(jouerMois(partie(), 2), 250_000);
    const avant = etat.entreprises[0];
    const apres = ouvrirSuccursale(etat, 'joueur-1', 'residentiel', 'Café du Coin – Rosemont');
    const ent = apres.entreprises[0];
    expect(ent.succursales).toHaveLength(1);
    const s = ent.succursales![0];
    expect(s.nom).toBe('Café du Coin – Rosemont');
    const equipe = secteurParId('cafe').equipeDepart.reduce((a, x) => a + x.nombre, 0);
    expect(ent.employes.filter((e) => e.site === s.id)).toHaveLength(equipe);
    expect(ent.immobilisations.length).toBe(avant.immobilisations.length + 2);
    expect(totalBalance(ent.livre.soldes)).toBe(0);
    expect(nbEtablissements(ent)).toBe(2);
  });

  it('la succursale vend aussi : résultats par établissement et ventes totales plus élevées', () => {
    const base = avecApport(jouerMois(partie(), 2), 250_000);
    const avec = simulerMois(ouvrirSuccursale(base, 'joueur-1', 'rue'));
    const sans = simulerMois(base);
    const a = avec.entreprises[0].archives.at(-1)!;
    expect(a.sites).toHaveLength(2);
    const total = a.sites!.reduce((t, x) => t + x.servies, 0);
    expect(Math.abs(total - a.indicateurs.servies)).toBeLessThanOrEqual(2);
    expect(a.indicateurs.servies).toBeGreaterThan(sans.entreprises[0].archives.at(-1)!.indicateurs.servies);
    expect(totalBalance(avec.entreprises[0].livre.soldes)).toBe(0);
  });

  it('fermer une succursale mute l’équipe et coûte une pénalité de bail', () => {
    const ouverte = ouvrirSuccursale(avecApport(partie(), 250_000), 'joueur-1', 'residentiel');
    const s = ouverte.entreprises[0].succursales![0];
    const emp = ouverte.entreprises[0].employes.find((e) => e.site === s.id)!;
    const mute = affecterEmploye(ouverte, 'joueur-1', emp.id, null);
    expect(mute.entreprises[0].employes.find((e) => e.id === emp.id)!.site).toBeUndefined();
    const fermee = fermerSuccursale(ouverte, 'joueur-1', s.id);
    const ent = fermee.entreprises[0];
    expect(ent.succursales).toHaveLength(0);
    expect(ent.employes.every((e) => !e.site)).toBe(true);
    expect(ent.livre.soldes.encaisse).toBeLessThan(ouverte.entreprises[0].livre.soldes.encaisse);
  });
});
