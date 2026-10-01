/**
 * Gamme de produits : lignes de base du secteur et nouveaux produits développés en
 * cours de partie (coût de développement, délai, risque d'échec).
 */
import type { LigneProduit, NouveauProduit, Secteur } from './data-types';
import type { LigneOffre } from './market';
import { normaliserParSegment } from './marketing';
import type { Rng } from './rng';
import type { Entreprise, Message } from './types';
import { borner } from './util';

export function nouveauProduit(secteur: Secteur, id: string): NouveauProduit {
  const p = secteur.nouveauxProduits.find((x) => x.id === id);
  if (!p) throw new Error(`Produit introuvable : ${id}`);
  return p;
}

/** Toutes les lignes que l'entreprise doit approvisionner (incluant le produit B2B). */
export function lignesStock(ent: Entreprise, secteur: Secteur): LigneProduit[] {
  const nouvelles = ent.marketing.produits
    .filter((p) => p.statut === 'actif')
    .map((p) => nouveauProduit(secteur, p.ligneId));
  return [...secteur.lignes, ...nouvelles];
}

/** Le produit vendu aux entreprises (B2B) du secteur, s'il existe. */
export function produitB2B(secteur: Secteur): NouveauProduit | undefined {
  return secteur.nouveauxProduits.find((p) => p.b2b);
}

/** Identifiant du produit B2B actif de l'entreprise (null si aucun). */
export function produitB2BActif(ent: Entreprise, secteur: Secteur): NouveauProduit | null {
  const p = produitB2B(secteur);
  return p && produitActif(ent, p.id) ? p : null;
}

/** Lignes vendues en magasin (le produit B2B se vend par contrats). */
export function lignesVente(ent: Entreprise, secteur: Secteur): LigneProduit[] {
  return lignesStock(ent, secteur).filter((l) => !(l as NouveauProduit).b2b);
}

export function produitActif(ent: Entreprise, ligneId: string): boolean {
  return ent.marketing.produits.some((p) => p.ligneId === ligneId && p.statut === 'actif');
}

/** Lignes de l'offre pour le marché, avec la qualité de chaque ligne et le panier des segments. */
export function lignesOffre(
  ent: Entreprise,
  secteur: Secteur,
  qualiteLigne: (ligneId: string) => number,
): LigneOffre[] {
  return lignesVente(ent, secteur).map((ligne) => {
    const lance = ent.marketing.produits.find((p) => p.ligneId === ligne.id);
    const def = lance ? nouveauProduit(secteur, ligne.id) : null;
    return {
      ligne,
      qualite: qualiteLigne(ligne.id),
      facteur: lance ? lance.facteur : 1,
      panier: def ? normaliserParSegment(secteur, def.segments) : undefined,
    };
  });
}

/** Bonus d'utilité d'une gamme élargie (variété) : +0,06 par nouveau produit réussi. */
export function bonusGamme(ent: Entreprise, secteur: Secteur): number {
  const reussis = ent.marketing.produits.filter(
    (p) => p.statut === 'actif' && p.succes && !nouveauProduit(secteur, p.ligneId).b2b,
  ).length;
  return Math.min(0.18, 0.06 * reussis);
}

/** Probabilité de succès d'un lancement selon la qualité et l'image de marque. */
export function probabiliteSucces(p: NouveauProduit, qualite: number, image: number): number {
  return borner(p.probabiliteSucces + 0.25 * (qualite - 0.55) + 0.1 * (image - 0.5), 0.05, 1);
}

/** Les produits en développement dont le délai est écoulé sont lancés (succès ou échec). */
export function resoudreLancements(
  ent: Entreprise,
  secteur: Secteur,
  index: number,
  qualite: number,
  rng: Rng,
): Message[] {
  const m: Message[] = [];
  for (const p of ent.marketing.produits) {
    if (p.statut !== 'developpement' || p.moisDisponible > index) continue;
    const def = nouveauProduit(secteur, p.ligneId);
    p.succes = rng.chance(probabiliteSucces(def, qualite, ent.marketing.image));
    p.facteur = Math.round((p.succes ? rng.range(0.85, 1.2) : rng.range(0.25, 0.4)) * 100) / 100;
    p.statut = 'actif';
    m.push({
      code: def.b2b ? 'b2bOuvert' : p.succes ? 'produitSucces' : 'produitEchec',
      niveau: p.succes ? 'succes' : 'alerte',
      params: { nom: def.nom },
    });
  }
  return m;
}
