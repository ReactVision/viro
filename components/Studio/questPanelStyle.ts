import { ViroMaterials } from "../Material/ViroMaterials";
import type { Viro2DPoint } from "../Types/ViroUtils";

/** Text colours on a Quest panel card. */
export const QUEST_PANEL_TEXT = {
  primary: "#FFFFFF",
  secondary: "#B0B3B8",
  error: "#FF8A80",
} as const;

// Opaque: over passthrough a translucent card let the room, and the scene
// behind the card, show through far more than its alpha suggested.
const panelMaterial = (diffuseColor: string) => ({
  lightingModel: "Constant" as const,
  diffuseColor,
  readsFromDepthBuffer: false,
  writesToDepthBuffer: true,
  cullMode: "None" as const,
});

ViroMaterials.createMaterials({
  StudioQuestPanelCard: panelMaterial("#1C1E21"),
  StudioQuestPanelButton: panelMaterial("#0B66E4"),
  StudioQuestPanelButtonHover: panelMaterial("#3D8BFF"),
  StudioQuestPanelItem: panelMaterial("#3A3B3C"),
});

const CORNER_STEPS = 8;

// The same array for the same size: a new one makes the native side
// triangulate the polygon again, and a panel re-renders as the head moves.
const outlines = new Map<string, Viro2DPoint[]>();

/** A ViroPolygon outline: a rectangle centred on the origin, corners rounded. */
export function questRoundedRect(
  width: number,
  height: number,
  radius: number
): Viro2DPoint[] {
  const key = `${width}|${height}|${radius}`;
  const cached = outlines.get(key);
  if (cached) return cached;
  if (outlines.size > 64) outlines.clear();
  // Below half the height, so two corners never share a point, which the
  // native side drops with a warning.
  const r = Math.min(radius, width / 2, height * 0.45);
  const x = width / 2 - r;
  const y = height / 2 - r;
  const corners: [number, number, number][] = [
    [x, y, 0],
    [-x, y, 90],
    [-x, -y, 180],
    [x, -y, 270],
  ];
  const points: Viro2DPoint[] = [];
  for (const [cx, cy, start] of corners) {
    for (let i = 0; i <= CORNER_STEPS; i++) {
      const angle = ((start + (90 * i) / CORNER_STEPS) * Math.PI) / 180;
      points.push([cx + r * Math.cos(angle), cy + r * Math.sin(angle)]);
    }
  }
  outlines.set(key, points);
  return points;
}
