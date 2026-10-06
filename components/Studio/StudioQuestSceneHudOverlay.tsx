import * as React from "react";
import { ViroMaterials } from "../Material/ViroMaterials";
import { ViroNode } from "../ViroNode";
import { ViroQuad } from "../ViroQuad";
import type { ViroSource } from "../Types/ViroUtils";
import { exitVRScene } from "../Utilities/VRModuleOpenXR";
import { VRQuestNavigatorBridge } from "../Utilities/VRQuestNavigatorBridge";
import { questAlertStore } from "./domain/questAlertStore";
import { isSelectClick } from "./domain/questInput";
import {
  computeHeadLockedTransform,
  CameraPose,
  QUEST_PANEL_SCALE,
} from "./domain/questHeadLockedTransform";
import { studioColocationIndicatorContent } from "./colocation/indicatorContent";
import { studioColocationStore } from "./domain/colocationStore";
import { questMenuStore } from "./domain/questMenuStore";
import { estimateQuestTextLines, StudioQuestText } from "./StudioQuestText";
import { useStudioColocation } from "./useStudioColocation";

// How long the scene name, a live session's status, or the reason the last
// session ended stays up on its own.
const PEEK_MS = 5000;

// A line takes about 0.0115 m per point of font size.
const LINE_M_PER_POINT = 0.0115;
const PADDING_M = 0.04;
const PANEL_WIDTH_M = 1.6;
const TEXT_WIDTH_M = 1.5;

ViroMaterials.createMaterials({
  StudioQuestHudBackground: {
    lightingModel: "Constant",
    diffuseColor: "#111827CC",
    writesToDepthBuffer: true,
  },
  StudioQuestHudHover: {
    lightingModel: "Constant",
    diffuseColor: "#1F3B57",
    writesToDepthBuffer: true,
  },
});

type HudLine = {
  key: string;
  text: string;
  fontSize: number;
  color: string;
  onClick?: (position: unknown, source: ViroSource) => void;
};

const subscribeToColocation = (onChange: () => void) =>
  studioColocationStore.subscribe(onChange);
const getFailure = () => studioColocationStore.getFailure();
const subscribeToMenu = (onChange: () => void) =>
  questMenuStore.subscribe(onChange);
const getMenuItems = () => questMenuStore.getItems();
const subscribeToAlert = (onChange: () => void) =>
  questAlertStore.subscribe(onChange);
const isAlertShown = () => questAlertStore.isActive();

type Props = {
  /** Latest cached camera pose (throttled — see StudioARScene). Null before
   * the first onCameraTransformUpdate fires. */
  cameraPose: CameraPose | null;
  sceneName: string | null;
  /** Toggled by the menu button or the palm menu pinch (StudioARScene's
   * controller). */
  menuOpen: boolean;
  onCloseMenu: () => void;
  /** The tap-to-place prompt is in view. */
  placementPromptShown: boolean;
};

// Same exit path as the hardware back button (ViroQuestEntryPoint's
// BackHandler): invoke the current intent's onExitViro before finishing
// VRActivity.
function handleExitClick(_position: unknown, source: ViroSource) {
  if (!isSelectClick(source)) return;
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
 *   few seconds once it is live. When the host clears its colocation prop on
 *   failure, the reason shows for a few seconds and stays in the menu until
 *   the next session;
 * - the menu, which the left controller's menu button or, with hands, a pinch
 *   with the palm facing the wearer opens and closes: the same lines, the
 *   host's questMenuItems, and Exit. B exits as well.
 *
 * It is centred where the wearer looked when it was placed. While an ALERT or
 * the placement prompt holds the centre, the closed panel moves below it.
 */
export function StudioQuestSceneHudOverlay({
  cameraPose,
  sceneName,
  menuOpen,
  onCloseMenu,
  placementPromptShown,
}: Props) {
  const live = useStudioColocation();
  const failure = React.useSyncExternalStore(
    subscribeToColocation,
    getFailure,
    getFailure
  );
  const ended = live.status === "idle" && failure !== null;
  const session = studioColocationIndicatorContent(
    ended ? failure : live,
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
  const alertShown = React.useSyncExternalStore(
    subscribeToAlert,
    isAlertShown,
    isAlertShown
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

  // Placed while rendering, not in an effect: an effect lets the opened menu
  // draw one frame at the previous placement, and the wearer sees it jump.
  const [menuWasOpen, setMenuWasOpen] = React.useState(menuOpen);
  // The item each controller or hand points at. An item that unmounts while
  // pointed at never reports the ray leaving, so this resets with the menu.
  const [hoveredBySource, setHoveredBySource] = React.useState<
    Record<number, string>
  >({});
  if (menuOpen !== menuWasOpen) {
    setMenuWasOpen(menuOpen);
    setHoveredBySource({});
    if (menuOpen && cameraPose) setPlacedAt(cameraPose);
  }

  const statusKey = colocation
    ? `${colocation.title}\n${colocation.code ?? ""}`
    : null;
  const statusStays =
    colocation !== null && colocation.tone !== "live" && !ended;
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
      fontSize: 14,
      color: "#FFFFFF",
    },
  ];
  if (colocation) {
    lines.push({
      key: "status",
      text: colocation.title,
      fontSize: 13,
      color: colocation.tone === "error" ? "#FF8A80" : "#FFFFFF",
    });
    // Beside the title the code wrapped, split across two lines.
    if (colocation.code) {
      lines.push({
        key: "code",
        text: colocation.code,
        fontSize: 13,
        color: "#FFFFFF",
      });
    }
    if (colocation.detail) {
      lines.push({
        key: "detail",
        text: colocation.detail,
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
        fontSize: 13,
        color: "#7FCBFF",
        onClick: (_position, source) => {
          if (!isSelectClick(source)) return;
          onCloseMenu();
          item.onPress();
        },
      })
    );
    lines.push({
      key: "exit",
      text: "[ Exit ]",
      fontSize: 13,
      color: "#7FCBFF",
      onClick: handleExitClick,
    });
  }
  lines.push({
    key: "hint",
    text: menuOpen
      ? "Menu button or palm pinch to close"
      : "Menu button or palm pinch for the menu",
    fontSize: 11,
    color: "#CCCCCC",
  });

  // Sized to the wrapped text: a box one line tall draws a wrapped line over
  // its neighbours.
  const lineHeights = lines.map(
    (line) =>
      estimateQuestTextLines(line.text, TEXT_WIDTH_M, line.fontSize) *
      line.fontSize *
      LINE_M_PER_POINT
  );
  const height =
    2 * PADDING_M +
    lineHeights.reduce((sum, lineHeight) => sum + lineHeight, 0);
  const centred = menuOpen || (!alertShown && !placementPromptShown);
  const { position, rotation } = computeHeadLockedTransform(placedAt, {
    distanceM: 1.2,
    // Below the centre, the panel grows downwards, so its top edge stays where
    // an alert expects it.
    verticalOffsetM: centred
      ? 0
      : QUEST_PANEL_SCALE * (-0.4 - (height - 0.5) / 2),
  });

  // Each line is positioned explicitly: inside a ViroFlexView on Quest every
  // line rendered at the view's centre, on top of each other, and the
  // background never appeared. Clicks go to the nearest bounding box, and once
  // the panel is turned the background's wider box is nearer than the lines',
  // so the background ignores events. It is drawn first so the lines' boxes
  // cannot hide it.
  const hoveredKeys = new Set(Object.values(hoveredBySource));
  const hoverItem =
    (key: string) =>
    (isHovering: boolean, _position: unknown, source: ViroSource) => {
      // Eye gaze (Quest Pro) hovers too, and cannot click.
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
  return (
    <ViroNode
      position={position}
      rotation={rotation}
      scale={[QUEST_PANEL_SCALE, QUEST_PANEL_SCALE, QUEST_PANEL_SCALE]}
    >
      <ViroQuad
        position={[0, 0, -0.01]}
        width={PANEL_WIDTH_M}
        height={height}
        materials={["StudioQuestHudBackground"]}
        renderingOrder={-1}
        ignoreEventHandling
      />
      {lines.map((line, index) => {
        const y = lineTop - lineHeights[index] / 2;
        lineTop -= lineHeights[index];
        const hovered = line.onClick !== undefined && hoveredKeys.has(line.key);
        return (
          <React.Fragment key={line.key}>
            {hovered && (
              <ViroQuad
                position={[0, y, -0.005]}
                width={TEXT_WIDTH_M}
                height={lineHeights[index]}
                materials={["StudioQuestHudHover"]}
                renderingOrder={-1}
                ignoreEventHandling
              />
            )}
            <StudioQuestText
              text={line.text}
              position={[0, y, 0]}
              width={TEXT_WIDTH_M}
              height={lineHeights[index]}
              fontSize={line.fontSize}
              onClick={line.onClick}
              onHover={line.onClick ? hoverItem(line.key) : undefined}
              style={{ ...textStyle, color: hovered ? "#FFFFFF" : line.color }}
            />
          </React.Fragment>
        );
      })}
    </ViroNode>
  );
}
