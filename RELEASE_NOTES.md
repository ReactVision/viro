# Release Notes

## v3.1.1

**Meta Quest builds pass the Horizon Store's upload check again, and glTF models render as glTF defines them on every platform: metals look metallic without an environment map, visionOS draws a model's normal, metallic-roughness, occlusion and emissive maps, an occlusion map can sit on its own UV set, and mirrored nodes draw their faces.** Renderer binaries are rebuilt on virocore 3.1.1. The web build uses `@reactvision/viro-web-renderer` 1.1.1.

### Everywhere

- **Metal surfaces look metallic without an environment map.** The flat ambient light lit them like matte paint.
- **glTF `normalTexture.scale` and `occlusionTexture.strength` apply,** an occlusion map on `TEXCOORD_1` samples that set (not on visionOS), and mirrored nodes draw their faces.

### Meta Quest

- **Builds pass the Horizon Store's upload check again:** the Expo plugin declares `com.oculus.permission.HAND_TRACKING` beside `horizonos.permission.HAND_TRACKING` (3.0.3 had dropped the old name, which the store requires), and no longer declares `WRITE_EXTERNAL_STORAGE`, which gives a Quest app no storage access and which Meta's review asks to justify.

### visionOS

- **`Viro3DObject` draws a glTF model's normal, metallic-roughness, occlusion and emissive maps.** It drew the base color only, so textured models looked flat.

### Check when upgrading

- **A metallic model without a `lightingEnvironment` looks darker than in 3.1.0.** This is how glTF and three.js light it; give metallic models an environment map.
