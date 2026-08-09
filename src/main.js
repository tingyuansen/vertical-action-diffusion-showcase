/**
 * main.js — wiring.
 */

import {
  T0_GYR, T_END, T_END_GYR,
  Q_LAYER, Q0_EQUAL_EARLY
} from './physics.js';
import { Panel, N_PHYS } from './panel.js';
import { Scene, rampCSS, J_COLOR_MAX } from './scene.js';
import { DistPlot } from './distplot.js';

const FRAMES_PER_PASS = 2400;      // one pass over 8 Gyr at speed 1
const SPIN_AT_1KPC = 0.028;        // radians per frame at R = 1 kpc
const TAIL_X = 4;                  // the tail statistic is P(J > 4<J>)

const $ = (id) => document.getElementById(id);

/* ─────────────────────────────────────────────── state */

const L = new Panel('layer');
const V = new Panel('volume');
const scene = new Scene($('sky'));

const plotL = new DistPlot($('plotL'), {
  accent: '#ffb060', ownB: 0.5, otherB: 1.0
});
const plotV = new DistPlot($('plotV'), {
  accent: '#a692ff', ownB: 1.0, otherB: 0.5
});

let speed = 1, playing = true;

function rebuild() {
  L.seed(Q_LAYER);
  V.seed(Q0_EQUAL_EARLY);
}

/* ─────────────────────────────────────────────── equations */

function typeset() {
  if (typeof katex === 'undefined') return;
  const put = (id, tex, display) => {
    const el = $(id);
    if (el) katex.render(tex, el, { throwOnError: false, displayMode: !!display });
  };
  put('eqMaster',
    'D(J_z)=\\frac{1}{\\pi}\\int_{-Z}^{\\,Z} q(z)\\,\\sqrt{Z^{2}-z^{2}}\\;dz' +
    '\\qquad\\Longrightarrow\\qquad ' +
    'p(J_z)\\propto e^{-\\left(J_z/J_0\\right)^{2-b}}');
  put('eqLa', 'q(z)=Q\\,\\delta(z)\\;\\Rightarrow\\;D\\propto J_z^{1/2},\\;\\; b=\\tfrac{1}{2}');
  put('eqLb', 'p(J_z)\\propto e^{-\\left(J_z/J_0\\right)^{3/2}}');
  put('eqVa', 'q(z)=q_0\\;\\Rightarrow\\;D\\propto J_z,\\;\\; b=1');
  put('eqVb', 'p(J_z)\\propto e^{-J_z/J_0}');
  put('tailL', `P\\!\\left(J_z>${TAIL_X}\\langle J_z\\rangle\\right)`);
  put('tailV', `P\\!\\left(J_z>${TAIL_X}\\langle J_z\\rangle\\right)`);
  put('meanL', '\\langle J_z\\rangle');
  put('meanV', '\\langle J_z\\rangle');
  put('rmsL', '\\sqrt{\\langle z^{2}\\rangle}');
  put('rmsV', '\\sqrt{\\langle z^{2}\\rangle}');
}

/* ─────────────────────────────────────────────── colour key */

function paintKey() {
  const stops = [];
  for (let i = 0; i <= 12; i++) stops.push(rampCSS(i / 12));
  $('keyBar').style.background = `linear-gradient(90deg, ${stops.join(',')})`;
  $('keyHi').textContent = `${J_COLOR_MAX}+`;
}

/* ─────────────────────────────────────────────── stats */

function tailFraction(p) {
  if (p.mean <= 0) return 0;
  const cut = TAIL_X * p.mean;
  let n = 0;
  for (let i = 0; i < N_PHYS; i++) if (p.J[i] > cut) n++;
  return n / N_PHYS;
}

function refreshReadouts() {
  const tg = Math.max(L.t, V.t) * T0_GYR;
  $('age').textContent = tg.toFixed(2);
  $('clockFill').style.width = (100 * tg / T_END_GYR) + '%';
  $('valMeanL').textContent = L.mean.toFixed(1);
  $('valMeanV').textContent = V.mean.toFixed(1);
  $('valRmsL').textContent = Math.round(L.rms * 1000);
  $('valRmsV').textContent = Math.round(V.rms * 1000);
  $('valTailL').textContent = (100 * tailFraction(L)).toFixed(2) + '%';
  $('valTailV').textContent = (100 * tailFraction(V)).toFixed(2) + '%';
}

/* ─────────────────────────────────────────────── loop */

let last = performance.now(), frame = 0;

function tick(now) {
  requestAnimationFrame(tick);
  const dtReal = Math.min(50, now - last);
  last = now;

  const dphi = SPIN_AT_1KPC * (dtReal / 16.667);
  L.spin(dphi);
  V.spin(dphi);

  if (playing) {
    const goal = Math.min(T_END, L.t + T_END * speed / FRAMES_PER_PASS);
    if (L.t < T_END) L.step(Math.max(1, Math.round((goal - L.t) / L.dt0)));
    if (V.t < T_END) V.step(Math.max(1, Math.round((goal - V.t) / V.dt0)));
  }
  L.measure();
  V.measure();

  scene.draw(L, V);

  if (++frame % 3 === 0) {
    plotL.draw(L);
    plotV.draw(V);
    refreshReadouts();
  }
}

/* ─────────────────────────────────────────────── controls */

const PLAY_D = 'M3.4 2.3 13 8 3.4 13.7z';
const PAUSE_D = 'M4 2.5h3v11H4zM9 2.5h3v11H9z';

$('btnPlay').addEventListener('click', () => {
  playing = !playing;
  $('playIcon').innerHTML = `<path d="${playing ? PAUSE_D : PLAY_D}"/>`;
  $('playLabel').textContent = playing ? 'Pause' : 'Play';
});
$('btnRestart').addEventListener('click', rebuild);
$('speedSeg').addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  speed = +b.dataset.sp;
  [...e.currentTarget.children].forEach((c) => c.classList.toggle('on', c === b));
});

window.addEventListener('keydown', (e) => {
  if (e.key === ' ') { e.preventDefault(); $('btnPlay').click(); }
  if (e.key.toLowerCase() === 'r') rebuild();
  if (e.key.toLowerCase() === 'v') scene.resetView();
});
/* one camera, shared by both panels, so they always show the same viewpoint */
const sky = $('sky');
let dragging = false, lastX = 0, lastY = 0;

sky.addEventListener('pointerdown', (e) => {
  dragging = true;
  lastX = e.clientX;
  lastY = e.clientY;
  sky.setPointerCapture(e.pointerId);
  sky.classList.add('grabbing');
});
sky.addEventListener('pointermove', (e) => {
  if (!dragging) return;
  scene.camAz += (e.clientX - lastX) * 0.005;
  scene.setTilt(scene.tilt + (e.clientY - lastY) * 0.004);
  lastX = e.clientX;
  lastY = e.clientY;
});
const endDrag = () => { dragging = false; sky.classList.remove('grabbing'); };
sky.addEventListener('pointerup', endDrag);
sky.addEventListener('pointercancel', endDrag);
sky.addEventListener('dblclick', () => scene.resetView());
sky.addEventListener('wheel', (e) => {
  e.preventDefault();
  scene.setZoom(scene.zoom * Math.exp(-e.deltaY * 0.0012));
}, { passive: false });
window.addEventListener('resize', () => {
  scene.resize();
  plotL.resize();
  plotV.resize();
});

/* ─────────────────────────────────────────────── go */

if (new URLSearchParams(location.search).has('debug')) window.__app = { L, V, scene, plotL, plotV };

typeset();
paintKey();
rebuild();
requestAnimationFrame(tick);
