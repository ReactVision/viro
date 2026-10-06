import * as React from "react";
import { useEffect, useState } from "react";
import { BackHandler } from "react-native";
import { ViroMaterials } from "../Material/ViroMaterials";
import { ViroNode } from "../ViroNode";
import type { ViroSource } from "../Types/ViroUtils";
import { ViroQuad } from "../ViroQuad";
import { questAlertStore } from "./domain/questAlertStore";
import { isSelectClick } from "./domain/questInput";
import {
  computeHeadLockedTransform,
  CameraPose,
  QUEST_PANEL_SCALE,
} from "./domain/questHeadLockedTransform";
import { StudioQuestText } from "./StudioQuestText";

const TITLE_HEIGHT_M = 0.3;
const MESSAGE_HEIGHT_M = 0.5;

ViroMaterials.createMaterials({
  StudioQuestAlertBackground: {
    lightingModel: "Constant",
    diffuseColor: "#111827DD",
    writesToDepthBuffer: true,
  },
});

const dismiss = (_position: unknown, source: ViroSource) => {
  if (isSelectClick(source)) questAlertStore.dismiss();
};

type Props = {
  /** Latest cached camera pose (throttled — see StudioARScene). Null before
   * the first onCameraTransformUpdate fires. */
  cameraPose: CameraPose | null;
};

/**
 * Quest-only in-scene replacement for Alert.alert (invisible in the VR
 * compositor). Renders questAlertStore's active message as a head-locked
 * panel. A controller click anywhere on the panel dismisses it, mirroring how
 * tapping "OK" dismisses the native dialog on phones, and so does B.
 */
export function StudioQuestAlertOverlay({ cameraPose }: Props) {
  const [, forceUpdate] = useState(0);
  useEffect(
    () => questAlertStore.subscribe(() => forceUpdate((n) => n + 1)),
    []
  );

  // Added only while the alert shows, for the reason given at the menu's
  // back listener in StudioARScene.
  const active = questAlertStore.isActive();
  useEffect(() => {
    if (!active) return;
    const subscription = BackHandler.addEventListener(
      "hardwareBackPress",
      () => {
        questAlertStore.dismiss();
        return true;
      }
    );
    return () => subscription.remove();
  }, [active]);

  if (!active || !cameraPose) return null;

  const { position, rotation } = computeHeadLockedTransform(cameraPose);
  const title = questAlertStore.title();
  const message = questAlertStore.message();

  // Laid out the way StudioQuestSceneHudOverlay is, for the reasons given
  // there. The background takes clicks here, since any click dismisses.
  const contentHeight = (title ? TITLE_HEIGHT_M : 0) + MESSAGE_HEIGHT_M;
  const titleY = contentHeight / 2 - TITLE_HEIGHT_M / 2;
  const messageY = -contentHeight / 2 + MESSAGE_HEIGHT_M / 2;

  return (
    <ViroNode
      position={position}
      rotation={rotation}
      scale={[QUEST_PANEL_SCALE, QUEST_PANEL_SCALE, QUEST_PANEL_SCALE]}
    >
      <ViroQuad
        position={[0, 0, -0.01]}
        width={2}
        height={1}
        materials={["StudioQuestAlertBackground"]}
        renderingOrder={-1}
        onClick={dismiss}
      />
      {title && (
        <StudioQuestText
          text={title}
          position={[0, titleY, 0]}
          width={1.8}
          height={TITLE_HEIGHT_M}
          fontSize={22}
          onClick={dismiss}
          style={{
            fontFamily: "sans-serif",
            fontWeight: "bold",
            color: "#FFFFFF",
            textAlign: "center",
            textAlignVertical: "center",
          }}
        />
      )}
      <StudioQuestText
        text={message ?? ""}
        position={[0, messageY, 0]}
        width={1.8}
        height={MESSAGE_HEIGHT_M}
        fontSize={16}
        onClick={dismiss}
        style={{
          fontFamily: "sans-serif",
          color: "#FFFFFF",
          textAlign: "center",
          textAlignVertical: "center",
        }}
      />
    </ViroNode>
  );
}
