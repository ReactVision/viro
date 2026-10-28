import * as React from "react";
import type { ViroCameraTransform } from "../Types/ViroEvents";
import type { ViroSource } from "../Types/ViroUtils";
import { ViroController } from "../ViroController";
import { ViroNode } from "../ViroNode";
import { ViroScene } from "../ViroScene";
import { isSelectClick } from "./domain/questInput";
import {
  computeHeadLockedTransform,
  CameraPose,
  QUEST_PANEL_SCALE,
} from "./domain/questHeadLockedTransform";
import { questSceneLoadStore } from "./domain/questSceneLoadStore";
import { QUEST_PANEL_TEXT } from "./questPanelStyle";
import {
  QuestPanelLine,
  questPanelLayout,
  StudioQuestPanelCard,
} from "./StudioQuestPanelCard";
import { handleQuestExitClick } from "./StudioQuestSceneHudOverlay";

const POSE_INTERVAL_MS = 150;
const FONT_SIZE = 14;

const LOADING_LAYOUT = questPanelLayout([
  {
    key: "loading",
    text: "Loading scene...",
    fontSize: FONT_SIZE,
    color: QUEST_PANEL_TEXT.primary,
  },
]);
const FAILED_LINES: QuestPanelLine[] = [
  {
    key: "failed",
    text: "Failed to load scene",
    fontSize: FONT_SIZE,
    color: QUEST_PANEL_TEXT.error,
  },
  {
    key: "retry",
    text: "Retry",
    fontSize: FONT_SIZE,
    color: QUEST_PANEL_TEXT.primary,
    onClick: (_position, source) => {
      if (isSelectClick(source)) questSceneLoadStore.retry();
    },
  },
  {
    key: "exit",
    text: "Exit",
    fontSize: FONT_SIZE,
    color: QUEST_PANEL_TEXT.primary,
    onClick: handleQuestExitClick,
  },
];
const FAILED_LAYOUT = questPanelLayout(FAILED_LINES);

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

  const transform = anchor ? computeHeadLockedTransform(anchor) : null;
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
          <StudioQuestPanelCard
            layout={failed ? FAILED_LAYOUT : LOADING_LAYOUT}
            interactive={failed}
            hoveredKeys={hoveredKeys}
            onHoverItem={hoverItem}
          />
        </ViroNode>
      )}
    </ViroScene>
  );
}
