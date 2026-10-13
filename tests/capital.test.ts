/** Capital et transmission (étapes A8 et A9 du plan de la suite). */
import { describe, expect, it } from 'vitest';
import { totalBalance } from '../src/engine/accounting';
import {
  CAPITAL_RISQUE,
  SOCIO,
  chancesSociofinancement,
  lancerSociofinancement,
  leverCapitalRisque,
  termesCapitalRisque,
  verifierSociofinancement,
} from '../src/engine/capital';
import { bilanPartie } from '../src/engine/rapports';
import { creerPartie, modifierDecisions, simulerMois } from '../src/engine/simulation';
import {
  EXEMPTION_GAINS_CAPITAL,
  MOIS_PREPARATION_RELEVE,
  ROUTES,
  annulerReleve,
  evaluerEntreprise,
  offreVente,
  preparerReleve,
  vendreEntreprise,
} from '../src/engine/transmission';
import type { EtatPartie, FormeJuridique } from '../src/engine/types';
import { configTest, demarrageSecteur, jouerMois } from './helpers';

const partie = (graine = 5, forme: FormeJuridique = 'inc-qc', mois = 8): EtatPartie =>
  jouerMois(
    creerPartie(configTest(graine, 60), { ...demarrageSecteur('cafe'), formeJuridique: forme }),
    mois,
  );

/** Ajoute de l'argent en caisse (en équilibrant avec le capital) pour tester de plus gros prix. */
const enrichir = (etat: EtatPartie, dollars: number): EtatPartie => {
  const e = structuredClone(etat);
  const s = e.entreprises[0].livre.soldes;
  s.encaisse += dollars * 100;
  s.capitalActions = (s.capitalActions ?? 0) - dollars * 100;
  s.capital = (s.capital ?? 0) - 0;
  return e;
};

describe('A8 : sociofinancement', () => {
  it('les chances baissent quand l’objectif monte', () => {
    const ent = partie().entreprises[0];
    const bas = chancesSociofinancement(ent, SOCIO.objectifMin);
    const haut = chancesSociofinancement(ent, SOCIO.objectifMax);
    expect(bas).toBeGreaterThan(haut);
    expect(bas).toBeLessThanOrEqual(0.95);
    expect(haut).toBeGreaterThanOrEqual(0.05);
  });

  it('une campagne réussie : produits perçus d’avance, puis revenus à la livraison', () => {
    let trouve = false;
    for (let graine = 1; graine <= 14 && !trouve; graine++) {
      let etat = partie(graine, 'individuelle', 4);
      const avant = etat.entreprises[0].livre.soldes.encaisse;
      etat = lancerSociofinancement(etat, 'joueur-1', SOCIO.objectifMin);
      expect(etat.entreprises[0].capital?.campagne?.objectif).toBe(SOCIO.objectifMin);
      expect(etat.entreprises[0].livre.soldes.encaisse).toBeLessThan(avant);
      // Une deuxième campagne en même temps est refusée.
      expect(verifierSociofinancement(etat.entreprises[0], 4).ok).toBe(false);
      etat = jouerMois(etat, SOCIO.moisCampagne);
      const cap = etat.entreprises[0].capital!;
      expect(cap.campagne).toBeNull();
      expect(cap.historique).toHaveLength(1);
      if (!cap.historique[0].reussie) continue;
      trouve = true;
      expect(cap.historique[0].montant).toBeGreaterThanOrEqual(SOCIO.objectifMin);
      const s = etat.entreprises[0].livre.soldes;
      // Livraison en cours : une partie de la dette envers les contributeurs reste au passif.
      expect(Math.abs(s.produitsPercusAvance ?? 0)).toBeGreaterThan(0);
      expect(totalBalance(s)).toBe(0);
      etat = jouerMois(etat, SOCIO.moisLivraison + 1);
      const fin = etat.entreprises[0].livre.soldes;
      expect(fin.produitsPercusAvance ?? 0).toBe(0);
      expect(Math.abs(fin.revenusSociofinancement ?? 0)).toBeGreaterThan(0);
      expect(totalBalance(fin)).toBe(0);
    }
    expect(trouve).toBe(true);
  });

  it('une campagne ratée ne rapporte rien (tout ou rien)', () => {
    let trouve = false;
    for (let graine = 1; graine <= 30 && !trouve; graine++) {
      let etat = partie(graine, 'individuelle', 4);
      etat = lancerSociofinancement(etat, 'joueur-1', SOCIO.objectifMax);
      etat = jouerMois(etat, SOCIO.moisCampagne);
      const h = etat.entreprises[0].capital!.historique[0];
      if (h.reussie) continue;
      trouve = true;
      expect(h.montant).toBe(0);
      expect(etat.entreprises[0].capital!.livraisons).toHaveLength(0);
    }
    expect(trouve).toBe(true);
  });
});

describe('A8 : capital de risque et conseil d’administration', () => {
  const avecPme = (): EtatPartie => {
    const e = structuredClone(enrichir(partie(5, 'inc-qc', 8), 400_000));
    e.entreprises[0].croissance = { palier: 'pme', depuis: 0 };
    return e;
  };

  it('exige une société par actions, de la taille et du recul', () => {
    const indiv = partie(5, 'individuelle', 8).entreprises[0];
    expect(termesCapitalRisque(indiv, 300_000).ok).toBe(false);
    const petite = partie(5, 'inc-qc', 8).entreprises[0];
    expect(termesCapitalRisque(petite, 300_000).raison).toMatch(/ventes|PME/);
    expect(termesCapitalRisque(avecPme().entreprises[0], 300_000).ok).toBe(true);
  });

  it('dilue le fondateur, donne un siège au fonds et interdit les dividendes', () => {
    const depart = avecPme();
    const encaisse = depart.entreprises[0].livre.soldes.encaisse;
    let etat = leverCapitalRisque(depart, 'joueur-1', 300_000);
    const ent = etat.entreprises[0];
    const part = ent.finance.actionnaires.reduce((s, a) => s + a.part, 0);
    expect(part).toBeCloseTo(1, 3);
    expect(ent.finance.actionnaires.some((a) => a.type === 'risque')).toBe(true);
    expect(ent.finance.actionnaires.find((a) => a.type === 'fondateur')!.part).toBeLessThan(1);
    expect(ent.livre.soldes.encaisse - encaisse).toBeGreaterThan(280_000 * 100);
    expect(ent.capital?.conseil?.sieges).toHaveLength(3);
    expect(totalBalance(ent.livre.soldes)).toBe(0);
    // Une deuxième ronde est refusée tant que le fonds est là.
    expect(termesCapitalRisque(ent, 200_000).ok).toBe(false);
    // Le dividende prévu n'est pas versé.
    etat = modifierDecisions(etat, 'joueur-1', { dividendePonctuel: 5_000 });
    etat = simulerMois(etat);
    const archive = etat.entreprises[0].archives.at(-1)!;
    expect(archive.messages.some((m) => m.code === 'dividendeRefuse')).toBe(true);
    expect(archive.flux.dividendesVerses ?? 0).toBe(0);
  });

  it('deux revues sous l’objectif : le conseil force la vente', () => {
    let etat = leverCapitalRisque(avecPme(), 'joueur-1', 300_000);
    for (let revue = 0; revue < CAPITAL_RISQUE.avertissementsMax; revue++) {
      const e = structuredClone(etat);
      const conseil = e.entreprises[0].capital!.conseil!;
      conseil.prochaineRevue = e.moisCourant;
      conseil.ventesRef = 10_000_000;
      etat = simulerMois(e);
    }
    const ent = etat.entreprises[0];
    expect(ent.vente?.route).toBe('forcee');
    expect(etat.terminee).toBe(true);
    expect(etat.raisonFin).toBe('vente');
  });
});

describe('A9 : vendre ou transmettre', () => {
  it('évalue l’entreprise seulement avec assez d’historique', () => {
    const tot = partie(5, 'inc-qc', 2).entreprises[0];
    expect(evaluerEntreprise(tot).suffisant).toBe(false);
    const ev = evaluerEntreprise(partie(5, 'inc-qc', 12).entreprises[0]);
    expect(ev.suffisant).toBe(true);
    expect(ev.multiple).toBeGreaterThanOrEqual(1.5);
    expect(ev.multiple).toBeLessThanOrEqual(5.5);
    expect(ev.valeurActions).toBeGreaterThanOrEqual(0);
    expect(ev.lignes.length).toBeGreaterThan(4);
  });

  it('une entreprise non incorporée n’a pas l’exemption des gains en capital', () => {
    const societe = enrichir(partie(5, 'inc-qc', 12), 300_000);
    const individuelle = enrichir(partie(5, 'individuelle', 12), 300_000);
    const os = offreVente(societe, societe.entreprises[0], 'tiers');
    const oi = offreVente(individuelle, individuelle.entreprises[0], 'tiers');
    expect(os.gain).toBeGreaterThan(0);
    expect(os.exemption).toBe(Math.min(os.gain, EXEMPTION_GAINS_CAPITAL));
    expect(os.impot).toBe(0);
    expect(oi.exemption).toBe(0);
    expect(oi.impot).toBeGreaterThan(0);
    expect(os.net).toBeGreaterThan(oi.net);
  });

  it('la relève exige 12 mois de préparation, puis paie à crédit à prix réduit', () => {
    let etat = enrichir(partie(5, 'inc-qc', 8), 200_000);
    expect(offreVente(etat, etat.entreprises[0], 'releve').disponible).toBe(false);
    const employe = etat.entreprises[0].employes[0];
    const encaisse = etat.entreprises[0].livre.soldes.encaisse;
    etat = preparerReleve(etat, 'joueur-1', { type: 'employe', employeId: employe.id });
    expect(etat.entreprises[0].releve?.nom).toContain(employe.prenom);
    expect(etat.entreprises[0].livre.soldes.encaisse).toBeLessThan(encaisse);
    expect(offreVente(etat, etat.entreprises[0], 'releve').raison).toMatch(/prête dans/);
    etat = jouerMois(etat, MOIS_PREPARATION_RELEVE);
    const ent = etat.entreprises[0];
    const releve = offreVente(etat, ent, 'releve');
    expect(releve.disponible).toBe(true);
    expect(releve.prixEntreprise).toBe(
      Math.round(releve.valeurActions * ROUTES.releve.facteurPrix),
    );
    expect(releve.comptant).toBe(Math.round(releve.prixProprietaire * ROUTES.releve.partComptant));
    expect(releve.solde).toBe(releve.prixProprietaire - releve.comptant);
    expect(releve.valeurActuelleSolde).toBeLessThan(releve.solde);
    expect(releve.net).toBe(
      Math.max(0, releve.comptant + releve.valeurActuelleSolde - releve.frais - releve.impot),
    );
    // Annuler abandonne la préparation.
    expect(annulerReleve(etat, 'joueur-1').entreprises[0].releve).toBeUndefined();
  });

  it('vendre termine la partie et le résultat final reprend le net après impôt', () => {
    let etat = partie(5, 'inc-qc', 12);
    const offre = offreVente(etat, etat.entreprises[0], 'tiers');
    expect(offre.disponible).toBe(true);
    etat = vendreEntreprise(etat, 'joueur-1', 'tiers');
    const ent = etat.entreprises[0];
    expect(ent.vente?.route).toBe('tiers');
    expect(ent.vente?.net).toBe(offre.net);
    expect(etat.terminee).toBe(true);
    expect(etat.raisonFin).toBe('vente');
    const b = bilanPartie(ent);
    expect(b.vendue).toBe(true);
    expect(b.valeurPourProprietaire).toBe(offre.net);
    // Une entreprise vendue ne se revend pas.
    expect(vendreEntreprise(etat, 'joueur-1', 'tiers')).toBe(etat);
  });
});
