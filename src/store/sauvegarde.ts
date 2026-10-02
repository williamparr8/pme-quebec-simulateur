/**
 * Sauvegardes dans le localStorage : 3 emplacements manuels + 1 sauvegarde automatique
 * (à chaque fin de mois), et export/import d'une partie en fichier .json.
 * Le localStorage peut être indisponible (navigation privée) : toutes les opérations
 * sont protégées et le jeu reste jouable sans lui.
 */
import { compressToUTF16, decompressFromUTF16 } from 'lz-string';
import { VERSION_ETAT, type EtatPartie } from '../engine/types';

export type IdEmplacement = 'auto' | '1' | '2' | '3';
export const EMPLACEMENTS_MANUELS: IdEmplacement[] = ['1', '2', '3'];

const PREFIXE = 'pme-quebec:sauvegarde:';

export interface ResumeSauvegarde {
  emplacement: IdEmplacement;
  nomEntreprise: string;
  moisJoues: number;
  dureeMois: number;
  encaisse: number;
  /** Date de la sauvegarde (ISO). */
  sauvegardeLe: string;
  terminee: boolean;
}

interface FichierSauvegarde {
  format: 'pme-quebec-simulateur';
  version: typeof VERSION_ETAT;
  sauvegardeLe: string;
  etat: EtatPartie;
}

/**
 * Les sauvegardes sont compressées (lz-string) : une partie de 60 mois en équipes peut
 * dépasser 2 Mo en JSON, alors que le navigateur ne garde qu'environ 5 Mo par site.
 * Les anciennes sauvegardes non compressées restent lisibles.
 */
const MARQUE_COMPRESSION = 'lz16:';

/** Compresse un texte pour le stockage du navigateur. */
export function compresser(texte: string): string {
  return MARQUE_COMPRESSION + compressToUTF16(texte);
}

/** Décompresse un texte stocké (ou le retourne tel quel s'il n'était pas compressé). */
export function decompresser(brut: string): string | null {
  return brut.startsWith(MARQUE_COMPRESSION)
    ? decompressFromUTF16(brut.slice(MARQUE_COMPRESSION.length))
    : brut;
}

function lire(cle: string): string | null {
  try {
    const brut = window.localStorage.getItem(cle);
    return brut === null ? null : decompresser(brut);
  } catch {
    return null;
  }
}

function ecrire(cle: string, valeur: string): boolean {
  try {
    window.localStorage.setItem(cle, compresser(valeur));
    return true;
  } catch {
    return false;
  }
}

/** Vérifie qu'un objet a la forme d'un état de partie valide. */
export function estEtatPartie(x: unknown): x is EtatPartie {
  if (typeof x !== 'object' || x === null) return false;
  const e = x as Partial<EtatPartie>;
  return (
    e.version === VERSION_ETAT &&
    typeof e.moisCourant === 'number' &&
    typeof e.rngState === 'number' &&
    typeof e.config === 'object' &&
    Array.isArray(e.entreprises) &&
    e.entreprises.length > 0 &&
    Array.isArray(e.concurrents)
  );
}

function envelopper(etat: EtatPartie): FichierSauvegarde {
  return {
    format: 'pme-quebec-simulateur',
    version: VERSION_ETAT,
    sauvegardeLe: new Date().toISOString(),
    etat,
  };
}

export function analyserFichier(texte: string): EtatPartie {
  let donnees: unknown;
  try {
    donnees = JSON.parse(texte);
  } catch {
    throw new Error('Ce fichier n’est pas un fichier JSON valide.');
  }
  const f = donnees as Partial<FichierSauvegarde>;
  const etat = f && f.format === 'pme-quebec-simulateur' ? f.etat : donnees;
  if (!estEtatPartie(etat)) {
    const version = (etat as { version?: unknown } | null)?.version;
    if (typeof version === 'number' && version < VERSION_ETAT)
      throw new Error(
        'Cette partie a été créée avec une version précédente du jeu. Le moteur a beaucoup changé depuis : commence une nouvelle partie.',
      );
    throw new Error('Ce fichier ne contient pas une partie de PME Québec.');
  }
  return etat;
}

export function sauvegarder(emplacement: IdEmplacement, etat: EtatPartie): boolean {
  return ecrire(PREFIXE + emplacement, JSON.stringify(envelopper(etat)));
}

export function charger(emplacement: IdEmplacement): EtatPartie | null {
  const texte = lire(PREFIXE + emplacement);
  if (!texte) return null;
  try {
    return analyserFichier(texte);
  } catch {
    return null;
  }
}

export function supprimer(emplacement: IdEmplacement): void {
  try {
    window.localStorage.removeItem(PREFIXE + emplacement);
  } catch {
    // Rien à faire : le stockage est indisponible.
  }
}

export function resume(emplacement: IdEmplacement): ResumeSauvegarde | null {
  const texte = lire(PREFIXE + emplacement);
  if (!texte) return null;
  try {
    const f = JSON.parse(texte) as FichierSauvegarde;
    if (!estEtatPartie(f.etat)) return null;
    const ent = f.etat.entreprises[0];
    const derniere = ent.archives.at(-1);
    return {
      emplacement,
      // Mode équipes : on affiche le nombre d'équipes plutôt qu'une seule entreprise.
      nomEntreprise:
        f.etat.entreprises.length > 1
          ? `${f.etat.entreprises.length} équipes (${ent.nom}…)`
          : ent.nom,
      moisJoues: f.etat.moisCourant,
      dureeMois: f.etat.config.dureeMois,
      encaisse: derniere ? derniere.indicateurs.encaisse : ent.livre.soldes.encaisse / 100,
      sauvegardeLe: f.sauvegardeLe,
      terminee: f.etat.terminee,
    };
  } catch {
    return null;
  }
}

/** Télécharge la partie en fichier .json (le joueur choisit où l'enregistrer). */
export function exporter(etat: EtatPartie): void {
  const blob = new Blob([JSON.stringify(envelopper(etat), null, 1)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const lien = document.createElement('a');
  const nom = etat.entreprises[0].nom
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .toLowerCase();
  lien.href = url;
  lien.download = `pme-quebec-${nom || 'partie'}-mois-${etat.moisCourant}.json`;
  document.body.appendChild(lien);
  lien.click();
  lien.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function importer(fichier: File): Promise<EtatPartie> {
  return analyserFichier(await fichier.text());
}
