import * as React from "react";
import { useEffect, useState } from "react";
import { ViroNode } from "../ViroNode";
import { ViroFlexView } from "../ViroFlexView";
import { ViroText } from "../ViroText";
import { questAlertStore } from "./domain/questAlertStore";
import {
  computeHeadLockedTransform,
  CameraPose,
} from "./domain/questHeadLockedTransform";

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

  return (
    <ViroNode position={position} rotation={rotation}>
      <ViroFlexView
        width={2}
        height={1}
        onClick={() => questAlertStore.dismiss()}
        style={{
          backgroundColor: "rgba(0,0,0,0.85)",
          justifyContent: "center",
          alignItems: "center",
          padding: 0.06,
        }}
      >
        {title && (
          <ViroText
            text={title}
            width={1.8}
            height={0.3}
            style={{
              fontFamily: "Arial",
              fontSize: 22,
              fontWeight: "bold",
              color: "#FFFFFF",
              textAlign: "center",
            }}
          />
        )}
        <ViroText
          text={message ?? ""}
          width={1.8}
          height={0.5}
          style={{
            fontFamily: "Arial",
            fontSize: 16,
            color: "#FFFFFF",
            textAlign: "center",
          }}
        />
      </ViroFlexView>
    </ViroNode>
  );
}
