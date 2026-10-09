import * as React from "react";
import { useEffect, useMemo, useState } from "react";
import { BackHandler } from "react-native";
import { ViroNode } from "../ViroNode";
import type { ViroSource } from "../Types/ViroUtils";
import { ViroPolygon } from "../ViroPolygon";
import { questAlertStore } from "./domain/questAlertStore";
import { isSelectClick } from "./domain/questInput";
import {
  computeHeadLockedTransform,
  CameraPose,
  QUEST_PANEL_ORDER,
  QUEST_PANEL_SCALE,
} from "./domain/questHeadLockedTransform";
import { QUEST_PANEL_TEXT, questRoundedRect } from "./questPanelStyle";
import { estimateQuestTextHeight, StudioQuestText } from "./StudioQuestText";

const PANEL_WIDTH_M = 2;
const TEXT_WIDTH_M = 1.8;
const PADDING_M = 0.1;
const TITLE_GAP_M = 0.04;
const BUTTON_GAP_M = 0.1;
const BUTTON_WIDTH_M = 0.5;
const BUTTON_HEIGHT_M = 0.22;
const CORNER_RADIUS_M = 0.1;
const TITLE_FONT_SIZE = 22;
const MESSAGE_FONT_SIZE = 16;
const BUTTON_FONT_SIZE = 16;
const COUNTER_FONT_SIZE = 11;
// The panel follows the head, so a message too long for this height goes on
// further pages rather than past the view. At QUEST_PANEL_SCALE and 1.2 m it
// reaches about 14° above and below where the wearer looks.
const MAX_PANEL_HEIGHT_M = 2.4;

const BUTTON_OUTLINE = questRoundedRect(
  BUTTON_WIDTH_M,
  BUTTON_HEIGHT_M,
  BUTTON_HEIGHT_M / 2
);

type QuestAlertLayout = {
  titleHeight: number;
  pages: string[];
  messageHeights: number[];
  /** Unscaled, and the same for every page, so nothing placed below the panel
   * moves. */
  panelHeight: number;
};

export function questAlertLayout(
  title: string | null,
  message: string
): QuestAlertLayout {
  const titleHeight = title
    ? estimateQuestTextHeight(title, TEXT_WIDTH_M, TITLE_FONT_SIZE)
    : 0;
  const chrome =
    2 * PADDING_M +
    (title ? titleHeight + TITLE_GAP_M : 0) +
    BUTTON_GAP_M +
    BUTTON_HEIGHT_M;
  const messageHeightOf = (text: string) =>
    estimateQuestTextHeight(text, TEXT_WIDTH_M, MESSAGE_FONT_SIZE);

  const messageHeight = messageHeightOf(message);
  if (chrome + messageHeight <= MAX_PANEL_HEIGHT_M) {
    return {
      titleHeight,
      pages: [message],
      messageHeights: [messageHeight],
      panelHeight: chrome + messageHeight,
    };
  }

  const pageBudget = MAX_PANEL_HEIGHT_M - chrome;
  const pages: string[] = [];
  let page = "";
  for (const word of message.split(" ")) {
    const longer = page ? `${page} ${word}` : word;
    if (page && messageHeightOf(longer) > pageBudget) {
      pages.push(page);
      page = word;
    } else {
      page = longer;
    }
  }
  pages.push(page);
  return {
    titleHeight,
    pages,
    messageHeights: pages.map(messageHeightOf),
    panelHeight: MAX_PANEL_HEIGHT_M,
  };
}

type Props = {
  /** Latest cached camera pose (throttled — see StudioARScene). Null before
   * the first onCameraTransformUpdate fires. */
  cameraPose: CameraPose | null;
};

/**
 * Quest-only in-scene replacement for Alert.alert (invisible in the VR
 * compositor), drawn as a Meta Horizon OS dialog: a rounded dark card and a
 * blue OK button, which a trigger or pinch presses, as tapping "OK" dismisses
 * the native dialog on phones. B closes it too. A message too long for one
 * panel is shown a page at a time, and the button reads Next until the last.
 */
export function StudioQuestAlertOverlay({ cameraPose }: Props) {
  const [, forceUpdate] = useState(0);
  const [page, setPage] = useState(0);
  // Per source, as the menu's highlight is. A hover that ends as the alert
  // closes never reports its end, so a new alert starts with none.
  const [hoverSources, setHoverSources] = useState<ReadonlySet<number>>(
    () => new Set()
  );
  useEffect(
    () =>
      questAlertStore.subscribe(() => {
        setPage(0);
        setHoverSources(new Set());
        forceUpdate((n) => n + 1);
      }),
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

  const title = questAlertStore.title();
  const message = questAlertStore.message() ?? "";
  const layout = useMemo(
    () => questAlertLayout(title, message),
    [title, message]
  );
  const panelOutline = useMemo(
    () => questRoundedRect(PANEL_WIDTH_M, layout.panelHeight, CORNER_RADIUS_M),
    [layout.panelHeight]
  );

  if (!active || !cameraPose) return null;

  const { position, rotation } = computeHeadLockedTransform(cameraPose);
  const pageCount = layout.pages.length;
  const shownPage = Math.min(page, pageCount - 1);
  const lastPage = shownPage === pageCount - 1;
  const press = (_position: unknown, source: ViroSource) => {
    if (!isSelectClick(source)) return;
    if (lastPage) questAlertStore.dismiss();
    else setPage(shownPage + 1);
  };
  const hover = (
    isHovering: boolean,
    _position: unknown,
    source: ViroSource
  ) => {
    // Eye gaze (Quest Pro) hovers too, and cannot click.
    if (!isSelectClick(source)) return;
    const id = source as unknown as number;
    setHoverSources((current) => {
      if (current.has(id) === isHovering) return current;
      const next = new Set(current);
      if (isHovering) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  // Laid out the way StudioQuestPanelCard is, for the reasons given there,
  // and centred where the wearer looks. The text runs down from the top and
  // the button row sits at the bottom, so on a fixed-height paged panel the
  // button stays put. The card takes no click of its own but stops one from
  // reaching what is behind it; its text lets clicks through to it.
  const { titleHeight } = layout;
  const messageHeight = layout.messageHeights[shownPage];
  const top = layout.panelHeight / 2 - PADDING_M;
  const titleY = top - titleHeight / 2;
  const messageTop = top - (title ? titleHeight + TITLE_GAP_M : 0);
  const messageY = messageTop - messageHeight / 2;
  const buttonY = -layout.panelHeight / 2 + PADDING_M + BUTTON_HEIGHT_M / 2;
  const buttonX = TEXT_WIDTH_M / 2 - BUTTON_WIDTH_M / 2;
  const buttonLabel = lastPage ? "OK" : "Next";
  const counterWidth = TEXT_WIDTH_M - BUTTON_WIDTH_M - 0.1;
  const counter = `${shownPage + 1} of ${pageCount}`;
  const textStyle = {
    fontFamily: "sans-serif",
    textAlignVertical: "center" as const,
  };

  return (
    <ViroNode
      position={position}
      rotation={rotation}
      scale={[QUEST_PANEL_SCALE, QUEST_PANEL_SCALE, QUEST_PANEL_SCALE]}
    >
      <ViroPolygon
        position={[0, 0, -0.01]}
        vertices={panelOutline}
        holes={[]}
        materials={["StudioQuestPanelCard"]}
        renderingOrder={QUEST_PANEL_ORDER.alert}
      />
      {title && (
        <StudioQuestText
          text={title}
          position={[0, titleY, 0]}
          width={TEXT_WIDTH_M}
          height={titleHeight}
          fontSize={TITLE_FONT_SIZE}
          renderingOrder={QUEST_PANEL_ORDER.alert + 2}
          style={{
            ...textStyle,
            fontWeight: "bold",
            color: QUEST_PANEL_TEXT.primary,
            textAlign: "left",
          }}
        />
      )}
      <StudioQuestText
        text={layout.pages[shownPage]}
        position={[0, messageY, 0]}
        width={TEXT_WIDTH_M}
        height={messageHeight}
        fontSize={MESSAGE_FONT_SIZE}
        renderingOrder={QUEST_PANEL_ORDER.alert + 2}
        style={{
          ...textStyle,
          color: QUEST_PANEL_TEXT.secondary,
          textAlign: "left",
        }}
      />
      {pageCount > 1 && (
        <StudioQuestText
          text={counter}
          position={[-TEXT_WIDTH_M / 2 + counterWidth / 2, buttonY, 0]}
          width={counterWidth}
          height={estimateQuestTextHeight(
            counter,
            counterWidth,
            COUNTER_FONT_SIZE
          )}
          fontSize={COUNTER_FONT_SIZE}
          renderingOrder={QUEST_PANEL_ORDER.alert + 2}
          style={{
            ...textStyle,
            color: QUEST_PANEL_TEXT.secondary,
            textAlign: "left",
          }}
        />
      )}
      <ViroPolygon
        position={[buttonX, buttonY, -0.005]}
        vertices={BUTTON_OUTLINE}
        holes={[]}
        materials={[
          hoverSources.size > 0
            ? "StudioQuestPanelButtonHover"
            : "StudioQuestPanelButton",
        ]}
        renderingOrder={QUEST_PANEL_ORDER.alert + 1}
        onClick={press}
        onHover={hover}
      />
      <StudioQuestText
        text={buttonLabel}
        position={[buttonX, buttonY, 0]}
        width={BUTTON_WIDTH_M}
        height={estimateQuestTextHeight(
          buttonLabel,
          BUTTON_WIDTH_M,
          BUTTON_FONT_SIZE
        )}
        fontSize={BUTTON_FONT_SIZE}
        renderingOrder={QUEST_PANEL_ORDER.alert + 2}
        style={{
          ...textStyle,
          fontWeight: "bold",
          color: QUEST_PANEL_TEXT.primary,
          textAlign: "center",
        }}
      />
    </ViroNode>
  );
}
