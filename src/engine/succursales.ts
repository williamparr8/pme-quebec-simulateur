/**
 * Succursales : d'autres établissements dans la même ville, sous la même marque. Chacun a son
 * local (loyer, achalandage) et son équipe de service; les prix, la qualité, la notoriété et
 * les stocks (achats centralisés) sont communs. Sur le marché, chaque succursale est une offre
 * de plus : elle attire de nouveaux clients, mais en prend aussi au premier commerce
 * (cannibalisation).
 */
import type { Secteur, Ville } from './data-types';
import { amenagementDe, emplacementDe, equipementDe, loyerMensuelInitial } from './creation';
import type { ResultatOffre, VenteLigne } from './market';
import type { Employe, Entreprise } from './types';

export const MAX_SUCCURSALES = 4;
/** Pénalité de résiliation du bail d'une succursale fermée (mois de loyer). */
export const MOIS_PENALITE_FERMETURE = 3;

export interface CoutsSuccursale {
  equipement: number;
  amenagement: number;
  depotGarantie: number;
  fraisOuverture: number;
  loyerMensuel: number;
  total: number;
}

/** Coûts d'ouverture d'une succursale (même équipement et même aménagement que le premier commerce). */
export function coutsSuccursale(
  ent: Entreprise,
  secteur: Secteur,
  ville: Ville,
  emplacementId: string,
): CoutsSuccursale {
  const equipement = equipementDe(secteur, ent.equipementId).cout;
  const amenagement = amenagementDe(secteur, ent.amenagementId).cout;
  const loyerMensuel = loyerMensuelInitial(secteur, emplacementDe(ville, emplacementId));
  const depotGarantie = loyerMensuel * 2;
  const fraisOuverture = secteur.fraisDemarrage;
  return {
    equipement,
    amenagement,
    depotGarantie,
    fraisOuverture,
    loyerMensuel,
    total: equipement + amenagement + depotGarantie + fraisOuverture,
  };
}

/** Employés d'un établissement (undefined : le premier commerce). */
export function employesDuSite(ent: Entreprise, site: string | undefined): Employe[] {
  return ent.employes.filter((e) => (e.site ?? undefined) === site);
}

function fusionVentes(a: VenteLigne[], b: VenteLigne[]): VenteLigne[] {
  const total = new Map<string, VenteLigne>();
  for (const v of [...a, ...b]) {
    const t = total.get(v.ligneId);
    if (t) {
      t.unites += v.unites;
      t.chiffreAffaires += v.chiffreAffaires;
    } else total.set(v.ligneId, { ...v });
  }
  return [...total.values()];
}

/** Additionne les résultats de marché de deux établissements de la même entreprise. */
export function fusionnerResultats(a: ResultatOffre, b: ResultatOffre): ResultatOffre {
  const servies = a.servies + b.servies;
  const chiffreAffaires = a.chiffreAffaires + b.chiffreAffaires;
  const parSegment: ResultatOffre['parSegment'] = {};
  for (const k of new Set([...Object.keys(a.parSegment), ...Object.keys(b.parSegment)]))
    parSegment[k] = {
      demande: (a.parSegment[k]?.demande ?? 0) + (b.parSegment[k]?.demande ?? 0),
      servies: (a.parSegment[k]?.servies ?? 0) + (b.parSegment[k]?.servies ?? 0),
    };
  return {
    ...a,
    demande: a.demande + b.demande,
    servies,
    perduesCapacite: a.perduesCapacite + b.perduesCapacite,
    perduesRupture: a.perduesRupture + b.perduesRupture,
    part: a.part + b.part,
    ventes: fusionVentes(a.ventes, b.ventes),
    chiffreAffaires,
    ticketMoyen: servies > 0 ? chiffreAffaires / servies : a.ticketMoyen,
    parSegment,
    ventesLivraison: fusionVentes(a.ventesLivraison, b.ventesLivraison),
    chiffreAffairesLivraison: a.chiffreAffairesLivraison + b.chiffreAffairesLivraison,
  };
}
