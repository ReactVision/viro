import * as React from "react";
import { useCallback, useEffect, useRef } from "react";
import { StyleSheet, ViewStyle } from "react-native";
import { ViroARScene } from "../AR/ViroARScene";
import { ViroARSceneNavigator } from "../AR/ViroARSceneNavigator";
import { StudioARScene } from "./StudioARScene";
import { StudioSceneResponse } from "./types";

interface RvGetSceneResult {
  success: boolean;
  data?: string;
  error?: string;
}

interface ArSceneNavigatorHandle {
  rvGetScene: (sceneId: string) => Promise<RvGetSceneResult>;
  push: (route: { scene: React.ComponentType<any>; passProps?: Record<string, unknown> }) => void;
}

interface ViroARSceneNavigatorRef {
  arSceneNavigator?: ArSceneNavigatorHandle;
}

// Minimal placeholder rendered while rvGetScene is in-flight.
function LoadingScene() { return <ViroARScene />; }

interface StudioSceneNavigatorProps {
  /** UUID of the scene to load from GET /functions/v1/scenes/{sceneId} */
  sceneId: string;
  worldAlignment?: "Gravity" | "GravityAndHeading" | "Camera";
  autofocus?: boolean;
  style?: ViewStyle;
  onSceneReady?: () => void;
  onError?: (err: Error) => void;
  /** Called when a NAVIGATION function transitions to a new scene. */
  onSceneChange?: (sceneId: string, sceneName: string) => void;
}

/**
 * Drop-in AR scene component that fetches and renders a Studio-authored scene.
 *
 * Auth is handled by the ReactVision API key wired through the Expo plugin
 * (rvProjectId in app.json). No Supabase client needed.
 *
 * Usage:
 *   <StudioSceneNavigator sceneId="abc-123-uuid" style={StyleSheet.absoluteFill} />
 */
export function StudioSceneNavigator({
  sceneId,
  worldAlignment = "Gravity",
  autofocus = true,
  style,
  onSceneReady,
  onError,
  onSceneChange,
}: StudioSceneNavigatorProps) {
  const navigatorRef = useRef<ViroARSceneNavigatorRef | null>(null);
  const loadedSceneIdRef = useRef<string | null>(null);

  const onSceneReadyRef = useRef(onSceneReady);
  const onErrorRef = useRef(onError);
  const onSceneChangeRef = useRef(onSceneChange);
  onSceneReadyRef.current = onSceneReady;
  onErrorRef.current = onError;
  onSceneChangeRef.current = onSceneChange;

  const loadScene = useCallback(
    async (id: string, isCancelled: () => boolean) => {
      // Wait one frame to ensure the native view is mounted and has a node handle.
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      if (isCancelled()) return;

      const nav = navigatorRef.current?.arSceneNavigator;
      if (!nav) {
        throw new Error("ViroARSceneNavigator not mounted");
      }

      const result = await nav.rvGetScene(id);
      if (isCancelled()) return;
      if (!result?.success) {
        throw new Error(result?.error ?? "rvGetScene failed");
      }
      if (typeof result.data !== "string") {
        throw new Error("rvGetScene returned no data");
      }

      let sceneData: StudioSceneResponse;
      try {
        sceneData = JSON.parse(result.data) as StudioSceneResponse;
      } catch (parseErr) {
        throw new Error(
          `Failed to parse scene response: ${(parseErr as Error).message}`
        );
      }

      if (isCancelled()) return;
      loadedSceneIdRef.current = id;

      nav.push({
        scene: StudioARScene,
        passProps: {
          sceneData,
          onReady: onSceneReadyRef.current,
          onSceneChange: onSceneChangeRef.current,
        },
      });
    },
    []
  );

  useEffect(() => {
    if (loadedSceneIdRef.current === sceneId) return;

    let cancelled = false;
    const isCancelled = () => cancelled;

    loadScene(sceneId, isCancelled).catch((e: unknown) => {
      if (cancelled) return;
      const err = e instanceof Error ? e : new Error(String(e));
      const handler = onErrorRef.current;
      if (handler) handler(err);
      else console.error("[Studio] Failed to load scene:", err);
    });

    return () => {
      cancelled = true;
    };
  }, [sceneId, loadScene]);

  return (
    <ViroARSceneNavigator
      ref={navigatorRef as React.RefObject<any>}
      initialScene={{ scene: LoadingScene }}
      worldAlignment={worldAlignment}
      autofocus={autofocus}
      style={style ?? StyleSheet.absoluteFill}
    />
  );
}
