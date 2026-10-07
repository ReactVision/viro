import * as React from "react";
import { ViroMaterial, ViroMaterials } from "../Material/ViroMaterials";
import type { ViroTextStyle } from "../Styles/ViroTextStyle";
import type { Viro3DPoint } from "../Types/ViroUtils";
import { ViroNode } from "../ViroNode";
import { ViroQuad } from "../ViroQuad";
import { ViroText } from "../ViroText";

// ViroText rasterises a glyph at fontSize pixels and stretches it over fontSize
// centimetres, about 2 texels per degree at the panels' 1.2 m. Drawing at
// SUPERSAMPLE times the size under a 1/SUPERSAMPLE scale keeps the world size
// and multiplies the texels: 8 gives about 17 per degree there.
const SUPERSAMPLE = 8;
const INVERSE = 1 / SUPERSAMPLE;

// 2D ViroText takes no material from JS and always reads depth, so on a panel
// with no background a nearer object still hides it. This plate draws no
// colour but writes the panel's depth behind the glyphs. The bridges read the
// mask as colorWriteMask, an array, where ViroMaterial types colorWritesMask.
ViroMaterials.createMaterials({
  StudioQuestTextDepthPlate: {
    lightingModel: "Constant",
    readsFromDepthBuffer: false,
    writesToDepthBuffer: true,
    colorWriteMask: ["None"],
  } as ViroMaterial,
});

// Roboto's advance widths in ems, by rough class and rounded up, so an estimate
// errs towards one line too many rather than an overlap.
function advanceEm(char: string): number {
  if (" .,:;'|!ijlI".includes(char)) return 0.25;
  if ("frt()[]-".includes(char)) return 0.35;
  if ("mwMW".includes(char)) return 0.89;
  if (char !== char.toLowerCase()) return 0.72;
  return 0.58;
}

// A line takes about 0.0115 m per point of font size.
const LINE_M_PER_POINT = 0.0115;

/**
 * How many lines ViroText wraps text into. An em is fontSize centimetres, and
 * ViroText breaks between words, or inside a word wider than the line.
 */
function estimateQuestTextLines(
  text: string,
  widthM: number,
  fontSize: number
): number {
  const lineEm = widthM / (fontSize * 0.01);
  let lines = 0;
  for (const paragraph of text.split("\n")) {
    lines += 1;
    let usedEm = 0;
    for (const word of paragraph.split(" ")) {
      let wordEm = 0;
      for (const char of word) wordEm += advanceEm(char);
      const joinedEm = usedEm === 0 ? wordEm : usedEm + advanceEm(" ") + wordEm;
      if (joinedEm <= lineEm) {
        usedEm = joinedEm;
        continue;
      }
      const pieces = Math.max(1, Math.ceil(wordEm / lineEm));
      lines += (usedEm > 0 ? 1 : 0) + pieces - 1;
      usedEm = wordEm - (pieces - 1) * lineEm;
    }
  }
  return lines;
}

/** The height of the box text needs once ViroText has wrapped it, in metres. */
export function estimateQuestTextHeight(
  text: string,
  widthM: number,
  fontSize: number
): number {
  return (
    estimateQuestTextLines(text, widthM, fontSize) * fontSize * LINE_M_PER_POINT
  );
}

type Props = {
  text: string;
  position: Viro3DPoint;
  /** Metres, like ViroText's. */
  width: number;
  height: number;
  fontSize: number;
  /** The panel's text value from QUEST_PANEL_ORDER. */
  renderingOrder: number;
  /** For a panel with no background of its own. */
  depthPlate?: boolean;
  style?: Omit<ViroTextStyle, "fontSize">;
  onClick?: React.ComponentProps<typeof ViroText>["onClick"];
  onHover?: React.ComponentProps<typeof ViroText>["onHover"];
};

/**
 * A ViroText that reads sharply in a headset. textClipMode is always "None":
 * ViroText drops a line taller than its box, and the line height of a large
 * raster differs from the one each box was sized for.
 */
export function StudioQuestText({
  text,
  position,
  width,
  height,
  fontSize,
  renderingOrder,
  depthPlate,
  style,
  onClick,
  onHover,
}: Props) {
  return (
    <>
      {depthPlate && (
        <ViroQuad
          position={[position[0], position[1], position[2] - 0.002]}
          width={width}
          height={height}
          materials={["StudioQuestTextDepthPlate"]}
          renderingOrder={renderingOrder - 1}
          ignoreEventHandling
        />
      )}
      <ViroNode position={position} scale={[INVERSE, INVERSE, INVERSE]}>
        <ViroText
          text={text}
          width={width * SUPERSAMPLE}
          height={height * SUPERSAMPLE}
          textClipMode="None"
          // On the text itself: the renderer reads the order off the node
          // that holds the geometry.
          renderingOrder={renderingOrder}
          onClick={onClick}
          onHover={onHover}
          // A text with nothing to do on a click lets it reach what is behind,
          // so a placement aimed past a panel lands where it points.
          ignoreEventHandling={onClick === undefined}
          // The native side reads the size as an integer.
          style={{ ...style, fontSize: Math.round(fontSize * SUPERSAMPLE) }}
        />
      </ViroNode>
    </>
  );
}
