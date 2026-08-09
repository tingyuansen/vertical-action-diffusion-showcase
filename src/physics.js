/**
 * physics.js — vertical action diffusion in a harmonic disc.
 *
 * Units.  length kpc, speed km/s, time T0 = 1 kpc/(km/s) = 0.977792 Gyr.
 * The vertical frequency is held at nu = 75 km/s/kpc, so one vertical
 * oscillation takes 2*pi/nu = 0.0838 T0 = 82 Myr.
 *
 * The only physical input is q(z), the local rate at which the vertical
 * velocity is randomised.  Everything else is derived.
 *
 *   D(J) = (1/pi) * int_{-Z}^{Z} q(z) sqrt(Z^2 - z^2) dz,   Z = sqrt(2J/nu)
 *   q constant            ->  D = q0 J / nu               ->  b = 1
 *   q a thin midplane sheet ->  D = (Q/pi) sqrt(2J/nu)     ->  b = 1/2
 *   p(J,t) ∝ exp[ -(J/J0)^{2-b} ],     J0 ∝ t^{1/(2-b)}
 */

export const NU = 75.0;                 // km/s/kpc
export const T0_GYR = 0.977792;         // Gyr per T0
export const PERIOD = 2 * Math.PI / NU; // vertical period, T0
export const T_END_GYR = 8.0;
export const T_END = T_END_GYR / T0_GYR;

export const H_LAYER = 0.050;           // kpc.  thin against Z ~ 0.7 kpc
export const SIG_BIRTH = 6.0;           // km/s, vertical dispersion at birth

/* the Part I scale at 8 Gyr, J0 = 26.2 kpc km/s with b = 1/2 */
const J0_TARGET = 26.21;

/* ───────────────────────────────────────────────── special functions */

function gammaFn(x) {
  const g = [0.99999999999980993, 676.5203681218851, -1259.1392167224028,
             771.32342877765313, -176.61502916214059, 12.507343278686905,
             -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
  if (x < 0.5) return Math.PI / (Math.sin(Math.PI * x) * gammaFn(1 - x));
  x -= 1;
  let a = g[0];
  const t = x + 7.5;
  for (let i = 1; i < 9; i++) a += g[i] / (x + i);
  return Math.sqrt(2 * Math.PI) * Math.pow(t, x + 0.5) * Math.exp(-t) * a;
}

/** <J> / J0 for the stretched exponential of exponent 2-b. */
const meanOverJ0 = (b) => gammaFn(2 / (2 - b)) / gammaFn(1 / (2 - b));

/** pdf of x = J / <J>, so the amplitude divides out and only shape is left. */
export function pdfScaled(x, b) {
  const a = 2 - b, c = meanOverJ0(b);
  return a * c / gammaFn(1 / a) * Math.exp(-Math.pow(c * x, a));
}

/* ───────────────────────────────────────────────── Gaussian deviates */

let spare = null;
export function randn() {
  if (spare !== null) { const s = spare; spare = null; return s; }
  let u, v, s;
  do { u = 2 * Math.random() - 1; v = 2 * Math.random() - 1; s = u * u + v * v; }
  while (s >= 1 || s === 0);
  const f = Math.sqrt(-2 * Math.log(s) / s);
  spare = v * f;
  return u * f;
}

/* ───────────────────────────────────────────────── scattering profiles */

const INV_SQRT_2PI = 0.3989422804014327;

/** q(z) for the thin midplane sheet of column Q. */
export const qLayer = (z, Q) =>
  Q * INV_SQRT_2PI / H_LAYER * Math.exp(-0.5 * z * z / (H_LAYER * H_LAYER));

/* ───────────────────────────────────────────────── amplitudes
 *
 * Both are analytic.  For the thin sheet D = D0 J^{1/2} with
 * D0 = (Q/pi) sqrt(2/nu), and J0 = [1.125 D0 t]^{2/3}.
 * For the filled volume D = D0 J with D0 = q0/nu, and J0 = D0 t / 2.
 */

const D0_LAYER = Math.pow(J0_TARGET, 1.5) / (1.125 * T_END);
export const Q_LAYER  = Math.PI * D0_LAYER / Math.sqrt(2 / NU);

/** analytic mean action of the layer at age t. */
const meanLayer  = (t) => meanOverJ0(0.5) * Math.pow(1.125 * D0_LAYER * t, 2 / 3);

/**
 * Equally warm while young, and left alone after that.  The two scales then
 * part company on the growth law alone, t against t^{2/3}, which is a factor
 * of 2.5 in the mean action by 8 Gyr.
 *
 * Anchoring any earlier exaggerates the gap without adding any physics.  The
 * ratio of the two diffusivities is D_volume/D_layer ∝ sqrt(J), so it keeps
 * falling all the way down to the birth action, and matching there hands the
 * volume-filling case a head start that the geometry never asked for.
 */
const T_EARLY_GYR = 0.5;
const T_EARLY = T_EARLY_GYR / T0_GYR;
export const Q0_EQUAL_EARLY = 2 * NU * meanLayer(T_EARLY) / T_EARLY;
