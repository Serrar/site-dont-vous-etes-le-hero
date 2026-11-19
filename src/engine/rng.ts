// ============================================================================
// rng.ts : le hasard, rendu « contrôlable ».
//
// Pourquoi ne pas appeler Math.random() partout ? Parce qu'un test qui dépend
// du hasard est un test qui échoue « parfois ». En injectant la source de
// hasard, on peut la remplacer par une version prévisible (voir mulberry32).
// ============================================================================

/**
 * Un type de FONCTION : `() => number` = « une fonction sans argument qui
 * renvoie un nombre ». Math.random respecte ce type (nombre entre 0 inclus et 1 exclu).
 */
export type Rng = () => number;

/**
 * Générateur pseudo-aléatoire déterministe : la même `seed` donne toujours la
 * même suite de nombres. Algorithme classique « mulberry32 » (domaine public).
 *
 * La fonction renvoie une AUTRE fonction qui se souvient de `a` entre deux appels :
 * c'est une « closure », comme en JS.
 */
export function mulberry32(seed: number): Rng {
  let a = seed >>> 0; // `>>> 0` force un entier non signé sur 32 bits
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    // Math.imul = multiplication d'entiers 32 bits (celle de JS déborderait en décimal)
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296; // ramené entre 0 et 1
  };
}

/** Lance un dé à 6 faces (résultat de 1 à 6) avec la source de hasard fournie. */
export function rollD6(rng: Rng): number {
  return Math.floor(rng() * 6) + 1;
}
