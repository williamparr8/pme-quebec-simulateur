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
import { sauvegarder, type IdEmplacement } from './sauvegarde';

export type Ecran = 'accueil' | 'creation' | 'jeu';
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

export type Modale = null | 'confirmerMois' | 'rapport' | 'aide' | 'sauvegardes' | 'fin';

interface StoreJeu {
  ecran: Ecran;
  onglet: Onglet;
  modale: Modale;
  etat: EtatPartie | null;
  emplacementCourant: IdEmplacement | null;
  /** Message bref annoncé aux lecteurs d'écran et affiché quelques secondes. */
  annonce: string;

  allerA: (ecran: Ecran) => void;
  changerOnglet: (onglet: Onglet) => void;
  ouvrirModale: (m: Modale) => void;
  fermerModale: () => void;
  annoncer: (texte: string) => void;

  demarrer: (config: ConfigPartie, params: ParametresDemarrage) => void;
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
  /** Applique n'importe quelle action du moteur à l'entreprise du joueur. */
  agir: (f: (etat: EtatPartie, entrepriseId: string) => EtatPartie) => void;
  sauvegarderDans: (emplacement: IdEmplacement) => boolean;
}

export const useJeu = create<StoreJeu>((set, get) => {
  /** Applique une action du moteur à l'entreprise du joueur. */
  const appliquer = (f: (etat: EtatPartie, id: string) => EtatPartie) => {
    const { etat } = get();
    if (!etat || etat.terminee) return;
    set({ etat: f(etat, etat.entreprises[0].id) });
  };

  return {
    ecran: 'accueil',
    onglet: 'tableau',
    modale: null,
    etat: null,
    emplacementCourant: null,
    annonce: '',

    allerA: (ecran) => set({ ecran }),
    changerOnglet: (onglet) => set({ onglet }),
    ouvrirModale: (modale) => set({ modale }),
    fermerModale: () => set({ modale: null }),
    annoncer: (annonce) => set({ annonce }),

    demarrer: (config, params) => {
      const etat = creerPartie(config, params);
      sauvegarder('auto', etat);
      set({ etat, ecran: 'jeu', onglet: 'tableau', modale: null, emplacementCourant: null });
    },

    chargerPartie: (etat, emplacement) =>
      set({
        etat,
        ecran: 'jeu',
        onglet: 'tableau',
        modale: etat.terminee ? 'fin' : null,
        emplacementCourant: emplacement,
      }),

    quitter: () => set({ ecran: 'accueil', etat: null, modale: null }),

    terminerMois: () => {
      const { etat, emplacementCourant } = get();
      if (!etat || etat.terminee) return;
      const suivant = simulerMois(etat);
      // Sauvegarde automatique à chaque fin de mois.
      sauvegarder('auto', suivant);
      if (emplacementCourant && emplacementCourant !== 'auto')
        sauvegarder(emplacementCourant, suivant);
      set({ etat: suivant, modale: 'rapport' });
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

/** Raccourci : entreprise du joueur (ou null). */
export function useEntreprise() {
  return useJeu((s) => s.etat?.entreprises[0] ?? null);
}
