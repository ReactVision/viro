import * as React from "react";
import type { ViroSource } from "../Types/ViroUtils";
import { ViroPolygon } from "../ViroPolygon";
import { QUEST_PANEL_ORDER } from "./domain/questHeadLockedTransform";
import { questRoundedRect } from "./questPanelStyle";
import { estimateQuestTextHeight, StudioQuestText } from "./StudioQuestText";

const PADDING_M = 0.08;
// Wide enough for the hint, "Menu button or palm pinch for the menu", on one
// line.
const TEXT_WIDTH_M = 2.1;
const PANEL_WIDTH_M = TEXT_WIDTH_M + 2 * PADDING_M;
const CORNER_RADIUS_M = 0.08;
// An item is a button: room above and below its label, and between it and the
// lines around it.
const ITEM_PADDING_M = 0.035;
const ITEM_GAP_M = 0.03;

export type QuestPanelLine = {
  key: string;
  text: string;
  fontSize: number;
  color: string;
  bold?: boolean;
  /** Makes the line an item: a button that takes the click. */
  onClick?: (position: unknown, source: ViroSource) => void;
};

export type QuestPanelLayout = {
  lines: QuestPanelLine[];
  textHeights: number[];
  rowHeights: number[];
  gapsBefore: number[];
  /** Unscaled metres. */
  height: number;
};

export function questPanelLayout(lines: QuestPanelLine[]): QuestPanelLayout {
  // Sized to the wrapped text: a box one line tall draws a wrapped line over
  // its neighbours.
  const textHeights = lines.map((line) =>
    estimateQuestTextHeight(line.text, TEXT_WIDTH_M, line.fontSize)
  );
  const isItem = (index: number) => lines[index]?.onClick !== undefined;
  const rowHeights = textHeights.map(
    (textHeight, index) => textHeight + (isItem(index) ? 2 * ITEM_PADDING_M : 0)
  );
  const gapsBefore: number[] = lines.map((_line, index) =>
    index > 0 && (isItem(index) || isItem(index - 1)) ? ITEM_GAP_M : 0
  );
  const height =
    2 * PADDING_M +
    rowHeights.reduce((sum, rowHeight) => sum + rowHeight, 0) +
    gapsBefore.reduce((sum, gap) => sum + gap, 0);
  return { lines, textHeights, rowHeights, gapsBefore, height };
}

type Props = {
  layout: QuestPanelLayout;
  /** The card stops a click between items from reaching what is behind it.
   * A panel with no items lets clicks through, as its text does. */
  interactive: boolean;
  hoveredKeys: ReadonlySet<string>;
  onHoverItem: (
    key: string
  ) => (isHovering: boolean, position: unknown, source: ViroSource) => void;
};

/**
 * The card the Quest menu, status and loading panels share: lines of text
 * aligned left, and items as buttons, each highlighted while a controller or
 * hand points at it. Each line is positioned explicitly: inside a ViroFlexView
 * on Quest every line rendered at the view's centre, on top of each other, and
 * the background never appeared. The card is drawn first and an item's button
 * next, so the text cannot hide them, and the text lets a click through to the
 * button.
 */
export function StudioQuestPanelCard({
  layout,
  interactive,
  hoveredKeys,
  onHoverItem,
}: Props) {
  let rowTop = layout.height / 2 - PADDING_M;
  return (
    <>
      <ViroPolygon
        position={[0, 0, -0.01]}
        vertices={questRoundedRect(
          PANEL_WIDTH_M,
          layout.height,
          CORNER_RADIUS_M
        )}
        holes={[]}
        materials={["StudioQuestPanelCard"]}
        renderingOrder={QUEST_PANEL_ORDER.hud}
        ignoreEventHandling={!interactive}
      />
      {layout.lines.map((line, index) => {
        const rowHeight = layout.rowHeights[index];
        rowTop -= layout.gapsBefore[index];
        const y = rowTop - rowHeight / 2;
        rowTop -= rowHeight;
        const item = line.onClick !== undefined;
        return (
          <React.Fragment key={line.key}>
            {item && (
              <ViroPolygon
                position={[0, y, -0.005]}
                vertices={questRoundedRect(
                  TEXT_WIDTH_M,
                  rowHeight,
                  rowHeight / 2
                )}
                holes={[]}
                materials={[
                  hoveredKeys.has(line.key)
                    ? "StudioQuestPanelButton"
                    : "StudioQuestPanelItem",
                ]}
                renderingOrder={QUEST_PANEL_ORDER.hud + 1}
                onClick={line.onClick}
                onHover={onHoverItem(line.key)}
              />
            )}
            <StudioQuestText
              text={line.text}
              position={[0, y, 0]}
              width={TEXT_WIDTH_M}
              height={layout.textHeights[index]}
              fontSize={line.fontSize}
              renderingOrder={QUEST_PANEL_ORDER.hud + 2}
              style={{
                fontFamily: "sans-serif",
                textAlign: item ? "center" : "left",
                textAlignVertical: "center",
                fontWeight: line.bold ? "bold" : "normal",
                color: line.color,
              }}
            />
          </React.Fragment>
        );
      })}
    </>
  );
}
