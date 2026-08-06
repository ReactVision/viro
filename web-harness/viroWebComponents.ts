/**
 * Curated `@reactvision/react-viro` surface for render.tsx's "tsx" execution
 * path. Only re-exports names that have a real .web.tsx implementation
 * (Vite's `resolve.extensions` in vite.config.ts picks it automatically from
 * the extensionless import, same as main.tsx). Anything a caller's generated
 * scene imports that isn't listed here degrades to a stub in render.tsx's
 * requireShim (renders children only, records a warning) instead of crashing
 * the whole scene — components like ViroARPlaneSelector/ViroARImageMarker/
 * ViroSpotLight-adjacent AR helpers don't have a web port yet.
 */
import { createElement, useEffect } from "react";
import { pushWarning } from "./renderState";
import { webRendererOptions } from "./wasmOptions";

export { Viro360Image } from "../components/Viro360Image";
export { Viro360Video } from "../components/Viro360Video";
export { Viro3DObject } from "../components/Viro3DObject";
export { ViroAmbientLight } from "../components/ViroAmbientLight";
export { ViroBox } from "../components/ViroBox";
export { ViroButton } from "../components/ViroButton";
export { ViroCamera } from "../components/ViroCamera";
export { ViroDirectionalLight } from "../components/ViroDirectionalLight";
export { ViroFlexView } from "../components/ViroFlexView";
export { ViroGeometry } from "../components/ViroGeometry";
export { ViroImage } from "../components/ViroImage";
export { ViroLightingEnvironment } from "../components/ViroLightingEnvironment";
export { ViroMaterialVideo } from "../components/ViroMaterialVideo";
export { ViroNode } from "../components/ViroNode";
export { ViroOmniLight } from "../components/ViroOmniLight";
export { ViroOrbitCamera } from "../components/ViroOrbitCamera";
export { ViroParticleEmitter } from "../components/ViroParticleEmitter";
export { ViroPolygon } from "../components/ViroPolygon";
export { ViroPolyline } from "../components/ViroPolyline";
export { ViroPortal } from "../components/ViroPortal";
export { ViroPortalScene } from "../components/ViroPortalScene";
export { ViroQuad } from "../components/ViroQuad";
export { ViroScene } from "../components/ViroScene";
export { ViroSkyBox } from "../components/ViroSkyBox";
export { ViroSound } from "../components/ViroSound";
export { ViroSoundField } from "../components/ViroSoundField";
export { ViroSpatialSound } from "../components/ViroSpatialSound";
export { ViroSphere } from "../components/ViroSphere";
// ViroSpinner.web.tsx intentionally NOT re-exported: it `require()`s its
// built-in PNGs at module scope (native/Metro convention), which Vite has no
// global `require` for — just importing the file throws at load time, before
// the component is ever used. Left out so it degrades to the safe
// unsupported-component stub instead of crashing every render that imports
// it. Fix at the source (e.g. `?url` imports) before re-adding.
export { ViroSpotLight } from "../components/ViroSpotLight";
export { ViroSurface } from "../components/ViroSurface";
export { ViroText } from "../components/ViroText";
export { ViroVideo } from "../components/ViroVideo";
export { ViroARPlane } from "../components/AR/ViroARPlane";
export { ViroARScene } from "../components/AR/ViroARScene";
export { ViroMaterials } from "../components/Material/ViroMaterials";
export { ViroAnimations } from "../components/Animation/ViroAnimations";

// ─── Navigators: wrapped, not re-exported directly ────────────────────────
// Caller-supplied TSX (the "tsx" render path) has no way to know about this
// harness's bundler setup, so its own <ViroARSceneNavigator>/
// <Viro3DSceneNavigator> JSX never passes `webRendererOptions` — without
// defaulting it here, the renderer falls back to a root-relative
// `/wasm/viro-web.js` that 404s against this harness's hashed build output.
// `{ webRendererOptions, ...props }` lets an explicit prop (unlikely, but
// harmless) still win.
import { Viro3DSceneNavigator as _Viro3DSceneNavigatorRaw } from "../components/Viro3DSceneNavigator";
import { ViroARSceneNavigator as _ViroARSceneNavigatorRaw } from "../components/AR/ViroARSceneNavigator";
import { ViroScene as _SceneForVR } from "../components/ViroScene";

export function Viro3DSceneNavigator(props: any) {
  return createElement(_Viro3DSceneNavigatorRaw, { webRendererOptions, ...props });
}

export function ViroARSceneNavigator(props: any) {
  return createElement(_ViroARSceneNavigatorRaw, { webRendererOptions, ...props });
}

// There's no web navigator/scene for VR yet — fall back to the 3D ones and
// say so via a warning, rather than failing a VR-flavored generated scaffold
// outright. Both aliases keep the same prop surface as their 3D originals.
export function ViroVRSceneNavigator(props: any) {
  useEffect(() => {
    pushWarning(
      '"ViroVRSceneNavigator" has no web implementation yet — rendered via Viro3DSceneNavigator.',
    );
  }, []);
  return createElement(_Viro3DSceneNavigatorRaw, { webRendererOptions, ...props });
}

export function ViroVRScene(props: any) {
  return createElement(_SceneForVR, props);
}
