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
export const J_BIRTH = SIG_BIRTH * SIG_BIRTH / NU;

/* the Part I scale at 8 Gyr, J0 = 26.2 kpc km/s with b = 1/2 */
export const J0_TARGET = 26.21;

/* ───────────────────────────────────────────────── special functions */

export function gammaFn(x) {
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
export const meanOverJ0 = (b) => gammaFn(2 / (2 - b)) / gammaFn(1 / (2 - b));

/** pdf of x = J / <J>, so the amplitude divides out and only shape is left. */
export function pdfScaled(x, b) {
  const a = 2 - b, c = meanOverJ0(b);
  return a * c / gammaFn(1 / a) * Math.exp(-Math.pow(c * x, a));
}

export const JMEAN_TARGET = meanOverJ0(0.5) * J0_TARGET;   // 17.28 kpc km/s

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

/**
 * D(J) for the layer, by quadrature with z = Z sin(theta) so the square-root
 * singularity at the turning points is removed analytically.
 */
export function dLayer(J, Q) {
  const Z = Math.sqrt(2 * J / NU);
  const n = Math.max(240, Math.ceil(28 * Z / H_LAYER));
  const w = Math.PI / n;
  let s = 0;
  for (let i = 0; i < n; i++) {
    const th = (i + 0.5) / n * Math.PI - Math.PI / 2;
    const c = Math.cos(th);
    s += qLayer(Z * Math.sin(th), Q) * Z * Z * c * c * w;
  }
  return s / Math.PI;
}

export const dVolume = (J, q0) => q0 * J / NU;

/** local logarithmic slope of D, which is what b means. */
export function bEffLayer(J, Q) {
  return Math.log(dLayer(J * 1.04, Q) / dLayer(J * 0.96, Q)) / Math.log(1.04 / 0.96);
}

/* ───────────────────────────────────────────────── amplitudes
 *
 * Both are analytic.  For the thin sheet D = D0 J^{1/2} with
 * D0 = (Q/pi) sqrt(2/nu), and J0 = [1.125 D0 t]^{2/3}.
 * For the filled volume D = D0 J with D0 = q0/nu, and J0 = D0 t / 2.
 */

export const D0_LAYER = Math.pow(J0_TARGET, 1.5) / (1.125 * T_END);
export const Q_LAYER  = Math.PI * D0_LAYER / Math.sqrt(2 / NU);

/** analytic mean action at age t, useful for labelling and for sanity checks. */
export const meanLayer  = (t) => meanOverJ0(0.5) * Math.pow(1.125 * D0_LAYER * t, 2 / 3);
export const meanVolume = (t, q0) => q0 / NU * t / 2;

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
export const T_EARLY_GYR = 0.5;
export const T_EARLY = T_EARLY_GYR / T0_GYR;
export const Q0_EQUAL_EARLY = 2 * NU * meanLayer(T_EARLY) / T_EARLY;
