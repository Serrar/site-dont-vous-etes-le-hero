export type Rng = () => number;

/** Générateur pseudo-aléatoire déterministe (même seed = même partie). */
export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function rollD6(rng: Rng): number {
  return Math.floor(rng() * 6) + 1;
}
