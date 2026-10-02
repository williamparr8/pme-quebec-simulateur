/**
 * Sons générés avec la Web Audio API (aucun fichier audio) : caisse enregistreuse, perte,
 * alerte, réussite… Ils respectent la préférence « Sons » et restent discrets.
 */
import { usePreferences } from '../store/preferences';

export type Son = 'caisse' | 'perte' | 'alerte' | 'reussite' | 'erreur' | 'passage';

let contexte: AudioContext | null = null;

interface Note {
  frequence: number;
  debut: number;
  duree: number;
  type?: OscillatorType;
  volume?: number;
}

const SONS: Record<Son, Note[]> = {
  // « Cha-ching » : deux notes brèves, puis la clochette du tiroir-caisse.
  caisse: [
    { frequence: 1046.5, debut: 0, duree: 0.07, type: 'triangle' },
    { frequence: 1568, debut: 0.08, duree: 0.07, type: 'triangle' },
    { frequence: 2093, debut: 0.16, duree: 0.6, type: 'sine', volume: 0.12 },
    { frequence: 2637, debut: 0.16, duree: 0.45, type: 'sine', volume: 0.06 },
  ],
  perte: [
    { frequence: 392, debut: 0, duree: 0.18, type: 'sine' },
    { frequence: 311, debut: 0.2, duree: 0.35, type: 'sine' },
  ],
  alerte: [
    { frequence: 660, debut: 0, duree: 0.12, type: 'square', volume: 0.04 },
    { frequence: 880, debut: 0.15, duree: 0.12, type: 'square', volume: 0.04 },
  ],
  reussite: [
    { frequence: 523.25, debut: 0, duree: 0.12, type: 'triangle' },
    { frequence: 659.25, debut: 0.1, duree: 0.12, type: 'triangle' },
    { frequence: 783.99, debut: 0.2, duree: 0.3, type: 'triangle' },
  ],
  erreur: [{ frequence: 180, debut: 0, duree: 0.25, type: 'sawtooth', volume: 0.04 }],
  passage: [
    { frequence: 783.99, debut: 0, duree: 0.2, type: 'sine' },
    { frequence: 1046.5, debut: 0.18, duree: 0.4, type: 'sine' },
  ],
};

export function jouerSon(son: Son): void {
  if (!usePreferences.getState().sons) return;
  try {
    const Ctx =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    contexte ??= new Ctx();
    const ctx = contexte;
    if (ctx.state === 'suspended') void ctx.resume();
    const t0 = ctx.currentTime + 0.02;
    for (const n of SONS[son]) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = n.type ?? 'sine';
      osc.frequency.value = n.frequence;
      const volume = n.volume ?? 0.08;
      // Enveloppe courte (attaque rapide, décroissance) pour éviter les clics.
      gain.gain.setValueAtTime(0.0001, t0 + n.debut);
      gain.gain.exponentialRampToValueAtTime(volume, t0 + n.debut + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + n.debut + n.duree);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t0 + n.debut);
      osc.stop(t0 + n.debut + n.duree + 0.02);
    }
  } catch {
    // Audio indisponible (navigateur, politique de lecture) : le jeu continue en silence.
  }
}
