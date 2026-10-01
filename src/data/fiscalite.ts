/**
 * Paramètres fiscaux et sociaux utilisés par le moteur.
 *
 * Chaque valeur indique sa source officielle et la date de vérification.
 * Pour mettre le jeu à jour (nouvelle année), il suffit de modifier ce fichier :
 * le moteur ne contient aucun taux « codé en dur ».
 *
 * Les valeurs marquées « // À VÉRIFIER » sont listées dans DECISIONS.md.
 */

export interface Source {
  /** Adresse de la page officielle consultée. */
  url: string;
  /** Date de vérification (AAAA-MM-JJ). */
  verifie: string;
  note?: string;
}

/** Année des paramètres fiscaux (les taux 2026 sont utilisés pendant toute la partie, sauf indexation simulée). */
export const ANNEE_PARAMETRES = 2026;

// ---------------------------------------------------------------------------
// Salaire minimum (Loi sur les normes du travail, Règlement sur les normes du travail)
// ---------------------------------------------------------------------------
export const SALAIRE_MINIMUM = {
  /** Taux général, en dollars l'heure. */
  general: 16.6,
  /** Taux des salariés au pourboire, en dollars l'heure. */
  pourboire: 13.3,
  enVigueurDepuis: '2026-05-01',
  /** Mois de l'année (1-12) où le salaire minimum est révisé chaque année au Québec. */
  moisRevision: 5,
  /** Hausse annuelle simulée dans le jeu après 2026 (hypothèse de conception, voir DECISIONS.md). */
  hausseAnnuelleSimulee: 0.03,
  source: {
    url: 'https://www.quebec.ca/nouvelles/actualites/details/le-taux-general-du-salaire-minimum-passera-a-1660-lheure-le-1er-mai-2026-68123',
    verifie: '2026-09-30',
  } satisfies Source,
} as const;

// ---------------------------------------------------------------------------
// Cotisations de l'employeur (2026)
// ---------------------------------------------------------------------------
export const COTISATIONS_2026 = {
  /** Régime de rentes du Québec : taux de base 5,30 % + 1re cotisation supplémentaire 1 %. */
  rrq: {
    tauxEmployeur: 0.063,
    tauxEmploye: 0.063,
    maximumGainsAdmissibles: 74_600,
    exemptionGenerale: 3_500,
    source: {
      url: 'https://www.revenuquebec.ca/fr/entreprises/retenues-a-la-source-et-cotisations-de-lemployeur/calculer-les-retenues-a-la-source-et-vos-cotisations-demployeur/regime-de-rentes-du-quebec/maximum-du-salaire-admissible-et-taux-de-cotisation/',
      verifie: '2026-09-30',
    } satisfies Source,
  },
  /** 2e cotisation supplémentaire au RRQ (gains entre le MGA et le MSGA). */
  rrq2: {
    taux: 0.04,
    maximumSupplementaireGainsAdmissibles: 85_000,
    source: {
      url: 'https://www.revenuquebec.ca/fr/entreprises/retenues-a-la-source-et-cotisations-de-lemployeur/calculer-les-retenues-a-la-source-et-vos-cotisations-demployeur/regime-de-rentes-du-quebec/maximum-du-salaire-admissible-et-taux-de-cotisation/',
      verifie: '2026-09-30',
    } satisfies Source,
  },
  /** Régime québécois d'assurance parentale. */
  rqap: {
    tauxEmployeur: 0.00602,
    tauxEmploye: 0.0043,
    maximumRevenuAssurable: 103_000,
    source: {
      url: 'https://www.revenuquebec.ca/fr/entreprises/retenues-a-la-source-et-cotisations-de-lemployeur/calculer-les-retenues-a-la-source-et-vos-cotisations-demployeur/regime-quebecois-dassurance-parentale/maximum-de-revenus-assurables-et-taux-de-cotisation/',
      verifie: '2026-09-30',
    } satisfies Source,
  },
  /** Assurance-emploi, taux réduits applicables au Québec (à cause du RQAP). */
  assuranceEmploi: {
    tauxEmploye: 0.013,
    /** 1,4 × le taux de l'employé. */
    tauxEmployeur: 0.0182,
    maximumRemunerationAssurable: 68_900,
    source: {
      url: 'https://www.canada.ca/fr/emploi-developpement-social/nouvelles/2025/09/la-commission-de-lassurance-emploi-du-canada-determine-le-taux-de-cotisation-a-lassurance-emploi-pour-2026.html',
      verifie: '2026-09-30',
    } satisfies Source,
  },
  /** Fonds des services de santé : taux pour une masse salariale totale de 1 M$ ou moins (secteurs autres que primaire et manufacturier). */
  fss: {
    tauxPetiteMasseSalariale: 0.0165,
    seuilPetiteMasseSalariale: 1_000_000,
    source: {
      url: 'https://www.revenuquebec.ca/fr/entreprises/retenues-a-la-source-et-cotisations-de-lemployeur/calculer-les-retenues-a-la-source-et-vos-cotisations-demployeur/cotisation-de-lemployeur-au-fonds-des-services-de-sante/seuil-de-la-masse-salariale-totale-et-taux-de-cotisation-au-fss/',
      verifie: '2026-09-30',
    } satisfies Source,
  },
  /** Cotisation relative aux normes du travail (CNT), payée à Revenu Québec. */
  cnt: {
    taux: 0.0006, // À VÉRIFIER : taux 2026 non confirmé (0,06 % depuis plusieurs années)
    maximumRemunerationAssujettie: 103_000,
    source: {
      url: 'https://www.revenuquebec.ca/fr/entreprises/retenues-a-la-source-et-cotisations-de-lemployeur/calculer-les-retenues-a-la-source-et-vos-cotisations-demployeur/cotisation-relative-aux-normes-du-travail/',
      verifie: '2026-09-30',
      note: 'Taux reconduit, à confirmer pour 2026.',
    } satisfies Source,
  },
  /** CNESST (santé et sécurité du travail). Le taux dépend de l'unité de classification. */
  cnesst: {
    tauxMoyen2026: 0.0154,
    salaireMaximumAssurable: 103_000,
    source: {
      url: 'https://www.quebec.ca/nouvelles/actualites/details/financement-du-regime-quebecois-de-sante-et-de-securite-du-travail-pour-2026-la-cnesst-fixe-le-taux-moyen-de-cotisation-pour-2026-62890',
      verifie: '2026-09-30',
      note: 'Le taux propre à chaque secteur est dans secteurs.json (tauxCnesst).',
    } satisfies Source,
  },
} as const;

// ---------------------------------------------------------------------------
// Taux d'intérêt
// ---------------------------------------------------------------------------
export const TAUX_INTERET = {
  /** Taux directeur de la Banque du Canada au début de la partie. */
  tauxDirecteurInitial: 0.0225,
  /** Écart habituel entre le taux préférentiel des banques et le taux directeur. */
  ecartTauxPreferentiel: 0.022,
  /** Mois (1-12) des annonces de la Banque du Canada (calendrier type : 8 annonces par année). */
  moisAnnonces: [1, 3, 4, 6, 7, 9, 10, 12],
  bornes: { min: 0.0025, max: 0.06 },
  source: {
    url: 'https://www.banqueducanada.ca/2026/09/fad-communique-2026-09-02/',
    verifie: '2026-09-30',
    note: 'Taux directeur maintenu à 2,25 % le 2 septembre 2026; taux préférentiel de 4,45 %.',
  } satisfies Source,
} as const;

// ---------------------------------------------------------------------------
// Frais bancaires
// ---------------------------------------------------------------------------
export const FRAIS_TRAITEMENT_CARTES = {
  /** Taux moyen pondéré (débit + crédit) payé par un petit commerce. Estimation de conception. */
  taux: 0.022, // À VÉRIFIER : varie selon le fournisseur (Moneris, Square, Desjardins, etc.)
  source: {
    url: 'https://www.canada.ca/fr/ministere-finances/programmes/politique-secteur-financier/frais-cartes-credit.html',
    verifie: '2026-09-30',
    note: 'Estimation : 1,5 % à 2,5 % pour le crédit, moins pour le débit.',
  } satisfies Source,
} as const;
