/**
 * Exportation : vendre en Ontario, aux États-Unis ou en Europe. Chaque marché coûte cher à
 * ouvrir (adaptation, courtier, certifications) et à maintenir; les ventes montent pendant
 * 6 mois, dépendent de la qualité, du prix et du taux de change (un dollar canadien faible
 * rend nos produits moins chers à l'étranger). Les exportations hors Canada sont détaxées.
 * Simplifications : les marchandises exportées sont achetées et expédiées au fil des
 * commandes (hors stock), les clients paient au taux de change du mois et la TVH des ventes
 * en Ontario n'est pas simulée (prix nets de taxes).
 */
import exportJson from '../data/export.json';
import { ecritureSimple, type GrandLivre } from './accounting';
import { payer } from './ecritures';
import type { Entreprise, Message } from './types';
import { borner, versCents } from './util';

export interface MarcheExport {
  id: string;
  nom: string;
  devise: 'CAD' | 'USD' | 'EUR';
  coutOuverture: number;
  fraisMensuels: number;
  potentiel: number;
  transport: number;
  courtage: number;
  description: string;
}

export const MARCHES_EXPORT = exportJson.marches as MarcheExport[];
export const SECTEURS_EXPORT: readonly string[] = exportJson.secteurs;
/** Mois pour que les ventes à l'étranger atteignent leur plein régime. */
export const MOIS_DEMARRAGE_EXPORT = 6;
/** Taux de change de référence (dollar canadien en dollars américains) au début du jeu. */
export const TAUX_CHANGE_REFERENCE = 0.72;

export function marcheExport(id: string): MarcheExport {
  return MARCHES_EXPORT.find((m) => m.id === id) as MarcheExport;
}

export function peutExporter(secteurId: string): boolean {
  return SECTEURS_EXPORT.includes(secteurId);
}

/**
 * Effet du taux de change sur la demande : quand le dollar canadien baisse, nos produits
 * coûtent moins cher en dollars américains ou en euros.
 */
export function facteurChange(devise: MarcheExport['devise'], tauxChange: number): number {
  if (devise === 'CAD') return 1;
  return borner(Math.pow(TAUX_CHANGE_REFERENCE / tauxChange, 1.5), 0.6, 1.6);
}

export interface ContexteExport {
  index: number;
  tauxChange: number;
  /** Ventes réelles du mois au Québec (base de la demande à l'étranger). */
  ventesMois: number;
  /** Rapport moyen coût des marchandises / prix de vente. */
  ratioCout: number;
  qualite: number;
  indicePrix: number;
}

/** Ventes et coûts mensuels de chaque marché d'exportation ouvert. */
export function gererExportations(L: GrandLivre, ent: Entreprise, c: ContexteExport): Message[] {
  const marches = ent.exportations?.marches ?? [];
  if (marches.length === 0) return [];
  const attrait =
    borner(c.qualite / 0.55, 0.5, 1.5) *
    borner(Math.pow(1 / Math.max(0.3, c.indicePrix), 1.2), 0.5, 1.6);
  let ventesTotales = 0;
  let coutsTotaux = 0;
  for (const o of marches) {
    const m = marcheExport(o.id);
    const montee = Math.min(1, (c.index - o.ouverture + 1) / MOIS_DEMARRAGE_EXPORT);
    const ventes = Math.round(
      c.ventesMois * m.potentiel * attrait * facteurChange(m.devise, c.tauxChange) * montee,
    );
    const cmv = Math.round(ventes * c.ratioCout);
    const logistique = Math.round(ventes * (m.transport + m.courtage));
    if (ventes > 0) {
      ecritureSimple(
        L,
        `Ventes à l’exportation : ${m.nom}`,
        'encaisse',
        'ventes',
        versCents(ventes),
        'encaissementsClients',
      );
      ecritureSimple(
        L,
        `Marchandises exportées : ${m.nom}`,
        'coutMarchandises',
        'encaisse',
        versCents(cmv),
        'paiementsFournisseurs',
      );
      ecritureSimple(
        L,
        `Transport international et courtage : ${m.nom}`,
        'fraisExpedition',
        'encaisse',
        versCents(logistique),
        'paiementsFournisseurs',
      );
    }
    payer(
      L,
      ent,
      `Représentation à l’étranger : ${m.nom}`,
      'fraisDivers',
      m.fraisMensuels,
      true,
      'loyerEtFrais',
    );
    ventesTotales += ventes;
    coutsTotaux += cmv + logistique + m.fraisMensuels;
  }
  if (ent.exportations) ent.exportations.dernier = { ventes: ventesTotales, couts: coutsTotaux };
  return [
    {
      code: 'exportationsMois',
      niveau: ventesTotales > coutsTotaux ? 'succes' : 'info',
      params: { ventes: ventesTotales, couts: coutsTotaux, taux: c.tauxChange },
    },
  ];
}
