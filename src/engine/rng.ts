/**
 * Générateur pseudo-aléatoire déterministe (mulberry32).
 * L'état tient dans un seul entier de 32 bits : il est sauvegardé avec la partie,
 * ce qui garantit que « même graine + mêmes décisions = mêmes résultats ».
 */
export class Rng {
  state: number;

  constructor(graine: number) {
    this.state = graine | 0;
  }

  /** Nombre uniforme dans [0, 1[. */
  next(): number {
    this.state = (this.state + 0x6d2b79f5) | 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Nombre uniforme dans [min, max[. */
  range(min: number, max: number): number {
    return min + (max - min) * this.next();
  }

  /** Entier uniforme dans [min, max] (bornes incluses). */
  int(min: number, max: number): number {
    return min + Math.floor(this.next() * (max - min + 1));
  }

  chance(probabilite: number): boolean {
    return this.next() < probabilite;
  }

  pick<T>(liste: readonly T[]): T {
    if (liste.length === 0) throw new Error('Liste vide');
    return liste[this.int(0, liste.length - 1)];
  }

  /** Loi normale (Box-Muller), bornée à ±4 écarts-types pour éviter les valeurs extrêmes. */
  normal(moyenne = 0, ecartType = 1): number {
    const u1 = Math.max(this.next(), 1e-12);
    const u2 = this.next();
    const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    return moyenne + ecartType * Math.max(-4, Math.min(4, z));
  }
}

/** Transforme un texte (ex. « boulangerie2027 ») en graine numérique stable. */
export function graineDepuisTexte(texte: string): number {
  let h = 2166136261;
  for (let i = 0; i < texte.length; i++) {
    h ^= texte.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
