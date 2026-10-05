import * as React from "react";
import { useEffect, useState } from "react";
import { ViroMaterials } from "../Material/ViroMaterials";
import { ViroNode } from "../ViroNode";
import { ViroQuad } from "../ViroQuad";
import { ViroText } from "../ViroText";
import { questAlertStore } from "./domain/questAlertStore";
import {
  computeHeadLockedTransform,
  CameraPose,
} from "./domain/questHeadLockedTransform";

const TITLE_HEIGHT_M = 0.3;
const MESSAGE_HEIGHT_M = 0.5;

ViroMaterials.createMaterials({
  StudioQuestAlertBackground: {
    lightingModel: "Constant",
    diffuseColor: "#111827DD",
    writesToDepthBuffer: true,
  },
});

const dismiss = () => questAlertStore.dismiss();

type Props = {
  /** Latest cached camera pose (throttled — see StudioARScene). Null before
   * the first onCameraTransformUpdate fires. */
  cameraPose: CameraPose | null;
};

/**
 * Quest-only in-scene replacement for Alert.alert (invisible in the VR
 * compositor). Renders questAlertStore's active message as a head-locked
 * panel; dismiss is a controller click anywhere on the panel, mirroring how
 * tapping "OK" dismisses the native dialog on phones.
 */
export function StudioQuestAlertOverlay({ cameraPose }: Props) {
  const [, forceUpdate] = useState(0);
  useEffect(
    () => questAlertStore.subscribe(() => forceUpdate((n) => n + 1)),
    []
  );

  if (!questAlertStore.isActive() || !cameraPose) return null;

  const { position, rotation } = computeHeadLockedTransform(cameraPose);
  const title = questAlertStore.title();
  const message = questAlertStore.message();

  // Laid out the way StudioQuestSceneHudOverlay is, for the reasons given
  // there. The background takes clicks here, since any click dismisses.
  const contentHeight = (title ? TITLE_HEIGHT_M : 0) + MESSAGE_HEIGHT_M;
  const titleY = contentHeight / 2 - TITLE_HEIGHT_M / 2;
  const messageY = -contentHeight / 2 + MESSAGE_HEIGHT_M / 2;

  return (
    <ViroNode position={position} rotation={rotation}>
      <ViroQuad
        position={[0, 0, -0.01]}
        width={2}
        height={1}
        materials={["StudioQuestAlertBackground"]}
        renderingOrder={-1}
        onClick={dismiss}
      />
      {title && (
        <ViroText
          text={title}
          position={[0, titleY, 0]}
          width={1.8}
          height={TITLE_HEIGHT_M}
          textClipMode="None"
          onClick={dismiss}
          style={{
            fontFamily: "sans-serif",
            fontSize: 22,
            fontWeight: "bold",
            color: "#FFFFFF",
            textAlign: "center",
            textAlignVertical: "center",
          }}
        />
      )}
      <ViroText
        text={message ?? ""}
        position={[0, messageY, 0]}
        width={1.8}
        height={MESSAGE_HEIGHT_M}
        textClipMode="None"
        onClick={dismiss}
        style={{
          fontFamily: "sans-serif",
          fontSize: 16,
          color: "#FFFFFF",
          textAlign: "center",
          textAlignVertical: "center",
        }}
      />
    </ViroNode>
  );
}
