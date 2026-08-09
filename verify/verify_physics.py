#!/usr/bin/env python3
"""Independent check of the physics the page runs in the browser.

This is a NumPy transcription of `src/physics.js` and `src/panel.js`, written
against the same constants and the same integration scheme.  It prints the
table in the README.  Nothing here is imported by the page.

Three things are checked.

1.  The diffusion coefficient.  D(J) is the scattering profile smeared with a
    semicircular window, and it must tend to the closed forms in the two
    limits, D proportional to sqrt(J) for a thin sheet and to J for a filled
    volume.

2.  The integrator.  Steps are split only near the plane, so the result has to
    be independent of how coarse the base step is and of how finely the
    crossing is resolved.

3.  The distribution.  The particles are never told what shape to take, so the
    tail fractions are a prediction they either meet or miss.

Run with:  python3 verify/verify_physics.py
"""

import numpy as np
from scipy.special import gamma, gammaincc

# ── constants, mirroring src/physics.js ──────────────────────────────────────
NU = 75.0                       # km/s/kpc
T0_GYR = 0.977792               # Gyr per T0
PERIOD = 2 * np.pi / NU         # vertical period, T0
T_END_GYR = 8.0
T_END = T_END_GYR / T0_GYR
H_LAYER = 0.050                 # kpc
SIG_BIRTH = 6.0                 # km/s
J0_TARGET = 26.21               # kpc km/s, the Part I scale at 8 Gyr

# ── constants, mirroring src/panel.js ────────────────────────────────────────
SPP = 96                        # base steps per vertical period
GUARD = 5 * H_LAYER             # start subdividing this close to the plane
RES = 0.32 * H_LAYER            # target step in z while inside the layer

mean_over_J0 = lambda b: gamma(2 / (2 - b)) / gamma(1 / (2 - b))

D0_LAYER = J0_TARGET ** 1.5 / (1.125 * T_END)
Q_LAYER = np.pi * D0_LAYER / np.sqrt(2 / NU)
mean_layer = lambda t: mean_over_J0(0.5) * (1.125 * D0_LAYER * t) ** (2 / 3)

T_EARLY = 0.5 / T0_GYR
Q0_EQUAL_EARLY = 2 * NU * mean_layer(T_EARLY) / T_EARLY


def q_layer(z, Q=Q_LAYER):
    return Q / (np.sqrt(2 * np.pi) * H_LAYER) * np.exp(-0.5 * (z / H_LAYER) ** 2)


def d_layer(J, Q=Q_LAYER):
    """(1/pi) int q(z) sqrt(Z^2 - z^2) dz, with z = Z sin(theta)."""
    Z = np.sqrt(2 * J / NU)
    n = max(400, int(40 * Z / H_LAYER))
    th = (np.arange(n) + 0.5) / n * np.pi - np.pi / 2
    w = np.pi / n
    return (q_layer(Z * np.sin(th), Q) * (Z * np.cos(th)) ** 2 * w).sum() / np.pi


def b_eff(J, Q=Q_LAYER):
    return np.log(d_layer(J * 1.04, Q) / d_layer(J * 0.96, Q)) / np.log(1.04 / 0.96)


def run(kind, nstar, spp=SPP, res=RES, tmax=T_END, seed=0):
    """The integrator of src/panel.js, transcribed.

    Between kicks the pair (z, v) rotates rigidly at nu, which is exact.  A
    kick adds a Gaussian increment to the velocity alone.  Steps are split
    only for stars close enough to the plane to reach it during the step.
    """
    rng = np.random.default_rng(seed)
    dt0 = PERIOD / spp
    nstep = int(tmax / dt0)
    z = rng.standard_normal(nstar) * SIG_BIRTH / NU
    v = rng.standard_normal(nstar) * SIG_BIRTH

    def half_step(zz, vv, d, q_of_z):
        ch, sh = np.cos(0.5 * NU * d), np.sin(0.5 * NU * d)
        u = vv / NU
        z1 = zz * ch + u * sh
        u1 = -zz * sh + u * ch
        u1 = u1 + rng.standard_normal(z1.size) * np.sqrt(q_of_z(z1) * d) / NU
        return z1 * ch + u1 * sh, (-z1 * sh + u1 * ch) * NU

    for _ in range(nstep):
        dt = dt0 * (0.9 + 0.2 * rng.random())
        if kind == "volume":
            z, v = half_step(z, v, dt, lambda zz: Q0_EQUAL_EARLY)
            continue
        near = np.abs(z) < GUARD + np.abs(v) * dt * 1.15
        far = ~near
        if far.any():
            z[far], v[far] = half_step(z[far], v[far], dt, q_layer)
        if near.any():
            k = int(np.clip(np.ceil(np.abs(v[near]).max() * dt / res), 1, 32))
            zz, vv = z[near].copy(), v[near].copy()
            for _s in range(k):
                zz, vv = half_step(zz, vv, dt / k, q_layer)
            z[near], v[near] = zz, vv

    return (v ** 2 + (NU * z) ** 2) / (2 * NU)


def survival(b, x):
    a, c = 2 - b, mean_over_J0(b)
    return gammaincc(1 / a, (c * x) ** a)


def main():
    print("1.  the diffusion coefficient")
    print(f"    thin sheet, h = {H_LAYER*1000:.0f} pc")
    for J in (5.0, 17.0, 30.0):
        print(f"      b at J = {J:5.1f} kpc km/s   {b_eff(J):.4f}"
              f"        (closed form 0.5)")
    print("    filled volume                          1.0000"
          "        (closed form 1.0, exactly)")
    num, ana = d_layer(20.0, Q=1.0), np.sqrt(2 * 20.0 / NU) / np.pi
    print(f"    D(20) with Q = 1, quadrature {num:.6f} against {ana:.6f}\n")

    print("2.  the integrator, mean action at 8 Gyr")
    for spp, res in ((48, RES), (96, RES), (96, 0.2 * H_LAYER), (192, RES)):
        J = run("layer", 20000, spp=spp, res=res, seed=1)
        print(f"      steps/period {spp:4d}   resolution {res/H_LAYER:.2f} h"
              f"   <J> = {J.mean():7.3f}")
    print(f"      target from the closed form            "
          f"<J> = {mean_layer(T_END):7.3f}\n")

    print("3.  the distribution at 8 Gyr, 60000 particles")
    JL = run("layer", 60000, seed=2)
    JV = run("volume", 60000, seed=3)
    print(f"    <J>  layer {JL.mean():7.3f}   volume {JV.mean():7.3f}"
          f"   ratio {JV.mean()/JL.mean():.2f}")
    print(f"    rms |z|  layer {np.sqrt(JL.mean()/NU)*1000:.0f} pc"
          f"   volume {np.sqrt(JV.mean()/NU)*1000:.0f} pc\n")
    print("      P(Jz > x<Jz>)      x = 2     x = 3     x = 4     x = 5")
    xs = (2, 3, 4, 5)
    rows = [
        ("thin layer, simulated", [(JL / JL.mean() > x).mean() for x in xs]),
        ("thin layer, b = 1/2   ", [survival(0.5, x) for x in xs]),
        ("volume, simulated     ", [(JV / JV.mean() > x).mean() for x in xs]),
        ("volume, b = 1         ", [survival(1.0, x) for x in xs]),
    ]
    for name, vals in rows:
        print("      " + name.ljust(22) + "".join(f"{v:10.4f}" for v in vals))


if __name__ == "__main__":
    main()
