/**
 * Actions du joueur entre deux mois. Chaque action est une fonction pure : elle reçoit un
 * état et retourne un nouvel état (copie). Les dépenses immédiates (formation, étude de
 * marché, affichage d'un poste…) sont inscrites aux livres du mois en cours.
 */
import {
  dilemmeParId,
  formationParId,
  FORMATION_GESTIONNAIRE_HYGIENE,
  INITIATIVES_ECO,
  plateformeParId,
  posteParId,
  secteurParId,
  typeEtudeParId,
  villeParId,
} from '../data';
import { ecritureSimple, type CompteId, type FluxId } from './accounting';
import { ajouterAcquisition } from './annuel';
import {
  coutDemarche,
  demarche,
  estSocieteActions,
  fraisMiseAJourAnnuelle,
  immatriculationObligatoire,
} from './conformite';
import {
  BORNES_DECISIONS,
  DIFFICULTES,
  amenagementDe,
  dateDuMois,
  parId,
  politiqueParDefaut,
  validerDecisions,
} from './creation';
import type { IdTypeEtude } from './data-types';
import { tauxPreferentiel } from './economy';
import { payer } from './ecritures';
import { realiserEtude } from './etudes';
import { appliquerEffets, type CategorieDepense, type ContexteEffets } from './events';
import { evaluerCredit, limiteMargeMax, tauxPlacement, typePlacement } from './financement';
import {
  COUT_RECRUTEMENT,
  employeDepuisCandidat,
  genererCandidat,
  genererEmploye,
  nombreCandidats,
  penurieDuMois,
  probabiliteAcceptation,
  salaireMarchePoste,
  semainesPreavis,
} from './hr';
import {
  investissementDef,
  possede,
  COMPTES_IMMOBILISATIONS,
  effetsInvestissements,
} from './immobilisations';
import { creerPret, rembourserPartiellement } from './loans';
import { nouveauProduit, lignesVente } from './produits';
import { Rng } from './rng';
import { bilan } from './statements';
import type { Entreprise, EtatPartie, Decisions, FrequenceTaxes, IdDemarche } from './types';
import { borner, versCents, versDollars } from './util';

// ---------------------------------------------------------------------------
// Outils
// ---------------------------------------------------------------------------

function trouverEntreprise(etat: EtatPartie, id: string): Entreprise {
  return parId(etat.entreprises, id);
}

/** Applique une action sur une copie de l'état (fonction pure). */
function action(
  etat: EtatPartie,
  entrepriseId: string,
  f: (ent: Entreprise, e: EtatPartie) => void,
): EtatPartie {
  const e = structuredClone(etat);
  f(trouverEntreprise(e, entrepriseId), e);
  return e;
}

function nouvelId(ent: Entreprise, prefixe: string): string {
  ent.prochainId += 1;
  return `${prefixe}-${ent.prochainId}`;
}

/** Index du mois à venir (celui que le joueur prépare). */
function indexCourant(e: EtatPartie): number {
  return Math.min(e.moisCourant, e.config.dureeMois - 1);
}

const COMPTES_DEPENSES: Record<
  CategorieDepense,
  { compte: CompteId; flux: FluxId; taxable: boolean }
> = {
  formation: { compte: 'formation', flux: 'formationAvantages', taxable: true },
  entretien: { compte: 'entretien', flux: 'loyerEtFrais', taxable: true },
  amendes: { compte: 'amendes', flux: 'droitsEtAmendes', taxable: false },
  recrutement: { compte: 'recrutement', flux: 'publicite', taxable: true },
  sinistres: { compte: 'sinistres', flux: 'droitsEtAmendes', taxable: false },
};

/** Fin d'emploi : départ immédiat et indemnité tenant lieu de préavis (versée avec la paie). */
export function terminerEmploi(ent: Entreprise, employeId: string, index: number): void {
  const employe = parId(ent.employes, employeId);
  const semaines = semainesPreavis(employe.moisAnciennete);
  // Un employé syndiqué peut contester (grief) : l'entreprise négocie souvent une indemnité plus élevée.
  const facteur = ent.rh.syndicat.statut === 'accredite' ? 2 : 1;
  ent.enAttente.indemnites +=
    Math.round(semaines * employe.heuresSemaine * employe.salaireHoraire * facteur * 100) / 100;
  ent.employes = ent.employes.filter((x) => x.id !== employeId);
  ent.rh.departs.push({ index, type: 'finEmploi' });
}

/** Contexte d'application des effets d'un dilemme (dépenses et fins d'emploi). */
export function contexteEffets(
  ent: Entreprise,
  employeId: string | null,
  index: number,
  rng: Rng,
): ContexteEffets {
  return {
    ent,
    employeId,
    index,
    rng,
    messages: [],
    depense: (categorie, montant, libelle) => {
      const c = COMPTES_DEPENSES[categorie];
      payer(ent.livre, ent, libelle, c.compte, montant, c.taxable, c.flux);
    },
    congedier: (id) => terminerEmploi(ent, id, index),
  };
}

// ---------------------------------------------------------------------------
// Décisions générales
// ---------------------------------------------------------------------------

export function modifierDecisions(
  etat: EtatPartie,
  entrepriseId: string,
  changements: Partial<Decisions>,
): EtatPartie {
  return action(etat, entrepriseId, (ent, e) => {
    const secteur = secteurParId(e.config.secteurId);
    ent.decisions = validerDecisions(
      { ...ent.decisions, ...changements },
      secteur,
      ent.formeJuridique,
      lignesVente(ent, secteur),
    );
    // Coût initial d'une initiative écoresponsable (certification), payé une seule fois.
    for (const id of ent.decisions.initiativesEco) {
      const init = INITIATIVES_ECO.find((x) => x.id === id);
      if (!init || init.coutInitial <= 0 || ent.marketing.initiativesPayees.includes(id)) continue;
      payer(ent.livre, ent, init.nom, 'ecoresponsabilite', init.coutInitial, true, 'loyerEtFrais');
      ent.marketing.initiativesPayees.push(id);
    }
  });
}

/** Change le fournisseur d'une ligne et recalcule la politique d'approvisionnement. */
export function changerFournisseur(
  etat: EtatPartie,
  entrepriseId: string,
  ligneId: string,
  fournisseurId: string,
): EtatPartie {
  return action(etat, entrepriseId, (ent, e) => {
    const secteur = secteurParId(e.config.secteurId);
    const ligne = [...secteur.lignes, ...secteur.nouveauxProduits].find((l) => l.id === ligneId);
    if (!ligne) return;
    const demande = ent.operations.stocks[ligneId]?.demandeRecente ?? 0;
    const actuelle = ent.decisions.approvisionnement[ligneId];
    const nouvelle = politiqueParDefaut(ligne, fournisseurId, demande, e.conjoncture);
    ent.decisions.approvisionnement[ligneId] =
      actuelle && !actuelle.auto ? { ...actuelle, fournisseurId } : nouvelle;
  });
}

// ---------------------------------------------------------------------------
// Ressources humaines
// ---------------------------------------------------------------------------

/** Embauche rapide (sans recrutement détaillé), utilisée par les tests et la calibration. */
export function embaucher(
  etat: EtatPartie,
  entrepriseId: string,
  heuresSemaine?: number,
  posteId?: string,
): EtatPartie {
  return action(etat, entrepriseId, (ent, e) => {
    const secteur = secteurParId(e.config.secteurId);
    const ville = villeParId(e.config.villeId);
    const poste = posteParId(posteId ?? secteur.postes[0]);
    const rng = new Rng(e.rngState);
    const heures = Math.round(
      borner(
        heuresSemaine ?? poste.heuresSemaineDefaut,
        BORNES_DECISIONS.heuresEmploye.min,
        BORNES_DECISIONS.heuresEmploye.max,
      ),
    );
    const salaire = Math.max(
      e.salaireMinimum,
      salaireMarchePoste(poste, ville.indiceSalaires, e.conjoncture.indicePrix),
    );
    ent.employes.push(genererEmploye(nouvelId(ent, 'emp'), poste, heures, salaire, rng));
    payer(
      ent.livre,
      ent,
      'Recrutement et intégration d’un employé',
      'recrutement',
      COUT_RECRUTEMENT,
      true,
      'publicite',
    );
    e.rngState = rng.state;
  });
}

/** Publier une offre d'emploi sur une plateforme. */
export function afficherPoste(
  etat: EtatPartie,
  entrepriseId: string,
  posteId: string,
  plateformeId: string,
): EtatPartie {
  return action(etat, entrepriseId, (ent, e) => {
    const secteur = secteurParId(e.config.secteurId);
    if (!secteur.postes.includes(posteId)) return;
    const plateforme = plateformeParId(plateformeId);
    const index = indexCourant(e);
    if (plateforme.cout > 0)
      payer(
        ent.livre,
        ent,
        `Affichage d’un poste : ${plateforme.nom}`,
        'recrutement',
        plateforme.cout,
        true,
        'publicite',
      );
    if (plateforme.delaiMois === 0) {
      genererCandidatsAffichage(ent, e, posteId, plateformeId, index);
    } else {
      ent.rh.affichages.push({
        id: nouvelId(ent, 'aff'),
        posteId,
        plateformeId,
        moisPublication: index,
        moisCandidats: index + plateforme.delaiMois,
      });
    }
  });
}

/** Génère les candidats d'un affichage (mutation). */
export function genererCandidatsAffichage(
  ent: Entreprise,
  e: EtatPartie,
  posteId: string,
  plateformeId: string,
  index: number,
): number {
  const ville = villeParId(e.config.villeId);
  const poste = posteParId(posteId);
  const rng = new Rng(e.rngState);
  const { mois } = dateDuMois(e.config, index);
  const penurie = penurieDuMois(ville.penurieMainOeuvre, e.conjoncture.phase, mois);
  const n = nombreCandidats(plateformeId, penurie, rng);
  for (let i = 0; i < n; i++) {
    ent.rh.candidats.push(
      genererCandidat(
        nouvelId(ent, 'cand'),
        poste,
        plateformeParId(plateformeId),
        {
          salaireMarche: salaireMarchePoste(poste, ville.indiceSalaires, e.conjoncture.indicePrix),
          salaireMinimum: e.salaireMinimum,
          penurie,
        },
        index,
        rng,
      ),
    );
  }
  e.rngState = rng.state;
  return n;
}

/** Offre d'emploi à un candidat : il accepte si le salaire répond à ses attentes. */
export function embaucherCandidat(
  etat: EtatPartie,
  entrepriseId: string,
  candidatId: string,
  salaireOffert: number,
  heures?: number,
): EtatPartie {
  return action(etat, entrepriseId, (ent, e) => {
    const c = ent.rh.candidats.find((x) => x.id === candidatId && x.statut === 'disponible');
    if (!c) return;
    const rng = new Rng(e.rngState);
    const salaire = Math.max(e.salaireMinimum, Math.round(salaireOffert * 100) / 100);
    if (!rng.chance(probabiliteAcceptation(salaire, c.attentes))) {
      c.statut = 'refuse';
      e.rngState = rng.state;
      return;
    }
    e.rngState = rng.state;
    const h = Math.round(
      borner(
        heures ?? c.heuresSouhaitees,
        BORNES_DECISIONS.heuresEmploye.min,
        BORNES_DECISIONS.heuresEmploye.max,
      ),
    );
    ent.employes.push(employeDepuisCandidat(c, salaire, h));
    ent.rh.candidats = ent.rh.candidats.filter((x) => x.id !== candidatId);
    const plateforme = plateformeParId(c.plateformeId);
    if (plateforme.pourcentageSalaire > 0) {
      const frais = salaire * h * 52 * plateforme.pourcentageSalaire;
      payer(
        ent.livre,
        ent,
        `Frais de l’agence de placement (${c.prenom} ${c.nom})`,
        'recrutement',
        frais,
        true,
        'publicite',
      );
    }
  });
}

export function retirerCandidat(
  etat: EtatPartie,
  entrepriseId: string,
  candidatId: string,
): EtatPartie {
  return action(etat, entrepriseId, (ent) => {
    ent.rh.candidats = ent.rh.candidats.filter((x) => x.id !== candidatId);
  });
}

/** Fin d'emploi : l'employé part tout de suite et reçoit une indemnité tenant lieu de préavis. */
export function congedier(etat: EtatPartie, entrepriseId: string, employeId: string): EtatPartie {
  return action(etat, entrepriseId, (ent, e) => terminerEmploi(ent, employeId, indexCourant(e)));
}

export function modifierHeuresEmploye(
  etat: EtatPartie,
  entrepriseId: string,
  employeId: string,
  heures: number,
): EtatPartie {
  return action(etat, entrepriseId, (ent) => {
    const employe = parId(ent.employes, employeId);
    employe.heuresSemaine = Math.round(
      borner(heures, BORNES_DECISIONS.heuresEmploye.min, BORNES_DECISIONS.heuresEmploye.max),
    );
  });
}

/** Modifier le salaire d'un employé (une hausse de 2 % ou plus compte comme une augmentation). */
export function modifierSalaireEmploye(
  etat: EtatPartie,
  entrepriseId: string,
  employeId: string,
  salaire: number,
): EtatPartie {
  return action(etat, entrepriseId, (ent, e) => {
    const employe = parId(ent.employes, employeId);
    const nouveau =
      Math.round(borner(salaire, e.salaireMinimum, BORNES_DECISIONS.salaireHoraire.max) * 100) /
      100;
    if (nouveau >= employe.salaireHoraire * 1.02) {
      employe.derniereAugmentation = indexCourant(e);
      employe.moral = Math.round(borner(employe.moral + 3, 0, 100));
    }
    employe.salaireHoraire = nouveau;
  });
}

/** Augmentation générale (en proportion) pour tous les employés. */
export function augmentationGenerale(
  etat: EtatPartie,
  entrepriseId: string,
  taux: number,
): EtatPartie {
  return action(etat, entrepriseId, (ent, e) => {
    const t = borner(taux, 0, 0.3);
    if (t <= 0) return;
    for (const x of ent.employes) {
      x.salaireHoraire =
        Math.round(borner(x.salaireHoraire * (1 + t), e.salaireMinimum, 60) * 100) / 100;
      if (t >= 0.02) {
        x.derniereAugmentation = indexCourant(e);
        x.moral = Math.round(borner(x.moral + 3, 0, 100));
      }
    }
  });
}

export function formerEmploye(
  etat: EtatPartie,
  entrepriseId: string,
  employeId: string,
  formationId: string,
): EtatPartie {
  return action(etat, entrepriseId, (ent) => {
    const employe = parId(ent.employes, employeId);
    const f = formationParId(formationId);
    if (employe.formations.includes(f.id)) return;
    if (f.postes && !f.postes.includes(employe.posteId)) return;
    payer(
      ent.livre,
      ent,
      `Formation : ${f.nom} (${employe.prenom} ${employe.nom})`,
      'formation',
      f.cout,
      true,
      'formationAvantages',
    );
    employe.formations.push(f.id);
    employe.competence =
      Math.round(borner(employe.competence + f.gainCompetence, 0.5, 1.4) * 100) / 100;
    employe.moral = Math.round(borner(employe.moral + f.gainMoral, 0, 100));
  });
}

/** Le propriétaire suit la formation de gestionnaire d'établissement alimentaire (MAPAQ). */
export function formerProprietaireHygiene(etat: EtatPartie, entrepriseId: string): EtatPartie {
  return action(etat, entrepriseId, (ent) => {
    if (ent.rh.gestionnaireHygiene) return;
    payer(
      ent.livre,
      ent,
      FORMATION_GESTIONNAIRE_HYGIENE.nom,
      'formation',
      FORMATION_GESTIONNAIRE_HYGIENE.cout,
      true,
      'formationAvantages',
    );
    ent.rh.gestionnaireHygiene = true;
  });
}

/** Évaluation annuelle de rendement : reconnaissance (moral) et constat des besoins. */
export function evaluerEmploye(
  etat: EtatPartie,
  entrepriseId: string,
  employeId: string,
): EtatPartie {
  return action(etat, entrepriseId, (ent, e) => {
    const employe = parId(ent.employes, employeId);
    const index = indexCourant(e);
    if (employe.derniereEvaluation !== null && index - employe.derniereEvaluation < 6) return;
    employe.derniereEvaluation = index;
    employe.moral = Math.round(borner(employe.moral + 5, 0, 100));
  });
}

/** Répondre à un dilemme : les effets sont appliqués immédiatement. */
export function repondreDilemme(
  etat: EtatPartie,
  entrepriseId: string,
  dilemmeId: string,
  choixId: string,
): EtatPartie {
  return action(etat, entrepriseId, (ent, e) => {
    const d = ent.dilemmes.find((x) => x.id === dilemmeId);
    if (!d) return;
    const def = dilemmeParId(d.defId);
    const choix = def.choix.find((c) => c.id === choixId);
    if (!choix) return;
    const rng = new Rng(e.rngState);
    appliquerEffets(choix.effets, contexteEffets(ent, d.employeId, indexCourant(e), rng));
    ent.dilemmes = ent.dilemmes.filter((x) => x.id !== dilemmeId);
    e.rngState = rng.state;
  });
}

// ---------------------------------------------------------------------------
// Marketing
// ---------------------------------------------------------------------------

export function commanderEtude(
  etat: EtatPartie,
  entrepriseId: string,
  typeId: IdTypeEtude,
): EtatPartie {
  return action(etat, entrepriseId, (ent, e) => {
    const type = typeEtudeParId(typeId);
    const secteur = secteurParId(e.config.secteurId);
    const ville = villeParId(e.config.villeId);
    const index = indexCourant(e);
    const { annee, mois } = dateDuMois(e.config, index);
    const rng = new Rng(e.rngState);
    payer(
      ent.livre,
      ent,
      `Étude de marché : ${type.nom}`,
      'etudesMarche',
      type.cout,
      true,
      'publicite',
    );
    const effets = effetsInvestissements(ent, secteur);
    ent.marketing.etudes.unshift(
      realiserEtude(
        typeId,
        {
          ent,
          secteur,
          ville,
          conj: e.conjoncture,
          concurrents: e.concurrents,
          facteurMarche: DIFFICULTES[e.config.difficulte].marche,
          ambiance: Math.min(
            0.95,
            amenagementDe(secteur, ent.amenagementId).ambiance + effets.ambiance,
          ),
          index,
          annee,
          mois,
        },
        nouvelId(ent, 'etude'),
        rng,
      ),
    );
    ent.marketing.etudes = ent.marketing.etudes.slice(0, 12);
    e.rngState = rng.state;
  });
}

export function lancerProduit(
  etat: EtatPartie,
  entrepriseId: string,
  produitId: string,
): EtatPartie {
  return action(etat, entrepriseId, (ent, e) => {
    const secteur = secteurParId(e.config.secteurId);
    const p = nouveauProduit(secteur, produitId);
    const existant = ent.marketing.produits.find((x) => x.ligneId === produitId);
    if (existant && existant.statut !== 'retire') return;
    payer(
      ent.livre,
      ent,
      `Développement : ${p.nom}`,
      'developpementProduits',
      p.coutDeveloppement,
      true,
      'publicite',
    );
    const index = indexCourant(e);
    if (existant) {
      existant.statut = 'developpement';
      existant.moisDisponible = index + p.delaiMois;
    } else {
      ent.marketing.produits.push({
        ligneId: p.id,
        statut: 'developpement',
        moisDisponible: index + p.delaiMois,
        facteur: 1,
        succes: false,
      });
    }
    ent.decisions.prix[p.id] = Math.round(p.prixReference * e.conjoncture.indicePrix * 20) / 20;
    if (!ent.decisions.approvisionnement[p.id]) {
      ent.decisions.approvisionnement[p.id] = politiqueParDefaut(
        p,
        secteur.fournisseursDefaut[p.categorieAppro],
        p.b2b ? 100 : 3000 * p.tauxAchat,
        e.conjoncture,
      );
    }
  });
}

/** Retirer un produit de la gamme (le stock restant sera écoulé ou jeté). */
export function retirerProduit(
  etat: EtatPartie,
  entrepriseId: string,
  produitId: string,
): EtatPartie {
  return action(etat, entrepriseId, (ent) => {
    const p = ent.marketing.produits.find((x) => x.ligneId === produitId);
    if (!p || p.statut === 'retire') return;
    p.statut = 'retire';
    if (ent.b2b.contrats.length > 0 && produitId === 'traiteur') ent.b2b.contrats = [];
    ent.b2b.appels = produitId === 'traiteur' ? [] : ent.b2b.appels;
  });
}

// ---------------------------------------------------------------------------
// Ventes aux entreprises
// ---------------------------------------------------------------------------

export function soumettre(
  etat: EtatPartie,
  entrepriseId: string,
  appelId: string,
  prix: number | null,
): EtatPartie {
  return action(etat, entrepriseId, (ent) => {
    const a = ent.b2b.appels.find((x) => x.id === appelId);
    if (!a) return;
    a.soumission = prix === null ? null : Math.round(borner(prix, 1, 200) * 100) / 100;
  });
}

// ---------------------------------------------------------------------------
// Finance
// ---------------------------------------------------------------------------

export type ModeFinancement = 'comptant' | 'pretFixe' | 'pretVariable';

/** Acheter un investissement, au comptant ou avec un prêt d'équipement sur 5 ans. */
export function investir(
  etat: EtatPartie,
  entrepriseId: string,
  investissementId: string,
  mode: ModeFinancement,
): EtatPartie {
  return action(etat, entrepriseId, (ent, e) => {
    const secteur = secteurParId(e.config.secteurId);
    const inv = investissementDef(secteur, investissementId);
    if (inv.unique && possede(ent, inv.id)) return;
    const index = indexCourant(e);
    if (mode !== 'comptant') {
      const type = mode === 'pretFixe' ? 'fixe' : 'variable';
      const ev = evaluerCredit(ent, inv.cout, 60, type, e.conjoncture);
      if (!ev.accepte) return;
      const pret = creerPret(
        nouvelId(ent, 'pret'),
        `Prêt d’équipement : ${inv.nom}`,
        versCents(inv.cout),
        ev.taux,
        60,
        {
          preteur: 'Banque',
          type,
          ecartTaux: ev.taux - tauxPreferentiel(e.conjoncture),
        },
      );
      ent.prets.push(pret);
      ecritureSimple(
        ent.livre,
        `Prêt d’équipement : ${inv.nom}`,
        'encaisse',
        'empruntBancaire',
        pret.capitalInitial,
        'empruntsRecus',
      );
    }
    const comptes = COMPTES_IMMOBILISATIONS[inv.type];
    const avant = ent.livre.soldes[comptes.actif];
    payer(
      ent.livre,
      ent,
      `Acquisition : ${inv.nom}`,
      comptes.actif,
      inv.cout,
      true,
      'acquisitionImmobilisations',
    );
    const cout = versDollars(ent.livre.soldes[comptes.actif] - avant);
    ent.immobilisations.push({
      id: nouvelId(ent, 'immo'),
      nom: inv.nom,
      type: inv.type,
      classeDpa: inv.classeDpa,
      cout,
      dureeVieMois:
        inv.type === 'ameliorations' ? Math.max(12, ent.bail.dureeMois - index) : inv.dureeVieMois,
      acquisition: index,
      amortCumule: 0,
      investissementId: inv.id,
    });
    ajouterAcquisition(ent.fiscal, inv.classeDpa, cout);
  });
}

/** Demander un prêt à terme à la banque (accepté seulement si le dossier le permet). */
export function demanderPret(
  etat: EtatPartie,
  entrepriseId: string,
  montant: number,
  dureeMois: number,
  type: 'fixe' | 'variable',
): EtatPartie {
  return action(etat, entrepriseId, (ent, e) => {
    const m = Math.round(borner(montant, 1000, 250_000));
    const duree = Math.round(borner(dureeMois, 12, 120));
    const ev = evaluerCredit(ent, m, duree, type, e.conjoncture);
    if (!ev.accepte) return;
    const pret = creerPret(
      nouvelId(ent, 'pret'),
      `Prêt à terme (taux ${type})`,
      versCents(m),
      ev.taux,
      duree,
      {
        preteur: 'Banque',
        type,
        ecartTaux: ev.taux - tauxPreferentiel(e.conjoncture),
      },
    );
    ent.prets.push(pret);
    ecritureSimple(
      ent.livre,
      'Nouveau prêt à terme',
      'encaisse',
      'empruntBancaire',
      pret.capitalInitial,
      'empruntsRecus',
    );
  });
}

/** Remboursement anticipé d'un prêt précis (au lieu du premier prêt). */
export function rembourserPret(
  etat: EtatPartie,
  entrepriseId: string,
  pretId: string,
  montant: number,
): EtatPartie {
  return action(etat, entrepriseId, (ent) => {
    const pret = ent.prets.find((p) => p.id === pretId && p.solde > 0);
    if (!pret) return;
    const rembourse = rembourserPartiellement(pret, versCents(Math.max(0, montant)));
    ecritureSimple(
      ent.livre,
      `Remboursement anticipé – ${pret.nom}`,
      'empruntBancaire',
      'encaisse',
      rembourse,
      'remboursementsEmprunts',
    );
  });
}

export function demanderHausseMarge(
  etat: EtatPartie,
  entrepriseId: string,
  limite: number,
): EtatPartie {
  return action(etat, entrepriseId, (ent, e) => {
    const base = DIFFICULTES[e.config.difficulte].limiteMarge;
    const max = limiteMargeMax(ent, base);
    if (limite > max || ent.moisEnDefaut > 0) return;
    ent.margeCredit.limite = versCents(Math.round(Math.max(0, limite) / 1000) * 1000);
  });
}

export function placer(
  etat: EtatPartie,
  entrepriseId: string,
  typeId: string,
  montant: number,
): EtatPartie {
  return action(etat, entrepriseId, (ent, e) => {
    const m = versCents(Math.max(0, Math.round(montant)));
    if (m <= 0 || m > ent.livre.soldes.encaisse) return;
    const t = typePlacement(typeId);
    const index = indexCourant(e);
    ent.finance.placements.push({
      id: nouvelId(ent, 'plac'),
      typeId,
      montant: m,
      taux: tauxPlacement(typeId, e.conjoncture),
      echeance: t.dureeMois > 0 ? index + t.dureeMois : null,
    });
    ecritureSimple(
      ent.livre,
      `Placement : ${t.nom}`,
      'placements',
      'encaisse',
      m,
      'placementsNets',
    );
  });
}

/** Retirer un placement (seulement le compte d'épargne ou un CPG échu). */
export function retirerPlacement(
  etat: EtatPartie,
  entrepriseId: string,
  placementId: string,
): EtatPartie {
  return action(etat, entrepriseId, (ent, e) => {
    const p = ent.finance.placements.find((x) => x.id === placementId);
    if (!p || (p.echeance !== null && p.echeance > indexCourant(e))) return;
    ecritureSimple(
      ent.livre,
      `Retrait du placement : ${typePlacement(p.typeId).nom}`,
      'encaisse',
      'placements',
      p.montant,
      'placementsNets',
    );
    ent.finance.placements = ent.finance.placements.filter((x) => x.id !== placementId);
  });
}

/** Valeur qu'un investisseur accorde à une société existante (avant son investissement). */
export function valorisationEnCours(ent: Entreprise): number {
  const derniers = ent.archives.slice(-12);
  const baiia = derniers.reduce((a, x) => a + x.indicateurs.beneficeNet, 0);
  const portion = ent.archives.at(-1)?.portionCouranteDette ?? 0;
  const capitaux = bilan(ent.livre.soldes, portion).capitaux.total;
  return Math.max(10_000, Math.round(Math.max(capitaux, 4 * baiia)));
}

/** Investisseur providentiel en cours de partie (société par actions seulement). */
export function accueillirInvestisseur(
  etat: EtatPartie,
  entrepriseId: string,
  montant: number,
): EtatPartie {
  return action(etat, entrepriseId, (ent) => {
    if (!estSocieteActions(ent.formeJuridique)) return;
    const m = Math.round(borner(montant, 10_000, 250_000));
    const pre = valorisationEnCours(ent);
    const part = m / (pre + m);
    const totalAutres = ent.finance.actionnaires
      .filter((a) => a.type === 'ange')
      .reduce((a, x) => a + x.part, 0);
    if (part + totalAutres * (1 - part) > 0.49) return;
    for (const a of ent.finance.actionnaires)
      a.part = Math.round(a.part * (1 - part) * 10000) / 10000;
    ent.finance.actionnaires.push({
      nom: 'Investisseur providentiel',
      part: Math.round(part * 10000) / 10000,
      type: 'ange',
    });
    ecritureSimple(
      ent.livre,
      'Émission d’actions à un investisseur providentiel',
      'encaisse',
      'capitalActions',
      versCents(m),
      'apportsProprietaire',
    );
  });
}

// ---------------------------------------------------------------------------
// Fiscalité et juridique (Jalon 2)
// ---------------------------------------------------------------------------

/** Inscription volontaire aux fichiers de la TPS et de la TVQ. */
export function inscrireTaxes(etat: EtatPartie, entrepriseId: string): EtatPartie {
  return action(etat, entrepriseId, (ent) => {
    ent.fiscal.inscritTaxes = true;
    ent.fiscal.doitSInscrire = false;
  });
}

export function changerFrequenceTaxes(
  etat: EtatPartie,
  entrepriseId: string,
  frequence: FrequenceTaxes,
): EtatPartie {
  return action(etat, entrepriseId, (ent) => {
    ent.fiscal.frequenceTaxes = frequence;
  });
}

/** Faire une démarche oubliée (payer son coût maintenant) avant qu'elle soit découverte. */
export function regulariserDemarche(
  etat: EtatPartie,
  entrepriseId: string,
  id: IdDemarche,
): EtatPartie {
  return action(etat, entrepriseId, (ent) => {
    if (ent.demarches[id]) return;
    ent.demarches[id] = true;
    if (id === 'mapaq') ent.rh.gestionnaireHygiene = true;
    const cout = coutDemarche(id, ent.formeJuridique);
    if (cout > 0)
      ecritureSimple(
        ent.livre,
        `Régularisation : ${demarche(id).nom}`,
        'droitsPermis',
        'encaisse',
        versCents(cout),
        'droitsEtAmendes',
      );
  });
}

/** Produire la déclaration de mise à jour annuelle au REQ pour l'année en cours. */
export function produireMiseAJourAnnuelle(etat: EtatPartie, entrepriseId: string): EtatPartie {
  return action(etat, entrepriseId, (ent, e) => {
    const { annee } = dateDuMois(e.config, indexCourant(e));
    if (ent.fiscal.majAnnuelles.includes(annee)) return;
    ent.fiscal.majAnnuelles.push(annee);
    ecritureSimple(
      ent.livre,
      `Déclaration de mise à jour annuelle ${annee} (REQ)`,
      'droitsPermis',
      'encaisse',
      versCents(fraisMiseAJourAnnuelle(ent.formeJuridique)),
      'droitsEtAmendes',
    );
  });
}

/** S'incorporer : la société par actions prend effet le 1er janvier suivant (début d'un exercice). */
export function planifierIncorporation(
  etat: EtatPartie,
  entrepriseId: string,
  type: 'inc-qc' | 'inc-federal' | null,
): EtatPartie {
  return action(etat, entrepriseId, (ent) => {
    if (ent.formeJuridique !== 'individuelle') return;
    ent.fiscal.incorporationPrevue = type;
  });
}

/** La déclaration de mise à jour annuelle est-elle exigée cette année? */
export function majAnnuelleExigee(anneeDepart: number, ent: Entreprise, annee: number): boolean {
  return (
    annee > anneeDepart && (ent.demarches.req || immatriculationObligatoire(ent.formeJuridique))
  );
}
