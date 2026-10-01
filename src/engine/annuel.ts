/**
 * Fin d'exercice fiscal : déduction pour amortissement (DPA), revenu fiscal, report des
 * pertes, impôt de la société (T2 et CO-17) ou du propriétaire (T1 et TP-1), relevés
 * T4 et RL-1. L'amortissement comptable est remplacé par la DPA dans le calcul fiscal.
 */
import { DPA, IMPOT_SOCIETES } from '../data/fiscalite';
import { ecritureSimple, type GrandLivre, type Mouvements } from './accounting';
import { estSocieteActions } from './conformite';
import { etatResultats } from './statements';
import { impotPersonnel, impotSociete } from './tax';
import type { DeclarationAnnuelle, Entreprise } from './types';
import { versCents } from './util';

const arrondi = (x: number): number => Math.round(x * 100) / 100;

/** DPA de l'année. Biens acquis avant 2028 : incitatif à l'investissement accéléré (pas de demi-année). */
export function calculerDpa(
  uccEquipement: number,
  uccAmeliorations: number,
  coutAmeliorations: number,
  dureeBailAnnees: number,
): { equipement: number; ameliorations: number; total: number } {
  const equipement = arrondi(Math.max(0, uccEquipement) * DPA.equipement.taux);
  const ameliorations = arrondi(
    Math.min(Math.max(0, uccAmeliorations), coutAmeliorations / Math.max(1, dureeBailAnnees)),
  );
  return { equipement, ameliorations, total: arrondi(equipement + ameliorations) };
}

/**
 * Calcule les impôts de l'exercice et prépare les déclarations. Pour une société par
 * actions, l'impôt est inscrit aux livres (charge et impôts à payer).
 * @param mouvementsAnnee mouvements de tout l'exercice, avant l'impôt sur le revenu
 */
export function finExerciceFiscal(
  ent: Entreprise,
  annee: number,
  mouvementsAnnee: Mouvements,
  livre: GrandLivre,
): DeclarationAnnuelle {
  const f = ent.fiscal;
  const r = etatResultats(mouvementsAnnee);
  const nonDeductibles = (mouvementsAnnee.amendes ?? 0) / 100;
  const dpa = calculerDpa(
    f.uccEquipement,
    f.uccAmeliorations,
    f.coutAmeliorations,
    ent.bail.dureeMois / 12,
  );
  f.uccEquipement = arrondi(f.uccEquipement - dpa.equipement);
  f.uccAmeliorations = arrondi(f.uccAmeliorations - dpa.ameliorations);
  const revenuFiscal = arrondi(r.beneficeAvantImpot + r.amortissement + nonDeductibles - dpa.total);

  const feuillets = Object.values(f.paieAnnee);
  const taxes = { ...f.taxesAnnee };
  const declaration: DeclarationAnnuelle = {
    annee,
    forme: ent.formeJuridique,
    beneficeComptable: r.beneficeAvantImpot,
    amortissementComptable: r.amortissement,
    dpa: dpa.total,
    nonDeductibles,
    revenuFiscal,
    pertesUtilisees: 0,
    pertesReportees: f.pertesReportees,
    heuresRemunerees: Math.round(f.heuresRemunereesAnnee),
    personnel: {
      revenuEntreprise: 0,
      salaire: 0,
      dividendes: 0,
      impotFederal: 0,
      impotQuebec: 0,
      cotisations: 0,
      total: 0,
    },
    feuillets,
    taxes,
  };

  if (estSocieteActions(ent.formeJuridique)) {
    // Report des pertes autres qu'en capital (jusqu'à 20 ans).
    let imposable = revenuFiscal;
    if (imposable < 0) {
      f.pertesReportees = arrondi(f.pertesReportees - imposable);
      imposable = 0;
    } else {
      const utilisees = Math.min(f.pertesReportees, imposable);
      declaration.pertesUtilisees = arrondi(utilisees);
      f.pertesReportees = arrondi(f.pertesReportees - utilisees);
      imposable -= utilisees;
    }
    declaration.pertesReportees = f.pertesReportees;
    const impot = impotSociete(imposable, f.heuresRemunereesAnnee);
    ecritureSimple(
      livre,
      `Impôts sur le revenu de l’exercice ${annee} (T2 et CO-17)`,
      'impots',
      'impotsAPayer',
      versCents(impot.total),
    );
    const solde = arrondi(impot.total - f.acomptesVersesAnnee);
    declaration.societe = {
      revenuImposable: impot.revenuImposable,
      facteurDpeQuebec: impot.facteurDpeQuebec,
      impotFederal: impot.impotFederal,
      impotQuebec: impot.impotQuebec,
      total: impot.total,
      acomptesVerses: f.acomptesVersesAnnee,
      solde,
    };
    f.soldeImpotAPayer = solde;
    f.acompteMensuel = impot.total > IMPOT_SOCIETES.seuilAcomptes ? arrondi(impot.total / 12) : 0;
    const salaire = f.paieAnnee.dirigeant?.brut ?? 0;
    const dividendes = livre.soldes.dividendes / 100;
    const perso = impotPersonnel({ emploi: salaire, dividendesNonDetermines: dividendes });
    declaration.personnel = {
      revenuEntreprise: 0,
      salaire,
      dividendes,
      impotFederal: perso.impotFederal,
      impotQuebec: perso.impotQuebec,
      cotisations: 0,
      total: arrondi(perso.impotFederal + perso.impotQuebec),
    };
  } else {
    // Entreprise individuelle ou société de personnes : le revenu est imposé chez le propriétaire.
    const part = ent.associe ? 1 - ent.associe.part : 1;
    const revenuEntreprise = arrondi(revenuFiscal * part);
    const perso = impotPersonnel({ entreprise: Math.max(0, revenuEntreprise) });
    declaration.personnel = {
      revenuEntreprise,
      salaire: 0,
      dividendes: 0,
      impotFederal: perso.impotFederal,
      impotQuebec: perso.impotQuebec,
      cotisations: perso.cotisationsAutonome,
      total: perso.total,
    };
  }

  f.acomptesVersesAnnee = 0;
  f.paieAnnee = {};
  f.heuresRemunereesAnnee = 0;
  f.taxesAnnee = { tpsPercue: 0, tvqPercue: 0, cti: 0, rti: 0 };
  f.declarations.push(declaration);
  return declaration;
}
