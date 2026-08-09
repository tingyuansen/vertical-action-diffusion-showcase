/**
 * scene.js — the two discs, drawn.
 *
 * Stars and their orbits are coloured by vertical action, so the
 * amount of hot material in the tail is visible without reading a plot.
 * Heights are exaggerated by Z_EX against a disc twenty kiloparsecs across.
 */

import { NU } from './physics.js';
import { N_DRAW, N_ORBIT, N_SCAT, R_OUT, VC, SCAT_HALF_THICK, LAYER_SHOW } from './panel.js';

export const Z_EX = 2.1;          // vertical exaggeration
export const J_COLOR_MAX = 90.0;  // kpc km/s at the top of the ramp

/* deep blue for cold orbits through to red for the hottest */
const STOPS = [
  [0.00, 34, 72, 170], [0.14, 58, 130, 222], [0.30, 110, 186, 240],
  [0.46, 190, 222, 245], [0.58, 242, 238, 224], [0.72, 250, 204, 118],
  [0.86, 244, 138, 58], [1.00, 222, 52, 40]
];
const NBIN = 28;

function rampRGB(t) {
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  for (let i = 1; i < STOPS.length; i++) {
    if (t <= STOPS[i][0]) {
      const a = STOPS[i - 1], b = STOPS[i];
      const f = (t - a[0]) / (b[0] - a[0]);
      return [Math.round(a[1] + f * (b[1] - a[1])),
              Math.round(a[2] + f * (b[2] - a[2])),
              Math.round(a[3] + f * (b[3] - a[3]))];
    }
  }
  const l = STOPS[STOPS.length - 1];
  return [l[1], l[2], l[3]];
}

export function rampCSS(t) {
  const c = rampRGB(t);
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}

/** action to ramp position.  compressed so the cold end still spreads out. */
export const jToRamp = (J) => Math.pow(Math.min(1, J / J_COLOR_MAX), 0.6);

/* ───────────────────────────────────────────── sprites */

function starSprite(rgb, R) {
  const cv = document.createElement('canvas');
  cv.width = cv.height = R * 2;
  const g = cv.getContext('2d');
  const rad = g.createRadialGradient(R, R, 0, R, R, R);
  const c = `${rgb[0]},${rgb[1]},${rgb[2]}`;
  rad.addColorStop(0, `rgba(${c},1)`);
  rad.addColorStop(0.15, `rgba(${c},.78)`);
  rad.addColorStop(0.40, `rgba(${c},.17)`);
  rad.addColorStop(1, `rgba(${c},0)`);
  g.fillStyle = rad;
  g.fillRect(0, 0, R * 2, R * 2);
  return cv;
}

function blob(r, g_, b, core, R = 32) {
  const cv = document.createElement('canvas');
  cv.width = cv.height = R;
  const c = cv.getContext('2d');
  const rad = c.createRadialGradient(R / 2, R / 2, 0, R / 2, R / 2, R / 2);
  rad.addColorStop(0, `rgba(${r},${g_},${b},${core})`);
  rad.addColorStop(0.3, `rgba(${r},${g_},${b},${core * 0.35})`);
  rad.addColorStop(1, `rgba(${r},${g_},${b},0)`);
  c.fillStyle = rad;
  c.fillRect(0, 0, R, R);
  return cv;
}

export class Scene {
  constructor(canvas) {
    this.cv = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.sprites = [];
    this.rgba = [];
    for (let i = 0; i < NBIN; i++) {
      const rgb = rampRGB(i / (NBIN - 1));
      this.sprites.push(starSprite(rgb, 10));
      this.rgba.push(`rgba(${rgb[0]},${rgb[1]},${rgb[2]},`);
    }
    // the perturbers.  drawn soft and large so they never read as stars, and
    // in colours the action ramp does not use
    this.cloud = blob(255, 148, 82, 0.95, 40);     // molecular clouds
    this.haze = blob(146, 124, 250, 0.85, 40);     // dark substructure
    this.flash = blob(255, 250, 232, 1.0);
    this.tilt = 0.19;
    this.se = Math.sin(this.tilt);
    this.ce = Math.cos(this.tilt);
    this.camAz = 0;                 // shared by both panels, so they stay in step
    this.zoom = 1;
    this.p = [0, 0, 0];
    this.resize();
  }

  setTilt(t) {
    this.tilt = Math.max(0.03, Math.min(1.25, t));
    this.se = Math.sin(this.tilt);
    this.ce = Math.cos(this.tilt);
  }

  setZoom(z) {
    this.zoom = Math.max(0.5, Math.min(2.0, z));
    this.vL.s = this.baseS * this.zoom;
    this.vV.s = this.baseS * this.zoom;
  }

  resetView() { this.setTilt(0.19); this.camAz = 0; this.setZoom(1); }

  resize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    this.W = window.innerWidth;
    this.H = window.innerHeight;
    this.cv.width = Math.round(this.W * dpr);
    this.cv.height = Math.round(this.H * dpr);
    this.cv.style.width = this.W + 'px';
    this.cv.style.height = this.H + 'px';
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.stacked = this.W < 1020;
    if (this.stacked) {
      this.baseS = Math.min(this.W / 28, this.H * 0.155 / 6.5);
      this.vL = { cx: this.W * 0.5, cy: this.H * 0.375, s: 0 };
      this.vV = { cx: this.W * 0.5, cy: this.H * 0.70, s: 0 };
    } else {
      this.baseS = Math.min(this.W * 0.5 / 26.5, this.H / 15.5);
      this.vL = { cx: this.W * 0.263, cy: this.H * 0.505, s: 0 };
      this.vV = { cx: this.W * 0.737, cy: this.H * 0.505, s: 0 };
    }
    this.setZoom(this.zoom);
  }

  project(vw, R, a, z, out) {
    const t = a + this.camAz;
    const x = R * Math.cos(t), d = R * Math.sin(t);
    out[0] = vw.cx + x * vw.s;
    out[1] = vw.cy - (d * this.se + z * Z_EX * this.ce) * vw.s;
    out[2] = d;
    return out;
  }

  clear() {
    const c = this.ctx;
    c.globalCompositeOperation = 'source-over';
    c.globalAlpha = 1;
    c.fillStyle = '#04060b';
    c.fillRect(0, 0, this.W, this.H);
  }

  discGlow(p, vw) {
    const c = this.ctx;
    const rx = R_OUT * vw.s * 1.02;
    const ry = (R_OUT * this.se + Math.max(0.4, p.rms * 2.4) * Z_EX * this.ce) * vw.s;
    c.save();
    c.globalCompositeOperation = 'lighter';
    c.translate(vw.cx, vw.cy);
    c.scale(1, ry / rx);
    const g = c.createRadialGradient(0, 0, 0, 0, 0, rx);
    const tint = '150,166,204';
    g.addColorStop(0, `rgba(${tint},.13)`);
    g.addColorStop(0.32, `rgba(${tint},.06)`);
    g.addColorStop(0.72, `rgba(${tint},.018)`);
    g.addColorStop(1, `rgba(${tint},0)`);
    c.fillStyle = g;
    c.beginPath();
    c.arc(0, 0, rx, 0, 6.2832);
    c.fill();
    c.restore();
  }

  scatterers(p, vw) {
    const c = this.ctx, P = this.p;
    const layer = p.kind === 'layer';
    const img = layer ? this.cloud : this.haze;
    // clouds are small and crisp so the lane stays thin.  substructure is
    // large and soft so it reads as something filling the box
    const base = layer ? 0.54 : 0.25;
    const seed = layer ? 0.7 : 1.6;
    const grow = layer ? 1.3 : 3.6;
    const puff = layer ? 2.9 : 4.8;
    c.globalCompositeOperation = 'lighter';
    for (let i = 0; i < N_SCAT; i++) {
      this.project(vw, p.scR[i], p.scA[i], p.scZ[i], P);
      const near = 0.45 + 0.55 * (P[2] / R_OUT * 0.5 + 0.5);
      const r = (seed + p.scS[i] * grow) * near * (vw.s / 30);
      c.globalAlpha = base * near;
      c.drawImage(img, P[0] - r * puff * 0.5, P[1] - r * puff * 0.5, r * puff, r * puff);
    }
  }

  /**
   * The region the scatterers occupy, drawn as the silhouette of a cylinder.
   * A vertical sweep of an inclined circle projects to the ellipse offset up
   * and down by the sweep, so the outline is the top arc raised, the bottom
   * arc lowered, and two straight sides at the extreme radii.
   */
  slab(p, vw) {
    const c = this.ctx;
    const layer = p.kind === 'layer';
    const half = layer ? LAYER_SHOW : SCAT_HALF_THICK;
    const R = R_OUT * 0.97;
    const rx = R * vw.s;
    const ry = R * this.se * vw.s;
    const dz = half * Z_EX * this.ce * vw.s;
    const N = 96;

    c.save();
    c.globalCompositeOperation = 'source-over';
    c.beginPath();
    for (let i = 0; i <= N / 2; i++) {                  // top arc, raised
      const a = (i / (N / 2)) * Math.PI;
      const x = vw.cx + rx * Math.cos(a);
      const y = vw.cy - ry * Math.sin(a) - dz;
      i ? c.lineTo(x, y) : c.moveTo(x, y);
    }
    c.lineTo(vw.cx - rx, vw.cy + dz);
    for (let i = 0; i <= N / 2; i++) {                  // bottom arc, lowered
      const a = Math.PI + (i / (N / 2)) * Math.PI;
      c.lineTo(vw.cx + rx * Math.cos(a), vw.cy - ry * Math.sin(a) + dz);
    }
    c.closePath();
    c.fillStyle = layer ? 'rgba(255,148,82,.038)' : 'rgba(146,124,250,.02)';
    c.fill();
    c.strokeStyle = layer ? 'rgba(255,172,110,.6)' : 'rgba(163,146,255,.38)';
    c.lineWidth = layer ? 1.2 : 1.3;
    c.stroke();

    if (!layer) {                                        // mark the midplane
      c.beginPath();
      for (let i = 0; i <= N; i++) {
        const a = (i / N) * 2 * Math.PI;
        const x = vw.cx + rx * Math.cos(a);
        const y = vw.cy - ry * Math.sin(a);
        i ? c.lineTo(x, y) : c.moveTo(x, y);
      }
      c.setLineDash([4, 7]);
      c.strokeStyle = 'rgba(163,146,255,.3)';
      c.lineWidth = 1;
      c.stroke();
    }
    c.restore();
  }

  /**
   * The orbit of a star is a helix wrapped on a cylinder of radius R.  Moving
   * an angle dphi around the disc takes a time R dphi / Vc, during which the
   * vertical phase advances by nu R dphi / Vc, so the helix closes nu R / Vc
   * times per revolution.  That is 2.5 at the Sun's radius.
   *
   * The amplitude is Z = sqrt(2 J / nu), which is what heating grows, so a
   * hot orbit is drawn tall and red and a cold one flat and blue.
   */
  orbits(p, vw) {
    const c = this.ctx, P = this.p;
    const NSEG = 104, ARC = 2.15;
    c.globalCompositeOperation = 'lighter';
    c.lineJoin = 'round';
    c.lineCap = 'round';
    for (let k = 0; k < N_ORBIT; k++) {
      const i = p.orbIdx[k];
      const R = p.R[i], a0 = p.a[i], J = p.J[i];
      const Z = Math.sqrt(2 * Math.max(J, 0) / NU);
      const wind = NU * R / VC;
      const bin = Math.min(NBIN - 1, (jToRamp(J) * (NBIN - 1) + 0.5) | 0);
      const css = this.rgba[bin];
      // three nested passes fake a taper towards the ends of the arc
      for (const [span, alpha, width] of [[1.0, 0.09, 1.0], [0.62, 0.16, 1.1], [0.28, 0.28, 1.35]]) {
        c.strokeStyle = css + alpha + ')';
        c.lineWidth = width;
        c.beginPath();
        const n = Math.max(12, Math.round(NSEG * span));
        for (let j = 0; j <= n; j++) {
          const f = (j / n - 0.5) * 2 * ARC * span;
          const z = Z * Math.sin(p.orbPhase[k] + wind * f);
          this.project(vw, R, a0 + f, z, P);
          j ? c.lineTo(P[0], P[1]) : c.moveTo(P[0], P[1]);
        }
        c.stroke();
      }
    }
  }

  stars(p, vw) {
    const c = this.ctx, P = this.p;
    const W = this.W, H = this.H;
    const sc = vw.s / 30;
    c.globalCompositeOperation = 'lighter';
    for (let i = 0; i < N_DRAW; i++) {
      this.project(vw, p.R[i], p.a[i], p.z[i], P);
      if (P[0] < -30 || P[0] > W + 30 || P[1] < -30 || P[1] > H + 30) continue;
      const t = jToRamp(p.J[i]);
      const bin = Math.min(NBIN - 1, (t * (NBIN - 1) + 0.5) | 0);
      const near = 0.5 + 0.5 * (P[2] / R_OUT * 0.5 + 0.5);
      const r = (1.55 + 1.6 * t) * near * sc;
      c.globalAlpha = (0.58 + 0.34 * t) * near;
      c.drawImage(this.sprites[bin], P[0] - r * 2.5, P[1] - r * 2.5, r * 5.0, r * 5.0);
      const f = p.flash[i];
      if (f > 0.12) {
        c.globalAlpha = f * 0.30;
        const fr = r * 4.4;
        c.drawImage(this.flash, P[0] - fr, P[1] - fr, fr * 2, fr * 2);
      }
    }
    c.globalCompositeOperation = 'source-over';
    c.globalAlpha = 1;
  }

  drawPanel(p, vw) {
    this.discGlow(p, vw);
    this.slab(p, vw);
    this.scatterers(p, vw);
    this.orbits(p, vw);
    this.stars(p, vw);
  }

  draw(L, V) {
    this.clear();
    this.drawPanel(L, this.vL);
    this.drawPanel(V, this.vV);
    if (!this.stacked) {
      const c = this.ctx;
      c.strokeStyle = 'rgba(255,255,255,.06)';
      c.lineWidth = 1;
      c.beginPath();
      c.moveTo(this.W / 2, this.H * 0.17);
      c.lineTo(this.W / 2, this.H * 0.87);
      c.stroke();
    }
  }
}
