/**
 * The web light estimate reads the camera frame, in the units native reports:
 * 1000 for a room the camera exposes at middle grey.
 */
import { estimateAmbientLight } from "../components/Web/viroLightEstimate";

const frame = (r: number, g: number, b: number, pixels = 4) =>
  Array.from({ length: pixels }, () => [r, g, b, 255]).flat();

describe("estimateAmbientLight", () => {
  test("a frame at middle grey is a neutral room", () => {
    const light = estimateAmbientLight(frame(117, 117, 117))!;
    expect(light.intensity).toBeGreaterThan(990);
    expect(light.intensity).toBeLessThan(1010);
    expect(light.color).toBe("#ffffff");
  });

  test("a dark frame reads as a dim room", () => {
    expect(estimateAmbientLight(frame(30, 30, 30))!.intensity).toBeLessThan(300);
  });

  test("the colour is the frame's mean hue at full brightness", () => {
    expect(estimateAmbientLight(frame(200, 100, 50))!.color).toBe("#ff8040");
  });

  test("an empty frame gives no estimate", () => {
    expect(estimateAmbientLight([])).toBeNull();
  });
});
