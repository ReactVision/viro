/**
 * The anchor a web plane reports: classification inferred from alignment, as on
 * Android, and vertices only where the feed supplies a polygon.
 */
import { anchorToViro } from "../components/AR/ViroARScene.web";

const plane = (alignment: any, polygon?: [number, number][]) => ({
  id: "p",
  center: [0, -1, -2] as [number, number, number],
  normal: [0, 1, 0] as [number, number, number],
  rotation: [0, 0, 0] as [number, number, number],
  width: 1,
  height: 1,
  alignment,
  confidence: 1,
  ...(polygon ? { polygon } : {}),
});

describe("anchorToViro", () => {
  it("classifies by alignment", () => {
    expect(anchorToViro(plane("HorizontalUpward")).classification).toBe("Floor");
    expect(anchorToViro(plane("HorizontalDownward")).classification).toBe("Ceiling");
    expect(anchorToViro(plane("Vertical")).classification).toBe("Wall");
    expect(anchorToViro(plane("Horizontal")).classification).toBe("Unknown");
  });

  it("reports a fed polygon as [x, 0, z] vertices and none otherwise", () => {
    expect(anchorToViro(plane("HorizontalUpward", [[-0.5, -0.5], [0.5, 0], [0, 0.5]])).vertices).toEqual([
      [-0.5, 0, -0.5],
      [0.5, 0, 0],
      [0, 0, 0.5],
    ]);
    expect("vertices" in anchorToViro(plane("HorizontalUpward"))).toBe(false);
  });
});
