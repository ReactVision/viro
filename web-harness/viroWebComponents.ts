/**
 * Curated `@reactvision/react-viro` surface for render.tsx's "tsx" execution
 * path. Only re-exports names that have a real .web.tsx implementation
 * (Vite's `resolve.extensions` in vite.config.ts picks it automatically from
 * the extensionless import, same as main.tsx). Anything a caller's generated
 * scene imports that isn't listed here degrades to a stub in render.tsx's
 * requireShim (renders children only, records a warning) instead of crashing
 * the whole scene. A component whose web file only renders nothing (the
 * markers, ViroVPSAnchor) is still exported, since that is what native does
 * with nothing tracked.
 */
import { createElement, useEffect, useSyncExternalStore } from "react";
import { markError, pushWarning } from "./renderState";
import { webRendererOptions } from "./wasmOptions";

// tinyvio, built through platforms/slam's drop-in C API and served from
// public/. Rebuild with tinyvio's scripts/build_slam_wasm.sh.
// Resolved against the document's base, so a page served under a path prefix
// (preview.html behind `<base href>`) still finds it.
const slamScriptUrl = () => new URL("tinyvio-slam.js", document.baseURI).href;

let navigatorDefaults: Record<string, unknown> = {};
let navigator3DDefaults: Record<string, unknown> = {};

/** Props every AR navigator the caller's code mounts gets, under its own. */
export function setARNavigatorDefaults(defaults: Record<string, unknown>): void {
  navigatorDefaults = defaults;
  navigatorDefaultsListeners.forEach((l) => l());
}
const navigatorDefaultsListeners = new Set<() => void>();
const onNavigatorDefaults = (l: () => void) => {
  navigatorDefaultsListeners.add(l);
  return () => void navigatorDefaultsListeners.delete(l);
};

/** Props every 3D, VR (drawn as 3D) and ViroSceneNavigator the caller's code mounts gets, under its own. */
export function set3DNavigatorDefaults(defaults: Record<string, unknown>): void {
  navigator3DDefaults = defaults;
}

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
// Plain values, not components: left to the require shim's stub they would be
// truthy functions, so `isQuest ? <Quest/> : <Phone/>` would take the Quest branch.
export { isQuest, isWeb, hasOpenXRSupport } from "../components/Utilities/ViroPlatform";
export { ViroAnimations } from "../components/Animation/ViroAnimations";
// The stub's value for a constant is a function, so a check such as
// `state === ViroTrackingStateConstants.TRACKING_NORMAL` was never true.
export {
  ViroARTrackingReasonConstants,
  ViroRecordingErrorConstants,
  ViroTrackingStateConstants,
} from "../components/ViroConstants";
export {
  checkPermissions,
  gpsToArWorld,
  isARSupportedOnDevice,
  latLngToMercator,
  polarToCartesian,
  polarToCartesianActual,
  requestRequiredPermissions,
} from "../components/Utilities/ViroUtils";
export { StreamingAudioManager } from "../components/Utilities/StreamingAudioManager";
export { useViroTrackingReady } from "../components/hooks/useViroTrackingReady";
export { useFixedUpdate, useGameLoop, useLateUpdate } from "../components/hooks/useGameLoop";
export { useAnySourceHover } from "../components/Utilities/useAnySourceHover";
export { useAnySourcePressed } from "../components/Utilities/useAnySourcePressed";
export { useViroMapCamera, viroMapCameraTransform } from "../components/useViroMapCamera";
export { ViroGameLoopUtils } from "../components/ViroGameLoopUtils";
export { ViroAnimatedComponent } from "../components/ViroAnimatedComponent";
export { ViroAnimatedImage } from "../components/ViroAnimatedImage";
export { ViroCameraTexture } from "../components/ViroCameraTexture";
export { ViroGameLoop } from "../components/ViroGameLoop";
export { ViroVirtualButton } from "../components/ViroVirtualButton";
export { ViroVirtualJoystick } from "../components/ViroVirtualJoystick";
// These render nothing on web, as on native when nothing is tracked. The stub
// drew their children at the origin instead.
export { ViroController } from "../components/ViroController";
export {
  ViroObjectDetector,
  VIRO_OBJECT_DETECTOR_UNAVAILABLE_ERROR,
} from "../components/ViroObjectDetector";
export { ViroARImageMarker } from "../components/AR/ViroARImageMarker";
export { ViroARObjectMarker } from "../components/AR/ViroARObjectMarker";
export { ViroVPSAnchor } from "../components/AR/ViroVPSAnchor";
// Plain JS: children stay hidden until the frame resolves, which on web it does not.
export { ViroARCloudAnchor } from "../components/AR/ViroARCloudAnchor";
export { ViroSharedFrame } from "../components/AR/ViroSharedFrame";

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
import { ViroVRSceneNavigator as _ViroVRSceneNavigatorRaw } from "../components/ViroVRSceneNavigator";
import { ViroSceneNavigator as _ViroSceneNavigatorRaw } from "../components/ViroSceneNavigator";

export function Viro3DSceneNavigator(props: any) {
  if (usePlaybackRefusal("Viro3DSceneNavigator")) return null;
  return createElement(_Viro3DSceneNavigatorRaw, { webRendererOptions, ...navigator3DDefaults, ...props });
}

export function ViroSceneNavigator(props: any) {
  if (usePlaybackRefusal("ViroSceneNavigator")) return null;
  return createElement(_ViroSceneNavigatorRaw, { webRendererOptions, ...navigator3DDefaults, ...props });
}

// The library's own file needs PermissionsAndroid, which react-native-web does
// not export. On a phone it mounts the AR navigator with `arInitialScene ??
// initialScene`, so this does the same.
export function ViroXRSceneNavigator(props: any) {
  const { initialScene, arInitialScene, vrInitialScene: _vrScene, ...rest } = props;
  const scene = arInitialScene ?? initialScene;
  useEffect(() => {
    if (!scene) pushWarning("ViroXRSceneNavigator needs `arInitialScene` or `initialScene`.");
  }, [scene]);
  if (!scene) return null;
  return createElement(ViroARSceneNavigator, { ...rest, initialScene: scene });
}

// A recording to drive the AR session from, when one was supplied. Caller TSX
// declares its own <ViroARSceneNavigator> and has no way to know about any of
// this, so the wrapper injects it -- the same reason webRendererOptions is
// injected here rather than passed.
let playbackSource: unknown = null;
let onSessionReady: ((session: unknown) => void) | null = null;

export function setPlaybackSource(
  source: unknown,
  onReady: (session: unknown) => void,
): void {
  playbackSource = source;
  onSessionReady = onReady;
}

// The recording only ever reaches the AR wrapper below. Any other navigator
// mounted over one is a working free-running scene that never publishes the
// frame stepper, so the driver would sit out its whole timeout; the error is
// what lets it stop at once (playback.ts resolves its wait on it).
function usePlaybackRefusal(navigator: string): boolean {
  const refused = playbackSource !== null;
  useEffect(() => {
    if (!refused) return;
    markError(
      new Error(
        `A render over a recording is driven through ViroARSceneNavigator; this scene mounts ${navigator}, which cannot play the recording back.`,
      ),
    );
  }, [refused, navigator]);
  return refused;
}

// One render produces one output frame, so two navigators mounted at once are
// two AR sessions over the same recording drawing into two stacked canvases:
// both scenes appear in the one video, and the tracker runs twice for it. It
// happens when a bundle's entry composes several scene components that each
// declare their own navigator -- a natural way to write "show me all my
// scenes" that this harness cannot honour. Counted here because this wrapper
// is the single funnel every caller navigator passes through.
let navigatorsMounted = 0;

export function ViroARSceneNavigator(props: any) {
  const defaults = useSyncExternalStore(onNavigatorDefaults, () => navigatorDefaults);
  useEffect(() => {
    navigatorsMounted += 1;
    if (navigatorsMounted > 1) {
      pushWarning(
        "This scene mounts more than one ViroARSceneNavigator. A render draws " +
          "one navigator over the recording, so every scene after the first is " +
          "stacked on top of the others in the same output. Render one scene " +
          "per run.",
      );
    }
    return () => {
      navigatorsMounted -= 1;
    };
  }, []);
  // The tracking engine too, for the same reason: caller-supplied TSX has no
  // way to know where this harness serves it from, and without a default the
  // AR session fails at start with "slam-wasm not found" — which reads like a
  // missing build rather than a missing prop.
  return createElement(_ViroARSceneNavigatorRaw, {
    webRendererOptions,
    slamScriptUrl: slamScriptUrl(),
    ...defaults,
    ...props,
    // After the caller's props, not before: a scene rendered over a recording
    // is rendered over that recording, whatever its own JSX asked for.
    ...(playbackSource
      ? {
          arOptions: { playback: playbackSource, showCameraBackground: true },
          onSessionReady,
        }
      : {}),
  });
}

// The library renders VR scenes through the 3D navigator in mono; this only
// adds the injected renderer options and the 3D navigator's defaults.
export function ViroVRSceneNavigator(props: any) {
  if (usePlaybackRefusal("ViroVRSceneNavigator")) return null;
  return createElement(_ViroVRSceneNavigatorRaw, { webRendererOptions, ...navigator3DDefaults, ...props });
}

export function ViroVRScene(props: any) {
  return createElement(_SceneForVR, props);
}
