/**
 * État global de l'interface (Zustand). Le moteur reste indépendant : le store
 * ne fait qu'appeler ses fonctions pures et conserver le nouvel état.
 */
import { create } from 'zustand';
import {
  congedier,
  creerPartie,
  embaucher,
  modifierDecisions,
  modifierHeuresEmploye,
  simulerMois,
  inscrireTaxes,
  changerFrequenceTaxes,
  regulariserDemarche,
  produireMiseAJourAnnuelle,
  planifierIncorporation,
} from '../engine/simulation';
import type {
  ConfigPartie,
  Decisions,
  EtatPartie,
  FrequenceTaxes,
  IdDemarche,
  ParametresDemarrage,
} from '../engine/types';
import { enregistrerClassement } from './classement';
import { sauvegarder, type IdEmplacement } from './sauvegarde';

export type Ecran = 'accueil' | 'creation' | 'jeu' | 'scenarios' | 'classement';

/** Mode de la prochaine partie à créer. */
export type ModeCreation =
  { type: 'solo' } | { type: 'equipes'; nombre: number } | { type: 'scenario'; scenarioId: string };

export type Onglet =
  'tableau' | 'marketing' | 'rh' | 'finance' | 'operations' | 'ventes' | 'juridique';

export const ONGLETS: { id: Onglet; nom: string; touche: string }[] = [
  { id: 'tableau', nom: 'Tableau de bord', touche: 'T' },
  { id: 'marketing', nom: 'Marketing', touche: 'M' },
  { id: 'rh', nom: 'Ressources humaines', touche: 'R' },
  { id: 'operations', nom: 'Opérations', touche: 'O' },
  { id: 'ventes', nom: 'Ventes', touche: 'V' },
  { id: 'finance', nom: 'Finance', touche: 'F' },
  { id: 'juridique', nom: 'Juridique et fiscalité', touche: 'J' },
];

export type Modale =
  null | 'confirmerMois' | 'rapport' | 'aide' | 'sauvegardes' | 'fin' | 'glossaire' | 'quiz';

/**
 * Équipes qui jouent ce mois-ci : les entreprises actives, et celles qui viennent de faire
 * faillite ou d'être vendues (elles voient leur dernier rapport une fois).
 */
export function equipesDuTour(etat: EtatPartie): number[] {
  return etat.entreprises
    .map((e, i) => ({ e, i }))
    .filter(
      ({ e }) =>
        (!e.enFaillite && !e.vente) ||
        (etat.moisCourant > 0 && e.archives.at(-1)?.index === etat.moisCourant - 1),
    )
    .map(({ i }) => i);
}

interface StoreJeu {
  ecran: Ecran;
  onglet: Onglet;
  modale: Modale;
  etat: EtatPartie | null;
  emplacementCourant: IdEmplacement | null;
  /** Message bref annoncé aux lecteurs d'écran et affiché quelques secondes. */
  annonce: string;
  /** Équipe qui a le clavier (0 en solo). */
  equipeCourante: number;
  /** Écran « Passez le clavier » affiché : il cache les décisions de l'équipe précédente. */
  passage: boolean;
  modeCreation: ModeCreation;
  /** Tutoriel guidé des 3 premiers mois (étape dans la liste du mois courant). */
  tutoriel: { actif: boolean; etape: number };

  allerA: (ecran: Ecran) => void;
  changerOnglet: (onglet: Onglet) => void;
  ouvrirModale: (m: Modale) => void;
  fermerModale: () => void;
  annoncer: (texte: string) => void;

  choisirModeCreation: (mode: ModeCreation) => void;
  commencerTour: () => void;
  choisirEquipe: (index: number) => void;
  changerTutoriel: (t: { actif: boolean; etape: number }) => void;
  demarrer: (config: ConfigPartie, params: ParametresDemarrage | ParametresDemarrage[]) => void;
  chargerPartie: (etat: EtatPartie, emplacement: IdEmplacement | null) => void;
  quitter: () => void;
  terminerMois: () => void;
  changerDecisions: (changements: Partial<Decisions>) => void;
  embaucherEmploye: (heures?: number) => void;
  congedierEmploye: (id: string) => void;
  changerHeuresEmploye: (id: string, heures: number) => void;
  inscrireAuxTaxes: () => void;
  changerFrequence: (f: FrequenceTaxes) => void;
  regulariser: (id: IdDemarche) => void;
  produireDeclarationReq: () => void;
  planifierIncorporationSociete: (type: 'inc-qc' | 'inc-federal' | null) => void;
  /** Applique n'importe quelle action du moteur à l'entreprise de l'équipe courante. */
  agir: (f: (etat: EtatPartie, entrepriseId: string) => EtatPartie) => void;
  sauvegarderDans: (emplacement: IdEmplacement) => boolean;
}

export const useJeu = create<StoreJeu>((set, get) => {
  /** Applique une action du moteur à l'entreprise de l'équipe qui a le clavier. */
  const appliquer = (f: (etat: EtatPartie, id: string) => EtatPartie) => {
    const { etat, equipeCourante } = get();
    if (!etat || etat.terminee) return;
    const ent = etat.entreprises[equipeCourante] ?? etat.entreprises[0];
    set({ etat: f(etat, ent.id) });
  };

  return {
    ecran: 'accueil',
    onglet: 'tableau',
    modale: null,
    etat: null,
    emplacementCourant: null,
    annonce: '',
    equipeCourante: 0,
    passage: false,
    modeCreation: { type: 'solo' },
    tutoriel: { actif: false, etape: 0 },

    allerA: (ecran) => set({ ecran }),
    changerOnglet: (onglet) => set({ onglet }),
    ouvrirModale: (modale) => set({ modale }),
    fermerModale: () => set({ modale: null }),
    annoncer: (annonce) => set({ annonce }),

    choisirModeCreation: (modeCreation) => set({ modeCreation, ecran: 'creation' }),
    commencerTour: () => {
      const { etat, tutoriel } = get();
      set({
        passage: false,
        onglet: 'tableau',
        modale: etat && etat.moisCourant > 0 ? 'rapport' : null,
        tutoriel: { ...tutoriel, etape: 0 },
      });
    },
    choisirEquipe: (equipeCourante) => set({ equipeCourante }),
    changerTutoriel: (tutoriel) => set({ tutoriel }),

    demarrer: (config, params) => {
      const etat = creerPartie(config, params);
      sauvegarder('auto', etat);
      set({
        etat,
        ecran: 'jeu',
        onglet: 'tableau',
        modale: null,
        emplacementCourant: null,
        equipeCourante: 0,
        passage: etat.entreprises.length > 1,
        tutoriel: { actif: config.tutoriel === true, etape: 0 },
      });
    },

    chargerPartie: (etat, emplacement) =>
      set({
        etat,
        ecran: 'jeu',
        onglet: 'tableau',
        modale: etat.terminee ? 'fin' : null,
        emplacementCourant: emplacement,
        equipeCourante: equipesDuTour(etat)[0] ?? 0,
        passage: etat.entreprises.length > 1 && !etat.terminee,
        tutoriel: { actif: etat.config.tutoriel === true && etat.moisCourant < 3, etape: 0 },
      }),

    quitter: () => set({ ecran: 'accueil', etat: null, modale: null, passage: false }),

    terminerMois: () => {
      const { etat, emplacementCourant, equipeCourante } = get();
      if (!etat || etat.terminee) return;
      // Mode équipes : on passe le clavier à l'équipe suivante avant de simuler le mois.
      const suivante = equipesDuTour(etat).find((i) => i > equipeCourante);
      if (suivante !== undefined) {
        set({ equipeCourante: suivante, passage: true, modale: null, onglet: 'tableau' });
        return;
      }
      const suivant = simulerMois(etat);
      // Sauvegarde automatique à chaque fin de mois.
      sauvegarder('auto', suivant);
      if (emplacementCourant && emplacementCourant !== 'auto')
        sauvegarder(emplacementCourant, suivant);
      if (suivant.terminee) enregistrerClassement(suivant);
      const equipes = suivant.entreprises.length > 1;
      set({
        etat: suivant,
        equipeCourante: equipes ? (equipesDuTour(suivant)[0] ?? 0) : 0,
        passage: equipes && !suivant.terminee,
        modale: equipes ? (suivant.terminee ? 'fin' : null) : 'rapport',
        onglet: 'tableau',
        tutoriel: { ...get().tutoriel, etape: 0 },
      });
    },

    changerDecisions: (changements) => appliquer((e, id) => modifierDecisions(e, id, changements)),
    embaucherEmploye: (heures) => appliquer((e, id) => embaucher(e, id, heures)),
    congedierEmploye: (employeId) => appliquer((e, id) => congedier(e, id, employeId)),
    changerHeuresEmploye: (employeId, heures) =>
      appliquer((e, id) => modifierHeuresEmploye(e, id, employeId, heures)),
    inscrireAuxTaxes: () => appliquer((e, id) => inscrireTaxes(e, id)),
    changerFrequence: (f) => appliquer((e, id) => changerFrequenceTaxes(e, id, f)),
    regulariser: (d) => appliquer((e, id) => regulariserDemarche(e, id, d)),
    produireDeclarationReq: () => appliquer((e, id) => produireMiseAJourAnnuelle(e, id)),
    planifierIncorporationSociete: (t) => appliquer((e, id) => planifierIncorporation(e, id, t)),
    agir: (f) => appliquer(f),

    sauvegarderDans: (emplacement) => {
      const { etat } = get();
      if (!etat) return false;
      const ok = sauvegarder(emplacement, etat);
      if (ok) set({ emplacementCourant: emplacement });
      return ok;
    },
  };
});

/** Raccourci : entreprise de l'équipe qui a le clavier (ou null). */
export function useEntreprise() {
  return useJeu((s) => s.etat?.entreprises[s.equipeCourante] ?? s.etat?.entreprises[0] ?? null);
}
