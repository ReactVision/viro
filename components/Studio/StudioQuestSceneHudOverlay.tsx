import * as React from "react";
import { ViroNode } from "../ViroNode";
import { ViroFlexView } from "../ViroFlexView";
import { ViroText } from "../ViroText";
import { exitVRScene } from "../Utilities/VRModuleOpenXR";
import { VRQuestNavigatorBridge } from "../Utilities/VRQuestNavigatorBridge";
import {
  computeHeadLockedTransform,
  CameraPose,
} from "./domain/questHeadLockedTransform";

type Props = {
  /** Latest cached camera pose (throttled — see StudioARScene). Null before
   * the first onCameraTransformUpdate fires. */
  cameraPose: CameraPose | null;
  sceneName: string | null;
  /** "AUTOMATIC" | "MANUAL" | "NONE" — plane status line is hidden for NONE. */
  planeDetectionMode: string;
  hasFoundPlane: boolean;
};

// Same exit path as the hardware back button (ViroQuestEntryPoint's
// BackHandler, see roadmap task 2): invoke the current intent's onExitViro
// before finishing VRActivity.
function handleExitClick() {
  VRQuestNavigatorBridge.getIntent()?.rendererConfig?.onExitViro?.();
  exitVRScene();
}

/**
 * Quest has no 2D chrome (header, back, plane banner) — StudioGo's is stuck
 * in MainActivity, out of view once VRActivity takes the display (see
 * ViroXRSceneNavigator, which renders null on Quest). This is the in-scene
 * replacement: a small persistent head-locked HUD with the scene name, plane
 * status, and an in-scene "Exit" the hardware back button already covers,
 * but this makes it discoverable and provides a scene name / plane status
 * that has no other Quest-visible equivalent.
 *
 * Sits below StudioQuestAlertOverlay's position (verticalOffsetM) so an
 * ALERT firing at the same time doesn't render on top of it.
 */
export function StudioQuestSceneHudOverlay({
  cameraPose,
  sceneName,
  planeDetectionMode,
  hasFoundPlane,
}: Props) {
  if (!cameraPose) return null;

  const { position, rotation } = computeHeadLockedTransform(cameraPose, {
    distanceM: 1.2,
    verticalOffsetM: -0.4,
  });

  return (
    <ViroNode position={position} rotation={rotation}>
      <ViroFlexView
        width={1.6}
        height={0.5}
        style={{
          backgroundColor: "rgba(0,0,0,0.6)",
          justifyContent: "center",
          alignItems: "center",
          padding: 0.04,
        }}
      >
        <ViroText
          text={sceneName ?? "Untitled scene"}
          width={1.5}
          height={0.15}
          style={{
            fontFamily: "Arial",
            fontSize: 14,
            color: "#FFFFFF",
            textAlign: "center",
          }}
        />
        {planeDetectionMode !== "NONE" && (
          <ViroText
            text={hasFoundPlane ? "Plane found" : "Scanning for planes…"}
            width={1.5}
            height={0.12}
            style={{
              fontFamily: "Arial",
              fontSize: 11,
              color: "#CCCCCC",
              textAlign: "center",
            }}
          />
        )}
        <ViroText
          text="[ Exit ]"
          width={1.5}
          height={0.15}
          onClick={handleExitClick}
          style={{
            fontFamily: "Arial",
            fontSize: 13,
            color: "#7FCBFF",
            textAlign: "center",
          }}
        />
      </ViroFlexView>
    </ViroNode>
  );
}
