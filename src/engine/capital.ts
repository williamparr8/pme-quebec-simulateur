/**
 * Capital : sociofinancement (campagne « tout ou rien » avec contreparties) et capital de risque
 * (dilution, conseil d'administration, objectif de croissance, restriction des dividendes).
 * Comptabilité du sociofinancement : les contributions sont des produits perçus d'avance (passif)
 * constatés en revenus quand les contreparties sont livrées. Simplifications : les taxes de vente
 * sur les contributions ne sont pas simulées, et un seul fonds de capital de risque par partie.
 */
import { ecritureSimple, type GrandLivre } from './accounting';
import { valorisationEnCours } from './actions';
import { estSocieteActions } from './conformite';
import { palier, ventesDouzeMois } from './croissance';
import { payer } from './ecritures';
import type { Rng } from './rng';
import { MOIS_PREPARATION_RELEVE, venteForcee } from './transmission';
import type { Entreprise, EtatPartie, Message } from './types';
import { borner, versCents } from './util';

export const SOCIO = {
  objectifMin: 3_000,
  objectifMax: 60_000,
  /** Durée de la campagne (mois). */
  moisCampagne: 2,
  /** Délai minimal entre deux campagnes (mois). */
  delaiEntreCampagnes: 6,
  /** Vidéo, photos et page de présentation. */
  fraisLancement: 400,
  fraisPlateforme: 0.05, // À VÉRIFIER : 5 % chez Kickstarter, 8 à 9 % chez Ulule
  fraisPaiement: 0.04, // À VÉRIFIER : 3 à 5 % de frais de traitement des paiements
  /** Part des contributions qui sert à fabriquer et à expédier les contreparties. */
  coutContreparties: 0.35,
  moisLivraison: 3,
  /** Les contributions peuvent dépasser l'objectif jusqu'à ce pourcentage. */
  depassementMax: 0.5,
} as const;

export const CAPITAL_RISQUE = {
  montantMin: 100_000,
  montantMax: 2_000_000,
  /** Prime de croissance sur la valeur actuelle : le fonds paie pour le potentiel. */
  primeCroissance: 1.4,
  partMax: 0.4,
  /** Part maximale de l'ensemble des investisseurs après la ronde. */
  partInvestisseursMax: 0.6,
  fraisJuridiques: 5_000,
  fraisDiligence: 0.015,
  /** Ventes annuelles minimales (ou palier PME) pour intéresser un fonds. */
  ventesMin: 400_000,
  objectifCroissance: 0.2,
  moisRevue: 12,
  avertissementsMax: 2,
} as const;

const arrondi = (x: number): number => Math.round(x);

function etatCapital(ent: Entreprise): NonNullable<Entreprise['capital']> {
  ent.capital ??= { campagne: null, livraisons: [], historique: [] };
  return ent.capital;
}

// ---------------------------------------------------------------------------
// Sociofinancement
// ---------------------------------------------------------------------------

/** Chances de réussite d'une campagne : l'objectif est-il raisonnable pour ta notoriété? */
export function chancesSociofinancement(ent: Entreprise, objectif: number): number {
  const ventes = Math.max(24_000, ventesDouzeMois(ent));
  const r = objectif / ventes;
  const notoriete = borner(ent.clientele.notoriete, 0, 1);
  const derniere = ent.archives.at(-1)?.indicateurs;
  const satisfaction = borner(derniere?.satisfaction ?? 0.5, 0, 1);
  return borner(0.9 - 2.4 * r + 0.5 * notoriete + 0.25 * (satisfaction - 0.5), 0.05, 0.95);
}

export function verifierSociofinancement(
  ent: Entreprise,
  index: number,
): { ok: boolean; raison: string } {
  if (ent.vente || ent.enFaillite) return { ok: false, raison: 'L’entreprise n’est plus active.' };
  const c = ent.capital;
  if (c?.campagne) return { ok: false, raison: 'Une campagne est déjà en cours.' };
  const derniere = c?.historique.at(-1);
  if (derniere && index - derniere.index < SOCIO.delaiEntreCampagnes)
    return {
      ok: false,
      raison: `Attends encore ${SOCIO.delaiEntreCampagnes - (index - derniere.index)} mois avant une nouvelle campagne : tes contributeurs de la dernière ne sont pas oubliés.`,
    };
  if ((c?.livraisons.length ?? 0) > 0)
    return {
      ok: false,
      raison: 'Termine d’abord de livrer les contreparties de ta dernière campagne.',
    };
  return { ok: true, raison: '' };
}

/** Lance une campagne de sociofinancement (tout ou rien) : le résultat arrive dans 2 mois. */
export function lancerSociofinancement(
  etat: EtatPartie,
  entrepriseId: string,
  objectif: number,
): EtatPartie {
  const e = structuredClone(etat);
  const ent = e.entreprises.find((x) => x.id === entrepriseId);
  if (!ent) return etat;
  const index = Math.min(e.moisCourant, e.config.dureeMois - 1);
  if (!verifierSociofinancement(ent, index).ok) return etat;
  const o = arrondi(borner(objectif, SOCIO.objectifMin, SOCIO.objectifMax) / 100) * 100;
  payer(
    ent.livre,
    ent,
    'Lancement d’une campagne de sociofinancement (vidéo, photos, page)',
    'publicite',
    SOCIO.fraisLancement,
    true,
    'publicite',
  );
  etatCapital(ent).campagne = { objectif: o, debut: index, fin: index + SOCIO.moisCampagne };
  return e;
}

// ---------------------------------------------------------------------------
// Capital de risque et conseil d'administration
// ---------------------------------------------------------------------------

export interface TermesCapitalRisque {
  ok: boolean;
  raison: string;
  valorisationAvant: number;
  valorisationApres: number;
  part: number;
  frais: number;
  /** Ta part après la ronde. */
  partFondateur: number;
}

export function termesCapitalRisque(ent: Entreprise, montant: number): TermesCapitalRisque {
  const m = arrondi(borner(montant, CAPITAL_RISQUE.montantMin, CAPITAL_RISQUE.montantMax));
  const avant = arrondi(valorisationEnCours(ent) * CAPITAL_RISQUE.primeCroissance);
  const part = m / (avant + m);
  const fondateur = ent.finance.actionnaires.find((a) => a.type === 'fondateur')?.part ?? 1;
  const autres = ent.finance.actionnaires
    .filter((a) => a.type !== 'fondateur')
    .reduce((s, a) => s + a.part, 0);
  const frais = arrondi(CAPITAL_RISQUE.fraisJuridiques + m * CAPITAL_RISQUE.fraisDiligence);
  let raison = '';
  if (!estSocieteActions(ent.formeJuridique))
    raison = 'Un fonds n’investit que dans une société par actions (département Juridique).';
  else if (ent.vente || ent.enFaillite) raison = 'L’entreprise n’est plus active.';
  else if (ent.capital?.conseil) raison = 'Un fonds siège déjà à ton conseil d’administration.';
  else if (ventesDouzeMois(ent) < CAPITAL_RISQUE.ventesMin && palier(ent) === 'petite')
    raison = `Un fonds s’intéresse aux entreprises qui dépassent ${CAPITAL_RISQUE.ventesMin.toLocaleString('fr-CA')} $ de ventes par an, ou qui sont devenues une PME.`;
  else if (ent.archives.length < 6)
    raison = 'Il faut au moins 6 mois d’historique pour intéresser un fonds.';
  else if (part > CAPITAL_RISQUE.partMax)
    raison = `Le fonds demanderait ${(part * 100).toFixed(0)} % de l’entreprise : au-delà de ${CAPITAL_RISQUE.partMax * 100} %, tu perdrais le contrôle. Réduis le montant.`;
  else if (autres + part * (1 - autres) > CAPITAL_RISQUE.partInvestisseursMax)
    raison = 'Avec tes investisseurs actuels, tu céderais trop de l’entreprise.';
  return {
    ok: raison === '',
    raison,
    valorisationAvant: avant,
    valorisationApres: avant + m,
    part,
    frais,
    partFondateur: fondateur * (1 - part),
  };
}

/** Ronde de capital de risque : le fonds reçoit des actions et un siège au conseil. */
export function leverCapitalRisque(
  etat: EtatPartie,
  entrepriseId: string,
  montant: number,
): EtatPartie {
  const e = structuredClone(etat);
  const ent = e.entreprises.find((x) => x.id === entrepriseId);
  if (!ent) return etat;
  const t = termesCapitalRisque(ent, montant);
  if (!t.ok) return etat;
  const m = arrondi(borner(montant, CAPITAL_RISQUE.montantMin, CAPITAL_RISQUE.montantMax));
  const index = Math.min(e.moisCourant, e.config.dureeMois - 1);
  for (const a of ent.finance.actionnaires)
    a.part = Math.round(a.part * (1 - t.part) * 10_000) / 10_000;
  ent.finance.actionnaires.push({
    nom: 'Fonds de capital de risque',
    part: Math.round(t.part * 10_000) / 10_000,
    type: 'risque',
  });
  ecritureSimple(
    ent.livre,
    'Émission d’actions à un fonds de capital de risque',
    'encaisse',
    'capitalActions',
    versCents(m),
    'apportsProprietaire',
  );
  payer(
    ent.livre,
    ent,
    'Frais juridiques et de vérification diligente de la ronde',
    'honoraires',
    t.frais,
    true,
    'loyerEtFrais',
  );
  etatCapital(ent).conseil = {
    sieges: [ent.proprietaire, 'Représentant du fonds', 'Administrateur indépendant'],
    objectifCroissance: CAPITAL_RISQUE.objectifCroissance,
    ventesRef: arrondi(ventesDouzeMois(ent)),
    prochaineRevue: index + CAPITAL_RISQUE.moisRevue,
    avertissements: 0,
    sansDividendes: true,
  };
  return e;
}

// ---------------------------------------------------------------------------
// Traitement mensuel
// ---------------------------------------------------------------------------

export interface ContexteCapital {
  index: number;
  rng: Rng;
}

export function gererCapital(L: GrandLivre, ent: Entreprise, c: ContexteCapital): Message[] {
  const messages: Message[] = [];
  const cap = ent.capital;

  // Relève prête
  if (ent.releve && c.index - ent.releve.debut + 1 === MOIS_PREPARATION_RELEVE)
    messages.push({ code: 'releveePrete', niveau: 'succes', params: { nom: ent.releve.nom } });

  if (!cap) return messages;

  // Résultat de la campagne de sociofinancement
  if (cap.campagne && c.index >= cap.campagne.fin - 1) {
    const { objectif } = cap.campagne;
    cap.campagne = null;
    const reussie = c.rng.chance(chancesSociofinancement(ent, objectif));
    if (reussie) {
      const brut = arrondi(objectif * (1 + c.rng.range(0, SOCIO.depassementMax)));
      const frais = arrondi(brut * (SOCIO.fraisPlateforme + SOCIO.fraisPaiement));
      ecritureSimple(
        L,
        'Contributions reçues (sociofinancement)',
        'encaisse',
        'produitsPercusAvance',
        versCents(brut),
        'encaissementsClients',
      );
      ecritureSimple(
        L,
        'Frais de la plateforme et de paiement',
        'fraisCartes',
        'encaisse',
        versCents(frais),
        'fraisBancaires',
      );
      cap.livraisons.push({ restantCents: versCents(brut), mois: SOCIO.moisLivraison });
      cap.historique.push({ index: c.index, objectif, montant: brut, reussie: true });
      messages.push({
        code: 'sociofinancementReussi',
        niveau: 'succes',
        params: { objectif, brut, frais },
      });
    } else {
      cap.historique.push({ index: c.index, objectif, montant: 0, reussie: false });
      messages.push({ code: 'sociofinancementEchec', niveau: 'alerte', params: { objectif } });
    }
  }

  // Livraison des contreparties : les produits perçus d'avance deviennent des revenus
  for (const l of cap.livraisons) {
    const part = l.mois <= 1 ? l.restantCents : Math.floor(l.restantCents / l.mois);
    ecritureSimple(
      L,
      'Contreparties livrées : produits perçus d’avance constatés',
      'produitsPercusAvance',
      'revenusSociofinancement',
      part,
    );
    ecritureSimple(
      L,
      'Fabrication et expédition des contreparties',
      'coutMarchandises',
      'encaisse',
      Math.round(part * SOCIO.coutContreparties),
      'paiementsFournisseurs',
    );
    l.restantCents -= part;
    l.mois -= 1;
  }
  cap.livraisons = cap.livraisons.filter((l) => l.mois > 0 && l.restantCents > 0);

  // Revue annuelle du conseil d'administration
  const conseil = cap.conseil;
  if (conseil && c.index >= conseil.prochaineRevue) {
    const ventes = ventesDouzeMois(ent);
    const croissance = conseil.ventesRef > 0 ? ventes / conseil.ventesRef - 1 : 0;
    const reussie = croissance >= conseil.objectifCroissance;
    if (reussie) {
      conseil.avertissements = Math.max(0, conseil.avertissements - 1);
    } else {
      conseil.avertissements += 1;
    }
    messages.push({
      code: 'conseilRevue',
      niveau: reussie ? 'succes' : 'alerte',
      params: {
        croissance: Math.round(croissance * 1000) / 10,
        objectif: Math.round(conseil.objectifCroissance * 100),
        avertissements: conseil.avertissements,
      },
    });
    conseil.ventesRef = arrondi(ventes);
    conseil.prochaineRevue = c.index + CAPITAL_RISQUE.moisRevue;
    if (conseil.avertissements >= CAPITAL_RISQUE.avertissementsMax) {
      ent.vente = venteForcee(ent, c.index);
      messages.push({ code: 'venteForcee', niveau: 'danger', params: { prix: ent.vente.prix } });
    }
  }
  return messages;
}
