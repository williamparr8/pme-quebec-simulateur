/**
 * Immobilisations : registre des biens, amortissement comptable linéaire (sur la durée
 * de vie utile) et effets des investissements sur l'exploitation. La déduction fiscale
 * (DPA) est calculée séparément à la fin de l'exercice (annuel.ts).
 */
import type { CompteId } from './accounting';
import type {
  EffetsInvestissement,
  Investissement,
  Secteur,
  TypeImmobilisation,
} from './data-types';
import type { Entreprise, Immobilisation } from './types';
import { versCents, type Cents } from './util';

export const COMPTES_IMMOBILISATIONS: Record<
  TypeImmobilisation,
  { actif: CompteId; cumul: CompteId; libelle: string }
> = {
  equipement: { actif: 'equipement', cumul: 'amortCumEquipement', libelle: 'l’équipement' },
  ameliorations: {
    actif: 'ameliorationsLocatives',
    cumul: 'amortCumAmeliorations',
    libelle: 'des améliorations locatives',
  },
  vehicule: { actif: 'vehicules', cumul: 'amortCumVehicules', libelle: 'des véhicules' },
  informatique: {
    actif: 'informatique',
    cumul: 'amortCumInformatique',
    libelle: 'du matériel informatique et des logiciels',
  },
};

export function investissementDef(secteur: Secteur, id: string): Investissement {
  const inv = secteur.investissements.find((x) => x.id === id);
  if (!inv) throw new Error(`Investissement introuvable : ${id}`);
  return inv;
}

export function possede(ent: Entreprise, investissementId: string): boolean {
  return ent.immobilisations.some((i) => i.investissementId === investissementId);
}

/** Amortissement du mois de chaque bien (cents), par compte d'amortissement cumulé (mutation). */
export function amortirImmobilisations(ent: Entreprise): Map<TypeImmobilisation, Cents> {
  const parType = new Map<TypeImmobilisation, Cents>();
  for (const immo of ent.immobilisations) {
    const cout = versCents(immo.cout);
    const restant = cout - immo.amortCumule;
    if (restant <= 0) continue;
    const montant = Math.min(restant, Math.round(cout / Math.max(1, immo.dureeVieMois)));
    immo.amortCumule += montant;
    parType.set(immo.type, (parType.get(immo.type) ?? 0) + montant);
  }
  return parType;
}

export function valeurNette(immo: Immobilisation): number {
  return Math.round(versCents(immo.cout) - immo.amortCumule) / 100;
}

/** Usure de l'équipement (0 = neuf, 1 = fin de vie utile), pondérée par le coût. */
export function usureEquipement(ent: Entreprise): number {
  const equipements = ent.immobilisations.filter((i) => i.type === 'equipement');
  const total = equipements.reduce((a, i) => a + i.cout, 0);
  if (total <= 0) return 0;
  return (
    equipements.reduce(
      (a, i) => a + i.cout * Math.min(1, i.amortCumule / Math.max(1, versCents(i.cout))),
      0,
    ) / total
  );
}

export interface EffetsCumules {
  capaciteService: number;
  capaciteProduction: number;
  ambiance: number;
  eco: number;
  /** Multiplicateur des frais variables par client (expédition, carburant). */
  fraisParVisite: number;
  qualiteLignes: Record<string, number>;
  coutLignes: Record<string, number>;
  demandeEte: number;
  pertesStocks: number;
  commandeEnLigne: number;
  livraisonPropre: boolean;
}

/** Effets combinés des investissements faits en cours de partie. */
export function effetsInvestissements(ent: Entreprise, secteur: Secteur): EffetsCumules {
  const r: EffetsCumules = {
    capaciteService: 0,
    capaciteProduction: 0,
    ambiance: 0,
    eco: 0,
    fraisParVisite: 1,
    qualiteLignes: {},
    coutLignes: {},
    demandeEte: 0,
    pertesStocks: 1,
    commandeEnLigne: 0,
    livraisonPropre: false,
  };
  for (const immo of ent.immobilisations) {
    if (!immo.investissementId) continue;
    const e: EffetsInvestissement = investissementDef(secteur, immo.investissementId).effets;
    r.capaciteService += e.capaciteService ?? 0;
    r.capaciteProduction += e.capaciteProduction ?? 0;
    r.eco += e.eco ?? 0;
    if (e.fraisParVisite !== undefined) r.fraisParVisite *= e.fraisParVisite;
    r.ambiance += e.ambiance ?? 0;
    r.demandeEte += e.demandeEte ?? 0;
    r.commandeEnLigne += e.commandeEnLigne ?? 0;
    if (e.pertesStocks !== undefined) r.pertesStocks *= e.pertesStocks;
    if (e.livraisonPropre) r.livraisonPropre = true;
    for (const [k, v] of Object.entries(e.qualiteLignes ?? {}))
      r.qualiteLignes[k] = (r.qualiteLignes[k] ?? 0) + v;
    for (const [k, v] of Object.entries(e.coutLignes ?? {}))
      r.coutLignes[k] = (r.coutLignes[k] ?? 1) * v;
  }
  return r;
}

/** Frais d'utilisation mensuels des investissements (abonnements, véhicule, terrasse) ($). */
export function fraisInvestissements(ent: Entreprise, secteur: Secteur, mois: number): number {
  let total = 0;
  for (const immo of ent.immobilisations) {
    if (!immo.investissementId) continue;
    const inv = investissementDef(secteur, immo.investissementId);
    if (!inv.fraisMensuels) continue;
    if (inv.moisActifs && !inv.moisActifs.includes(mois)) continue;
    total += inv.fraisMensuels;
  }
  return total;
}
