import * as React from "react";
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { ActivityIndicator, StyleSheet, View, ViewStyle } from "react-native";
import { ViroARScene } from "../AR/ViroARScene";
import { ViroScene } from "../ViroScene";
import { ViroXRSceneNavigator } from "../ViroXRSceneNavigator";
import { isQuest } from "../Utilities/ViroPlatform";
import { registerSceneAnimations } from "./domain/animationRegistry";
import { registerStudioMaterialsForAssets } from "./domain/studioMaterials";
import { StudioVariableStore } from "./domain/variableStore";
import { StudioARScene } from "./StudioARScene";
import { StudioProjectApiResponse, StudioSceneResponse } from "./types";
import { VRTStudioModule } from "./VRTStudioModule";

function LoadingARScene() { return <ViroARScene />; }
function LoadingVRScene() { return <ViroScene />; }

type ViroOcclusionMode = "peopleOnly" | "depthBased" | undefined;

/** Maps a project's occlusion_mode to the Viro navigator's occlusionMode. */
function mapOcclusionMode(
  dbValue: string | null | undefined
): ViroOcclusionMode {
  switch (dbValue) {
    case "PEOPLEONLY":
      return "peopleOnly";
    case "DEPTHBASED":
      return "depthBased";
    default:
      return undefined;
  }
}

const styles = StyleSheet.create({
  loader: {
    position: "absolute",
    top: 0, left: 0, right: 0, bottom: 0,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#000000",
  },
});

/** Imperative handle exposed via ref. */
export interface StudioSceneNavigatorHandle {
  /** Screenshots the AR renderer. Resolves `{ success: false }` (no-op) on Quest. */
  takeScreenshot: (
    fileName: string,
    saveToCameraRoll: boolean
  ) => Promise<{ success: boolean; url?: string; errorCode?: string }>;
}

interface StudioSceneNavigatorProps {
  /**
   * UUID of a specific scene to load. If omitted, the navigator fetches the
   * project configured in the app manifest and uses its opening scene.
   */
  sceneId?: string;
  worldAlignment?: "Gravity" | "GravityAndHeading" | "Camera";
  autofocus?: boolean;
  style?: ViewStyle;
  onSceneReady?: () => void;
  onError?: (err: Error) => void;
  onSceneChange?: (sceneId: string, sceneName: string) => void;
  onExitViro?: () => void;
  /** Fired after the scene is fetched and parsed, before it is pushed. */
  onSceneLoaded?: (sceneData: StudioSceneResponse) => void;
  /** Threaded to the initial scene's StudioARScene (initial scene only). */
  onPlaneDetected?: () => void;
  onPlaneSelected?: () => void;
  noAssetsMessage?: string;
}

/**
 * Cross-reality Studio scene navigator. Renders a Studio-authored scene on
 * both AR devices (iOS / non-Quest Android) and Meta Quest (VR).
 *
 * Opening-scene resolution order:
 *   1. `sceneId` prop → use it directly
 *   2. Native project (RVProjectId from manifest) → use `opening_scene.id`
 *   3. Fallback → first scene in the project's scene list
 *
 * On Quest, ViroXRSceneNavigator is not rendered until the scene data is
 * ready. This means VRActivity always launches with the actual content scene
 * as its initial scene, avoiding the LoadingVRScene → replace timing race.
 */
export const StudioSceneNavigator = forwardRef<
  StudioSceneNavigatorHandle,
  StudioSceneNavigatorProps
>(function StudioSceneNavigator(
  {
    sceneId,
    worldAlignment = "Gravity",
    autofocus = true,
    style,
    onSceneReady,
    onError,
    onSceneChange,
    onExitViro,
    onSceneLoaded,
    onPlaneDetected,
    onPlaneSelected,
    noAssetsMessage,
  },
  ref
) {
  const navigatorRef = useRef<any>(null);
  const loadedSceneIdRef = useRef<string | null>(null);

  // Session-scoped variable store: outlives every scene push, resets when the
  // navigator (= the AR/VR session) unmounts.
  const variableStoreRef = useRef<StudioVariableStore | null>(null);
  if (variableStoreRef.current === null) {
    variableStoreRef.current = new StudioVariableStore();
  }
  useEffect(() => {
    return () => {
      variableStoreRef.current?.reset();
      variableStoreRef.current = null;
    };
  }, []);

  const onSceneReadyRef = useRef(onSceneReady);
  const onErrorRef = useRef(onError);
  const onSceneChangeRef = useRef(onSceneChange);
  const onSceneLoadedRef = useRef(onSceneLoaded);
  const onPlaneDetectedRef = useRef(onPlaneDetected);
  const onPlaneSelectedRef = useRef(onPlaneSelected);
  const noAssetsMessageRef = useRef(noAssetsMessage);
  onSceneReadyRef.current = onSceneReady;
  onErrorRef.current = onError;
  onSceneChangeRef.current = onSceneChange;
  onSceneLoadedRef.current = onSceneLoaded;
  onPlaneDetectedRef.current = onPlaneDetected;
  onPlaneSelectedRef.current = onPlaneSelected;
  noAssetsMessageRef.current = noAssetsMessage;

  // On Quest: holds the resolved scene entry. ViroXRSceneNavigator is not
  // rendered until this is non-null, so VRActivity always launches into content.
  const [vrSceneEntry, setVrSceneEntry] = useState<{ scene: any; passProps?: any } | null>(null);

  // Host config derived from the loaded scene; native setters apply post-mount,
  // so setting these after the navigator mounts is fine.
  const [occlusionMode, setOcclusionMode] =
    useState<ViroOcclusionMode>(undefined);
  const [numberOfTrackedImages, setNumberOfTrackedImages] = useState<
    number | undefined
  >(undefined);

  useImperativeHandle(
    ref,
    (): StudioSceneNavigatorHandle => ({
      takeScreenshot: (fileName, saveToCameraRoll) => {
        // On AR the handle is the ViroARSceneNavigator instance (has
        // arSceneNavigator.takeScreenshot); on Quest it's a bridge without it.
        const nav = navigatorRef.current?.arSceneNavigator;
        if (typeof nav?.takeScreenshot !== "function") {
          return Promise.resolve({ success: false });
        }
        return nav.takeScreenshot(fileName, saveToCameraRoll);
      },
    }),
    []
  );

  const resolveSceneId = useCallback(async (): Promise<string> => {
    if (sceneId) return sceneId;

    const projectResult = await VRTStudioModule.rvGetProject();
    if (!projectResult.success) {
      throw new Error(projectResult.error ?? "rvGetProject failed");
    }
    if (typeof projectResult.data !== "string") {
      throw new Error("rvGetProject returned no data");
    }

    const { project } = JSON.parse(projectResult.data) as StudioProjectApiResponse;

    if (project.opening_scene?.id) {
      return project.opening_scene.id;
    }
    if (project.scenes.length > 0) {
      return project.scenes[0].id;
    }
    throw new Error(`Project ${project.id} has no scenes`);
  }, [sceneId]);

  const loadScene = useCallback(
    async (isCancelled: () => boolean) => {
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      if (isCancelled()) return;

      const resolvedSceneId = await resolveSceneId();
      if (isCancelled()) return;

      if (loadedSceneIdRef.current === resolvedSceneId) return;

      const result = await VRTStudioModule.rvGetScene(resolvedSceneId);
      if (isCancelled()) return;
      if (!result.success) {
        throw new Error(result.error ?? "rvGetScene failed");
      }
      if (typeof result.data !== "string") {
        throw new Error("rvGetScene returned no data");
      }

      const sceneData: StudioSceneResponse = JSON.parse(result.data);
      if (isCancelled()) return;

      loadedSceneIdRef.current = resolvedSceneId;

      // Derive host config from the scene (occlusion + image tracking).
      const triggerImageCount = sceneData.assets.filter(
        (a) => !!a.trigger_image_url
      ).length;
      setNumberOfTrackedImages(
        triggerImageCount > 0 ? Math.min(triggerImageCount, 5) : undefined
      );
      setOcclusionMode(mapOcclusionMode(sceneData.project?.occlusion_mode));

      onSceneLoadedRef.current?.(sceneData);

      // On Quest: pre-register animations and materials before VRActivity launches.
      // This mirrors the module-level registration pattern used by XRSceneContent —
      // native registrations complete before any Viro components mount, eliminating
      // the race between registerAnimations/createMaterials native calls and the
      // Fabric commit that creates those components.
      if (isQuest) {
        registerSceneAnimations(sceneData.animations);
        registerStudioMaterialsForAssets(sceneData.assets);
      }

      const entry = {
        scene: StudioARScene,
        passProps: {
          sceneData,
          onReady: onSceneReadyRef.current,
          onSceneChange: onSceneChangeRef.current,
          onPlaneDetected: onPlaneDetectedRef.current,
          onPlaneSelected: onPlaneSelectedRef.current,
          noAssetsMessage: noAssetsMessageRef.current,
          variableStore: variableStoreRef.current,
        },
      };

      if (isQuest) {
        // On Quest: setting vrSceneEntry triggers ViroXRSceneNavigator to mount
        // with StudioARScene as vrInitialScene — VRActivity gets content immediately.
        setVrSceneEntry(entry);
      } else {
        navigatorRef.current?.arSceneNavigator?.push(entry);
      }
    },
    [resolveSceneId]
  );

  useEffect(() => {
    let cancelled = false;
    const isCancelled = () => cancelled;

    loadScene(isCancelled).catch((e: unknown) => {
      if (cancelled) return;
      const err = e instanceof Error ? e : new Error(String(e));
      const handler = onErrorRef.current;
      if (handler) handler(err);
      else console.error("[Studio] Failed to load scene:", err);
    });

    return () => { cancelled = true; };
  }, [sceneId, loadScene]);

  // On Quest: show a spinner until scene data is ready, then mount
  // ViroXRSceneNavigator (which launches VRActivity with content immediately).
  if (isQuest && !vrSceneEntry) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color="#ffffff" />
      </View>
    );
  }

  return (
    <ViroXRSceneNavigator
      ref={navigatorRef}
      arInitialScene={{ scene: LoadingARScene }}
      vrInitialScene={vrSceneEntry ?? { scene: LoadingVRScene }}
      worldAlignment={worldAlignment}
      autofocus={autofocus}
      numberOfTrackedImages={numberOfTrackedImages}
      occlusionMode={occlusionMode}
      onExitViro={onExitViro}
      style={style ?? StyleSheet.absoluteFill}
    />
  );
});
