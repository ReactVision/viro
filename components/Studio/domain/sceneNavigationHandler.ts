import { Alert } from "react-native";
import { StudioAnimation, StudioSceneFunction, StudioSceneResponse } from "../types";

type SceneNavigator = any; // ViroARSceneNavigator navigator object passed to AR scenes

const ANIMATION_CHAIN_MAX_DEPTH = 10;

/**
 * Resolves a scene function by ID from a flat list.
 */
function resolveById(
  id: string,
  fns: StudioSceneFunction[]
): StudioSceneFunction | undefined {
  return fns.find((f) => f.id === id);
}

/**
 * Looks up target_asset_id for an ANIMATION-type scene function.
 * The inline scene_animation only has the animation UUID — we resolve it
 * from the top-level animations array.
 */
function resolveAnimationTargetAssetId(
  animationId: string,
  animations: StudioAnimation[]
): string | undefined {
  return animations.find((a) => a.id === animationId)?.target_asset_id;
}

/**
 * Single dispatcher for all scene function types.
 * Used by onClick, onCollision, and on_load_function triggers.
 */
export function executeFunctionWithRelations(
  fn: StudioSceneFunction,
  sceneNavigator: SceneNavigator | undefined,
  animations: StudioAnimation[],
  onAnimationTrigger?: (targetAssetId: string, animationKey: string) => void,
  depth = 0,
  onSceneChange?: (sceneId: string, sceneName: string) => void,
): void {
  if (depth > ANIMATION_CHAIN_MAX_DEPTH) {
    console.warn(
      `[Studio] Max animation chain depth (${ANIMATION_CHAIN_MAX_DEPTH}) exceeded for function ${fn.id}.`
    );
    return;
  }

  if (fn.function_type === "NAVIGATION") {
    const nav = fn.scene_navigation;
    if (!nav?.navigate_to || !sceneNavigator) return;
    void navigateToScene(sceneNavigator, nav.navigate_to, animations, onSceneChange);
  } else if (fn.function_type === "ALERT") {
    const alrt = fn.scene_alert;
    if (!alrt) return;
    Alert.alert(alrt.alert_title ?? "Alert", alrt.alert_message ?? "", [
      { text: "OK", style: "default" },
    ]);
  } else if (fn.function_type === "ANIMATION") {
    const anim = fn.scene_animation;
    if (!anim || !onAnimationTrigger) return;

    // The inline scene_animation has `id` but not `target_asset_id` —
    // resolve it from the top-level animations array via the animation UUID.
    const targetAssetId = resolveAnimationTargetAssetId(
      fn.animation ?? anim.id,
      animations
    );
    if (!targetAssetId) {
      console.warn(
        `[Studio] ANIMATION function ${fn.id}: could not resolve target_asset_id for animation ${anim.id}`
      );
      return;
    }
    onAnimationTrigger(targetAssetId, anim.name);
  }
}

/**
 * Executes the scene's on_load_function if set.
 */
export function executeOnLoadFunction(
  functionId: string,
  functions: StudioSceneFunction[],
  sceneNavigator: SceneNavigator | undefined,
  animations: StudioAnimation[],
  onAnimationTrigger?: (targetAssetId: string, animationKey: string) => void,
  onSceneChange?: (sceneId: string, sceneName: string) => void,
): void {
  const fn = resolveById(functionId, functions);
  if (!fn) {
    console.warn(`[Studio] on_load_function ${functionId} not found.`);
    return;
  }
  executeFunctionWithRelations(fn, sceneNavigator, animations, onAnimationTrigger, 0, onSceneChange);
}

/**
 * Navigates to a new AR scene by fetching its data via rvGetScene and
 * pushing it onto the ViroARSceneNavigator stack.
 *
 * The sceneNavigator object exposes rvGetScene as a method — no separate
 * API client needed here.
 */
async function navigateToScene(
  sceneNavigator: SceneNavigator,
  targetSceneId: string,
  currentAnimations: StudioAnimation[],
  onSceneChange?: (sceneId: string, sceneName: string) => void,
): Promise<void> {
  if (!sceneNavigator) {
    console.error("[Studio] SceneNavigator not available for navigation");
    Alert.alert("Navigation Error", "Unable to navigate to scene");
    return;
  }

  console.log(`[Studio] Navigating to scene: ${targetSceneId}`);

  try {
    const result = await sceneNavigator.rvGetScene(targetSceneId);
    if (!result?.success) {
      throw new Error(result?.error ?? "rvGetScene failed");
    }

    const sceneData: StudioSceneResponse = JSON.parse(result.data);

    // Lazy import to avoid circular dependency
    const { StudioARScene } = require("../StudioARScene");

    sceneNavigator.push({
      scene: StudioARScene,
      passProps: {
        sceneData,
        onSceneChange,
      },
    });

    onSceneChange?.(targetSceneId, sceneData.scene.name ?? targetSceneId);
    console.log(`[Studio] Navigated to scene: ${sceneData.scene.name}`);
  } catch (error) {
    console.error("[Studio] Error navigating to scene:", error);
    Alert.alert("Navigation Error", "Failed to load scene");
  }
}
