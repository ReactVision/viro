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
  QUEST_PANEL_ORDER,
  QUEST_PANEL_SCALE,
} from "./domain/questHeadLockedTransform";
import { estimateQuestTextHeight, StudioQuestText } from "./StudioQuestText";

// The smallest boxes and panel, which a short alert keeps.
const TITLE_HEIGHT_M = 0.3;
const MESSAGE_HEIGHT_M = 0.5;
const PANEL_HEIGHT_M = 1;
const PADDING_M = 0.1;
const TEXT_WIDTH_M = 1.8;
const TITLE_FONT_SIZE = 22;
const MESSAGE_FONT_SIZE = 16;

ViroMaterials.createMaterials({
  StudioQuestAlertBackground: {
    lightingModel: "Constant",
    diffuseColor: "#111827DD",
    readsFromDepthBuffer: false,
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
  // there. The background takes clicks here, since any click dismisses. Long
  // text grows the panel upwards: the menu placed below an alert expects its
  // bottom edge where a short alert has it.
  const titleHeight = title
    ? Math.max(
        TITLE_HEIGHT_M,
        estimateQuestTextHeight(title, TEXT_WIDTH_M, TITLE_FONT_SIZE)
      )
    : 0;
  const messageHeight = Math.max(
    MESSAGE_HEIGHT_M,
    estimateQuestTextHeight(message ?? "", TEXT_WIDTH_M, MESSAGE_FONT_SIZE)
  );
  const contentHeight = titleHeight + messageHeight;
  const panelHeight = Math.max(PANEL_HEIGHT_M, contentHeight + 2 * PADDING_M);
  const panelY = (panelHeight - PANEL_HEIGHT_M) / 2;
  const titleY = panelY + contentHeight / 2 - titleHeight / 2;
  const messageY = panelY - contentHeight / 2 + messageHeight / 2;

  return (
    <ViroNode
      position={position}
      rotation={rotation}
      scale={[QUEST_PANEL_SCALE, QUEST_PANEL_SCALE, QUEST_PANEL_SCALE]}
    >
      <ViroQuad
        position={[0, panelY, -0.01]}
        width={2}
        height={panelHeight}
        materials={["StudioQuestAlertBackground"]}
        renderingOrder={QUEST_PANEL_ORDER.alert}
        onClick={dismiss}
      />
      {title && (
        <StudioQuestText
          text={title}
          position={[0, titleY, 0]}
          width={TEXT_WIDTH_M}
          height={titleHeight}
          fontSize={TITLE_FONT_SIZE}
          renderingOrder={QUEST_PANEL_ORDER.alert + 2}
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
        width={TEXT_WIDTH_M}
        height={messageHeight}
        fontSize={MESSAGE_FONT_SIZE}
        renderingOrder={QUEST_PANEL_ORDER.alert + 2}
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
