// A small seeded random generator (xorshift32): the same seed gives the same
// sequence, which is what makes the city layout and the screenshot scenes repeatable.
export function createRandom(seed) {
  let a = (seed | 0) || 1;
  return function random() {
    a ^= a << 13;
    a ^= a >>> 17;
    a ^= a << 5;
    return (a >>> 0) / 4294967296;
  };
}

/** Pick an integer in [min, max] from the generator. */
export function randInt(random, min, max) {
  return min + Math.floor(random() * (max - min + 1));
}

/** Pick one item from an array. */
export function pick(random, items) {
  return items[Math.floor(random() * items.length)];
}
