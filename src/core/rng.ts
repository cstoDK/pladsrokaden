// Lille tilfældighedsgenerator med startværdi (mulberry32), så tests
// kan gentages, og så "Nyt forslag" kan give et nyt resultat.

export type Rng = () => number;

export function lavRng(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function heltal(rng: Rng, max: number): number {
  return Math.floor(rng() * max);
}

export function bland<T>(rng: Rng, liste: T[]): T[] {
  const a = liste.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = heltal(rng, i + 1);
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}
