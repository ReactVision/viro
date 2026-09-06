# visionOS component sweep (M6)

`ViroVisionOSSweep.tsx` is the sweep scene for the M6 component verification, five pages matching
the tiers in `plans/visionos-component-sweep.md`.

## Assets it expects

Not committed — point them at whatever the host app already ships:

| Path | Used by | Note |
|---|---|---|
| `assets/shiba.glb` | page 2 | GLB or GLTF only; `VROFBXLoader` is excluded from the visionOS target |
| `assets/env.hdr` | page 4 | equirectangular HDR for `ViroLightingEnvironment` |
| `assets/particle.png` | page 3 | any small texture; `ViroParticleEmitter.image` is required |
| `assets/button.png` | page 5 | any small texture |

## Backgrounds

The portal background API was implemented on 2026-08-23 (virocore `3803fab7`), so `ViroSkyBox` and
`Viro360Image` now link and render. They are not in this scene yet — add them once the sweep has
run once as-is, so a background failure cannot be confused with a component failure.

`Viro360Video` still does not work, for the unrelated reason that `VROVideoTextureiOS` is not in
the visionOS target.

## The feature toggles

`Viro3DSceneNavigator` requires `hdrEnabled` / `pbrEnabled` / `bloomEnabled` / `shadowsEnabled` /
`multisamplingEnabled`, so the panel exposes them as buttons rather than hardcoding them. They
double as the cost-attribution control: when per-pass GPU counters are unavailable — which is the
case in the Simulator — the frame timer's own advice is to toggle a feature and take the difference
in GPU total. MSAA starts off, since the M6 ticket gates it behind a confirmed budget.

## Reading the results

Record four things per component, not one: **renders / correct in stereo / correct at depth /
frame cost**. Only the first is established in the Simulator, and it is the weakest of the four.

Page 5 is expected to fail its interaction. That is the recorded state of input on visionOS, not a
regression: the bridge's `VROInputControllerVisionOS` has no event source until hand tracking
lands. If a tap ever registers there, that is worth a ticket of its own.
