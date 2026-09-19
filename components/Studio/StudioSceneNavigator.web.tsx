/**
 * Web host/navigator for Studio scenes. Web counterpart of StudioSceneNavigator
 * (native): instead of pushing StudioARScene onto ViroXRSceneNavigator via the
 * native VRTStudioModule, it holds the scene data in state and renders
 * StudioARScene.web inside a web navigator — ViroARSceneNavigator (AR via slam)
 * or Viro3DSceneNavigator (non-AR 3D), chosen from the scene's plane detection.
 *
 * Data source is injected (out of the renderer's scope): pass `sceneData`
 * directly, or a `loadScene(id)` fetcher (also used for NAVIGATION between
 * scenes via the runtime's injectable `navigate` seam). `apiRequestExecutor`
 * (for API_REQUEST functions) is likewise injected.
 */
import * as React from "react";
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { Viro3DSceneNavigator } from "../Viro3DSceneNavigator.web";
import { ViroARSceneNavigator } from "../AR/ViroARSceneNavigator.web";
import { StudioARScene, type StudioPlacementApi } from "./StudioARScene.web";
import { StudioPlacementStore, isTapToPlaceAsset } from "./domain/placementStore";
import { studioPlacementBannerStore } from "./domain/placementBannerStore";
import { STUDIO_RENDERER_EFFECTS } from "./domain/studioRendererEffects";
import { StudioVariableStore } from "./domain/variableStore";
import { StudioPlacementIndicator } from "./StudioPlacementIndicator.web";
import { StudioRecordingIndicator } from "./StudioRecordingIndicator.web";
import type { SequenceRuntimeContext } from "./domain/sceneNavigationHandler";
import type { StudioSceneResponse } from "./types";

export interface StudioSceneNavigatorWebHandle {
  takeScreenshot: (fileName: string) => Promise<{ success: boolean; url?: string }>;
}

export interface StudioSceneNavigatorWebProps {
  /** Scene data injected directly (single scene, no fetching). */
  sceneData?: StudioSceneResponse;
  /** Fetch a scene by id — used for the initial load (if `sceneData` omitted) and NAVIGATION. */
  loadScene?: (sceneId: string) => Promise<StudioSceneResponse>;
  /** Initial scene id (when using `loadScene`). */
  sceneId?: string;
  /** API_REQUEST transport for scene functions. */
  apiRequestExecutor?: SequenceRuntimeContext["apiRequestExecutor"];
  /** Force a mode; default derives from the scene (AR if plane detection is on). */
  mode?: "ar" | "3d";
  /** Passed to the underlying web navigator (WASM asset loading). */
  webRendererOptions?: any;
  /** slam-wasm loading for AR mode (see ViroARSceneNavigator.web). */
  slamScriptUrl?: string;
  onSceneReady?: () => void;
  onError?: (err: Error) => void;
  onSceneChange?: (sceneId: string, sceneName: string) => void;
  onSceneLoaded?: (sceneData: StudioSceneResponse) => void;
  onPlaneDetected?: () => void;
  onUnsupported?: (features: string[]) => void;
  /**
   * Render the REC pill while a RECORD_VIDEO toggle is running. Default true,
   * matching native. Hosts with their own chrome set this false and render
   * <StudioRecordingIndicator /> where it fits.
   */
  recordingIndicator?: boolean;
  /**
   * Render the tap-to-place prompt while a scene asset awaits placement.
   * Default true, matching native.
   */
  placementIndicator?: boolean;
  /**
   * Capture/tuning options forwarded to the AR session. Merged over the
   * defaults this component sets, so a caller can add without restating them.
   * Passing `playback` here replays a recording instead of opening a camera.
   */
  arOptions?: Record<string, unknown>;
  /**
   * Called with the AR session once it is running, for hosts that drive it
   * rather than only observe it — stepping a replay, for instance.
   */
  onSessionReady?: (session: any) => void;
  noAssetsMessage?: string;
  loadingView?: React.ReactNode;
  renderError?: (error: Error) => React.ReactNode;
}

function isARScene(sceneData: StudioSceneResponse | undefined): boolean {
  const mode = ((sceneData?.scene?.plane_detection as string) ?? "NONE").toUpperCase();
  return mode === "AUTOMATIC" || mode === "MANUAL";
}

/**
 * The tap surface for guided placement, and the only writer of the prompt state.
 *
 * Mounted only while the queue is waiting on an asset, so it never swallows a
 * tap meant for the scene's own click handlers. The visible pill is a separate
 * indicator the host positions in its own chrome; this publishes what it shows.
 *
 * Screen point to canvas pixels: the hit test works in the renderer's drawing
 * buffer, which is not the element's CSS size on a scaled display or under a
 * `devicePixelRatio` other than 1.
 */
const StudioPlacementOverlay: React.FC<{
  store: StudioPlacementStore;
  apiRef: React.MutableRefObject<StudioPlacementApi | null>;
  getName: (assetId: string) => string | null;
}> = ({ store, apiRef, getName }) => {
  const [activeId, setActiveId] = useState<string | null>(() =>
    store.activeAssetId(),
  );
  const missTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setActiveId(store.activeAssetId());
    return store.subscribeActive(() => setActiveId(store.activeAssetId()));
  }, [store]);

  useEffect(() => {
    studioPlacementBannerStore.set(!!activeId, activeId ? getName(activeId) : null);
  }, [activeId, getName]);

  useEffect(
    () => () => {
      if (missTimerRef.current) clearTimeout(missTimerRef.current);
      studioPlacementBannerStore.reset();
    },
    [],
  );

  const handlePointerUp = useCallback(
    (evt: React.PointerEvent<HTMLDivElement>) => {
      const api = apiRef.current;
      if (!api) return;
      const target = evt.currentTarget;
      const rect = target.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
      const canvas = target.parentElement?.querySelector("canvas");
      const bufferW = canvas?.width ?? rect.width;
      const bufferH = canvas?.height ?? rect.height;
      const x = ((evt.clientX - rect.left) / rect.width) * bufferW;
      const y = ((evt.clientY - rect.top) / rect.height) * bufferH;

      void api.placeAtScreenPoint(x, y).then((result) => {
        if (result !== "miss") {
          studioPlacementBannerStore.setShowMiss(false);
          return;
        }
        studioPlacementBannerStore.setShowMiss(true);
        if (missTimerRef.current) clearTimeout(missTimerRef.current);
        missTimerRef.current = setTimeout(
          () => studioPlacementBannerStore.setShowMiss(false),
          2500,
        );
      });
    },
    [apiRef],
  );

  if (!activeId) return null;

  return (
    <div
      onPointerUp={handlePointerUp}
      style={{
        position: "absolute",
        inset: 0,
        // Above the canvas and below the pills, which set pointerEvents none.
        zIndex: 1,
        touchAction: "none",
      }}
    />
  );
};

export const StudioSceneNavigator = forwardRef<
  StudioSceneNavigatorWebHandle,
  StudioSceneNavigatorWebProps
>((props, ref) => {
  const {
    recordingIndicator = true,
    placementIndicator = true,
    arOptions,
    onSessionReady,
    sceneData: injectedSceneData,
    loadScene,
    sceneId,
    apiRequestExecutor,
    mode,
    webRendererOptions,
    slamScriptUrl,
    onSceneReady,
    onError,
    onSceneChange,
    onSceneLoaded,
    onPlaneDetected,
    onUnsupported,
    noAssetsMessage,
    loadingView,
    renderError,
  } = props;

  const containerRef = useRef<HTMLDivElement>(null);
  // Session-scoped variable store (survives NAVIGATION between scenes).
  const variableStoreRef = useRef<StudioVariableStore | null>(null);
  if (variableStoreRef.current === null) variableStoreRef.current = new StudioVariableStore();

  // The guided placement queue, and the scene's imperative handle onto it.
  const placementStoreRef = useRef<StudioPlacementStore | null>(null);
  const placementApiRef = useRef<StudioPlacementApi | null>(null);

  const [sceneData, setSceneData] = useState<StudioSceneResponse | undefined>(injectedSceneData);
  const [error, setError] = useState<Error | null>(null);

  const onSceneLoadedRef = useRef(onSceneLoaded);
  onSceneLoadedRef.current = onSceneLoaded;

  const applyScene = useCallback((next: StudioSceneResponse) => {
    setSceneData(next);
    onSceneLoadedRef.current?.(next);
  }, []);

  // Initial load: prefer injected data, else fetch by id.
  useEffect(() => {
    if (injectedSceneData) {
      applyScene(injectedSceneData);
      return;
    }
    if (!sceneId || !loadScene) return;
    let cancelled = false;
    loadScene(sceneId)
      .then((data) => !cancelled && applyScene(data))
      .catch((err) => {
        if (cancelled) return;
        const e = err instanceof Error ? err : new Error(String(err));
        setError(e);
        onError?.(e);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sceneId, injectedSceneData]);

  // NAVIGATION seam: fetch the target scene and re-render.
  const navigate = useCallback(
    (targetSceneId: string) => {
      if (!loadScene) {
        console.warn("[Studio web] navigate ignored: no loadScene provided");
        return;
      }
      loadScene(targetSceneId)
        .then((data) => applyScene(data))
        .catch((err) => onError?.(err instanceof Error ? err : new Error(String(err))));
    },
    [loadScene, applyScene, onError],
  );

  useImperativeHandle(
    ref,
    () => ({
      takeScreenshot: async (fileName: string) => {
        const canvas = containerRef.current?.querySelector("canvas");
        if (!canvas) return { success: false };
        try {
          return { success: true, url: canvas.toDataURL("image/png") };
        } catch {
          return { success: false };
        }
      },
    }),
    [],
  );

  // Owned here rather than in the scene so the prompt can read the same queue
  // the tap surface drives, and so neither survives a scene change.
  const placementStore = (placementStoreRef.current ??= new StudioPlacementStore());

  const placementNames = new Map(
    (sceneData?.assets ?? [])
      .filter(isTapToPlaceAsset)
      .map((a) => [a.id, a.name ?? ""] as const),
  );
  const getPlacementName = (assetId: string) => placementNames.get(assetId) ?? null;

  if (error && renderError) return <>{renderError(error)}</>;
  if (!sceneData) return <>{loadingView ?? null}</>;

  const resolvedMode = mode ?? (isARScene(sceneData) ? "ar" : "3d");

  const SceneComponent = () => (
    <StudioARScene
      placementApiRef={placementApiRef}
      placementStore={placementStore}
      key={sceneData.scene.id}
      sceneData={sceneData}
      mode={resolvedMode}
      apiRequestExecutor={apiRequestExecutor}
      navigate={navigate}
      onReady={onSceneReady}
      onSceneChange={onSceneChange}
      onPlaneDetected={onPlaneDetected}
      onUnsupported={onUnsupported}
      noAssetsMessage={noAssetsMessage}
      variableStore={variableStoreRef.current ?? undefined}
    />
  );

  // The two HUD pills sit over the canvas rather than in it: they are DOM
  // siblings, so neither the WebGL capture nor a canvas recorder sees them,
  // which is the same guarantee the native ones give. Offsets mirror the
  // native constants (iOS branch — there is no status bar to measure on web).
  const overlay: React.CSSProperties = {
    position: "absolute",
    left: 0,
    right: 0,
    display: "flex",
    justifyContent: "center",
    pointerEvents: "none",
  };

  return (
    <div
      ref={containerRef}
      style={{ width: "100%", height: "100%", position: "relative" }}
    >
      {resolvedMode === "ar" ? (
        <ViroARSceneNavigator
          initialScene={{ scene: SceneComponent }}
          webRendererOptions={webRendererOptions}
          slamScriptUrl={slamScriptUrl}
          arOptions={{ detectPlanes: true, ...arOptions }}
          onSessionReady={onSessionReady}
          {...STUDIO_RENDERER_EFFECTS}
        />
      ) : (
        <Viro3DSceneNavigator
          initialScene={{ scene: SceneComponent }}
          webRendererOptions={webRendererOptions}
          {...STUDIO_RENDERER_EFFECTS}
        />
      )}
      {recordingIndicator && (
        <div style={{ ...overlay, top: 52 }}>
          <StudioRecordingIndicator />
        </div>
      )}
      {resolvedMode === "ar" && (
        <StudioPlacementOverlay
          store={placementStore}
          apiRef={placementApiRef}
          getName={getPlacementName}
        />
      )}
      {placementIndicator && (
        <div style={{ ...overlay, top: 64, padding: "0 24px", zIndex: 2 }}>
          <StudioPlacementIndicator />
        </div>
      )}
    </div>
  );
});

StudioSceneNavigator.displayName = "StudioSceneNavigator";
