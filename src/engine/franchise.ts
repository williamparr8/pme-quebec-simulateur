/**
 * Franchise, dans les deux sens :
 * - franchisé : ouvrir sous une bannière connue (droit d'entrée, redevances et fonds
 *   publicitaire sur les ventes, en échange d'une notoriété et d'achats groupés);
 * - franchiseur : une PME bien notée peut vendre des franchises de sa marque (droits
 *   d'entrée, redevances), mais doit soutenir son réseau, et un franchisé faible nuit à l'image.
 * Simplification : les droits et les redevances sont comptabilisés sans TPS ni TVQ.
 */
import franchiseJson from '../data/franchise.json';
import { ecritureSimple, type GrandLivre } from './accounting';
import { payer } from './ecritures';
import type { PhaseEconomique } from './economy';
import type { Rng } from './rng';
import type { Entreprise, Message } from './types';
import { borner, versCents } from './util';

export const PARAMETRES_FRANCHISE = franchiseJson.franchise;
export const PARAMETRES_RESEAU = franchiseJson.reseau;

export function banniere(secteurId: string): string {
  return (franchiseJson.bannieres as Record<string, string>)[secteurId] ?? 'Bannière Québec';
}

/** Le réseau de franchises peut-il être lancé? */
export function peutLancerReseau(ent: Entreprise): boolean {
  return (
    !ent.reseau &&
    !ent.franchise &&
    (ent.croissance?.palier ?? 'petite') !== 'petite' &&
    ent.clientele.note >= PARAMETRES_RESEAU.noteMinimale
  );
}

/** Rabais d'achats groupés d'un franchisé. */
export const facteurAchatsFranchise = (ent: Entreprise): number =>
  ent.franchise ? 1 - PARAMETRES_FRANCHISE.rabaisAchats : 1;

export interface ContexteFranchise {
  index: number;
  rng: Rng;
  phase: PhaseEconomique;
  /** Ventes du mois de l'entreprise (magasin et livraison). */
  ventesMois: number;
  etablissements: number;
}

/**
 * Opérations mensuelles : redevances payées par un franchisé, ou revenus, soutien et
 * évolution du réseau d'un franchiseur.
 */
export function gererFranchise(L: GrandLivre, ent: Entreprise, c: ContexteFranchise): Message[] {
  const m: Message[] = [];
  if (ent.franchise && c.ventesMois > 0) {
    const taux = ent.franchise.redevance + ent.franchise.fondsPublicitaire;
    payer(
      L,
      ent,
      `Redevances et fonds publicitaire : ${ent.franchise.banniere}`,
      'redevances',
      Math.round(c.ventesMois * taux * 100) / 100,
      false,
      'loyerEtFrais',
    );
  }
  const r = ent.reseau;
  if (!r) return m;
  const p = PARAMETRES_RESEAU;
  const recession = c.phase === 'recession';

  // Fermetures (plus fréquentes en récession et pour les franchisés faibles).
  r.franchises = r.franchises.filter((f) => {
    const proba = p.probabiliteFermeture * (recession ? 2.5 : 1) * (f.facteur < 0.75 ? 2 : 1);
    if (!c.rng.chance(proba)) return true;
    r.fermees += 1;
    ent.clientele.note = Math.max(1, Math.round((ent.clientele.note - 0.05) * 100) / 100);
    m.push({ code: 'franchiseFermee', niveau: 'alerte', params: { nom: f.nom } });
    return false;
  });

  // Nouveau franchisé : plus probable si la marque est connue et bien notée.
  if (r.franchises.length < Math.min(r.objectif, p.maximum)) {
    const attrait =
      borner((ent.clientele.note - 3.5) / 1.2, 0, 1) *
      borner(ent.clientele.notoriete / 0.5, 0.2, 1);
    if (c.rng.chance(p.probabiliteCandidat * attrait * (recession ? 0.4 : 1))) {
      const numero = r.franchises.length + r.fermees + 1;
      const f = {
        id: `fr-${numero}`,
        nom: `Franchise no ${numero}`,
        ouverture: c.index,
        facteur: Math.round(c.rng.range(0.6, 1.15) * 100) / 100,
      };
      r.franchises.push(f);
      ecritureSimple(
        L,
        `Droit d’entrée : ${f.nom}`,
        'encaisse',
        'revenusFranchise',
        versCents(p.droitEntree),
        'autresEncaissements',
      );
      payer(
        L,
        ent,
        `Formation initiale du franchisé : ${f.nom}`,
        'formation',
        p.formationInitiale,
        true,
        'formationAvantages',
      );
      m.push({
        code: 'franchiseVendue',
        niveau: 'succes',
        params: { nom: f.nom, montant: p.droitEntree },
      });
    }
  }

  // Redevances : chaque franchisé vend environ autant qu'un établissement de l'entreprise.
  if (r.franchises.length > 0) {
    const parEtablissement = c.ventesMois / Math.max(1, c.etablissements);
    const ventesReseau = r.franchises.reduce((s, f) => s + parEtablissement * f.facteur, 0);
    const redevances = Math.round(ventesReseau * (p.redevance + p.fondsPublicitaire));
    r.dernierRevenu = redevances;
    if (redevances > 0)
      ecritureSimple(
        L,
        'Redevances et fonds publicitaire des franchisés',
        'encaisse',
        'revenusFranchise',
        versCents(redevances),
        'autresEncaissements',
      );
    payer(
      L,
      ent,
      'Soutien au réseau de franchisés (conseillers, visites)',
      'fraisDivers',
      p.soutienMensuel * r.franchises.length,
      true,
      'loyerEtFrais',
    );
    // Le fonds publicitaire fait connaître la marque; un franchisé faible nuit à la réputation.
    ent.clientele.notoriete = Math.min(0.95, ent.clientele.notoriete + 0.002 * r.franchises.length);
    const faibles = r.franchises.filter((f) => f.facteur < 0.75).length;
    if (faibles > 0)
      ent.clientele.note = Math.max(
        1,
        Math.round((ent.clientele.note - 0.01 * faibles) * 100) / 100,
      );
  }
  return m;
}
