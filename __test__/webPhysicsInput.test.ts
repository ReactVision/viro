/**
 * Web dragging (rays from the published camera view) and the collision router
 * that gives each body its own collisions by viroTag.
 */
import type { ViroCollision, ViroSceneApi } from "@reactvision/viro-web-renderer";
import { addCollisionListener, registerCollisionBody } from "../components/Web/viroCollisions";
import { dragFollower, rayAt, releaseVelocity, type CameraView, type Vec3 } from "../components/Web/viroDrag";

const element = { getBoundingClientRect: () => ({ left: 10, top: 20 }) } as unknown as HTMLElement;
const view: CameraView = { position: [0, 0, 0], orientation: [0, 0, 0, 1], fx: 100, fy: 100, cx: 50, cy: 50, element };
const close = (a: number[], b: number[]) => a.forEach((v, i) => expect(v).toBeCloseTo(b[i]!, 5));

describe("web dragging", () => {
  it("casts the centre pixel down -Z and a pixel above it upward", () => {
    close(rayAt(view, 60, 70).dir, [0, 0, -1]);
    expect(rayAt(view, 60, 20).dir[1]).toBeGreaterThan(0);
  });

  it("keeps the grabbed point at its distance for FixedDistance, carrying the node with it", () => {
    const follow = dragFollower("FixedDistance", undefined, {
      ray: { origin: [0, 0, 0], dir: [0, 0, -1] },
      hit: [0, 0, -2],
      node: [0, -0.1, -2],
    })!;
    close(follow({ origin: [0, 0, 0], dir: [1, 0, 0] })!, [2, -0.1, 0]);
  });

  it("slides along dragPlane, clamped to the circle its maxDistance cuts in the plane", () => {
    const follow = dragFollower(
      "FixedToPlane",
      { planePoint: [0, -1, 0], planeNormal: [0, 1, 0], maxDistance: 3 },
      { ray: { origin: [0, 0, 0], dir: [0, -Math.SQRT1_2, -Math.SQRT1_2] }, hit: [0, -1, -1], node: [0, -1, -1] },
    )!;
    close(follow({ origin: [0, 0, 0], dir: [Math.SQRT1_2, -Math.SQRT1_2, 0] })!, [1, -1, 0]);
    close(follow({ origin: [0, 0, 0], dir: [0, -0.1, -1] })!, [0, -1, -Math.sqrt(8)]);
  });

  it("puts a node off the plane onto it, and leaves one with no planeNormal where it is", () => {
    const start = { ray: { origin: [0, 0, 0] as Vec3, dir: [0, 0, -1] as Vec3 }, hit: [0, 0, -1] as Vec3, node: [0, 0.5, -1] as Vec3 };
    const onto = dragFollower("FixedToPlane", { planePoint: [0, -1, 0], planeNormal: [0, 1, 0] }, start)!;
    close(onto({ origin: [0, 0, 0], dir: [0, -Math.SQRT1_2, -Math.SQRT1_2] })!, [0, -1, -1]);
    const still = dragFollower("FixedToPlane", { planePoint: [0, -1, 0] }, start)!;
    close(still({ origin: [0, 0, 0], dir: [1, 0, 0] })!, [0, 0.5, -1]);
  });

  it("has no follower for an unknown dragType", () => {
    expect(dragFollower("Sideways", undefined, { ray: { origin: [0, 0, 0], dir: [0, 0, -1] }, hit: [0, 0, -1], node: [0, 0, -1] })).toBeNull();
  });

  it("throws with the velocity of the last 80 ms, capped", () => {
    close(releaseVelocity([{ t: 0, p: [0, 0, 0] }, { t: 100, p: [9, 9, 9] }, { t: 150, p: [9.1, 9, 9] }]), [2, 0, 0]);
    expect(Math.hypot(...releaseVelocity([{ t: 0, p: [0, 0, 0] }, { t: 10, p: [5, 0, 0] }]))).toBeCloseTo(10);
  });
});

describe("collision router", () => {
  function fakeScene() {
    let handler: ((c: ViroCollision) => void) | null = null;
    const scene = { setCollisionHandler: (h: typeof handler) => ((handler = h), true) } as unknown as ViroSceneApi;
    return { scene, fire: (c: ViroCollision) => handler?.(c) };
  }

  it("tells only the body that collided, naming the other by its viroTag", () => {
    const { scene, fire } = fakeScene();
    const ball = jest.fn();
    const pin = jest.fn();
    const a = registerCollisionBody(scene, () => "same", () => ball);
    const b = registerCollisionBody(scene, () => "same", () => pin);
    expect(a.key).not.toBe(b.key);
    fire({ tag: a.key, otherTag: b.key, point: [1, 2, 3], normal: [0, 1, 0] });
    expect(ball).toHaveBeenCalledWith("same", [1, 2, 3], [0, 1, 0]);
    expect(pin).not.toHaveBeenCalled();
  });

  it("gives scene listeners viroTags, and stops after unregister and unsubscribe", () => {
    const { scene, fire } = fakeScene();
    const seen: ViroCollision[] = [];
    const stop = addCollisionListener(scene, (c) => seen.push(c));
    const onHit = jest.fn();
    const a = registerCollisionBody(scene, () => "asset-a", () => onHit);
    const b = registerCollisionBody(scene, () => "asset-b", () => undefined);
    fire({ tag: a.key, otherTag: b.key, point: [0, 0, 0], normal: [0, 1, 0] });
    expect(seen[0]).toMatchObject({ tag: "asset-a", otherTag: "asset-b" });
    a.unregister();
    stop();
    fire({ tag: a.key, otherTag: b.key, point: [0, 0, 0], normal: [0, 1, 0] });
    expect(onHit).toHaveBeenCalledTimes(1);
    expect(seen).toHaveLength(1);
  });
});
