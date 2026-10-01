/**
 * Modèle de demande (logit multinomial avec option « ne rien acheter ici »).
 *
 * Le marché est découpé en segments (personas : étudiants, familles…). Dans chaque
 * segment, chaque commerce reçoit un score d'utilité qui dépend du prix, de la qualité
 * perçue, du service, de l'ambiance, des avis, des heures d'ouverture, de
 * l'écoresponsabilité et de l'achat local, pondérés selon les sensibilités du segment.
 * Seuls les clients qui connaissent le commerce le considèrent : l'attrait est donc
 * multiplié par la notoriété dans le segment. L'option « alternative » (faire son café
 * à la maison, aller ailleurs) rend la demande totale sensible au niveau des prix.
 * Un bassin séparé représente les commandes passées sur une plateforme de livraison.
 */
import type { LigneProduit, Secteur, Sensibilites } from './data-types';
import { borner } from './util';

export interface LigneOffre {
  ligne: LigneProduit;
  /** Qualité de la ligne (0 à 1); par défaut, la qualité de l'offre. */
  qualite?: number;
  /** Multiplicateur de la demande (ex. nouveau produit qui n'a pas trouvé son public). */
  facteur?: number;
  /** Multiplicateur du panier par segment (remplace celui du secteur). */
  panier?: Record<string, number>;
}

export interface Offre {
  id: string;
  prix: Record<string, number>;
  /** Qualité perçue par les clients (0 à 1). */
  qualite: number;
  /** Qualité du service (0 à 1). */
  service: number;
  ambiance: number;
  /** Proportion des clients du marché qui connaissent le commerce (0 à 1). */
  notoriete: number;
  /** Notoriété par segment (sinon : la notoriété générale). */
  notorieteSegments?: Record<string, number>;
  /** Note moyenne des avis en ligne (1 à 5). */
  note: number;
  /** Heures d'ouverture effectives par semaine. */
  heuresOuverture: number;
  /** Nombre maximal de visites que le commerce peut servir ce mois-ci. */
  capaciteVisites: number;
  /** Proportion des visites perdues faute de stock (0 à 1). */
  tauxRupture?: number;
  /** Bonus (ou malus) d'utilité lié à l'emplacement (achalandage). */
  bonusEmplacement?: number;
  /**
   * Prix payé par le client / prix affiché : 1,14975 si le commerce perçoit la TPS et la TVQ,
   * 1 pour un petit fournisseur non inscrit. Par défaut : taxes perçues.
   */
  facteurPrixClient?: number;
  /** Écoresponsabilité perçue (0 à 1, 0,3 = commerce ordinaire). */
  eco?: number;
  /** Achat local perçu (0 à 1, 0,4 = commerce ordinaire). */
  local?: number;
  /** Offert sur une plateforme de livraison. */
  livraison?: boolean;
  /** Lignes offertes (par défaut : les lignes du secteur). */
  lignes?: LigneOffre[];
  /** Bonus d'utilité général (gamme, promotion, ruptures fréquentes…). */
  bonusUtilite?: number;
  /** Bonus d'utilité par segment (commande en ligne, fidélité…). */
  bonusSegments?: Record<string, number>;
  /** Image de marque (0 à 1) : une marque forte réduit la sensibilité au prix. */
  image?: number;
  /** Multiplicateur de la demande en magasin (ex. terrasse en été). */
  facteurDemande?: number;
}

/** Segment de clientèle tel que vu par le marché. */
export interface SegmentMarche {
  id: string;
  part: number;
  /** Multiplicateurs des sensibilités du secteur. */
  sensibilites: Omit<Sensibilites, 'note'>;
  panier: Record<string, number>;
}

export interface OptionsMarche {
  segments?: SegmentMarche[];
  /** Bassin des commandes livrées. */
  livraison?: { part: number; majoration: number; panier: Record<string, number> };
}

/** Facteur des taxes de vente au Québec (TPS 5 % + TVQ 9,975 %). */
const FACTEUR_TAXES_MARCHE = 1.14975;
/** Valeurs « neutres » de l'écoresponsabilité et de l'achat local. */
export const ECO_NEUTRE = 0.3;
export const LOCAL_NEUTRE = 0.4;

const SEGMENT_UNIQUE: SegmentMarche = {
  id: 'tous',
  part: 1,
  sensibilites: { prix: 1, qualite: 1, service: 1, ambiance: 1, heures: 1, eco: 1, local: 1 },
  panier: {},
};

/** Indice du prix payé par le client (taxes comprises) par rapport au marché. */
export function indicePrixClient(
  offre: Pick<Offre, 'prix' | 'facteurPrixClient'>,
  secteur: Secteur,
  indicePrix = 1,
): number {
  return (
    indicePrixOffre(offre.prix, secteur, indicePrix) *
    ((offre.facteurPrixClient ?? FACTEUR_TAXES_MARCHE) / FACTEUR_TAXES_MARCHE)
  );
}

export interface VenteLigne {
  ligneId: string;
  unites: number;
  chiffreAffaires: number;
}

export interface ResultatOffre {
  utilite: number;
  attrait: number;
  /** Visites que les clients voulaient faire (incluant les clients refoulés par un concurrent plein). */
  demande: number;
  /** Visites réellement servies. */
  servies: number;
  /** Visites perdues (capacité ou rupture de stock). */
  perduesCapacite: number;
  perduesRupture: number;
  /** Part de marché (visites servies / total des visites servies par tous les commerces). */
  part: number;
  ventes: VenteLigne[];
  chiffreAffaires: number;
  ticketMoyen: number;
  /** Demande et visites servies par segment (et « livraison »). */
  parSegment: Record<string, { demande: number; servies: number }>;
  /** Ventes par ligne des commandes livrées (incluses dans `ventes`). */
  ventesLivraison: VenteLigne[];
  chiffreAffairesLivraison: number;
}

export interface ResultatMarche {
  potentiel: number;
  partAlternative: number;
  totalServies: number;
  resultats: Record<string, ResultatOffre>;
}

/** Prix de référence d'une ligne, ajusté selon l'inflation cumulée. */
export function prixReference(ligne: LigneProduit, indicePrix: number): number {
  return ligne.prixReference * indicePrix;
}

/**
 * Indice de prix d'une offre : 1 = prix du marché, 1,10 = 10 % plus cher.
 * Pondéré selon l'importance de chaque ligne de base dans le panier moyen.
 */
export function indicePrixOffre(
  prix: Record<string, number>,
  secteur: Secteur,
  indicePrix = 1,
): number {
  let poids = 0;
  let total = 0;
  for (const ligne of secteur.lignes) {
    const ref = prixReference(ligne, indicePrix);
    const w = ligne.tauxAchat * ref;
    poids += w;
    total += w * ((prix[ligne.id] ?? ref) / ref);
  }
  return poids > 0 ? total / poids : 1;
}

/** Probabilité qu'une visite inclue un achat de cette ligne. */
export function tauxAchatLigne(
  ligne: LigneProduit,
  prix: number,
  qualite: number,
  indicePrix = 1,
): number {
  const ratio = Math.max(0.2, prix / prixReference(ligne, indicePrix));
  return borner(
    ligne.tauxAchat * Math.pow(ratio, -ligne.elasticite) * (0.85 + 0.3 * qualite),
    0,
    1,
  );
}

/** Utilité d'une offre pour un segment (en magasin). */
export function utiliteOffre(
  offre: Offre,
  secteur: Secteur,
  indicePrix = 1,
  segment: SegmentMarche = SEGMENT_UNIQUE,
): number {
  const s = secteur.sensibilites;
  const m = segment.sensibilites;
  const ip = indicePrixClient(offre, secteur, indicePrix);
  const heures = Math.max(1, offre.heuresOuverture) / secteur.heuresOuvertureReference;
  const marque = 1 - 0.3 * ((offre.image ?? 0.5) - 0.5);
  return (
    -s.prix * m.prix * marque * (ip - 1) +
    s.qualite * m.qualite * (offre.qualite - 0.5) +
    s.service * m.service * (offre.service - 0.5) +
    s.ambiance * m.ambiance * (offre.ambiance - 0.5) +
    s.note * (offre.note - 3.5) +
    s.heures * m.heures * Math.log(heures) +
    (s.eco ?? 0) * m.eco * ((offre.eco ?? ECO_NEUTRE) - ECO_NEUTRE) +
    (s.local ?? 0) * m.local * ((offre.local ?? LOCAL_NEUTRE) - LOCAL_NEUTRE) +
    (offre.bonusEmplacement ?? 0) +
    (offre.bonusUtilite ?? 0) +
    (offre.bonusSegments?.[segment.id] ?? 0)
  );
}

/** Utilité d'une offre pour les clients qui commandent par une plateforme de livraison. */
function utiliteLivraison(offre: Offre, secteur: Secteur, indicePrix: number, majoration: number) {
  const s = secteur.sensibilites;
  const ip = indicePrixClient(offre, secteur, indicePrix) * (1 + majoration);
  return (
    -s.prix * (ip - 1) +
    s.qualite * (offre.qualite - 0.5) +
    s.note * (offre.note - 3.5) +
    (s.eco ?? 0) * ((offre.eco ?? ECO_NEUTRE) - ECO_NEUTRE) +
    (offre.bonusUtilite ?? 0)
  );
}

function lignesDe(offre: Offre, secteur: Secteur): LigneOffre[] {
  return offre.lignes ?? secteur.lignes.map((ligne) => ({ ligne }));
}

/** Ventes par ligne pour un nombre de visites servies (panier d'un segment). */
export function ventesParLigne(
  offre: Offre,
  secteur: Secteur,
  visites: number,
  indicePrix = 1,
  panier: (l: LigneOffre) => number = () => 1,
): VenteLigne[] {
  return lignesDe(offre, secteur).map((lo) => {
    const prix = offre.prix[lo.ligne.id] ?? prixReference(lo.ligne, indicePrix);
    const unites = Math.round(
      visites *
        tauxAchatLigne(lo.ligne, prix, lo.qualite ?? offre.qualite, indicePrix) *
        (lo.facteur ?? 1) *
        panier(lo),
    );
    return {
      ligneId: lo.ligne.id,
      unites,
      chiffreAffaires: Math.round(unites * prix * 100) / 100,
    };
  });
}

function additionner(a: VenteLigne[], b: VenteLigne[]): VenteLigne[] {
  const total = new Map<string, VenteLigne>();
  for (const v of [...a, ...b]) {
    const x = total.get(v.ligneId) ?? { ligneId: v.ligneId, unites: 0, chiffreAffaires: 0 };
    x.unites += v.unites;
    x.chiffreAffaires = Math.round((x.chiffreAffaires + v.chiffreAffaires) * 100) / 100;
    total.set(v.ligneId, x);
  }
  return [...total.values()];
}

/** Proportion des clients refoulés (commerce plein) qui essaient un autre commerce. */
const PART_DEBORDEMENT = 0.6;

interface Bassin {
  id: string;
  potentiel: number;
  attraitAlternatif: number;
  /** Attrait de chaque offre dans ce bassin (0 si elle n'y participe pas). */
  attraits: number[];
  utilites: number[];
  panier: (l: LigneOffre) => number;
  livraison: boolean;
}

export function simulerMarche(
  offres: readonly Offre[],
  secteur: Secteur,
  potentiel: number,
  indicePrix = 1,
  options: OptionsMarche = {},
): ResultatMarche {
  const segments =
    options.segments && options.segments.length > 0 ? options.segments : [SEGMENT_UNIQUE];
  const attraitAlternatif = Math.exp(secteur.utiliteAlternative);

  // 1. Bassins : un par segment en magasin, plus la livraison.
  const bassins: Bassin[] = segments.map((seg) => {
    const utilites = offres.map((o) => utiliteOffre(o, secteur, indicePrix, seg));
    return {
      id: seg.id,
      potentiel: potentiel * seg.part,
      attraitAlternatif,
      utilites,
      attraits: offres.map(
        (o, i) =>
          borner(o.notorieteSegments?.[seg.id] ?? o.notoriete, 0.005, 1) *
          Math.exp(utilites[i]) *
          (o.facteurDemande ?? 1),
      ),
      panier: (l) => l.panier?.[seg.id] ?? seg.panier[l.ligne.id] ?? 1,
      livraison: false,
    };
  });
  const liv = options.livraison;
  if (liv && liv.part > 0 && offres.some((o) => o.livraison)) {
    const utilites = offres.map((o) => utiliteLivraison(o, secteur, indicePrix, liv.majoration));
    bassins.push({
      id: 'livraison',
      potentiel: potentiel * liv.part,
      attraitAlternatif,
      utilites,
      attraits: offres.map((o, i) =>
        o.livraison ? borner(o.notoriete, 0.005, 1) * Math.exp(utilites[i]) : 0,
      ),
      panier: (l) => liv.panier[l.ligne.id] ?? 1,
      livraison: true,
    });
  }

  // 2. Demande de chaque commerce dans chaque bassin.
  const demandesBassins = bassins.map((b) => {
    const total = b.attraitAlternatif + b.attraits.reduce((a, x) => a + x, 0);
    return b.attraits.map((x) => (b.potentiel * x) / total);
  });
  const demandes = offres.map((_o, i) => Math.round(demandesBassins.reduce((a, d) => a + d[i], 0)));
  const capacites = offres.map((o) => Math.max(0, Math.floor(o.capaciteVisites)));
  const potentielTotal = bassins.reduce((a, b) => a + b.potentiel, 0);
  const attraitMoyen = offres.map((_o, i) =>
    potentielTotal > 0
      ? bassins.reduce((a, b) => a + b.attraits[i] * b.potentiel, 0) / potentielTotal
      : 0,
  );

  // 3. Débordement : une partie des clients qui trouvent un commerce plein vont chez un
  // concurrent qui a encore de la place (au prorata de son attrait); les autres renoncent.
  const debordement = offres.reduce(
    (acc, _o, i) => acc + Math.max(0, demandes[i] - capacites[i]),
    0,
  );
  const recus = offres.map(() => 0);
  if (debordement > 0) {
    const ouverts = offres
      .map((_o, i) => ({ i, attrait: attraitMoyen[i], place: capacites[i] - demandes[i] }))
      .filter((x) => x.place > 0);
    const attraitOuverts = attraitAlternatif + ouverts.reduce((a, x) => a + x.attrait, 0);
    for (const x of ouverts) {
      recus[x.i] = Math.min(
        x.place,
        Math.round((PART_DEBORDEMENT * debordement * x.attrait) / attraitOuverts),
      );
    }
  }

  // 4. Visites servies, réparties entre les bassins, et ventes par ligne.
  const resultats: Record<string, ResultatOffre> = {};
  let totalServies = 0;
  for (const [i, offre] of offres.entries()) {
    const demande = demandes[i] + recus[i];
    const apresCapacite = Math.min(demande, capacites[i]);
    const perduesRupture = Math.round(apresCapacite * borner(offre.tauxRupture ?? 0, 0, 1));
    const servies = apresCapacite - perduesRupture;
    const demandeBrute = demandesBassins.reduce((a, d) => a + d[i], 0);
    const parSegment: Record<string, { demande: number; servies: number }> = {};
    let ventes: VenteLigne[] = [];
    let ventesLivraison: VenteLigne[] = [];
    let reste = servies;
    for (const [k, b] of bassins.entries()) {
      const partBassin = demandeBrute > 0 ? demandesBassins[k][i] / demandeBrute : 0;
      const s =
        k === bassins.length - 1 ? reste : Math.min(reste, Math.round(servies * partBassin));
      reste -= s;
      parSegment[b.id] = { demande: Math.round(demande * partBassin), servies: s };
      const v = ventesParLigne(offre, secteur, s, indicePrix, b.panier);
      if (b.livraison) ventesLivraison = v;
      ventes = additionner(ventes, v);
    }
    const chiffreAffaires =
      Math.round(ventes.reduce((a, v) => a + v.chiffreAffaires, 0) * 100) / 100;
    const utilite =
      potentielTotal > 0
        ? bassins.reduce((a, b) => a + b.utilites[i] * b.potentiel, 0) / potentielTotal
        : 0;
    resultats[offre.id] = {
      utilite,
      attrait: attraitMoyen[i],
      demande,
      servies,
      perduesCapacite: demande - apresCapacite,
      perduesRupture,
      part: 0,
      ventes,
      chiffreAffaires,
      ticketMoyen: servies > 0 ? chiffreAffaires / servies : 0,
      parSegment,
      ventesLivraison,
      chiffreAffairesLivraison:
        Math.round(ventesLivraison.reduce((a, v) => a + v.chiffreAffaires, 0) * 100) / 100,
    };
    totalServies += servies;
  }
  for (const r of Object.values(resultats)) {
    r.part = totalServies > 0 ? r.servies / totalServies : 0;
  }
  const totalAttrait = attraitAlternatif + attraitMoyen.reduce((a, x) => a + x, 0);
  return {
    potentiel,
    partAlternative: attraitAlternatif / totalAttrait,
    totalServies,
    resultats,
  };
}

/**
 * Évolution de la notoriété : la publicité et la visibilité de l'emplacement font
 * connaître le commerce (rendements décroissants), le bouche-à-oreille dépend du
 * nombre de clients satisfaits et l'oubli fait baisser la notoriété chaque mois.
 * @param gainPublicite gain de notoriété apporté par la publicité (0 à 1), ou un budget ($)
 *   quand `budgetEnDollars` est vrai (modèle simplifié des concurrents).
 * @param oubli proportion de la notoriété perdue chaque mois sans rappel
 */
export function evoluerNotoriete(
  notoriete: number,
  budgetPublicite: number,
  visibilite: number,
  partVisites: number,
  satisfaction: number,
  oubli = 0.07,
  gainPubliciteDirect?: number,
): number {
  const pub = gainPubliciteDirect ?? 0.13 * (1 - Math.exp(-Math.max(0, budgetPublicite) / 3000));
  const boucheAOreille = 0.3 * borner(partVisites, 0, 1) * borner(satisfaction, 0, 1);
  const gain = (1 - notoriete) * (pub + visibilite + boucheAOreille);
  return borner(notoriete * (1 - oubli) + gain, 0.01, 0.98);
}
