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

// ---------------------------------------------------------------------------
// Taxes de vente (Jalon 2)
// ---------------------------------------------------------------------------
export const TAXES_VENTE = {
  tps: 0.05,
  tvq: 0.09975,
  /** Ventes taxables sur 4 trimestres civils consécutifs au-delà desquelles l'inscription est obligatoire. */
  seuilPetitFournisseur: 30_000,
  /** Fréquence de déclaration selon les fournitures taxables annuelles (on peut choisir plus souvent). */
  seuilsFrequence: { annuelleMax: 1_500_000, trimestrielleMax: 6_000_000 },
  /** Proportion des charges d'exploitation taxables (donnent droit aux CTI/RTI). */
  source: {
    url: 'https://www.revenuquebec.ca/fr/entreprises/taxes/tpstvh-et-tvq/',
    verifie: '2026-10-01',
    note: 'TPS 5 %, TVQ 9,975 %, seuil du petit fournisseur de 30 000 $. Les aliments préparés et les boissons servies dans un café sont taxables.',
  } satisfies Source,
} as const;

// ---------------------------------------------------------------------------
// Impôt des particuliers 2026
// ---------------------------------------------------------------------------
export interface Palier {
  /** Borne supérieure du palier ($), Infinity pour le dernier. */
  jusqua: number;
  taux: number;
}

export const IMPOT_PARTICULIERS_2026 = {
  federal: {
    paliers: [
      { jusqua: 58_523, taux: 0.14 },
      { jusqua: 117_045, taux: 0.205 },
      { jusqua: 181_440, taux: 0.26 },
      { jusqua: 258_482, taux: 0.29 },
      { jusqua: Infinity, taux: 0.33 },
    ] satisfies Palier[],
    montantPersonnelBase: 16_452,
    /** Taux des crédits non remboursables (= taux du 1er palier). */
    tauxCredits: 0.14,
    /** Abattement du Québec : réduction de l'impôt fédéral de base des résidents du Québec. */
    abattementQuebec: 0.165,
    source: {
      url: 'https://www.narcity.com/fr/tranches-impot-arc-canada-2026',
      verifie: '2026-10-01',
      note: 'Taux du 1er palier réduit à 14 % depuis le 1er janvier 2026. Seuils indexés par l’ARC.',
    } satisfies Source,
  },
  quebec: {
    paliers: [
      { jusqua: 54_345, taux: 0.14 },
      { jusqua: 108_680, taux: 0.19 },
      { jusqua: 132_245, taux: 0.24 },
      { jusqua: Infinity, taux: 0.2575 },
    ] satisfies Palier[],
    montantPersonnelBase: 18_952, // À VÉRIFIER : 18 571 $ (2025) indexé de 2,05 %
    tauxCredits: 0.14,
    source: {
      url: 'https://www.narcity.com/fr/nouvelles-tranches-revenu-quebec-impots-2026',
      verifie: '2026-10-01',
    } satisfies Source,
  },
  dividendes: {
    /** Majoration (« gross-up ») et crédits d'impôt pour dividendes, en % du dividende majoré. */
    nonDetermines: { majoration: 0.15, creditFederal: 0.090301, creditQuebec: 0.0342 },
    determines: { majoration: 0.38, creditFederal: 0.150198, creditQuebec: 0.117 },
    source: {
      url: 'https://wellington-altus.ca/wp-content/uploads/2026/09/AWPG_Personal_Tax_Cards_QC_08_2026_Final_EN.pdf',
      verifie: '2026-10-01',
    } satisfies Source,
  },
  /** Cotisations d'un travailleur autonome (il paie les deux parts du RRQ). */
  travailleurAutonome: {
    tauxRrq: 0.126,
    tauxRqap: 0.00764, // À VÉRIFIER : taux 2026 des travailleurs autonomes estimé (0,878 % en 2025 × baisse de 2026)
  },
} as const;

/** Taux des retenues de l'employé (2026). */
export const RETENUES_EMPLOYE_2026 = {
  rrq: 0.063,
  rqap: 0.0043,
  assuranceEmploi: 0.013,
  source: {
    url: 'https://www.revenuquebec.ca/fr/entreprises/retenues-a-la-source-et-cotisations-de-lemployeur/employeur-principaux-changements-2026/',
    verifie: '2026-10-01',
  } satisfies Source,
} as const;

// ---------------------------------------------------------------------------
// Impôt des sociétés (SPCC, années d'imposition commençant en 2027)
// ---------------------------------------------------------------------------
export const IMPOT_SOCIETES = {
  plafondAffaires: 500_000,
  federal: { tauxGeneral: 0.15, tauxPetiteEntreprise: 0.09 },
  quebec: {
    tauxGeneral: 0.115,
    /** Taux réduit de 3,2 % à 2,2 % pour les années commençant après le 29 avril 2026. */
    tauxPetiteEntreprise: 0.022,
    /** Critère des heures rémunérées : DPE complète à 5 500 h, réduite linéairement entre 5 000 et 5 500 h. */
    heuresMinimum: 5_000,
    heuresCompletes: 5_500,
  },
  /** Seuil d'impôt de l'année précédente au-delà duquel des acomptes provisionnels mensuels sont exigés. */
  seuilAcomptes: 3_000,
  source: {
    url: 'https://www.crowe.com/ca/crowebgk/fr-ca/publications/tax-update-quebec-cuts-small-business-corporate-tax-rate',
    verifie: '2026-10-01',
    note: 'Taux du Québec pour PME réduit à 2,2 % (années commençant après le 29 avril 2026); fédéral : 9 % (DPE) et 15 %.',
  } satisfies Source,
} as const;

/** Déduction pour amortissement (DPA) : taux des catégories utilisées. */
export const DPA = {
  /** Taux dégressifs (la catégorie 13 est linéaire sur la durée du bail). */
  taux: { '8': 0.2, '10': 0.3, '12': 1, '13': 0, '50': 0.55 },
  noms: {
    '8': 'Catégorie 8 – mobilier et équipement (20 %)',
    '10': 'Catégorie 10 – véhicules (30 %)',
    '12': 'Catégorie 12 – logiciels (100 %)',
    '13': 'Catégorie 13 – améliorations locatives (durée du bail)',
    '50': 'Catégorie 50 – matériel informatique (55 %)',
  },
  /**
   * Incitatif à l'investissement accéléré (rétabli par le budget fédéral 2025, projet de loi C-15) :
   * l'année d'acquisition, la DPA vaut 1,5 fois le taux normal (au lieu de la moitié avec la
   * règle de la demi-année) pour les biens prêts à être mis en service avant 2030. De 2030 à
   * 2033, seule la règle de la demi-année est suspendue; ensuite, elle s'applique de nouveau.
   */
  facteurPremiereAnnee: (annee: number): number =>
    annee <= 2029 ? 1.5 : annee <= 2033 ? 1 : 0.5,
  source: {
    url: 'https://www.mccarthy.ca/fr/references/blogues/consumer-markets-perspectives/le-budget-2025-comprend-des-incitatifs-fiscaux-appeles-superdeduction-a-la-productivite-et-l-elimination-de-la-taxe-de-luxe-sur-certains-aeronefs-et-navires',
    verifie: '2026-10-01',
    note: 'Catégories de DPA (ARC) et incitatif à l’investissement accéléré prolongé (budget 2025, « super-déduction à la productivité »).',
  } satisfies Source,
} as const;

/** Taux de change du dollar américain (prix des fournisseurs importés). */
export const TAUX_CHANGE = {
  /** Dollars canadiens pour 1 $ US au début de la partie. */
  usdCadInitial: 1.38,
  /** Taux de référence des prix des fournisseurs en $ US. */
  reference: 1.38,
  bornes: { min: 1.2, max: 1.55 },
  source: {
    url: 'https://www.poundsterlinglive.com/history/CAD-USD-2026',
    verifie: '2026-10-01',
    note: 'Environ 0,72 $ US pour 1 $ CA en septembre 2026, soit environ 1,38 $ CA pour 1 $ US.',
  } satisfies Source,
} as const;

// ---------------------------------------------------------------------------
// Registraire des entreprises du Québec (REQ) et constitution fédérale
// ---------------------------------------------------------------------------
export const FRAIS_REQ_2026 = {
  individuelle: { immatriculation: 41, miseAJourAnnuelle: 41 },
  societePersonnes: { immatriculation: 63, miseAJourAnnuelle: 63 },
  societeActionsQc: { constitution: 397, miseAJourAnnuelle: 106 },
  /** Société fédérale : constitution auprès de Corporations Canada + immatriculation au REQ. */
  societeActionsFederale: {
    constitutionCorporationsCanada: 200, // À VÉRIFIER : frais de dépôt en ligne de Corporations Canada
    immatriculationReq: 397, // À VÉRIFIER : immatriculation d'une société constituée hors Québec
    miseAJourAnnuelle: 106,
  },
  /** Pénalité si la déclaration de mise à jour annuelle est produite en retard. */
  penaliteRetard: 0.5,
  source: {
    url: 'https://www.quebec.ca/entreprises-et-travailleurs-autonomes/tarifs-registraire-entreprises/societe-par-actions',
    verifie: '2026-10-01',
    note: 'Tarifs réguliers en vigueur le 1er janvier 2026 (entreprise individuelle, société de personnes, société par actions).',
  } satisfies Source,
} as const;

/** Taux d'intérêt sur les montants dus aux gouvernements (estimation). */
export const INTERETS_FISCAUX = {
  tauxAnnuel: 0.07, // À VÉRIFIER : taux prescrit de Revenu Québec et de l'ARC sur les soldes dus
} as const;
