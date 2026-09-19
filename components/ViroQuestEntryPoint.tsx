import * as React from "react";
import { BackHandler, findNodeHandle, StyleSheet } from "react-native";
import {
  VRQuestNavigatorBridge,
  VRQuestIntent,
} from "./Utilities/VRQuestNavigatorBridge";
import { exitVRScene } from "./Utilities/VRModuleOpenXR";
import { ViroVRSceneNavigator } from "./ViroVRSceneNavigator";
import { StudioSceneErrorBoundary } from "./Studio/StudioSceneErrorBoundary";
import { ViroScene } from "./ViroScene";
import { ViroAmbientLight } from "./ViroAmbientLight";
import { ViroText } from "./ViroText";

// Rendered in place of the crashed scene. Has to be a full, valid Viro scene
// (not a plain RN <View>) — VRActivity's display is exclusively driven by the
// OpenXR compositor, so a bare 2D view would never appear.
function QuestCrashFallbackScene() {
  return (
    <ViroScene>
      <ViroAmbientLight color="#ffffff" intensity={1000} />
      <ViroText
        text="Something went wrong loading this scene."
        position={[0, 0, -2]}
        width={3}
        height={1}
        style={{ fontFamily: "Arial", fontSize: 20, color: "#FFFFFF", textAlign: "center" }}
      />
    </ViroScene>
  );
}

/**
 * Drop-in root component for VRActivity on Meta Quest.
 *
 * The library auto-registers this as 'VRQuestScene' when imported, so most
 * apps need no manual setup. ViroXRSceneNavigator (panel side) calls
 * setIntent() with the initial scene and renderer config before launching
 * VRActivity. This component reads that intent, mounts ViroVRSceneNavigator
 * with key={intentKey} (fresh stack per intent), and populates the bridge
 * viewTag so VRModuleOpenXR ops (recenterTracking, setPassthroughEnabled)
 * work without a direct ref to ViroVRSceneNavigator.
 */
export function ViroQuestEntryPoint() {
  const [intent, setIntent] = React.useState<VRQuestIntent | null>(
    () => VRQuestNavigatorBridge.getIntent()
  );
  const navRef = React.useRef<ViroVRSceneNavigator>(null);

  React.useEffect(() => VRQuestNavigatorBridge.onIntent(setIntent), []);

  // Wire hardware back button to exit VR. Apps that need custom back behaviour
  // can call AppRegistry.registerComponent('VRQuestScene', ...) to override.
  //
  // Reads the intent from the bridge at press time (not the `intent` state
  // closed over above) so a VR relaunch that swaps in a new onExitViro after
  // this effect's first run is still honoured — exitVRScene() posts the
  // native finish() to the main looper asynchronously, so calling
  // onExitViro() first here still runs before VRActivity actually finishes.
  React.useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      VRQuestNavigatorBridge.getIntent()?.rendererConfig?.onExitViro?.();
      exitVRScene();
      return true;
    });
    return () => sub.remove();
  }, []);

  // Forward bridge ops (push/pop/etc.) to the live navigator.
  React.useEffect(() => {
    if (!intent) return;
    return VRQuestNavigatorBridge.subscribeOps((op) => {
      const nav = navRef.current;
      if (!nav) return;
      if (op.type === "push")         nav.push(op.scene);
      else if (op.type === "pop")     nav.pop();
      else if (op.type === "popN")    nav.popN(op.n);
      else if (op.type === "replace") nav.replace(op.scene);
      else if (op.type === "jump")    nav.jump(op.scene);
    });
  }, [intent?.intentKey]);

  // Publish the native view tag so VRModuleOpenXR callers can target this view.
  React.useEffect(() => {
    if (!intent) return;
    const t = setTimeout(() => {
      const tag = findNodeHandle(navRef.current);
      if (tag != null) VRQuestNavigatorBridge.setViewTag(tag);
    }, 100);
    return () => {
      clearTimeout(t);
      VRQuestNavigatorBridge.setViewTag(null);
    };
  }, [intent?.intentKey]);

  if (!intent) return null;

  const { initialScene, rendererConfig } = intent;

  return (
    <StudioSceneErrorBoundary
      onError={(error) => VRQuestNavigatorBridge.reportQuestError(error)}
      renderError={() => (
        <ViroVRSceneNavigator
          initialScene={{ scene: QuestCrashFallbackScene }}
          style={StyleSheet.absoluteFill}
        />
      )}
    >
      <ViroVRSceneNavigator
        ref={navRef}
        key={intent.intentKey}
        initialScene={initialScene}
        {...rendererConfig}
        style={StyleSheet.absoluteFill}
      />
    </StudioSceneErrorBoundary>
  );
}
