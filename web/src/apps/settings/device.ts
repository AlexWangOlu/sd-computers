// Stable fake hardware identifiers derived from the computer's id, so each in-game computer shows
// its own Device ID / Product ID that never changes between sessions.

const fnv = (s: string, seed: number): number => {
  let h = (0x811c9dc5 ^ seed) >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
};

/** "8F3A2C1D-4B5E-9A07-C3D2-11E0F4A9B6C8" style GUID. */
export function deviceId(id: string): string {
  const hex = [1, 2, 3, 4].map(i => fnv(id, Math.imul(i, 0x9e3779b9)).toString(16).padStart(8, '0')).join('').toUpperCase();
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

/** "00330-80412-63518-AA172" style product id. */
export function productId(id: string): string {
  const n = (seed: number, len: number) => String(fnv(id, seed) % 10 ** len).padStart(len, '0');
  return `00330-${n(11, 5)}-${n(12, 5)}-AA${n(13, 3)}`;
}
