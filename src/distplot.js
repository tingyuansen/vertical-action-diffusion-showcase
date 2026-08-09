/**
 * distplot.js — the action distribution, in units of the mean action.
 *
 * Scaling by the mean removes the amplitude, so what is left on the axis is
 * shape alone.  Both analytic curves are drawn in both panels, with the gap
 * between them shaded, because the whole measurement lives in that gap.
 */

import { pdfScaled } from './physics.js';

/* The plot starts at 1.5 mean actions.  Below that the two shapes lie almost
   on top of each other, and the whole distinction is in what follows. */
const X_MIN = 1.5;
const X_MAX = 6.0;
const Y_LO = Math.log10(1.4e-4);
const Y_HI = Math.log10(0.62);
const SUP = ['', '⁻¹', '⁻²', '⁻³'];

export class DistPlot {
  constructor(canvas, { accent, ownB, otherB, ownLabel, otherLabel }) {
    this.cv = canvas;
    this.ctx = canvas.getContext('2d');
    this.accent = accent;
    this.ownB = ownB;
    this.otherB = otherB;
    this.ownLabel = ownLabel;
    this.otherLabel = otherLabel;
    this.resize();
  }

  resize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const r = this.cv.getBoundingClientRect();
    this.w = r.width || 320;
    this.h = r.height || 200;
    this.cv.width = Math.round(this.w * dpr);
    this.cv.height = Math.round(this.h * dpr);
    this.dpr = dpr;
  }

  draw(panel) {
    const c = this.ctx;
    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    c.clearRect(0, 0, this.w, this.h);

    const PL = 50, PR = 14, PT = 12, PB = 44;
    const x0 = PL, x1 = this.w - PR, y0 = PT, y1 = this.h - PB;
    const X = (x) => x0 + ((x - X_MIN) / (X_MAX - X_MIN)) * (x1 - x0);
    const Y = (v) => y1 - (Math.log10(Math.max(v, 1e-12)) - Y_LO) / (Y_HI - Y_LO) * (y1 - y0);

    /* ── grid and ticks ─────────────────────────────────────── */
    c.lineWidth = 1;
    c.font = '500 13px "Inter var", Inter, system-ui, sans-serif';
    c.textAlign = 'right';
    c.textBaseline = 'middle';
    for (let e = 0; e >= -3; e--) {
      const yy = Y(Math.pow(10, e));
      if (yy < y0 - 1 || yy > y1 + 1) continue;
      c.strokeStyle = 'rgba(255,255,255,.075)';
      c.beginPath(); c.moveTo(x0, yy); c.lineTo(x1, yy); c.stroke();
      c.fillStyle = 'rgba(238,241,248,.82)';
      c.fillText(e === 0 ? '1' : '10' + SUP[-e], x0 - 8, yy);
    }
    c.textAlign = 'center';
    c.textBaseline = 'top';
    for (let xv = 2; xv <= X_MAX; xv++) {
      const xx = X(xv);
      c.strokeStyle = 'rgba(255,255,255,.055)';
      c.beginPath(); c.moveTo(xx, y0); c.lineTo(xx, y1); c.stroke();
      c.fillStyle = 'rgba(238,241,248,.82)';
      c.fillText(String(xv), xx, y1 + 7);
    }

    /* ── shade the gap between the two shapes ───────────────── */
    const NC = 200;
    const xAt = (i) => X_MIN + (i / NC) * (X_MAX - X_MIN);
    c.beginPath();
    for (let i = 0; i <= NC; i++) {
      const yy = Math.min(Math.max(Y(pdfScaled(xAt(i), this.ownB)), y0), y1);
      i ? c.lineTo(X(xAt(i)), yy) : c.moveTo(X(xAt(i)), yy);
    }
    for (let i = NC; i >= 0; i--) {
      c.lineTo(X(xAt(i)), Math.min(Math.max(Y(pdfScaled(xAt(i), this.otherB)), y0), y1));
    }
    c.closePath();
    c.fillStyle = 'rgba(255,255,255,.07)';
    c.fill();

    /* ── the live histogram ─────────────────────────────────── */
    const tot = panel.hstack * panel.J.length;
    const bw = panel.histMax / panel.bins;
    if (tot > 0) {
      c.fillStyle = this.accent + '30';
      c.strokeStyle = this.accent;
      c.lineWidth = 2;
      c.beginPath();
      let started = false;
      for (let k = 0; k < panel.bins; k++) {
        if ((k + 1) * bw <= X_MIN) continue;
        const dens = panel.hist[k] / (tot * bw);
        if (dens <= 0) continue;
        const xa = X(Math.max(k * bw, X_MIN)), xb = X((k + 1) * bw);
        const yy = Math.min(Y(dens), y1);
        if (!started) { c.moveTo(xa, y1); c.lineTo(xa, yy); started = true; }
        else c.lineTo(xa, yy);
        c.lineTo(xb, yy);
      }
      if (started) {
        c.lineTo(X(X_MAX), y1);
        c.closePath();
        c.fill();
        c.stroke();
      }
    }

    /* ── the two analytic shapes ────────────────────────────── */
    const curve = (b, stroke, dash, width) => {
      c.strokeStyle = stroke;
      c.lineWidth = width;
      c.setLineDash(dash);
      c.beginPath();
      let pen = false;
      for (let i = 0; i <= 260; i++) {
        const xv = X_MIN + (i / 260) * (X_MAX - X_MIN);
        const yy = Y(pdfScaled(xv, b));
        if (yy > y1) { if (pen) { c.stroke(); c.beginPath(); pen = false; } continue; }
        const xx = X(xv);
        pen ? c.lineTo(xx, yy) : (c.moveTo(xx, yy), pen = true);
      }
      c.stroke();
      c.setLineDash([]);
    };
    curve(this.otherB, 'rgba(233,237,246,.55)', [5, 4], 1.6);
    curve(this.ownB, '#ffffff', [], 2);

    /* ── frame and labels ───────────────────────────────────── */
    c.strokeStyle = 'rgba(255,255,255,.24)';
    c.lineWidth = 1.2;
    c.beginPath();
    c.moveTo(x0, y0); c.lineTo(x0, y1); c.lineTo(x1, y1);
    c.stroke();

    c.fillStyle = 'rgba(238,241,248,.96)';
    c.font = '600 14.5px "Inter var", Inter, system-ui, sans-serif';
    c.textAlign = 'center';
    c.textBaseline = 'top';
    c.fillText('Jᴢ / ⟨Jᴢ⟩', (x0 + x1) / 2, y1 + 24);

    c.save();
    c.translate(14, (y0 + y1) / 2);
    c.rotate(-Math.PI / 2);
    c.textBaseline = 'middle';
    c.fillText('p(Jᴢ)', 0, 0);
    c.restore();
  }
}
