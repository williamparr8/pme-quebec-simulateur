/** Écritures courantes partagées par la création, les actions et la simulation. */
import {
  ecritureSimple,
  passerEcriture,
  type CompteId,
  type FluxId,
  type GrandLivre,
  type LigneEcriture,
} from './accounting';
import { taxesSur } from './tax';
import type { Entreprise } from './types';
import { versCents } from './util';

/**
 * Paiement d'une dépense ou d'un actif. Si elle est taxable : une entreprise inscrite
 * récupère la TPS (CTI) et la TVQ (RTI); une entreprise non inscrite les absorbe dans le coût.
 */
export function payer(
  L: GrandLivre,
  ent: Entreprise,
  libelle: string,
  compte: CompteId,
  montantHT: number,
  taxable: boolean,
  flux: FluxId,
  contrepartie: CompteId = 'encaisse',
): void {
  const ht = versCents(montantHT);
  if (ht <= 0) return;
  if (!taxable) {
    ecritureSimple(L, libelle, compte, contrepartie, ht, flux);
    return;
  }
  const t = taxesSur(montantHT);
  const tps = versCents(t.tps);
  const tvq = versCents(t.tvq);
  if (ent.fiscal.inscritTaxes) {
    passerEcriture(L, {
      libelle: `${libelle} (TPS et TVQ récupérables)`,
      flux,
      lignes: [
        { compte, debit: ht },
        { compte: 'ctiARecouvrer', debit: tps },
        { compte: 'rtiARecouvrer', debit: tvq },
        { compte: contrepartie, credit: ht + tps + tvq },
      ],
    });
    ent.fiscal.taxesAnnee.cti += t.tps;
    ent.fiscal.taxesAnnee.rti += t.tvq;
  } else {
    ecritureSimple(
      L,
      `${libelle} (taxes incluses, non récupérables)`,
      compte,
      contrepartie,
      ht + tps + tvq,
      flux,
    );
  }
}

/** Ramène des comptes à zéro en contrepartie de l'encaisse (remises gouvernementales). */
export function solderComptes(
  L: GrandLivre,
  libelle: string,
  comptes: CompteId[],
  flux: FluxId,
): number {
  const lignes: LigneEcriture[] = [];
  let net = 0;
  for (const id of comptes) {
    const b = L.soldes[id];
    if (b > 0) lignes.push({ compte: id, credit: b });
    else if (b < 0) lignes.push({ compte: id, debit: -b });
    net -= b;
  }
  if (lignes.length === 0) return 0;
  if (net > 0) lignes.push({ compte: 'encaisse', credit: net });
  else if (net < 0) lignes.push({ compte: 'encaisse', debit: -net });
  passerEcriture(L, { libelle, flux, lignes });
  return net;
}

/**
 * Achat de marchandises : la partie détaxée (aliments de base) et la partie taxable
 * (emballages, fournitures). La contrepartie est l'encaisse (comptant) ou les comptes
 * fournisseurs (à crédit).
 */
export function acheterMarchandises(
  L: GrandLivre,
  ent: Entreprise,
  libelle: string,
  montant: number,
  partTaxable: number,
  contrepartie: 'encaisse' | 'comptesFournisseurs',
): void {
  if (montant <= 0) return;
  const taxable = Math.round(montant * partTaxable * 100) / 100;
  const detaxe = Math.round((montant - taxable) * 100) / 100;
  const flux: FluxId | undefined =
    contrepartie === 'encaisse' ? 'paiementsFournisseurs' : undefined;
  ecritureSimple(L, `${libelle} – aliments détaxés`, 'stocks', contrepartie, versCents(detaxe), flux);
  if (ent.fiscal.inscritTaxes) {
    payer(
      L,
      ent,
      `${libelle} – emballages et fournitures`,
      'stocks',
      taxable,
      true,
      'paiementsFournisseurs',
      contrepartie,
    );
  } else {
    const t = taxesSur(taxable);
    passerEcriture(L, {
      libelle: `${libelle} – emballages et fournitures (taxes non récupérables)`,
      flux,
      lignes: [
        { compte: 'stocks', debit: versCents(taxable) },
        { compte: 'coutMarchandises', debit: versCents(t.tps) + versCents(t.tvq) },
        { compte: contrepartie, credit: versCents(taxable) + versCents(t.tps) + versCents(t.tvq) },
      ],
    });
  }
}
