/**
 * The preview camera's keyboard and scroll controls: walking, turning where it
 * stands, and zooming on any scroll.
 */
import type { ViroSceneApi } from "@reactvision/viro-web-renderer";
import { attachVirtualCamera3D, type ViroVirtualCameraControls, type ViroVirtualCameraOptions } from "../components/Web/viroVirtualCamera";

const scene = {
  createNode: () => 100,
  setNodeCamera: () => {},
  addChildNode: () => {},
  removeNodeFromParent: () => {},
  destroyNode: () => {},
  setActiveCameraNode: () => {},
  setNodePosition: () => {},
  setNodeRotation: () => {},
} as unknown as ViroSceneApi;

function attach(options: Omit<ViroVirtualCameraOptions, "floorY" | "planes"> = {}) {
  const listeners: Record<string, (e: any) => void> = {};
  const element = {
    clientWidth: 800,
    clientHeight: 600,
    addEventListener: (type: string, fn: (e: any) => void) => (listeners[type] = fn),
    removeEventListener: () => {},
    querySelector: () => null,
  } as unknown as HTMLElement;
  let controls: ViroVirtualCameraControls | null = null;
  const detach = attachVirtualCamera3D(scene, 1, element, { ...options, onReady: (c) => (controls = c) });
  const fire = (type: string, e: Record<string, unknown>) => listeners[type]!({ preventDefault() {}, stopPropagation() {}, ...e });
  return { controls: controls!, fire, detach };
}

const round = (v: number[]) => v.map((n) => +n.toFixed(3) + 0);

describe("virtual camera controls", () => {
  const frames: FrameRequestCallback[] = [];
  beforeEach(() => {
    frames.length = 0;
    (globalThis as any).requestAnimationFrame = (cb: FrameRequestCallback) => frames.push(cb);
  });

  it("walks the way it faces while a key is held, faster with Shift, and stops on release", () => {
    const { controls, fire, detach } = attach();
    const t0 = performance.now();
    fire("keydown", { code: "KeyW", shiftKey: false });
    frames.shift()!(t0 + 100);
    // 1.4 m/s for a tenth of a second, down -Z.
    expect(round(controls.pose().position)).toEqual([0, 0, -0.14]);
    fire("keydown", { code: "KeyD", shiftKey: true });
    frames.shift()!(t0 + 200);
    // Forward and right together, normalised, at three times the speed.
    const step = 0.42 / Math.SQRT2;
    expect(round(controls.pose().position)).toEqual(round([step, 0, -0.14 - step]));
    fire("keyup", { code: "KeyW", shiftKey: false });
    fire("keyup", { code: "KeyD", shiftKey: false });
    frames.shift()!(t0 + 300);
    expect(frames).toHaveLength(0);
    detach();
  });

  it("ignores keys with a modifier and keys it does not move by", () => {
    const { fire, detach } = attach();
    fire("keydown", { code: "KeyW", metaKey: true });
    fire("keydown", { code: "KeyF" });
    expect(frames).toHaveLength(0);
    detach();
  });

  it("turns where it stands on right-drag, and circles the orbit centre on Alt and right-drag", () => {
    const { controls, fire, detach } = attach({ orbitCenter: () => [0, 0, -2] });
    fire("pointerdown", { pointerType: "mouse", button: 2, clientX: 0, clientY: 0, pointerId: 1 });
    fire("pointermove", { pointerType: "mouse", clientX: 150, clientY: 0 });
    fire("pointerup", { pointerType: "mouse" });
    expect(round(controls.pose().position)).toEqual([0, 0, 0]);
    expect(controls.pose().target[0]).toBeGreaterThan(0);
    controls.reset();
    fire("pointerdown", { pointerType: "mouse", button: 2, altKey: true, clientX: 0, clientY: 0, pointerId: 1 });
    fire("pointermove", { pointerType: "mouse", clientX: 150, clientY: 0 });
    const { position: p, target: t } = controls.pose();
    expect(round(p)).not.toEqual([0, 0, 0]);
    expect(Math.hypot(p[0], p[1], p[2] + 2)).toBeCloseTo(2, 6);
    expect(Math.hypot(t[0] - p[0], t[1] - p[1], t[2] - p[2])).toBeCloseTo(1, 6);
    detach();
  });

  it("zooms on a trackpad's two-finger scroll and a mouse wheel alike", () => {
    const { controls, fire, detach } = attach();
    const distance = () => {
      const { position: p, target: t } = controls.pose();
      return Math.hypot(p[0] - t[0], p[1] - t[1], p[2] - t[2]);
    };
    fire("wheel", { deltaMode: 0, deltaX: 0, deltaY: -40 });
    expect(distance()).toBeLessThan(1);
    controls.reset();
    fire("wheel", { deltaMode: 0, deltaX: 0, deltaY: 100 });
    expect(distance()).toBeGreaterThan(1);
    expect(controls.pose().target).toEqual([0, 0, -1]);
    detach();
  });

  it("moves along the view toward the orbit centre, by a share of the way there", () => {
    const { controls, fire, detach } = attach({ orbitCenter: () => [0, 0, -5] });
    fire("wheel", { deltaMode: 0, deltaX: 0, deltaY: -40 });
    const { position: p, target: t } = controls.pose();
    expect(round(p)).toEqual(round([0, 0, -5 * (1 - Math.exp(-0.06))]));
    expect(t[2] - p[2]).toBeCloseTo(-1, 6);
    detach();
  });
});
