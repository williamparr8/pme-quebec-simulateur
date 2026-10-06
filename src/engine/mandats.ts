/**
 * Mode « chef de département » : le joueur dirige un département et fait lui-même les calculs
 * à partir de documents sources. Ce module choisit les mandats du mois, les corrige, applique
 * les conséquences et décide quand le rapport d'évaluation est remis (chaque mois en Facile,
 * chaque trimestre en Réaliste, tous les 6 mois en Expert). Voir PLAN-DEPARTEMENTS.md.
 */
import { posteParId, secteurParId } from '../data';
import { payer } from './ecritures';
import { MANDATS_FINANCE } from './mandats-finance';
import type {
  DefinitionMandat,
  DepartementChef,
  DocumentSource,
  EnjeuMandat,
  MandatDuMois,
  ResultatMandat,
  UniteMandat,
} from './mandats-types';
import { congedier, embaucher, simulerMois } from './simulation';
import type { Difficulte, Entreprise, EtatPartie } from './types';
import { borner } from './util';

export * from './mandats-types';

export const MANDATS: readonly DefinitionMandat[] = [...MANDATS_FINANCE];
/** Départements jouables pour l'instant (les autres suivront). */
export const DEPARTEMENTS_DISPONIBLES: readonly DepartementChef[] = ['finance'];
export const MANDATS_PAR_MOIS = 3;
export const CONFIANCE_DEPART = 50;
const GAIN_CONFIANCE = 3;
const PERTE_CONFIANCE = 6;

/** Onglet du jeu que dirige chaque chef (les autres onglets sont verrouillés). */
export const ONGLET_DEPARTEMENT: Record<DepartementChef, string> = {
  finance: 'finance',
  fiscalite: 'juridique',
  ventes: 'ventes',
  operations: 'operations',
  rh: 'rh',
  marketing: 'marketing',
};

/** Frais causés par une erreur, selon l'enjeu du mandat. */
export const FRAIS_ENJEU: Record<EnjeuMandat, number> = { faible: 0, moyen: 150, eleve: 400 };

/** Nombre de mois entre deux rapports d'évaluation. */
export function cadenceRapport(d: Difficulte): number {
  return d === 'facile' ? 1 : d === 'realiste' ? 3 : 6;
}

/** Aide offerte selon le niveau : formule et indices, formule seulement, ou rien. */
export function aideMandat(d: Difficulte): {
  formule: boolean;
  indices: boolean;
  lignesInutiles: boolean;
} {
  return { formule: d !== 'expert', indices: d === 'facile', lignesInutiles: d === 'expert' };
}

/** Documents tels que le joueur les voit (les lignes inutiles n'apparaissent qu'en Expert). */
export function documentsVisibles(m: MandatDuMois, d: Difficulte): DocumentSource[] {
  if (aideMandat(d).lignesInutiles) return m.documents;
  return m.documents.map((doc) => ({ ...doc, lignes: doc.lignes.filter((l) => !l.inutile) }));
}

/** Une réponse est juste à 1 % près (avec un petit plancher pour les arrondis). */
export function estCorrect(reponse: number, attendu: number, unite: UniteMandat): boolean {
  const plancher: Record<UniteMandat, number> = {
    dollars: 1,
    pourcent: 0.15,
    ratio: 0.02,
    nombre: 0.5,
  };
  // Petite marge pour les erreurs d'arrondi des nombres à virgule (1,52 − 1,5 ≠ 0,02 exactement).
  const tolerance = Math.max(Math.abs(attendu) * 0.01, plancher[unite]) + 1e-9;
  return Math.abs(reponse - attendu) <= tolerance;
}

/** Mandats du mois : 3 mandats du département, en rotation parmi ceux qui s'appliquent. */
export function genererMandats(etat: EtatPartie, ent: Entreprise): MandatDuMois[] {
  const departement = ent.chef?.departement ?? etat.config.chefDepartement;
  if (!departement) return [];
  const ctx = { etat, ent, derniere: ent.archives.at(-1), precedente: ent.archives.at(-2) };
  const possibles: MandatDuMois[] = [];
  for (const def of MANDATS) {
    if (def.departement !== departement) continue;
    const donnees = def.generer(ctx);
    if (!donnees) continue;
    possibles.push({
      id: def.id,
      titre: def.titre,
      unite: def.unite,
      enjeu: def.enjeu,
      formule: def.formule,
      indices: def.indices,
      ...donnees,
      reponse: null,
    });
  }
  const n = possibles.length;
  const depart = (etat.moisCourant * MANDATS_PAR_MOIS) % Math.max(1, n);
  return Array.from(
    { length: Math.min(MANDATS_PAR_MOIS, n) },
    (_, k) => possibles[(depart + k) % n],
  );
}

/** Démarre le mode chef de département pour chaque entreprise de la partie. */
export function initialiserChef(etat: EtatPartie, departement: DepartementChef): EtatPartie {
  const e = structuredClone(etat);
  e.config.chefDepartement = departement;
  for (const ent of e.entreprises) {
    ent.chef = {
      departement,
      confiance: CONFIANCE_DEPART,
      mandats: [],
      historique: [],
      dernierRapport: 0,
    };
    ent.chef.mandats = genererMandats(e, ent);
  }
  return e;
}

/** Inscrit (ou efface, avec null) la réponse du joueur à un mandat du mois. */
export function repondreMandat(
  etat: EtatPartie,
  entrepriseId: string,
  mandatId: string,
  valeur: number | null,
): EtatPartie {
  const e = structuredClone(etat);
  const m = e.entreprises
    .find((x) => x.id === entrepriseId)
    ?.chef?.mandats.find((x) => x.id === mandatId);
  if (m) m.reponse = valeur !== null && Number.isFinite(valeur) ? valeur : null;
  return e;
}

/**
 * Corrige les mandats du mois (modifie l'entreprise) : la confiance de la direction change et
 * une erreur à enjeu moyen ou élevé entraîne des frais, tout de suite. L'explication, elle,
 * attend le prochain rapport d'évaluation.
 */
export function corrigerMandats(etat: EtatPartie, ent: Entreprise): void {
  const chef = ent.chef;
  if (!chef) return;
  let frais = 0;
  for (const m of chef.mandats) {
    const correct = m.reponse !== null && estCorrect(m.reponse, m.attendu, m.unite);
    const cout = correct ? 0 : FRAIS_ENJEU[m.enjeu];
    frais += cout;
    chef.confiance = borner(chef.confiance + (correct ? GAIN_CONFIANCE : -PERTE_CONFIANCE), 0, 100);
    chef.historique.push({
      index: etat.moisCourant,
      id: m.id,
      titre: m.titre,
      question: m.question,
      unite: m.unite,
      reponse: m.reponse,
      attendu: m.attendu,
      correct,
      cout,
      corrige: m.corrige,
    });
  }
  if (frais > 0)
    payer(
      ent.livre,
      ent,
      'Écarts et frais liés à des erreurs de gestion',
      'fraisDivers',
      frais,
      false,
      'loyerEtFrais',
    );
  chef.mandats = [];
}

/**
 * Résultats à expliquer maintenant : tous ceux depuis le dernier rapport lu, si le délai du
 * niveau est écoulé (ou si la partie est terminée). Sinon, rien.
 */
export function resultatsARapporter(etat: EtatPartie, ent: Entreprise): ResultatMandat[] {
  const chef = ent.chef;
  if (!chef) return [];
  const delai = etat.moisCourant - chef.dernierRapport;
  if (delai < cadenceRapport(etat.config.difficulte) && !etat.terminee) return [];
  return chef.historique.filter((r) => r.index >= chef.dernierRapport);
}

/** Le joueur a lu son rapport d'évaluation. */
export function lireRapportMandats(etat: EtatPartie, entrepriseId: string): EtatPartie {
  const e = structuredClone(etat);
  const chef = e.entreprises.find((x) => x.id === entrepriseId)?.chef;
  if (chef) chef.dernierRapport = e.moisCourant;
  return e;
}

/** Confiance telle que le joueur la connaît : seulement d'après les rapports déjà lus. */
export function confianceConnue(ent: Entreprise): number {
  const chef = ent.chef;
  if (!chef) return CONFIANCE_DEPART;
  return borner(
    chef.historique
      .filter((r) => r.index < chef.dernierRapport)
      .reduce((c, r) => c + (r.correct ? GAIN_CONFIANCE : -PERTE_CONFIANCE), CONFIANCE_DEPART),
    0,
    100,
  );
}

export type TitreChef = 'commis' | 'analyste' | 'chef' | 'directeur';

export function titreChef(confiance: number): TitreChef {
  if (confiance >= 90) return 'directeur';
  if (confiance >= 70) return 'chef';
  if (confiance >= 40) return 'analyste';
  return 'commis';
}

/**
 * Les collègues gèrent le personnel (sauf si le joueur dirige les RH) : ils embauchent quand
 * des clients repartent ou que la production déborde, et réduisent l'équipe sous-utilisée.
 */
export function gererCollegues(etat: EtatPartie, entrepriseId: string): EtatPartie {
  const ent = etat.entreprises.find((x) => x.id === entrepriseId);
  const i = ent?.archives.at(-1)?.indicateurs;
  if (!ent || !i || etat.terminee || ent.enFaillite || ent.vente) return etat;
  const secteur = secteurParId(etat.config.secteurId);
  const service = secteur.postes.find((p) => posteParId(p).role === 'service');
  const production = secteur.postes.find((p) => posteParId(p).role === 'production');
  const de = (poste?: string) => ent.employes.filter((x) => x.posteId === poste && !x.site);
  if (service && i.demande > 0 && i.perduesCapacite / i.demande > 0.02)
    return embaucher(etat, ent.id, undefined, service);
  if (production && i.demandeProduction > i.capaciteProduction * 1.03 && i.perduesProduction > 0)
    return embaucher(etat, ent.id, undefined, production);
  if (production && i.demandeProduction < 0.6 * i.capaciteProduction && de(production).length > 1)
    return congedier(etat, ent.id, de(production)[0].id);
  if (service && i.utilisation < 0.5 && de(service).length > 1)
    return congedier(etat, ent.id, de(service)[0].id);
  return etat;
}

/**
 * Fin de mois du mode chef de département : corrige les mandats, laisse agir les collègues,
 * simule le mois, puis prépare les mandats du mois suivant.
 */
export function terminerMoisChef(etat: EtatPartie): EtatPartie {
  if (etat.terminee) return etat;
  let e = structuredClone(etat);
  for (const ent of e.entreprises)
    if (ent.chef && !ent.enFaillite && !ent.vente) corrigerMandats(e, ent);
  for (const ent of etat.entreprises)
    if (ent.chef && ent.chef.departement !== 'rh') e = gererCollegues(e, ent.id);
  e = simulerMois(e);
  if (!e.terminee)
    for (const ent of e.entreprises)
      if (ent.chef && !ent.enFaillite && !ent.vente) ent.chef.mandats = genererMandats(e, ent);
  return e;
}
