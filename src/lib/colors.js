/**
 * Colour helpers for canvas rendering. Chart colours come from CSS custom properties
 * (see index.css) so light/dark themes stay in one place; canvases read them at paint time.
 */

/** @typedef {[number, number, number]} RGB */

/**
 * Sequential blue ramp, light → dark (validated reference palette).
 * Low values must recede toward the surface, so dark themes use it reversed.
 */
export const SEQUENTIAL = ['#cde2fb', '#b7d3f6', '#9ec5f4', '#86b6ef', '#6da7ec', '#5598e7', '#3987e5', '#2a78d6', '#256abf', '#1c5cab', '#184f95', '#104281'];

/**
 * @param {string} name  CSS custom property, e.g. '--surface'.
 * @returns {string}
 */
export function cssVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

/**
 * @param {string} h  #rrggbb
 * @returns {RGB}
 */
export function rgb(h) {
  return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
}

/**
 * @param {RGB} a
 * @param {RGB} b
 * @param {number} t  0..1
 * @returns {RGB}
 */
export function mix(a, b, t) {
  return [Math.round(a[0] + (b[0] - a[0]) * t), Math.round(a[1] + (b[1] - a[1]) * t), Math.round(a[2] + (b[2] - a[2]) * t)];
}

/**
 * Colour for a normalised magnitude t ∈ [0, 1] on the sequential ramp.
 * @param {number} t
 * @param {boolean} dark
 * @returns {RGB}
 */
export function sequential(t, dark) {
  const ramp = dark ? [...SEQUENTIAL].reverse() : SEQUENTIAL;
  const i = Math.min(ramp.length - 1, Math.max(0, Math.floor(t * ramp.length)));
  return rgb(ramp[i]);
}

/** @returns {boolean} */
export function isDarkTheme() {
  return document.documentElement.dataset.theme !== 'light';
}
