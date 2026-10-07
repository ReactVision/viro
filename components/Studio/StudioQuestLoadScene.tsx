import * as React from "react";
import type { ViroCameraTransform } from "../Types/ViroEvents";
import type { ViroSource } from "../Types/ViroUtils";
import { ViroController } from "../ViroController";
import { ViroNode } from "../ViroNode";
import { ViroQuad } from "../ViroQuad";
import { ViroScene } from "../ViroScene";
import { isSelectClick } from "./domain/questInput";
import {
  computeHeadLockedTransform,
  CameraPose,
  QUEST_PANEL_ORDER,
  QUEST_PANEL_SCALE,
} from "./domain/questHeadLockedTransform";
import { questSceneLoadStore } from "./domain/questSceneLoadStore";
import { handleQuestExitClick } from "./StudioQuestSceneHudOverlay";
import { estimateQuestTextHeight, StudioQuestText } from "./StudioQuestText";

// The menu panel's, as are the materials below.
const PADDING_M = 0.04;
const PANEL_WIDTH_M = 1.6;
const TEXT_WIDTH_M = 1.5;
const POSE_INTERVAL_MS = 150;

type Line = {
  key: string;
  text: string;
  color: string;
  onClick?: (position: unknown, source: ViroSource) => void;
};

const LOADING_LINES: Line[] = [
  { key: "loading", text: "Loading scene...", color: "#FFFFFF" },
];
const FAILED_LINES: Line[] = [
  { key: "failed", text: "Failed to load scene", color: "#FF8A80" },
  {
    key: "retry",
    text: "[ Retry ]",
    color: "#7FCBFF",
    onClick: (_position, source) => {
      if (isSelectClick(source)) questSceneLoadStore.retry();
    },
  },
  {
    key: "exit",
    text: "[ Exit ]",
    color: "#7FCBFF",
    onClick: handleQuestExitClick,
  },
];
const FONT_SIZE = 14;

/**
 * What Meta Quest's opening scene shows until its data arrives
 * (questSceneLoadStore). While loading, the panel follows the head, as an ALERT
 * does. A failure is placed once, as the menu is, so Retry and Exit hold still
 * under the laser; B exits as it does in a scene.
 */
export function StudioQuestLoadScene({ failed }: { failed: boolean }) {
  const [pose, setPose] = React.useState<CameraPose | null>(null);
  const lastPoseAtRef = React.useRef(0);
  const handleCameraTransformUpdate = React.useCallback(
    (t: ViroCameraTransform) => {
      const now = Date.now();
      if (now - lastPoseAtRef.current < POSE_INTERVAL_MS) return;
      lastPoseAtRef.current = now;
      setPose({ position: t.position, forward: t.forward, up: t.up });
    },
    []
  );

  const [placedAt, setPlacedAt] = React.useState<CameraPose | null>(null);
  // The button each controller or hand points at, as in the menu.
  const [hoveredBySource, setHoveredBySource] = React.useState<
    Record<number, string>
  >({});
  if (!failed && placedAt) {
    setPlacedAt(null);
    setHoveredBySource({});
  }
  if (failed && !placedAt && pose) setPlacedAt(pose);
  const anchor = failed ? placedAt : pose;

  const lines = failed ? FAILED_LINES : LOADING_LINES;
  const lineHeights = lines.map((line) =>
    estimateQuestTextHeight(line.text, TEXT_WIDTH_M, FONT_SIZE)
  );
  const height =
    2 * PADDING_M +
    lineHeights.reduce((sum, lineHeight) => sum + lineHeight, 0);
  const hoveredKeys = new Set(Object.values(hoveredBySource));
  const hoverItem =
    (key: string) =>
    (isHovering: boolean, _position: unknown, source: ViroSource) => {
      if (!isSelectClick(source)) return;
      const id = source as unknown as number;
      setHoveredBySource((current) => {
        if (isHovering) {
          return current[id] === key ? current : { ...current, [id]: key };
        }
        if (current[id] !== key) return current;
        const next = { ...current };
        delete next[id];
        return next;
      });
    };

  let lineTop = height / 2 - PADDING_M;
  const transform = anchor ? computeHeadLockedTransform(anchor) : null;
  // Laid out the way StudioQuestSceneHudOverlay is, for the reasons given there.
  return (
    <ViroScene
      toneMappingEnabled={false}
      onCameraTransformUpdate={handleCameraTransformUpdate}
    >
      <ViroController controllerVisibility reticleVisibility />
      {transform && (
        <ViroNode
          position={transform.position}
          rotation={transform.rotation}
          scale={[QUEST_PANEL_SCALE, QUEST_PANEL_SCALE, QUEST_PANEL_SCALE]}
        >
          <ViroQuad
            position={[0, 0, -0.01]}
            width={PANEL_WIDTH_M}
            height={height}
            materials={["StudioQuestHudBackground"]}
            renderingOrder={QUEST_PANEL_ORDER.hud}
            ignoreEventHandling={!failed}
          />
          {lines.map((line, index) => {
            const y = lineTop - lineHeights[index] / 2;
            lineTop -= lineHeights[index];
            const hovered =
              line.onClick !== undefined && hoveredKeys.has(line.key);
            return (
              <React.Fragment key={line.key}>
                {hovered && (
                  <ViroQuad
                    position={[0, y, -0.005]}
                    width={TEXT_WIDTH_M}
                    height={lineHeights[index]}
                    materials={["StudioQuestHudHover"]}
                    renderingOrder={QUEST_PANEL_ORDER.hud + 1}
                    ignoreEventHandling
                  />
                )}
                <StudioQuestText
                  text={line.text}
                  position={[0, y, 0]}
                  width={TEXT_WIDTH_M}
                  height={lineHeights[index]}
                  fontSize={FONT_SIZE}
                  renderingOrder={QUEST_PANEL_ORDER.hud + 2}
                  onClick={line.onClick}
                  onHover={line.onClick ? hoverItem(line.key) : undefined}
                  style={{
                    fontFamily: "sans-serif",
                    textAlign: "center",
                    textAlignVertical: "center",
                    color: hovered ? "#FFFFFF" : line.color,
                  }}
                />
              </React.Fragment>
            );
          })}
        </ViroNode>
      )}
    </ViroScene>
  );
}
