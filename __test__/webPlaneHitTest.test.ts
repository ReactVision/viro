/**
 * Hit tests against the planes a virtual camera reports, which stand in for
 * detected planes when an AR scene is previewed without a camera.
 */
import type { ArPlaneAnchor } from "@reactvision/viro-web-renderer";
import { hitTestPlanes } from "../components/Web/viroHitTest";
import { floorAnchorFor, virtualAnchors } from "../components/Web/viroVirtualCamera";

const floor: ArPlaneAnchor = { id: "floor", center: [0, -1, -1], normal: [0, 1, 0], rotation: [0, 0, 0], width: 5, height: 5, alignment: "HorizontalUpward", confidence: 1 };
const table: ArPlaneAnchor = { id: "table", center: [0, -0.25, -1.5], normal: [0, 1, 0], rotation: [0, 0, 0], width: 1.2, height: 0.8, alignment: "HorizontalUpward", confidence: 1 };
// Facing +X, its local X (the 2.6 m) runs down the wall and its local Z (the 5 m) along it.
const leftWall: ArPlaneAnchor = { id: "left", center: [-2.5, 0.3, -1], normal: [1, 0, 0], rotation: [0, 0, -90], width: 2.6, height: 5, alignment: "Vertical", confidence: 1 };
const down = { origin: [0, 0, -1.5] as [number, number, number], dir: [0, -1, 0] as [number, number, number] };

describe("hitTestPlanes", () => {
  const cast = (ray: { origin: [number, number, number]; dir: [number, number, number] }, planes: ArPlaneAnchor[]) =>
    hitTestPlanes(planes, ray.origin, ray.dir);
  const kinds = (hits: ReturnType<typeof hitTestPlanes>) => hits.map((h) => [h.anchorId, h.type]);

  it("returns hits nearest first, in native's shape", () => {
    const hits = cast(down, [floor, table]);
    expect(hits.map((h) => h.anchorId)).toEqual(["table", "floor"]);
    expect(hits[0]).toMatchObject({ type: "ExistingPlaneUsingExtent", hasDepthData: false, distance: 0.25 });
    expect(hits[0]!.transform.position).toEqual([0, -0.25, -1.5]);
  });

  it("types a hit outside a plane's extent as on the plane only", () => {
    const beside = { origin: [1, 0, -1.5] as [number, number, number], dir: [0, -1, 0] as [number, number, number] };
    expect(kinds(cast(beside, [floor, table]))).toEqual([
      ["table", "ExistingPlane"],
      ["floor", "ExistingPlaneUsingExtent"],
    ]);
  });

  it("measures a turned plane's extent along its own axes", () => {
    const toWall = (y: number, z: number) => ({ origin: [0, y, z] as [number, number, number], dir: [-1, 0, 0] as [number, number, number] });
    const inside = cast(toWall(1.5, -3), [leftWall]);
    expect(inside.map((h) => h.type)).toEqual(["ExistingPlaneUsingExtent"]);
    expect(inside[0]!.position[0]).toBeCloseTo(-2.5);
    expect(inside[0]!.position.slice(1)).toEqual([1.5, -3]);
    expect(kinds(cast(toWall(1.7, -1), [leftWall]))).toEqual([["left", "ExistingPlane"]]);
    expect(kinds(cast(toWall(0, -3.6), [leftWall]))).toEqual([["left", "ExistingPlane"]]);
  });

  it("ignores planes behind the ray and parallel to it", () => {
    expect(cast({ origin: [0, 0, -1.5], dir: [0, 1, 0] }, [floor])).toEqual([]);
    expect(cast({ origin: [0, 0, -1.5], dir: [1, 0, 0] }, [floor])).toEqual([]);
  });
});

describe("virtualAnchors", () => {
  it("reports the given planes in place of the floor", () => {
    expect(virtualAnchors({ floorY: -1, planes: [table] })).toEqual([table]);
    expect(virtualAnchors({})).toEqual([floorAnchorFor(-1)]);
    expect(virtualAnchors({ floorY: null })).toEqual([]);
  });
});
