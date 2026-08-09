# Where a disc gets heated

Two galactic discs, heated by random encounters, side by side. On the left the
scatterers are confined to a thin layer at the midplane. On the right they fill
the volume. Nothing else differs. The tail of the vertical action distribution
tells the two apart.

Companion to Ting & Rix (2026), `Vertical_Action_Diffusion_Heating`.

## The point

A kick changes the vertical action in proportion to the speed the star happened
to have when it arrived,

```
ΔJz = vz Δvz / ν  +  (Δvz)² / 2ν
```

and the star lingers where it is slow. Averaging around one orbit smears the
scattering profile with a semicircular window whose radius is the height the
orbit reaches,

```
D(Jz) = (1/π) ∫ q(z) √(Z² − z²) dz ,     Z = √(2 Jz / ν)
```

Solving the Fokker–Planck equation for `D = D₀ Jz^b` gives a stretched
exponential whose exponent is two minus the diffusivity slope,

```
p(Jz, t) ∝ exp[ −(Jz / J₀)^{2−b} ] ,     J₀ ∝ t^{1/(2−b)}
```

Scatterers that fill the volume give `b = 1` and the classical exponential. A
thin layer gives `b = 1/2` and a steeper tail, because the star crosses the
plane faster on a wider orbit but is through the layer sooner, so one of the two
powers of the crossing speed is cancelled by the brevity of the crossing.

## What the simulation actually does

Each star carries a height and a vertical velocity. Between kicks the pair
rotates rigidly at `ν = 75 km/s/kpc`, which is the exact solution of the
harmonic vertical oscillation. A kick adds a Gaussian increment to the velocity
alone, with variance `q(z) Δt` at the height the star currently occupies. The
action is read off afterwards as `Jz = (vz² + ν² z²) / 2ν`.

No diffusion coefficient is imposed and no distribution is assumed. The curves
drawn over the histograms are a prediction the particles either meet or miss.

The layer is thin, so a uniform timestep fine enough to resolve a plane crossing
would be wasted everywhere else. Steps are split only when a star is close
enough to the plane to reach it during the step, which costs about half again as
much as the volume-filling panel and converges.

Both amplitudes are analytic. The layer uses `D₀ = (Q/π)√(2/ν)` and the volume
`D₀ = q₀/ν`, with the layer anchored on `J₀ = 26.2 kpc km/s` at 8 Gyr, the
scale Part I measures.

## Verification

`verify/verify_physics.py` is an independent NumPy transcription of
`src/physics.js` and `src/panel.js`, written against the same constants and the
same integration scheme. It checks three things and prints the table below.
Nothing in it is imported by the page. It takes about three minutes.

```bash
pip install -r requirements-verify.txt
python3 verify/verify_physics.py
```

The diffusion coefficient tends to the closed forms in both limits. For the
50 pc sheet the logarithmic slope of D is 0.5098 at `Jz = 5`, 0.5028 at 17 and
0.5016 at 30, against one half for a true sheet. The filled volume gives one
exactly.

The integrator is insensitive to how it is run. Mean action at 8 Gyr comes back
as 17.18, 17.25, 17.24 and 17.23 kpc km/s for base steps of 48, 96, 96 and 192
per vertical period and crossing resolutions of 0.32, 0.32, 0.20 and 0.32 layer
scale heights, against 17.28 from the closed form.

The distribution is never imposed, so the tail is a prediction. With 60,000
particles per case,

| P(Jz > x⟨Jz⟩) | x = 2 | x = 3 | x = 4 | x = 5 |
|---|---|---|---|---|
| thin layer, simulated | 0.1228 | 0.0302 | 0.0056 | 0.0008 |
| thin layer, b = 1/2 | 0.1226 | 0.0297 | 0.0059 | 0.0010 |
| volume filling, simulated | 0.1379 | 0.0490 | 0.0181 | 0.0062 |
| volume filling, b = 1 | 0.1353 | 0.0498 | 0.0183 | 0.0067 |

The residual scatter at the far end is Poisson on a few tens of stars. The page
itself runs 8000 particles per panel and stacks the scaled histogram over time,
which is legitimate because the distribution of `Jz/⟨Jz⟩` is frozen.

## The amplitude

The two scattering rates have to be set to something, and the choice changes
what the picture says. Here both discs are made equally warm at 0.5 Gyr and then
left alone, so the scales part company on the growth law alone, `t` against
`t^{2/3}`. That is a factor of 2.5 in the mean action and 1.6 in the thickness
by 8 Gyr.

Anchoring any earlier exaggerates the gap without adding any physics. The ratio
of the two diffusivities is `D_volume / D_layer ∝ √Jz`, so it keeps falling all
the way down to the birth action, and matching there hands the volume-filling
case a head start the geometry never asked for.

The distribution plot removes the amplitude entirely by scaling to the mean
action, and it starts at 1.5 mean actions, because below that the two shapes lie
almost on top of each other and the whole distinction is in what follows.

## Honesty about the picture

Heights are stretched by a factor of 2.1 against a disc twenty-four kiloparsecs
across, so the heating is legible.

Two clocks run at once. The vertical oscillation and the heating share the true
clock, at 8 Gyr per pass, so a star bobs about once every twenty frames.
Rotation about the galactic centre is slowed by roughly two orders of magnitude,
because at the true rate it would be a blur. The drawn orbits are exempt from
that. Each is the true helix on the cylinder of radius R, winding `ν R / Vc`
times per revolution, which is 2.5 at the Sun's radius, with amplitude
`Z = √(2 Jz / ν)`. Stars and orbits are coloured by vertical action on a common
scale, so the two panels can be compared directly.

The vertical frequency is held at one value rather than varying with radius, the
potential is harmonic, and the heating amplitude is constant in time. Stars are
born with a 6 km/s vertical dispersion inside the gas layer rather than
perfectly cold. None of the four changes the exponent, and the lecture notes in
the companion repository carry all of them.

## Running it

The page uses ES modules, so it needs to be served rather than opened from the
filesystem.

```bash
python3 -m http.server 8731
```

Then open `http://localhost:8731`. Any static host works, including GitHub
Pages, since everything is vendored and there are no network calls at runtime.
Appending `?debug` exposes the panels and the scene on `window.__app`.

## Controls

| control | what it does |
|---|---|
| drag | swings the viewing angle, both panels together |
| wheel | zooms, both panels together |
| double click, or `v` | back to the default view |
| Pause, or space | freeze both discs |
| Restart, or `r` | back to a cold disc at t = 0 |
| 0.5× 1× 3× | how fast the 8 Gyr pass runs |

## Layout

```text
index.html          markup and the control dock
styles/main.css     the whole stylesheet
src/physics.js      units, q(z), D(J), the analytic solution, the amplitudes
src/panel.js        one disc of 8000 stars, integrated
src/scene.js        canvas rendering, the colour ramp, the drawn orbits
src/distplot.js     the action distribution plot
src/main.js         wiring, the loop, the camera, the controls
vendor/katex/       KaTeX 0.16.11, for the equations
vendor/fonts/       Inter and Newsreader, variable, latin subset
```

## Reference

Ting & Rix (2026), and Ting & Rix (2019) for the stellar sample. The measurement
of the exponent is in `Vertical_Action_Diffusion_Heating`, where the static
version of the mechanism figure is `paper/figures/fig01_mechanism.pdf`.

## License

MIT. KaTeX is MIT. Inter and Newsreader are under the SIL Open Font License.
