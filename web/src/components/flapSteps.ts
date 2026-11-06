/** The order a real split-flap drum turns through. Characters outside it snap directly. */
export const FLAP_ALPHABET = " ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789−+.:#";

/**
 * The flaps a tile shows on its way from `from` to `to`: it only ever turns forward through the drum, compressed to at
 * most `max` visible steps so a long journey still lands quickly. The last element is always `to`.
 */
export function flapSteps(from: string, to: string, max = 6): string[] {
  if (from === to) return [];
  const a = FLAP_ALPHABET.indexOf(from);
  const b = FLAP_ALPHABET.indexOf(to);
  if (a < 0 || b < 0) return [to];
  const n = FLAP_ALPHABET.length;
  const distance = (b - a + n) % n;
  const count = Math.min(distance, max);
  const out: string[] = [];
  for (let k = 1; k <= count; k++) {
    const idx = (a + Math.round((distance * k) / count)) % n;
    out.push(FLAP_ALPHABET[idx] ?? to);
  }
  out[out.length - 1] = to;
  return out;
}
