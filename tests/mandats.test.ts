/** Mode « chef de département » : structure commune et département Finance (étape E1). */
import { describe, expect, it } from 'vitest';
import { totalBalance } from '../src/engine/accounting';
import { versementMensuel } from '../src/engine/loans';
import {
  FRAIS_ENJEU,
  MANDATS,
  MANDATS_PAR_MOIS,
  aideMandat,
  cadenceRapport,
  confianceConnue,
  documentsVisibles,
  estCorrect,
  genererMandats,
  initialiserChef,
  lireRapportMandats,
  repondreMandat,
  resultatsARapporter,
  terminerMoisChef,
  titreChef,
} from '../src/engine/mandats';
import { semainesPreavis } from '../src/engine/mandats-fiscalite';
import { etatResultats } from '../src/engine/statements';
import type { Difficulte, EtatPartie } from '../src/engine/types';
import { configTest, creerPartieTest } from './helpers';

const partie = (difficulte: Difficulte = 'realiste', graine = 5): EtatPartie =>
  initialiserChef(creerPartieTest({ ...configTest(graine, 24), difficulte }), 'finance');

/** Répond juste à tous les mandats du mois (ou faux si `juste` est false). */
const repondre = (etat: EtatPartie, juste = true): EtatPartie => {
  let e = etat;
  for (const m of etat.entreprises[0].chef!.mandats)
    e = repondreMandat(e, 'joueur-1', m.id, juste ? m.attendu : m.attendu * 1.5 + 10);
  return e;
};

const jouer = (etat: EtatPartie, mois: number, juste = true): EtatPartie => {
  let e = etat;
  for (let k = 0; k < mois && !e.terminee; k++) e = terminerMoisChef(repondre(e, juste));
  return e;
};

describe('mandats du chef de département', () => {
  it('remet 3 mandats du département, toujours les mêmes pour une même partie', () => {
    const etat = partie();
    const chef = etat.entreprises[0].chef!;
    expect(chef.departement).toBe('finance');
    expect(chef.mandats).toHaveLength(MANDATS_PAR_MOIS);
    expect(new Set(chef.mandats.map((m) => m.id)).size).toBe(MANDATS_PAR_MOIS);
    expect(genererMandats(etat, etat.entreprises[0]).map((m) => m.id)).toEqual(
      chef.mandats.map((m) => m.id),
    );
    for (const m of chef.mandats) {
      expect(m.documents.length).toBeGreaterThan(0);
      for (const d of m.documents) expect(d.provenance.length).toBeGreaterThan(20);
      expect(m.corrige.length).toBeGreaterThan(0);
      expect(Number.isFinite(m.attendu)).toBe(true);
    }
  });

  it('les 10 mandats de finance apparaissent au fil des mois, avec des réponses cohérentes', () => {
    let etat = partie();
    const vus = new Map<string, number>();
    for (let k = 0; k < 14; k++) {
      const ent = etat.entreprises[0];
      for (const m of ent.chef!.mandats) {
        vus.set(m.id, m.attendu);
        if (m.id === 'F1')
          expect(m.attendu).toBeCloseTo(ent.archives.at(-1)!.indicateurs.tauxMargeBrute * 100, 0);
        if (m.id === 'F7') expect(m.attendu).toBeCloseTo(ent.livre.soldes.encaisse / 100, 2);
        if (m.id === 'F6') {
          const pret = ent.prets.find((p) => p.solde > 0)!;
          expect(m.attendu).toBeCloseTo(((pret.solde / 100) * pret.tauxAnnuel) / 12, 2);
        }
      }
      etat = terminerMoisChef(repondre(etat));
    }
    expect([...vus.keys()].sort()).toEqual(
      MANDATS.filter((d) => d.departement === 'finance')
        .map((d) => d.id)
        .sort(),
    );
    expect(totalBalance(etat.entreprises[0].livre.soldes)).toBe(0);
  });

  it('le versement d’un prêt suit la formule de l’annuité', () => {
    let etat = partie();
    let f5 = etat.entreprises[0].chef!.mandats.find((m) => m.id === 'F5');
    for (let k = 0; k < 6 && !f5; k++) {
      etat = terminerMoisChef(repondre(etat));
      f5 = etat.entreprises[0].chef!.mandats.find((m) => m.id === 'F5');
    }
    expect(f5).toBeDefined();
    const ligne = (libelle: string) =>
      f5!.documents[0].lignes.find((l) => l.libelle.startsWith(libelle))!.valeur;
    const nombre = (texte: string) =>
      Number(
        texte
          .replace(/[^\d,.-]/g, '')
          .replace(/\s/g, '')
          .replace(',', '.'),
      );
    const capital = nombre(ligne('Capital'));
    const taux = nombre(ligne('Taux')) / 100;
    const duree = nombre(ligne('Durée'));
    expect(f5!.attendu).toBeCloseTo(
      versementMensuel(Math.round(capital * 100), taux, duree) / 100,
      1,
    );
  });

  it('accepte une réponse à 1 % près et refuse au-delà', () => {
    expect(estCorrect(1005, 1000, 'dollars')).toBe(true);
    expect(estCorrect(1050, 1000, 'dollars')).toBe(false);
    expect(estCorrect(65.3, 65.2, 'pourcent')).toBe(true);
    expect(estCorrect(1.52, 1.5, 'ratio')).toBe(true);
    expect(estCorrect(1.6, 1.5, 'ratio')).toBe(false);
  });

  it('une bonne réponse augmente la confiance, une erreur coûte des frais tout de suite', () => {
    const depart = partie('facile');
    const bon = terminerMoisChef(repondre(depart, true)).entreprises[0];
    const mauvais = terminerMoisChef(repondre(depart, false)).entreprises[0];
    const oublie = terminerMoisChef(depart).entreprises[0];
    expect(bon.chef!.confiance).toBeGreaterThan(50);
    expect(mauvais.chef!.confiance).toBeLessThan(50);
    expect(oublie.chef!.historique.every((r) => !r.correct && r.reponse === null)).toBe(true);
    const frais = depart.entreprises[0]
      .chef!.mandats.map((m) => FRAIS_ENJEU[m.enjeu])
      .reduce((a, x) => a + x, 0);
    expect(mauvais.chef!.historique.reduce((a, r) => a + r.cout, 0)).toBe(frais);
    expect(bon.chef!.historique.reduce((a, r) => a + r.cout, 0)).toBe(0);
    expect(totalBalance(mauvais.livre.soldes)).toBe(0);
    // De nouveaux mandats sont remis pour le mois suivant.
    expect(bon.chef!.mandats).toHaveLength(MANDATS_PAR_MOIS);
  });

  it('le rapport arrive chaque mois (Facile), chaque trimestre (Réaliste) ou tous les 6 mois (Expert)', () => {
    expect([
      cadenceRapport('facile'),
      cadenceRapport('realiste'),
      cadenceRapport('expert'),
    ]).toEqual([1, 3, 6]);
    const apres = (d: Difficulte, mois: number) => {
      const e = jouer(partie(d), mois, false);
      return resultatsARapporter(e, e.entreprises[0]).length;
    };
    expect(apres('facile', 1)).toBe(3);
    expect(apres('realiste', 1)).toBe(0);
    expect(apres('realiste', 3)).toBe(9);
    expect(apres('expert', 5)).toBe(0);
    expect(apres('expert', 6)).toBe(18);
  });

  it('la confiance connue ne change qu’à la lecture du rapport', () => {
    let etat = jouer(partie('realiste'), 3, true);
    expect(confianceConnue(etat.entreprises[0])).toBe(50);
    expect(etat.entreprises[0].chef!.confiance).toBeGreaterThan(50);
    etat = lireRapportMandats(etat, 'joueur-1');
    expect(confianceConnue(etat.entreprises[0])).toBe(etat.entreprises[0].chef!.confiance);
    expect(resultatsARapporter(etat, etat.entreprises[0])).toHaveLength(0);
    expect(titreChef(95)).toBe('directeur');
    expect(titreChef(75)).toBe('chef');
    expect(titreChef(50)).toBe('analyste');
    expect(titreChef(10)).toBe('commis');
  });

  it('l’aide dépend du niveau, et l’Expert reçoit des lignes inutiles', () => {
    expect(aideMandat('facile')).toEqual({ formule: true, indices: true, lignesInutiles: false });
    expect(aideMandat('realiste')).toEqual({
      formule: true,
      indices: false,
      lignesInutiles: false,
    });
    expect(aideMandat('expert')).toEqual({ formule: false, indices: false, lignesInutiles: true });
    const etat = jouer(partie('expert'), 2);
    const m = etat.entreprises[0].chef!.mandats[0];
    const lignes = (d: Difficulte) =>
      documentsVisibles(m, d).reduce((a, doc) => a + doc.lignes.length, 0);
    expect(lignes('expert')).toBeGreaterThan(lignes('realiste'));
  });

  it('les collègues gèrent le personnel et la partie se rend au bout', () => {
    const etat = jouer(partie('realiste', 9), 24);
    expect(etat.terminee).toBe(true);
    expect(totalBalance(etat.entreprises[0].livre.soldes)).toBe(0);
    // À la fin, tous les résultats restants sont rapportés.
    expect(resultatsARapporter(etat, etat.entreprises[0]).length).toBeGreaterThan(0);
  });
});

describe('département Fiscalité et juridique (E2)', () => {
  const partieFisc = (difficulte: Difficulte = 'realiste', graine = 5): EtatPartie =>
    initialiserChef(creerPartieTest({ ...configTest(graine, 24), difficulte }), 'fiscalite');

  it('les 10 mandats de fiscalité apparaissent, avec des réponses cohérentes avec le moteur', () => {
    let etat = partieFisc();
    const vus = new Map<string, number>();
    for (let k = 0; k < 14; k++) {
      const ent = etat.entreprises[0];
      expect(ent.chef!.departement).toBe('fiscalite');
      for (const m of ent.chef!.mandats) {
        vus.set(m.id, m.attendu);
        expect(m.id.startsWith('T')).toBe(true);
        for (const d of m.documents) expect(d.provenance.length).toBeGreaterThan(20);
        expect(Number.isFinite(m.attendu)).toBe(true);
        if (m.id === 'T3') {
          // Prix affiché dans la soumission, puis total = prix × 1,14975 (à 2 cents près).
          const prix = Number(
            m.documents[0].lignes[0].valeur.replace(/[^\d,]/g, '').replace(',', '.'),
          );
          expect(m.attendu).toBeCloseTo(prix * 1.14975, 1);
        }
        if (m.id === 'T1' || m.id === 'T2') {
          const derniere = ent.archives.at(-1)!;
          const r = etatResultats(derniere.mouvements);
          const taux = m.id === 'T1' ? 0.05 : 0.09975;
          expect(m.attendu).toBeCloseTo((r.ventes - r.coutMarchandises) * taux, 0);
        }
      }
      etat = terminerMoisChef(repondre(etat));
    }
    expect([...vus.keys()].sort()).toEqual(
      MANDATS.filter((d) => d.departement === 'fiscalite')
        .map((d) => d.id)
        .sort(),
    );
    expect(totalBalance(etat.entreprises[0].livre.soldes)).toBe(0);
  });

  it('le barème du préavis suit la Loi sur les normes du travail', () => {
    expect(semainesPreavis(2)).toBe(0);
    expect(semainesPreavis(3)).toBe(1);
    expect(semainesPreavis(11)).toBe(1);
    expect(semainesPreavis(12)).toBe(2);
    expect(semainesPreavis(59)).toBe(2);
    expect(semainesPreavis(60)).toBe(4);
    expect(semainesPreavis(119)).toBe(4);
    expect(semainesPreavis(120)).toBe(8);
  });

  it('l’impôt d’une société et les démarches suivent les règles du jeu', () => {
    let etat = partieFisc();
    const vus = new Map<string, { attendu: number; question: string }>();
    for (let k = 0; k < 14; k++) {
      for (const m of etat.entreprises[0].chef!.mandats) vus.set(m.id, m);
      etat = terminerMoisChef(repondre(etat));
    }
    const t7 = vus.get('T7')!;
    // Au moins 11,2 % (taux réduits) et au plus 26,5 % (taux généraux) du revenu imposable.
    expect(t7.attendu).toBeGreaterThan(900_00 * 0.112 - 1);
    const t10 = vus.get('T10')!;
    expect(t10.attendu).toBeGreaterThanOrEqual(0);
    expect(t10.attendu).toBeLessThanOrEqual(3);
    const t8 = vus.get('T8')!;
    expect(t8.attendu).toBeGreaterThan(0);
  });

  it('une partie complète de chef de la fiscalité se rend au bout, aux trois niveaux', () => {
    for (const niveau of ['facile', 'realiste', 'expert'] as const) {
      const etat = jouer(partieFisc(niveau, 11), 24);
      expect(etat.terminee).toBe(true);
      expect(totalBalance(etat.entreprises[0].livre.soldes)).toBe(0);
    }
  });
});
