/** Tests du Jalon 4 : monde vivant (secteurs, villes, concurrents, événements, conjoncture). */
import { describe, expect, it } from 'vitest';
import {
  DILEMMES,
  FOURNISSEURS,
  INITIATIVES_ECO,
  PERSONNALITES,
  SECTEURS,
  VILLES,
  fournisseursCategorie,
  posteParId,
  secteurParId,
  villeParId,
} from '../src/data';
import { totalBalance } from '../src/engine/accounting';
import {
  creerConcurrent,
  deciderConcurrent,
  evoluerStatutsConcurrents,
  type Concurrent,
} from '../src/engine/ai-competitors';
import { DEMARCHES, demarchesSecteur } from '../src/engine/conformite';
import {
  PHASES,
  conjonctureInitiale,
  evoluerConjoncture,
  facteurConjoncture,
  type Conjoncture,
} from '../src/engine/economy';
import {
  CONDITIONS,
  appliquerEffets,
  texteDilemme,
  tirerDilemme,
  type EffetDilemme,
} from '../src/engine/events';
import { penurieDuMois } from '../src/engine/hr';
import { facteurTaxesSecteur } from '../src/engine/market';
import { Rng } from '../src/engine/rng';
import {
  contexteEffets,
  creerPartie,
  lancerProduit,
  modifierDecisions,
  repondreDilemme,
  simulerMois,
  validerDemarrage,
} from '../src/engine/simulation';
import type { EtatPartie } from '../src/engine/types';
import { texteMessage } from '../src/i18n/fr-CA';
import {
  DEMARRAGE_TEST,
  configTest,
  demarrageSecteur,
  gererMinimalement,
  jouerMois,
  jouerParDefaut,
  nouvellePartie,
} from './helpers';

/** Toutes les listes d'effets imbriquées (hasard, si, risque). */
function effetsImbriques(effets: readonly EffetDilemme[]): EffetDilemme[] {
  return effets.flatMap((e) => [
    e,
    ...(e.type === 'hasard' ? [...effetsImbriques(e.siOui), ...effetsImbriques(e.siNon)] : []),
    ...(e.type === 'si' ? [...effetsImbriques(e.alors), ...effetsImbriques(e.sinon)] : []),
    ...(e.type === 'risque' ? effetsImbriques(e.effets) : []),
  ]);
}

/** Force un événement dans une partie et y répond. */
function repondre(etat: EtatPartie, defId: string, choixId: string): EtatPartie {
  const e = structuredClone(etat);
  const ent = e.entreprises[0];
  const concurrent = e.concurrents.find((c) => c.actif && c.personnaliteId === 'geant');
  ent.dilemmes = [
    {
      id: 'test',
      defId,
      employeId: ent.employes[0]?.id ?? null,
      nomEmploye: ent.employes[0]?.prenom ?? '',
      index: e.moisCourant,
      params: { concurrentId: concurrent?.id, concurrent: concurrent?.nom, prix: 150_000 },
    },
  ];
  return repondreDilemme(e, ent.id, 'test', choixId);
}

describe('données du monde vivant', () => {
  it('7 secteurs, 8 villes, 5 personnalités de concurrents', () => {
    expect(SECTEURS.map((s) => s.id).sort()).toEqual(
      ['atelier', 'cafe', 'coiffure', 'enLigne', 'epicerie', 'paysagement', 'vetements'].sort(),
    );
    expect(VILLES).toHaveLength(8);
    expect(PERSONNALITES.map((p) => p.id)).toEqual([
      'geant',
      'local',
      'agressif',
      'prudent',
      'nouveau',
    ]);
  });

  it('chaque secteur est cohérent avec les autres données', () => {
    for (const s of SECTEURS) {
      // Emplacements présents dans chaque ville
      for (const v of VILLES)
        for (const id of s.emplacements) expect(v.emplacements.some((e) => e.id === id)).toBe(true);
      // Équipe de départ, postes et production
      for (const eq of s.equipeDepart) expect(s.postes).toContain(eq.posteId);
      const produit = [...s.lignes, ...s.nouveauxProduits].some((l) => l.production);
      if (produit) expect(s.postes.some((p) => posteParId(p).role === 'production')).toBe(true);
      // Fournisseurs : au moins 3 par catégorie, fournisseur par défaut de la bonne catégorie
      for (const l of [...s.lignes, ...s.nouveauxProduits]) {
        const defaut = s.fournisseursDefaut[l.categorieAppro];
        expect(defaut, `${s.id}/${l.id}`).toBeDefined();
        expect(FOURNISSEURS.find((f) => f.id === defaut)?.categorie).toBe(l.categorieAppro);
        expect(fournisseursCategorie(l.categorieAppro).length).toBeGreaterThanOrEqual(3);
        if (l.saisonnalite) expect(l.saisonnalite).toHaveLength(12);
      }
      // Au plus un produit vendu aux entreprises
      expect(s.nouveauxProduits.filter((p) => p.b2b).length).toBeLessThanOrEqual(1);
      // Initiatives, permis et concurrents nommés
      for (const id of s.initiativesEco)
        expect(INITIATIVES_ECO.some((i) => i.id === id)).toBe(true);
      for (const id of s.permis) expect(DEMARCHES.some((d) => d.id === id)).toBe(true);
      for (const p of PERSONNALITES) expect(s.concurrents[p.id]?.nom.length).toBeGreaterThan(2);
      expect(s.investissements.length).toBeGreaterThanOrEqual(4);
      expect(s.nouveauxProduits.length).toBeGreaterThanOrEqual(3);
    }
  });

  it('les permis propres au secteur ne s’appliquent qu’au bon secteur', () => {
    const ids = (s: string) => demarchesSecteur(secteurParId(s)).map((d) => d.id);
    expect(ids('epicerie')).toContain('racj');
    expect(ids('epicerie')).toContain('mapaq');
    expect(ids('cafe')).not.toContain('racj');
    expect(ids('vetements')).not.toContain('mapaq');
    expect(ids('paysagement')).toContain('pesticides');
    expect(ids('enLigne')).toContain('confidentialite');
  });

  it('au moins 60 événements valides, avec 2 à 4 choix et une leçon', () => {
    expect(DILEMMES.length).toBeGreaterThanOrEqual(60);
    const ids = new Set<string>();
    for (const d of DILEMMES) {
      expect(ids.has(d.id)).toBe(false);
      ids.add(d.id);
      expect(d.choix.length).toBeGreaterThanOrEqual(2);
      expect(d.choix.length).toBeLessThanOrEqual(4);
      expect(d.choix.some((c) => c.id === d.choixParDefaut)).toBe(true);
      expect(d.lecon.length).toBeGreaterThan(40);
      expect(CONDITIONS[d.condition], d.id).toBeDefined();
      for (const s of d.secteurs ?? []) expect(() => secteurParId(s)).not.toThrow();
      for (const c of d.choix)
        for (const e of effetsImbriques(c.effets)) {
          if (e.type === 'si') expect(CONDITIONS[e.condition], `${d.id} si`).toBeDefined();
          if (e.type === 'risque')
            expect(texteMessage({ code: e.code, niveau: 'danger' }).titre).not.toBe(e.code);
        }
    }
    // Toutes les catégories du prompt sont couvertes
    const categories = new Set(DILEMMES.map((d) => d.categorie));
    for (const c of [
      'rh',
      'meteo',
      'operations',
      'marketing',
      'juridique',
      'finance',
      'fiscal',
      'marche',
    ])
      expect(categories.has(c)).toBe(true);
  });

  it('remplace les marqueurs dans les textes des événements', () => {
    expect(
      texteDilemme('{Commerce} et {concurrent} ({nom}) : {prix}', {
        commerce: 'le café',
        concurrent: 'Kafé Labo',
        nom: 'Léa',
        prix: '100 000 $',
      }),
    ).toBe('Le café et Kafé Labo (Léa) : 100 000 $');
    expect(texteDilemme('{nom} part', '')).toBe('Un employé part');
  });
});

describe('secteurs et villes', () => {
  it('chaque secteur se joue 36 mois avec un bilan équilibré', () => {
    for (const s of SECTEURS) {
      const etat = jouerParDefaut(nouvellePartie(17, 36, s.id));
      expect(etat.terminee).toBe(true);
      for (const ent of etat.entreprises) expect(totalBalance(ent.livre.soldes)).toBe(0);
    }
  });

  it('chaque secteur peut s’ouvrir dans chaque ville', () => {
    for (const s of SECTEURS)
      for (const v of VILLES) {
        const params = demarrageSecteur(s.id);
        expect(validerDemarrage(params, s, v), `${s.id} à ${v.id}`).toEqual([]);
        const etat = simulerMois(
          creerPartie({ ...configTest(5, 12, s.id), villeId: v.id }, params),
        );
        expect(totalBalance(etat.entreprises[0].livre.soldes)).toBe(0);
      }
  });

  it('refuse un emplacement que le secteur ne permet pas', () => {
    const enLigne = secteurParId('enLigne');
    expect(validerDemarrage(DEMARRAGE_TEST, enLigne, villeParId('montreal'))).toContain(
      'emplacementInvalide',
    );
  });

  it('les villes diffèrent par le loyer, le revenu, le chômage et la concurrence', () => {
    const mtl = villeParId('montreal');
    const rimouski = villeParId('rimouski');
    const rue = (v: typeof mtl) => v.emplacements.find((e) => e.id === 'rue')!.loyerNetPi2;
    expect(rue(mtl)).toBeGreaterThan(rue(rimouski));
    expect(mtl.concurrence).toBeGreaterThan(rimouski.concurrence);
    expect(mtl.marchePotentielMensuel.cafe).toBeGreaterThan(rimouski.marchePotentielMensuel.cafe);
    // Chômage bas = pénurie de main-d'œuvre plus forte
    expect(penurieDuMois(villeParId('sherbrooke').chomage, 2)).toBeGreaterThan(
      penurieDuMois(mtl.chomage, 2),
    );
  });

  it('les produits détaxés ne portent pas de TPS ni de TVQ', () => {
    expect(facteurTaxesSecteur(secteurParId('cafe'))).toBeCloseTo(1.14975, 5);
    expect(facteurTaxesSecteur(secteurParId('epicerie'))).toBeLessThan(1.1);
    const etat = jouerMois(nouvellePartie(3, 12, 'epicerie'), 3);
    const ent = etat.entreprises[0];
    const ventes = ent.archives.reduce((a, x) => a + x.indicateurs.ventesMagasin, 0);
    const tps = ent.fiscal.taxesAnnee.tpsPercue;
    expect(ventes).toBeGreaterThan(0);
    // Moins de 5 % des ventes : une partie des produits est détaxée (fromages, épicerie).
    expect(tps).toBeLessThan(ventes * 0.05 * 0.8);
    expect(tps).toBeGreaterThan(0);
  });

  it('les lignes saisonnières se vendent seulement en saison (paysagement)', () => {
    let etat = nouvellePartie(4, 12, 'paysagement');
    etat = jouerMois(etat, 7);
    const ventes = (mois: number, ligne: string) =>
      etat.entreprises[0].archives[mois - 1].indicateurs.ventesParLigne.find(
        (v) => v.ligneId === ligne,
      )?.unites ?? 0;
    expect(ventes(1, 'entretien')).toBe(0);
    expect(ventes(1, 'deneigement')).toBeGreaterThan(0);
    expect(ventes(6, 'entretien')).toBeGreaterThan(0);
    expect(ventes(7, 'deneigement')).toBe(0);
  });

  it('la capacité de production limite les ventes des lignes produites sur place', () => {
    let etat = nouvellePartie(6, 12, 'atelier');
    etat = jouerMois(etat, 4);
    const i = etat.entreprises[0].archives.at(-1)!.indicateurs;
    expect(i.capaciteProduction).toBeGreaterThan(0);
    expect(i.demandeProduction).toBeGreaterThan(0);
    const meubles = i.ventesParLigne.find((v) => v.ligneId === 'meubles')!;
    expect(meubles.unites).toBeGreaterThan(0);
  });

  it('les ventes aux entreprises fonctionnent dans chaque secteur qui en offre', () => {
    for (const s of SECTEURS) {
      const produit = s.nouveauxProduits.find((p) => p.b2b);
      if (!produit) continue;
      let etat = nouvellePartie(8, 24, s.id);
      etat = lancerProduit(etat, etat.entreprises[0].id, produit.id);
      let appels = 0;
      for (let m = 0; m < 10 && !etat.terminee; m++) {
        etat = simulerMois(gererMinimalement(etat));
        const ent = etat.entreprises[0];
        appels += ent.b2b.appels.length;
        for (const a of ent.b2b.appels) {
          expect(a.quantiteParMois).toBeGreaterThanOrEqual(produit.b2b!.quantiteMin);
          etat = modifierDecisions(etat, ent.id, {});
        }
      }
      expect(appels, s.id).toBeGreaterThan(0);
      expect(totalBalance(etat.entreprises[0].livre.soldes)).toBe(0);
    }
  });
});

describe('conjoncture économique', () => {
  it('le cycle passe par des récessions, avec plus de chômage et moins de demande', () => {
    const rng = new Rng(42);
    let c: Conjoncture = conjonctureInitiale();
    const phases = new Set<string>();
    let chomageRecession = 0;
    let nRecession = 0;
    for (let m = 0; m < 1200; m++) {
      c = evoluerConjoncture(c, (m % 12) + 1, rng);
      phases.add(c.phase);
      expect(c.chomage).toBeGreaterThanOrEqual(0.03);
      expect(c.chomage).toBeLessThanOrEqual(0.12);
      expect(Number.isFinite(c.confiance)).toBe(true);
      if (c.phase === 'recession' && c.moisPhase >= 3) {
        chomageRecession += c.chomage;
        nRecession++;
      }
    }
    for (const p of Object.keys(PHASES)) expect(phases.has(p)).toBe(true);
    expect(chomageRecession / nRecession).toBeGreaterThan(0.065);
  });

  it('les secteurs cycliques souffrent plus d’une récession', () => {
    const recession = { ...conjonctureInitiale(), confiance: 0.88 };
    expect(facteurConjoncture(recession, secteurParId('atelier').cyclicite)).toBeLessThan(
      facteurConjoncture(recession, secteurParId('coiffure').cyclicite),
    );
  });
});

describe('concurrents', () => {
  const secteur = secteurParId('cafe');
  const ville = villeParId('montreal');
  const creer = (id: string): Concurrent =>
    creerConcurrent(
      PERSONNALITES.find((p) => p.id === id)!,
      {
        secteur,
        ville,
        potentiel: 28_000,
        agressivite: 1,
        rng: new Rng(1),
        dureeMois: 36,
      },
    );

  it('cinq concurrents dont un Nouveau joueur qui arrive en cours de partie', () => {
    const etat = nouvellePartie(9, 36);
    expect(etat.concurrents).toHaveLength(5);
    const nouveau = etat.concurrents.find((c) => c.personnaliteId === 'nouveau')!;
    expect(nouveau.statut).toBe('aVenir');
    expect(nouveau.nom).toBe(secteur.concurrents.nouveau.nom);
    for (const c of etat.concurrents) expect(c.fraisFixesMensuels).toBeGreaterThan(0);
    const fin = jouerMois(etat, 20);
    const apres = fin.concurrents.find((c) => c.personnaliteId === 'nouveau')!;
    expect(apres.statut).toBe('actif');
    expect(
      fin.entreprises[0].archives.some((a) =>
        a.messages.some((m) => m.code === 'concurrentArrive'),
      ),
    ).toBe(true);
  });

  it('un concurrent qui épuise sa trésorerie fait faillite ou est racheté', () => {
    const geant = creer('geant');
    const prudent = creer('prudent');
    prudent.fraisFixesMensuels = 10_000;
    prudent.tresorerie = -50_000;
    const messages = evoluerStatutsConcurrents([geant, prudent], 10, new Rng(3));
    expect(prudent.actif).toBe(false);
    expect(['faillite', 'rachete']).toContain(prudent.statut);
    expect(messages.length).toBe(1);
    // Le Géant, lui, est renfloué par son siège social.
    geant.tresorerie = -1_000_000;
    geant.fraisFixesMensuels = 10_000;
    for (let m = 0; m < 6; m++) evoluerStatutsConcurrents([geant], 11 + m, new Rng(m));
    expect(geant.actif).toBe(true);
  });

  it('l’Agressif copie les bonnes idées du joueur avec un délai', () => {
    const agressif = creer('agressif');
    agressif.livraison = false;
    const perso = PERSONNALITES.find((p) => p.id === 'agressif')!;
    const obs = { indicePrixJoueurs: 1, qualiteJoueurs: 0.5, partJoueurs: 0.15, livraison: true };
    const rng = new Rng(7);
    let copie = false;
    for (let m = 0; m < 12 && !copie; m++) {
      deciderConcurrent(agressif, perso, obs, m, 1, rng, secteur);
      copie = agressif.livraison;
    }
    expect(copie).toBe(true);
    // Le Prudent ne copie pas.
    const prudent = creer('prudent');
    const persoPrudent = PERSONNALITES.find((p) => p.id === 'prudent')!;
    for (let m = 0; m < 12; m++) deciderConcurrent(prudent, persoPrudent, obs, m, 1, rng, secteur);
    expect(prudent.idees).toEqual([]);
  });
});

describe('événements', () => {
  it('chaque choix de chaque événement s’applique sans erreur et garde le bilan équilibré', () => {
    for (const d of DILEMMES) {
      const secteurId = d.secteurs?.[0] ?? (d.condition === 'alimentation' ? 'cafe' : 'cafe');
      const base = jouerMois(nouvellePartie(13, 36, secteurId), 3);
      for (const c of d.choix) {
        const apres = repondre(base, d.id, c.id);
        const ent = apres.entreprises[0];
        expect(ent.dilemmes, `${d.id}/${c.id}`).toHaveLength(0);
        expect(totalBalance(ent.livre.soldes), `${d.id}/${c.id}`).toBe(0);
        // Le mois suivant se simule normalement (effets différés et modificateurs)
        if (!apres.terminee) {
          const suivant = simulerMois(apres);
          expect(totalBalance(suivant.entreprises[0].livre.soldes), `${d.id}/${c.id}`).toBe(0);
        }
      }
    }
  });

  it('les effets temporaires (demande, coûts) durent le nombre de mois prévu', () => {
    const etat = jouerMois(nouvellePartie(21, 12), 2);
    const apres = repondre(etat, 'chantier', 'rien');
    expect(apres.entreprises[0].modificateurs.find((m) => m.type === 'demande')?.moisRestants).toBe(
      3,
    );
    const fin = jouerMois(apres, 3);
    expect(fin.entreprises[0].modificateurs.filter((m) => m.type === 'demande')).toHaveLength(0);
  });

  it('accepter une offre de rachat termine la partie', () => {
    const etat = jouerMois(nouvellePartie(22, 36), 3);
    const apres = repondre(etat, 'offreRachat', 'vendre');
    expect(apres.terminee).toBe(true);
    expect(apres.raisonFin).toBe('vente');
    expect(apres.entreprises[0].vente?.prix).toBe(150_000);
  });

  it('un concurrent qui ouvre en face arrive le mois même', () => {
    const etat = jouerMois(nouvellePartie(23, 36), 3);
    const apres = simulerMois(repondre(etat, 'concurrentOuvreEnFace', 'difference'));
    expect(apres.concurrents.find((c) => c.personnaliteId === 'nouveau')?.statut).toBe('actif');
  });

  it('la faillite d’un fournisseur fait changer de fournisseur', () => {
    const etat = jouerMois(nouvellePartie(24, 36), 2);
    const avant = etat.entreprises[0].decisions.approvisionnement.boissons.fournisseurId;
    const apres = repondre(etat, 'fournisseurFaillite', 'fiable');
    const ent = apres.entreprises[0];
    expect(ent.operations.fournisseursFermes?.length).toBe(1);
    const fermes = ent.operations.fournisseursFermes!;
    for (const p of Object.values(ent.decisions.approvisionnement))
      expect(fermes).not.toContain(p.fournisseurId);
    expect(avant).toBeDefined();
  });

  it('l’effet « si » dépend de l’assurance', () => {
    const etat = nouvellePartie(25, 12);
    const assure = structuredClone(etat).entreprises[0];
    const sansAssurance = structuredClone(etat).entreprises[0];
    sansAssurance.demarches.assurances = false;
    const effets: EffetDilemme[] = [
      {
        type: 'si',
        condition: 'assure',
        alors: [{ type: 'depense', categorie: 'sinistres', montant: 1000, libelle: 'Franchise' }],
        sinon: [{ type: 'depense', categorie: 'sinistres', montant: 9000, libelle: 'Sinistre' }],
      },
    ];
    const rng = new Rng(1);
    appliquerEffets(effets, contexteEffets(assure, null, 0, rng, { etat }));
    appliquerEffets(effets, contexteEffets(sansAssurance, null, 0, rng, { etat }));
    expect(assure.livre.soldes.sinistres).toBe(100_000);
    expect(sansAssurance.livre.soldes.sinistres).toBe(900_000);
  });

  it('le mode Facile tire moins d’événements négatifs que le mode Expert', () => {
    const compter = (difficulte: 'facile' | 'expert') => {
      let negatifs = 0;
      for (let g = 0; g < 400; g++) {
        const etat = jouerMois(
          creerPartie({ ...configTest(g, 12), difficulte }, DEMARRAGE_TEST),
          0,
        );
        const ent = etat.entreprises[0];
        const d = tirerDilemme(
          ent,
          DILEMMES,
          {
            mois: 3,
            derniere: undefined,
            index: 14,
            probabilite: 1,
            id: 'x',
            secteur,
            concurrents: etat.concurrents,
            poidsNature:
              difficulte === 'facile'
                ? { negatif: 0.5, positif: 1.4 }
                : { negatif: 1.4, positif: 0.8 },
          },
          new Rng(g),
        );
        const def = DILEMMES.find((x) => x.id === d?.defId);
        if ((def?.nature ?? 'negatif') === 'negatif') negatifs++;
      }
      return negatifs;
    };
    const secteur = secteurParId('cafe');
    expect(compter('facile')).toBeLessThan(compter('expert'));
  });
});
