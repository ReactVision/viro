import * as React from "react";
import { ViroMaterials } from "../Material/ViroMaterials";
import { ViroNode } from "../ViroNode";
import { ViroQuad } from "../ViroQuad";
import { ViroText } from "../ViroText";
import { ViroEventSource, type ViroSource } from "../Types/ViroUtils";
import { exitVRScene } from "../Utilities/VRModuleOpenXR";
import { VRQuestNavigatorBridge } from "../Utilities/VRQuestNavigatorBridge";
import {
  computeHeadLockedTransform,
  CameraPose,
} from "./domain/questHeadLockedTransform";
import { studioColocationIndicatorContent } from "./colocation/indicatorContent";
import { studioColocationStore } from "./domain/colocationStore";
import { questMenuStore } from "./domain/questMenuStore";
import { useStudioColocation } from "./useStudioColocation";

// How long the scene name, or a live session's status, stays up on its own.
const PEEK_MS = 5000;

// On Quest a 13 pt line shows in 0.15 m and a 14 pt one did not, so each box
// allows at least 0.0115 m per point of font size.
const LINE_HEIGHT_M = 0.15;
const NAME_HEIGHT_M = 0.17;
const HINT_HEIGHT_M = 0.13;
// Three lines: a failure's reason runs long.
const DETAIL_HEIGHT_M = 0.39;
const PADDING_M = 0.04;
const PANEL_WIDTH_M = 1.6;
const TEXT_WIDTH_M = 1.5;

ViroMaterials.createMaterials({
  StudioQuestHudBackground: {
    lightingModel: "Constant",
    diffuseColor: "#111827CC",
    writesToDepthBuffer: true,
  },
});

type HudLine = {
  key: string;
  text: string;
  height: number;
  fontSize: number;
  color: string;
  onClick?: (position: unknown, source: ViroSource) => void;
};

const subscribeToColocation = (onChange: () => void) =>
  studioColocationStore.subscribe(onChange);
const subscribeToMenu = (onChange: () => void) =>
  questMenuStore.subscribe(onChange);
const getMenuItems = () => questMenuStore.getItems();

type Props = {
  /** Latest cached camera pose (throttled — see StudioARScene). Null before
   * the first onCameraTransformUpdate fires. */
  cameraPose: CameraPose | null;
  sceneName: string | null;
  /** Toggled by the Y button (StudioARScene's controller). */
  menuOpen: boolean;
  onCloseMenu: () => void;
};

// Y also clicks whatever the left controller points at, so closing the menu
// with Y would press the button under that ray.
const isYButton = (source: ViroSource) =>
  (source as unknown as number) === ViroEventSource.Y_BUTTON;

// Same exit path as the hardware back button (ViroQuestEntryPoint's
// BackHandler): invoke the current intent's onExitViro before finishing
// VRActivity.
function handleExitClick(_position: unknown, source: ViroSource) {
  if (isYButton(source)) return;
  VRQuestNavigatorBridge.getIntent()?.rendererConfig?.onExitViro?.();
  exitVRScene();
}

const textStyle = {
  fontFamily: "sans-serif",
  textAlign: "center",
  textAlignVertical: "center",
} as const;

/**
 * Quest has no 2D chrome: the host's is stuck in MainActivity, out of view once
 * VRActivity takes the display. This is the in-scene replacement. It is placed
 * in the room in front of the wearer when it appears and stays there, rather
 * than following the head:
 *
 * - the scene name, for a few seconds after the scene opens;
 * - a shared session's status and join code (unless the navigator's
 *   colocationIndicator is false), placed again whenever the status changes.
 *   It stays up while the session is being set up or has failed, and for a
 *   few seconds once it is live;
 * - the menu, which Y opens and closes: the same lines, the host's
 *   questMenuItems, and Exit. B and the left menu button exit as well.
 *
 * Sits below StudioQuestAlertOverlay's position (verticalOffsetM) so an
 * ALERT firing at the same time doesn't render on top of it.
 */
export function StudioQuestSceneHudOverlay({
  cameraPose,
  sceneName,
  menuOpen,
  onCloseMenu,
}: Props) {
  const session = studioColocationIndicatorContent(
    useStudioColocation(),
    null,
    "headset"
  );
  const showSession = React.useSyncExternalStore(
    subscribeToColocation,
    () => studioColocationStore.isBuiltInIndicatorShown(),
    () => true
  );
  const colocation = showSession ? session : null;
  const menuItems = React.useSyncExternalStore(
    subscribeToMenu,
    getMenuItems,
    getMenuItems
  );

  const poseRef = React.useRef(cameraPose);
  const menuOpenRef = React.useRef(menuOpen);
  React.useEffect(() => {
    poseRef.current = cameraPose;
    menuOpenRef.current = menuOpen;
  });

  // The pose the panel was placed from. Never follows the camera after that.
  const [placedAt, setPlacedAt] = React.useState<CameraPose | null>(null);
  const [peek, setPeek] = React.useState<"intro" | "status" | null>("intro");
  const place = React.useCallback(() => {
    if (poseRef.current) setPlacedAt(poseRef.current);
  }, []);

  const hasPose = cameraPose !== null;
  React.useEffect(() => {
    if (!hasPose) return;
    place();
    const timer = setTimeout(
      () => setPeek((p) => (p === "intro" ? null : p)),
      PEEK_MS
    );
    return () => clearTimeout(timer);
  }, [hasPose, place]);

  React.useEffect(() => {
    if (menuOpen) place();
  }, [menuOpen, place]);

  const statusKey = colocation
    ? `${colocation.title}\n${colocation.code ?? ""}`
    : null;
  const statusStays = colocation !== null && colocation.tone !== "live";
  React.useEffect(() => {
    if (statusKey === null) {
      setPeek((p) => (p === "status" ? null : p));
      return;
    }
    // An open menu stays where the wearer opened it.
    if (!menuOpenRef.current) place();
    setPeek("status");
    if (statusStays) return;
    const timer = setTimeout(
      () => setPeek((p) => (p === "status" ? null : p)),
      PEEK_MS
    );
    return () => clearTimeout(timer);
  }, [statusKey, statusStays, place]);

  if ((!menuOpen && peek === null) || !placedAt) return null;

  const lines: HudLine[] = [
    {
      key: "name",
      text: sceneName ?? "Untitled scene",
      height: NAME_HEIGHT_M,
      fontSize: 14,
      color: "#FFFFFF",
    },
  ];
  if (colocation) {
    lines.push({
      key: "status",
      text: colocation.code
        ? `${colocation.title}   ${colocation.code}`
        : colocation.title,
      height: LINE_HEIGHT_M,
      fontSize: 13,
      color: colocation.tone === "error" ? "#FF8A80" : "#FFFFFF",
    });
    if (colocation.detail) {
      lines.push({
        key: "detail",
        text: colocation.detail,
        height: DETAIL_HEIGHT_M,
        fontSize: 11,
        color: "#CCCCCC",
      });
    }
  }
  if (menuOpen) {
    menuItems.forEach((item, index) =>
      lines.push({
        key: `item:${index}:${item.label}`,
        text: `[ ${item.label} ]`,
        height: LINE_HEIGHT_M,
        fontSize: 13,
        color: "#7FCBFF",
        onClick: (_position, source) => {
          if (isYButton(source)) return;
          onCloseMenu();
          item.onPress();
        },
      })
    );
    lines.push({
      key: "exit",
      text: "[ Exit ]",
      height: LINE_HEIGHT_M,
      fontSize: 13,
      color: "#7FCBFF",
      onClick: handleExitClick,
    });
  }
  lines.push({
    key: "hint",
    text: menuOpen ? "Press Y to close" : "Press Y for the menu",
    height: HINT_HEIGHT_M,
    fontSize: 11,
    color: "#CCCCCC",
  });

  const height =
    2 * PADDING_M + lines.reduce((sum, line) => sum + line.height, 0);
  const { position, rotation } = computeHeadLockedTransform(placedAt, {
    distanceM: 1.2,
    // Grows downwards, so its top edge stays where an alert expects it.
    verticalOffsetM: -0.4 - (height - 0.5) / 2,
  });

  // Each line is positioned explicitly: inside a ViroFlexView on Quest every
  // line rendered at the view's centre, on top of each other, and the
  // background never appeared. Clicks go to the nearest bounding box, and once
  // the panel is turned the background's wider box is nearer than the lines',
  // so the background ignores events. It is drawn first so the lines' boxes
  // cannot hide it, and textClipMode="None" keeps a line whose font is taller
  // than its box instead of dropping it.
  let lineTop = height / 2 - PADDING_M;
  return (
    <ViroNode position={position} rotation={rotation}>
      <ViroQuad
        position={[0, 0, -0.01]}
        width={PANEL_WIDTH_M}
        height={height}
        materials={["StudioQuestHudBackground"]}
        renderingOrder={-1}
        ignoreEventHandling
      />
      {lines.map((line) => {
        const y = lineTop - line.height / 2;
        lineTop -= line.height;
        return (
          <ViroText
            key={line.key}
            text={line.text}
            position={[0, y, 0]}
            width={TEXT_WIDTH_M}
            height={line.height}
            textClipMode="None"
            onClick={line.onClick}
            style={{ ...textStyle, fontSize: line.fontSize, color: line.color }}
          />
        );
      })}
    </ViroNode>
  );
}
