import * as React from "react";
import { useEffect, useMemo, useState } from "react";
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
// The panel follows the head, so what it cannot fit in view can never be read.
// At 1.2 m this height reaches about 27° above and below where the wearer
// looks. Longer text shrinks to fit, down to the size of the menu's hint, and a
// message still too long goes on further pages.
const MAX_PANEL_HEIGHT_M = 2.4;
const MIN_MESSAGE_FONT_SIZE = 11;
const HINT_FONT_SIZE = 11;

const pageHint = (page: number, pages: number) =>
  `Trigger or pinch ${page < pages ? "for more" : "to close"} (${page}/${pages})`;

ViroMaterials.createMaterials({
  StudioQuestAlertBackground: {
    lightingModel: "Constant",
    diffuseColor: "#111827DD",
    readsFromDepthBuffer: false,
    writesToDepthBuffer: true,
  },
});

type QuestAlertLayout = {
  titleFontSize: number;
  titleHeight: number;
  messageFontSize: number;
  pages: string[];
  messageHeights: number[];
  hintHeight: number;
  /** The same for every page, so nothing placed below the panel moves. */
  panelHeight: number;
};

export function questAlertLayout(
  title: string | null,
  message: string
): QuestAlertLayout {
  const titleFontSizeFor = (messageFontSize: number) =>
    Math.round((TITLE_FONT_SIZE * messageFontSize) / MESSAGE_FONT_SIZE);
  const titleHeightAt = (fontSize: number) =>
    title
      ? Math.max(
          TITLE_HEIGHT_M,
          estimateQuestTextHeight(title, TEXT_WIDTH_M, fontSize)
        )
      : 0;
  const messageHeightAt = (text: string, fontSize: number) =>
    Math.max(
      MESSAGE_HEIGHT_M,
      estimateQuestTextHeight(text, TEXT_WIDTH_M, fontSize)
    );
  const fits = (fontSize: number) =>
    titleHeightAt(titleFontSizeFor(fontSize)) +
      messageHeightAt(message, fontSize) +
      2 * PADDING_M <=
    MAX_PANEL_HEIGHT_M;

  let messageFontSize = MESSAGE_FONT_SIZE;
  while (messageFontSize > MIN_MESSAGE_FONT_SIZE && !fits(messageFontSize)) {
    messageFontSize -= 1;
  }
  const titleFontSize = titleFontSizeFor(messageFontSize);
  const titleHeight = titleHeightAt(titleFontSize);

  if (fits(messageFontSize)) {
    const messageHeight = messageHeightAt(message, messageFontSize);
    return {
      titleFontSize,
      titleHeight,
      messageFontSize,
      pages: [message],
      messageHeights: [messageHeight],
      hintHeight: 0,
      panelHeight: Math.max(
        PANEL_HEIGHT_M,
        titleHeight + messageHeight + 2 * PADDING_M
      ),
    };
  }

  const hintHeight = estimateQuestTextHeight(
    pageHint(99, 99),
    TEXT_WIDTH_M,
    HINT_FONT_SIZE
  );
  const pageBudget =
    MAX_PANEL_HEIGHT_M - 2 * PADDING_M - titleHeight - hintHeight;
  const pages: string[] = [];
  let page = "";
  for (const word of message.split(" ")) {
    const longer = page ? `${page} ${word}` : word;
    if (
      page &&
      estimateQuestTextHeight(longer, TEXT_WIDTH_M, messageFontSize) >
        pageBudget
    ) {
      pages.push(page);
      page = word;
    } else {
      page = longer;
    }
  }
  pages.push(page);
  return {
    titleFontSize,
    titleHeight,
    messageFontSize,
    pages,
    messageHeights: pages.map((text) => messageHeightAt(text, messageFontSize)),
    hintHeight,
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
 * compositor). Renders questAlertStore's active message as a head-locked
 * panel. A controller click anywhere on the panel dismisses it, mirroring how
 * tapping "OK" dismisses the native dialog on phones, and so does B. A message
 * too long for one panel is shown a page at a time, and a click on any page but
 * the last shows the next.
 */
export function StudioQuestAlertOverlay({ cameraPose }: Props) {
  const [, forceUpdate] = useState(0);
  const [page, setPage] = useState(0);
  useEffect(
    () =>
      questAlertStore.subscribe(() => {
        setPage(0);
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

  if (!active || !cameraPose) return null;

  const { position, rotation } = computeHeadLockedTransform(cameraPose);
  const pageCount = layout.pages.length;
  const shownPage = Math.min(page, pageCount - 1);
  const click = (_position: unknown, source: ViroSource) => {
    if (!isSelectClick(source)) return;
    if (shownPage < pageCount - 1) setPage(shownPage + 1);
    else questAlertStore.dismiss();
  };

  // Laid out the way StudioQuestSceneHudOverlay is, for the reasons given
  // there, and centred where the wearer looks. The background takes clicks
  // here, since any click dismisses or turns the page.
  const { titleHeight, hintHeight } = layout;
  const messageHeight = layout.messageHeights[shownPage];
  const contentHeight = titleHeight + messageHeight + hintHeight;
  const titleY = contentHeight / 2 - titleHeight / 2;
  const messageY = contentHeight / 2 - titleHeight - messageHeight / 2;
  const hintY = -contentHeight / 2 + hintHeight / 2;

  return (
    <ViroNode
      position={position}
      rotation={rotation}
      scale={[QUEST_PANEL_SCALE, QUEST_PANEL_SCALE, QUEST_PANEL_SCALE]}
    >
      <ViroQuad
        position={[0, 0, -0.01]}
        width={2}
        height={layout.panelHeight}
        materials={["StudioQuestAlertBackground"]}
        renderingOrder={QUEST_PANEL_ORDER.alert}
        onClick={click}
      />
      {title && (
        <StudioQuestText
          text={title}
          position={[0, titleY, 0]}
          width={TEXT_WIDTH_M}
          height={titleHeight}
          fontSize={layout.titleFontSize}
          renderingOrder={QUEST_PANEL_ORDER.alert + 2}
          onClick={click}
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
        text={layout.pages[shownPage]}
        position={[0, messageY, 0]}
        width={TEXT_WIDTH_M}
        height={messageHeight}
        fontSize={layout.messageFontSize}
        renderingOrder={QUEST_PANEL_ORDER.alert + 2}
        onClick={click}
        style={{
          fontFamily: "sans-serif",
          color: "#FFFFFF",
          textAlign: "center",
          textAlignVertical: "center",
        }}
      />
      {pageCount > 1 && (
        <StudioQuestText
          text={pageHint(shownPage + 1, pageCount)}
          position={[0, hintY, 0]}
          width={TEXT_WIDTH_M}
          height={hintHeight}
          fontSize={HINT_FONT_SIZE}
          renderingOrder={QUEST_PANEL_ORDER.alert + 2}
          onClick={click}
          style={{
            fontFamily: "sans-serif",
            color: "#CCCCCC",
            textAlign: "center",
            textAlignVertical: "center",
          }}
        />
      )}
    </ViroNode>
  );
}
