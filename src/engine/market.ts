/**
 * Modèle de demande (logit multinomial avec option « ne rien acheter ici »).
 *
 * Chaque commerce reçoit un score d'utilité qui dépend du prix, de la qualité
 * perçue, du service, de l'ambiance, des avis et des heures d'ouverture.
 * Seuls les clients qui connaissent le commerce le considèrent : l'attrait est
 * donc multiplié par la notoriété. L'option « alternative » (faire son café à la
 * maison, aller ailleurs) rend la demande totale sensible au niveau des prix.
 */
import type { LigneProduit, Secteur } from './data-types';
import { borner } from './util';

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
}

/** Facteur des taxes de vente au Québec (TPS 5 % + TVQ 9,975 %). */
const FACTEUR_TAXES_MARCHE = 1.14975;

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
 * Pondéré selon l'importance de chaque ligne dans le panier moyen.
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

export function utiliteOffre(offre: Offre, secteur: Secteur, indicePrix = 1): number {
  const s = secteur.sensibilites;
  const ip = indicePrixClient(offre, secteur, indicePrix);
  const heures = Math.max(1, offre.heuresOuverture) / secteur.heuresOuvertureReference;
  return (
    -s.prix * (ip - 1) +
    s.qualite * (offre.qualite - 0.5) +
    s.service * (offre.service - 0.5) +
    s.ambiance * (offre.ambiance - 0.5) +
    s.note * (offre.note - 3.5) +
    s.heures * Math.log(heures) +
    (offre.bonusEmplacement ?? 0)
  );
}

/** Ventes par ligne pour un nombre de visites servies. */
export function ventesParLigne(
  offre: Offre,
  secteur: Secteur,
  visites: number,
  indicePrix = 1,
): VenteLigne[] {
  return secteur.lignes.map((ligne) => {
    const prix = offre.prix[ligne.id] ?? prixReference(ligne, indicePrix);
    const unites = Math.round(visites * tauxAchatLigne(ligne, prix, offre.qualite, indicePrix));
    return { ligneId: ligne.id, unites, chiffreAffaires: Math.round(unites * prix * 100) / 100 };
  });
}

/** Proportion des clients refoulés (commerce plein) qui essaient un autre commerce. */
const PART_DEBORDEMENT = 0.6;

export function simulerMarche(
  offres: readonly Offre[],
  secteur: Secteur,
  potentiel: number,
  indicePrix = 1,
): ResultatMarche {
  const attraitAlternatif = Math.exp(secteur.utiliteAlternative);
  const calculs = offres.map((offre) => {
    const utilite = utiliteOffre(offre, secteur, indicePrix);
    const attrait = borner(offre.notoriete, 0.005, 1) * Math.exp(utilite);
    return { offre, utilite, attrait };
  });
  const totalAttrait = attraitAlternatif + calculs.reduce((acc, c) => acc + c.attrait, 0);

  // Demande initiale de chaque commerce.
  const demandes = calculs.map((c) => Math.round((potentiel * c.attrait) / totalAttrait));
  const capacites = calculs.map((c) => Math.max(0, Math.floor(c.offre.capaciteVisites)));

  // Débordement : une partie des clients qui trouvent un commerce plein vont chez un
  // concurrent qui a encore de la place (au prorata de son attrait); les autres renoncent.
  const debordement = calculs.reduce(
    (acc, _c, i) => acc + Math.max(0, demandes[i] - capacites[i]),
    0,
  );
  const recus = calculs.map(() => 0);
  if (debordement > 0) {
    const ouverts = calculs
      .map((c, i) => ({ i, attrait: c.attrait, place: capacites[i] - demandes[i] }))
      .filter((x) => x.place > 0);
    const attraitOuverts = attraitAlternatif + ouverts.reduce((a, x) => a + x.attrait, 0);
    for (const x of ouverts) {
      recus[x.i] = Math.min(
        x.place,
        Math.round((PART_DEBORDEMENT * debordement * x.attrait) / attraitOuverts),
      );
    }
  }

  const resultats: Record<string, ResultatOffre> = {};
  let totalServies = 0;
  for (const [i, { offre, utilite, attrait }] of calculs.entries()) {
    const demande = demandes[i] + recus[i];
    const apresCapacite = Math.min(demande, capacites[i]);
    const perduesRupture = Math.round(apresCapacite * borner(offre.tauxRupture ?? 0, 0, 1));
    const servies = apresCapacite - perduesRupture;
    const ventes = ventesParLigne(offre, secteur, servies, indicePrix);
    const chiffreAffaires =
      Math.round(ventes.reduce((a, v) => a + v.chiffreAffaires, 0) * 100) / 100;
    resultats[offre.id] = {
      utilite,
      attrait,
      demande,
      servies,
      perduesCapacite: demande - apresCapacite,
      perduesRupture,
      part: 0,
      ventes,
      chiffreAffaires,
      ticketMoyen: servies > 0 ? chiffreAffaires / servies : 0,
    };
    totalServies += servies;
  }
  for (const r of Object.values(resultats)) {
    r.part = totalServies > 0 ? r.servies / totalServies : 0;
  }
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
 */
export function evoluerNotoriete(
  notoriete: number,
  budgetPublicite: number,
  visibilite: number,
  partVisites: number,
  satisfaction: number,
): number {
  const pub = 0.13 * (1 - Math.exp(-Math.max(0, budgetPublicite) / 3000));
  const boucheAOreille = 0.3 * borner(partVisites, 0, 1) * borner(satisfaction, 0, 1);
  const gain = (1 - notoriete) * (pub + visibilite + boucheAOreille);
  return borner(notoriete * (1 - 0.07) + gain, 0.01, 0.98);
}
