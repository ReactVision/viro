import * as React from "react";
import { useCallback, useEffect, useRef } from "react";
import { StyleSheet, ViewStyle } from "react-native";
import { ViroARScene } from "../AR/ViroARScene";
import { ViroARSceneNavigator } from "../AR/ViroARSceneNavigator";
import { StudioARScene } from "./StudioARScene";
import { StudioSceneResponse } from "./types";

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
  const navigatorRef = useRef<any>(null);
  const loadedRef = useRef(false);

  const loadScene = useCallback(async () => {
    if (loadedRef.current) return;

    // Wait one frame to ensure the native view is mounted and has a node handle.
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

    try {
      const nav = navigatorRef.current?.arSceneNavigator;
      const result = await nav?.rvGetScene(sceneId);
      if (!result?.success) {
        throw new Error(result?.error ?? "rvGetScene failed");
      }

      const sceneData: StudioSceneResponse = JSON.parse(result.data);
      loadedRef.current = true;

      nav?.push({
        scene: StudioARScene,
        passProps: {
          sceneData,
          onReady: onSceneReady,
          onSceneChange,
        },
      });
    } catch (e) {
      console.error("[Studio] Failed to load scene:", e);
      (onError ?? console.error)(e as Error);
    }
  }, [sceneId, onSceneReady, onError]);

  useEffect(() => {
    loadScene();
  }, [loadScene]);

  return (
    <ViroARSceneNavigator
      ref={navigatorRef}
      initialScene={{ scene: LoadingScene }}
      worldAlignment={worldAlignment}
      autofocus={autofocus}
      style={style ?? StyleSheet.absoluteFill}
    />
  );
}
