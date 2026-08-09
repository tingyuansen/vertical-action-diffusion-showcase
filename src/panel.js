/**
 * panel.js — one disc of stars, integrated exactly.
 *
 * Each star carries a height z and a vertical velocity v.  Between kicks the
 * pair rotates rigidly at nu, which is the exact harmonic solution.  A kick
 * adds a Gaussian increment to the velocity alone, with variance q(z) dt at
 * the height the star currently occupies.  The action is read off afterwards,
 *
 *     J = ( v^2 + nu^2 z^2 ) / (2 nu)
 *
 * so nothing about the diffusion coefficient or the action distribution is
 * imposed.  Both fall out.
 *
 * The layer is thin, so a uniform timestep fine enough to resolve a plane
 * crossing would be wasteful everywhere else.  Steps are therefore split only
 * when a star is close enough to the plane to reach it during the step.
 */

import { NU, PERIOD, H_LAYER, SIG_BIRTH, randn, qLayer } from './physics.js';

export const N_PHYS = 8000;      // integrated
export const N_DRAW = 2400;      // rendered
export const N_ORBIT = 22;       // stars whose orbit is drawn out in full
export const VC = 240.0;         // km/s, flat rotation curve

export const R_IN = 3.0, R_OUT = 12.0, R_SCALE = 4.0;
export const N_SCAT = 620;       // scatterers rendered
export const SCAT_HALF_THICK = 2.6;  // kpc, how far the volume-filling ones reach
export const LAYER_SHOW = 2 * H_LAYER;  // the slab drawn for the gas layer

const HIST_BINS = 24, HIST_MAX = 6.0;
const GUARD = 5 * H_LAYER;       // start subdividing this close to the plane
const RES = 0.32 * H_LAYER;      // target step in z while inside the layer

export class Panel {
  constructor(kind) {
    this.kind = kind;                       // 'layer' | 'volume'
    this.z = new Float64Array(N_PHYS);
    this.v = new Float64Array(N_PHYS);
    this.R = new Float64Array(N_PHYS);
    this.a = new Float64Array(N_PHYS);
    this.J = new Float64Array(N_PHYS);
    this.jPrev = new Float64Array(N_DRAW);
    this.flash = new Float32Array(N_DRAW);
    this.scR = new Float64Array(N_SCAT);
    this.scA = new Float64Array(N_SCAT);
    this.scZ = new Float64Array(N_SCAT);
    this.scS = new Float32Array(N_SCAT);
    this.hist = new Float64Array(HIST_BINS);
    this.orbIdx = new Int32Array(N_ORBIT);
    this.orbPhase = new Float64Array(N_ORBIT);
    this.mean = 0; this.rms = 0; this.hstack = 0; this.t = 0;
    this.spp = 96;
  }

  get bins() { return HIST_BINS; }
  get histMax() { return HIST_MAX; }

  seed(amp) {
    this.amp = amp;                       // Q for the layer, q0 for the volume
    this.dt0 = PERIOD / this.spp;
    this.t = 0;
    this.hist.fill(0);
    this.hstack = 0;

    for (let i = 0; i < N_PHYS; i++) {
      let R;
      do { R = -R_SCALE * Math.log(1 - Math.random()); } while (R < R_IN || R > R_OUT);
      this.R[i] = R;
      this.a[i] = Math.random() * 2 * Math.PI;
      this.v[i] = randn() * SIG_BIRTH;
      this.z[i] = randn() * SIG_BIRTH / NU;
      this.J[i] = (this.v[i] * this.v[i] + NU * NU * this.z[i] * this.z[i]) / (2 * NU);
    }
    for (let i = 0; i < N_DRAW; i++) { this.jPrev[i] = 0; this.flash[i] = 0; }

    for (let i = 0; i < N_SCAT; i++) {
      let R;
      do { R = -4.4 * Math.log(1 - Math.random()); } while (R < R_IN + 0.4 || R > R_OUT - 0.3);
      this.scR[i] = R;
      this.scA[i] = Math.random() * 2 * Math.PI;
      this.scZ[i] = this.kind === 'layer'
        ? randn() * H_LAYER
        : (Math.random() * 2 - 1) * SCAT_HALF_THICK;
      this.scS[i] = 0.35 + Math.random() * Math.random() * 2.8;
    }

    // a spread of radii, so the drawn orbits sample the whole disc
    for (let k = 0; k < N_ORBIT; k++) {
      const want = R_IN + 0.8 + (k / (N_ORBIT - 1)) * (R_OUT - R_IN - 1.9);
      let best = 0, bd = 1e9;
      for (let i = k; i < N_DRAW; i += 5) {
        const d = Math.abs(this.R[i] - want);
        if (d < bd) { bd = d; best = i; }
      }
      this.orbIdx[k] = best;
      this.orbPhase[k] = Math.random() * 2 * Math.PI;
    }
  }

  /** advance by nsub base steps of dt0, with jitter. */
  step(nsub) {
    const z = this.z, v = this.v, amp = this.amp;
    const layer = this.kind === 'layer';
    for (let s = 0; s < nsub; s++) {
      const dt = this.dt0 * (0.9 + 0.2 * Math.random());
      const halfAng = 0.5 * NU * dt;
      const CH = Math.cos(halfAng), SH = Math.sin(halfAng);
      const sd = Math.sqrt(dt) / NU;

      for (let i = 0; i < N_PHYS; i++) {
        let zz = z[i], vv = v[i];

        if (!layer) {
          const u = vv / NU;
          const z1 = zz * CH + u * SH;
          let u1 = -zz * SH + u * CH;
          u1 += randn() * Math.sqrt(amp) * sd;
          z[i] = z1 * CH + u1 * SH;
          v[i] = (-z1 * SH + u1 * CH) * NU;
          continue;
        }

        // how many substeps does this star need?
        let k = 1;
        if (Math.abs(zz) < GUARD + Math.abs(vv) * dt * 1.15) {
          k = Math.ceil(Math.abs(vv) * dt / RES);
          if (k < 1) k = 1; else if (k > 32) k = 32;
        }
        if (k === 1) {
          const u = vv / NU;
          const z1 = zz * CH + u * SH;
          let u1 = -zz * SH + u * CH;
          u1 += randn() * Math.sqrt(qLayer(z1, amp)) * sd;
          z[i] = z1 * CH + u1 * SH;
          v[i] = (-z1 * SH + u1 * CH) * NU;
        } else {
          const d = dt / k;
          const ch = Math.cos(0.5 * NU * d), sh = Math.sin(0.5 * NU * d);
          const sdk = Math.sqrt(d) / NU;
          for (let j = 0; j < k; j++) {
            const u = vv / NU;
            const z1 = zz * ch + u * sh;
            let u1 = -zz * sh + u * ch;
            u1 += randn() * Math.sqrt(qLayer(z1, amp)) * sdk;
            zz = z1 * ch + u1 * sh;
            vv = (-z1 * sh + u1 * ch) * NU;
          }
          z[i] = zz; v[i] = vv;
        }
      }
      this.t += dt;
    }
  }

  /** flat rotation curve, shown slowed.  dphi is the shift at 1 kpc. */
  spin(dphi) {
    const R = this.R, a = this.a;
    for (let i = 0; i < N_PHYS; i++) a[i] += dphi / R[i];
  }

  measure() {
    const z = this.z, v = this.v, J = this.J;
    let sJ = 0, sz = 0;
    for (let i = 0; i < N_PHYS; i++) {
      const j = (v[i] * v[i] + NU * NU * z[i] * z[i]) / (2 * NU);
      J[i] = j; sJ += j; sz += z[i] * z[i];
    }
    this.mean = sJ / N_PHYS;
    this.rms = Math.sqrt(sz / N_PHYS);

    // the distribution of J/<J> is frozen in time, so stacking frames buys
    // statistics in the tail without smearing anything.  the gate keeps the
    // birth transient out, since the scaled shape only settles once the disc
    // has forgotten how cold it started
    if (this.mean > 2.5) {
      const inv = HIST_BINS / (HIST_MAX * this.mean), decay = 0.994;
      for (let k = 0; k < HIST_BINS; k++) this.hist[k] *= decay;
      this.hstack = this.hstack * decay + 1;
      for (let i = 0; i < N_PHYS; i++) {
        const k = (J[i] * inv) | 0;
        if (k < HIST_BINS) this.hist[k] += 1;
      }
    }

    // flag the stars whose action moved hardest since the last frame
    let acc = 0;
    for (let i = 0; i < N_DRAW; i++) acc += Math.abs(J[i] - this.jPrev[i]);
    const thr = 4.5 * acc / N_DRAW + 1e-9;
    for (let i = 0; i < N_DRAW; i++) {
      const d = Math.abs(J[i] - this.jPrev[i]);
      this.flash[i] = Math.max(this.flash[i] * 0.82, d > thr ? Math.min(1, d / (2 * thr)) : 0);
      this.jPrev[i] = J[i];
    }
  }
}
