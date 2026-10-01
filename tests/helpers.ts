import {
  CANAUX,
  FORMATIONS,
  PLATEFORMES,
  SECTEURS,
  VILLES,
  fournisseursCategorie,
  secteurParId,
  villeParId,
} from '../src/data';
import { Rng } from '../src/engine/rng';
import { IDS_DEMARCHES } from '../src/engine/conformite';
import { ventesReference } from '../src/engine/financement';
import {
  accueillirInvestisseur,
  afficherPoste,
  augmentationGenerale,
  changerFournisseur,
  changerFrequenceTaxes,
  commanderEtude,
  congedier,
  creerPartie,
  demanderHausseMarge,
  demanderPret,
  embaucher,
  embaucherCandidat,
  emplacementDe,
  erreursSources,
  evaluerEmploye,
  formerEmploye,
  formerProprietaireHygiene,
  inscrireTaxes,
  investir,
  lancerProduit,
  modifierDecisions,
  modifierHeuresEmploye,
  modifierSalaireEmploye,
  placer,
  planifierIncorporation,
  produireMiseAJourAnnuelle,
  regulariserDemarche,
  repondreDilemme,
  retirerPlacement,
  retirerProduit,
  simulerMois,
  soumettre,
} from '../src/engine/simulation';
import { dilemmeParId } from '../src/data';
import type {
  ConfigPartie,
  DureePartie,
  EtatPartie,
  FormeJuridique,
  IdDemarche,
  ParametresDemarrage,
  PlanAffaires,
} from '../src/engine/types';
import type { IdTypeEtude } from '../src/engine/data-types';

export function configTest(
  graine: number,
  dureeMois: DureePartie = 36,
  secteurId = 'cafe',
): ConfigPartie {
  return {
    graine,
    difficulte: 'realiste',
    dureeMois,
    secteurId,
    villeId: 'montreal',
    anneeDepart: 2027,
  };
}

export const DEMARRAGE_TEST: ParametresDemarrage = {
  nomEntreprise: 'Café Test',
  nomProprietaire: 'Alex',
  couleur: '#3b82f6',
  emplacementId: 'rue',
  equipementId: 'neuf',
  amenagementId: 'chaleureux',
  apportPersonnel: 45_000,
  montantPret: 85_000,
  typeTauxPret: 'fixe',
  formeJuridique: 'individuelle',
  nomAssocie: '',
  apportAssocie: 0,
  demarches: [
    'req',
    'retenues',
    'cnesst',
    'permisMunicipal',
    'mapaq',
    'assurances',
    'compteBancaire',
    'francisation',
  ],
  inscritTaxes: true,
  ageProprietaire: 30,
  financements: {},
  planAffaires: null,
  methodeInventaire: 'coutMoyen',
};

/** Plan d'affaires réaliste (ventes au niveau du repère des prêteurs). */
export function planRealiste(
  secteurId = 'cafe',
  villeId = 'montreal',
  emplacementId = 'rue',
): PlanAffaires {
  const secteur = secteurParId(secteurId);
  const ville = villeParId(villeId);
  const [min, max] = secteur.margeBruteCible;
  return {
    ventesMensuelles: ventesReference(secteur, ville, emplacementDe(ville, emplacementId)),
    margeBrute: Math.round(((min + max) / 2) * 100) / 100,
    clienteleCible: 'professionnels',
    moisFondsRoulement: 4,
  };
}

/** Paramètres de démarrage adaptés à un secteur (emplacement permis, permis du secteur). */
export function demarrageSecteur(secteurId: string, base = DEMARRAGE_TEST): ParametresDemarrage {
  const secteur = secteurParId(secteurId);
  return {
    ...base,
    // Le premier emplacement permis est le choix typique du secteur (ex. local industriel pour un atelier).
    emplacementId: secteur.emplacements[0],
    demarches: [...new Set([...base.demarches, ...(secteur.permis as IdDemarche[])])],
  };
}

export function nouvellePartie(
  graine: number,
  dureeMois: DureePartie = 36,
  secteurId = 'cafe',
  villeId = 'montreal',
): EtatPartie {
  return creerPartie(
    { ...configTest(graine, dureeMois, secteurId), villeId },
    demarrageSecteur(secteurId),
  );
}

const ETUDES: IdTypeEtude[] = [
  'donneesSecondaires',
  'sondageEclair',
  'sondageComplet',
  'groupeDiscussion',
  'analyseConcurrence',
];

/** Joue des décisions aléatoires (même absurdes) pour éprouver le moteur. */
export function tourAleatoire(etat: EtatPartie, rng: Rng): EtatPartie {
  const ent = etat.entreprises[0];
  const id = ent.id;
  const secteur = secteurParId(etat.config.secteurId);
  const prix: Record<string, number> = {};
  for (const ligne of [...secteur.lignes, ...secteur.nouveauxProduits])
    prix[ligne.id] = ligne.prixReference * rng.range(0.5, 1.8);
  const publicite: Record<string, number> = {};
  for (const c of CANAUX) if (rng.chance(0.3)) publicite[c.id] = rng.int(0, 3000);
  let e = modifierDecisions(etat, id, {
    prix,
    qualiteId: rng.pick(secteur.qualites).id,
    publicite,
    heuresOuverture: rng.int(30, 112),
    heuresProprietaire: rng.int(0, 70),
    prelevements: rng.int(0, 6000),
    remboursementAutoMarge: rng.chance(0.7),
    apportPonctuel: rng.chance(0.05) ? rng.int(1000, 20000) : 0,
    remboursementAnticipe: rng.chance(0.05) ? rng.int(1000, 30000) : 0,
    promotion: rng.chance(0.2) ? rng.range(0, 0.3) : 0,
    programmeFidelite: rng.chance(0.4),
    initiativesEco: secteur.initiativesEco.filter(() => rng.chance(0.3)),
    panierBleu: rng.chance(0.5),
    livraison: rng.chance(0.4),
    reponseAvis: rng.pick(['ignorer', 'repondre', 'compenser'] as const),
    satisfactionGarantie: rng.chance(0.4),
    avantages: ['repas', 'assurance', 'flexibilite', 'rabais'].filter(() => rng.chance(0.25)),
    prendreEscomptes: rng.chance(0.5),
    methodeInventaire: rng.chance(0.5) ? 'peps' : 'coutMoyen',
    prevision: rng.chance(0.5)
      ? { ventes: rng.int(10_000, 60_000), benefice: rng.int(-10_000, 10_000) }
      : null,
  });

  // Ressources humaines
  if (rng.chance(0.15)) e = embaucher(e, id, rng.int(8, 45), rng.pick(secteur.postes));
  if (rng.chance(0.2)) e = afficherPoste(e, id, rng.pick(secteur.postes), rng.pick(PLATEFORMES).id);
  const candidats = e.entreprises[0].rh.candidats.filter((c) => c.statut === 'disponible');
  if (candidats.length > 0 && rng.chance(0.5)) {
    const c = rng.pick(candidats);
    e = embaucherCandidat(e, id, c.id, c.attentes * rng.range(0.9, 1.1), rng.int(8, 40));
  }
  const employes = () => e.entreprises[0].employes;
  if (employes().length > 0 && rng.chance(0.12)) e = congedier(e, id, rng.pick(employes()).id);
  if (employes().length > 0 && rng.chance(0.2))
    e = modifierHeuresEmploye(e, id, rng.pick(employes()).id, rng.int(5, 50));
  if (employes().length > 0 && rng.chance(0.15))
    e = modifierSalaireEmploye(e, id, rng.pick(employes()).id, rng.range(10, 30));
  if (employes().length > 0 && rng.chance(0.1))
    e = formerEmploye(e, id, rng.pick(employes()).id, rng.pick(FORMATIONS).id);
  if (employes().length > 0 && rng.chance(0.1)) e = evaluerEmploye(e, id, rng.pick(employes()).id);
  if (rng.chance(0.05)) e = augmentationGenerale(e, id, rng.range(0, 0.06));
  if (rng.chance(0.05)) e = formerProprietaireHygiene(e, id);
  for (const d of e.entreprises[0].dilemmes) {
    if (rng.chance(0.7)) e = repondreDilemme(e, id, d.id, rng.pick(dilemmeParId(d.defId).choix).id);
  }

  // Marketing, opérations et ventes
  if (rng.chance(0.06)) e = commanderEtude(e, id, rng.pick(ETUDES));
  if (rng.chance(0.06)) e = lancerProduit(e, id, rng.pick(secteur.nouveauxProduits).id);
  if (rng.chance(0.02)) e = retirerProduit(e, id, rng.pick(secteur.nouveauxProduits).id);
  if (rng.chance(0.08)) {
    const ligne = rng.pick(secteur.lignes);
    e = changerFournisseur(
      e,
      id,
      ligne.id,
      rng.pick(fournisseursCategorie(ligne.categorieAppro)).id,
    );
  }
  if (rng.chance(0.08)) {
    const ligne = rng.pick(secteur.lignes);
    const p = e.entreprises[0].decisions.approvisionnement[ligne.id];
    if (p)
      e = modifierDecisions(e, id, {
        approvisionnement: {
          ...e.entreprises[0].decisions.approvisionnement,
          [ligne.id]: {
            ...p,
            auto: rng.chance(0.5),
            pointCommande: rng.int(0, 400),
            quantite: rng.int(1, 900),
          },
        },
      });
  }
  for (const a of e.entreprises[0].b2b.appels)
    if (rng.chance(0.7)) e = soumettre(e, id, a.id, a.prixCible * rng.range(0.8, 1.3));

  // Finance
  if (rng.chance(0.05))
    e = investir(
      e,
      id,
      rng.pick(secteur.investissements).id,
      rng.pick(['comptant', 'pretFixe', 'pretVariable'] as const),
    );
  if (rng.chance(0.03))
    e = demanderPret(
      e,
      id,
      rng.int(5000, 60000),
      rng.int(12, 84),
      rng.chance(0.5) ? 'fixe' : 'variable',
    );
  if (rng.chance(0.05))
    e = placer(e, id, rng.pick(['ceie', 'cpg6', 'cpg12']), rng.int(1000, 20000));
  const placements = e.entreprises[0].finance.placements;
  if (placements.length > 0 && rng.chance(0.2))
    e = retirerPlacement(e, id, rng.pick(placements).id);
  if (rng.chance(0.03)) e = accueillirInvestisseur(e, id, rng.int(10_000, 80_000));
  if (rng.chance(0.03)) e = demanderHausseMarge(e, id, rng.int(10_000, 60_000));

  // Jalon 2 : rémunération d'une société, taxes, démarches et obligations
  e = modifierDecisions(e, id, {
    salaireDirigeant: rng.chance(0.7) ? rng.int(0, 6000) : 0,
    dividendePonctuel: rng.chance(0.08) ? rng.int(500, 15000) : 0,
  });
  if (rng.chance(0.05)) e = inscrireTaxes(e, id);
  if (rng.chance(0.05))
    e = changerFrequenceTaxes(e, id, rng.pick(['mensuelle', 'trimestrielle', 'annuelle'] as const));
  if (rng.chance(0.05)) e = regulariserDemarche(e, id, rng.pick(IDS_DEMARCHES));
  if (rng.chance(0.1)) e = produireMiseAJourAnnuelle(e, id);
  if (rng.chance(0.03))
    e = planifierIncorporation(e, id, rng.pick(['inc-qc', 'inc-federal'] as const));
  return simulerMois(e);
}

const FORMES: FormeJuridique[] = ['individuelle', 'senc', 'sec', 'inc-qc', 'inc-federal'];

/** Paramètres de démarrage variés selon la graine (forme juridique, démarches, financement). */
export function demarrageVarie(graine: number): ParametresDemarrage {
  const forme = FORMES[graine % FORMES.length];
  const financements: ParametresDemarrage['financements'] =
    forme === 'individuelle'
      ? { loveMoney: 10_000, creavenir: 10_000 }
      : forme === 'senc' || forme === 'sec'
        ? { bdc: 30_000 }
        : forme === 'inc-qc'
          ? { ange: 30_000, futurpreneur: 20_000 }
          : { fondsLocal: 25_000 };
  return {
    ...DEMARRAGE_TEST,
    formeJuridique: forme,
    nomAssocie: 'Sam Roy',
    apportAssocie: forme === 'senc' || forme === 'sec' ? 20_000 : 0,
    demarches: IDS_DEMARCHES.filter((_, i) => (graine >> i) % 2 === 0 || graine % 4 === 0),
    inscritTaxes: graine % 3 !== 0,
    financements: graine % 7 === 0 ? {} : financements,
    planAffaires: planRealiste(),
    typeTauxPret: graine % 2 === 0 ? 'fixe' : 'variable',
    methodeInventaire: graine % 2 === 0 ? 'peps' : 'coutMoyen',
  };
}

/** Ajuste le plan d'affaires au secteur, à la ville et à l'emplacement choisis. */
function plan(secteurId: string, villeId: string, p: ParametresDemarrage): ParametresDemarrage {
  const avecPlan = { ...p, planAffaires: planRealiste(secteurId, villeId, p.emplacementId) };
  // Les sources qui ne respectent pas leurs conditions (ex. part maximale du projet) sont retirées.
  const invalides = new Set<string>(
    erreursSources(avecPlan, secteurParId(secteurId), villeParId(villeId)).map((e) => e.source),
  );
  const financements = Object.fromEntries(
    Object.entries(avecPlan.financements).filter(([id]) => !invalides.has(id)),
  );
  return { ...avecPlan, financements };
}

/** Partie aléatoire : le secteur, la ville et la difficulté varient selon la graine. */
export function jouerAleatoirement(graine: number, mois: DureePartie): EtatPartie {
  const rng = new Rng(graine * 7919 + 13);
  const secteur = SECTEURS[graine % SECTEURS.length];
  const ville = VILLES[Math.floor(graine / SECTEURS.length) % VILLES.length];
  const difficultes = ['facile', 'realiste', 'expert'] as const;
  let etat = creerPartie(
    {
      ...configTest(graine, mois, secteur.id),
      villeId: ville.id,
      difficulte: difficultes[graine % 3],
    },
    plan(secteur.id, ville.id, demarrageSecteur(secteur.id, demarrageVarie(graine))),
  );
  while (!etat.terminee) etat = tourAleatoire(etat, rng);
  return etat;
}

/**
 * Gestion minimale entre deux mois : remplacer les employés partis (garder l'équipe de
 * départ du secteur) et trancher les événements avec le premier choix.
 */
export function gererMinimalement(etat: EtatPartie): EtatPartie {
  let e = etat;
  const id = e.entreprises[0].id;
  const secteur = secteurParId(e.config.secteurId);
  for (const eq of secteur.equipeDepart) {
    while (
      !e.terminee &&
      e.entreprises[0].employes.filter((x) => x.posteId === eq.posteId).length < eq.nombre
    )
      e = embaucher(e, id, undefined, eq.posteId);
  }
  for (const d of e.entreprises[0].dilemmes)
    e = repondreDilemme(e, id, d.id, dilemmeParId(d.defId).choix[0].id);
  return e;
}

/** Joue un nombre de mois avec les décisions par défaut et une gestion minimale. */
export function jouerMois(etat: EtatPartie, mois: number): EtatPartie {
  let e = etat;
  for (let i = 0; i < mois && !e.terminee; i++) e = simulerMois(gererMinimalement(e));
  return e;
}

/** Joue toute la partie avec les décisions par défaut et une gestion minimale. */
export function jouerParDefaut(etat: EtatPartie): EtatPartie {
  return jouerMois(etat, etat.config.dureeMois);
}
