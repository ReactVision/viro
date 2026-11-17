/**
 * The preview's camera for a 3D scene: a camera node of its own that the mouse
 * moves, which stands aside while the scene makes one of its own ViroCameras
 * the point of view.
 */
import type { ViroSceneApi } from "@reactvision/viro-web-renderer";
import { cameraView } from "../components/Web/viroDrag";
import { setSceneCameraActive } from "../components/Web/viroSceneCameras";
import { attachVirtualCamera3D } from "../components/Web/viroVirtualCamera";

function fakeScene() {
  const calls: string[] = [];
  let next = 100;
  const scene = {
    createNode: () => next++,
    setNodeCamera: (n: number) => calls.push(`camera ${n}`),
    addChildNode: () => {},
    removeNodeFromParent: () => {},
    destroyNode: (n: number) => calls.push(`destroy ${n}`),
    setActiveCameraNode: (n: number) => calls.push(`active ${n}`),
    setNodePosition: (n: number, x: number, y: number, z: number) => calls.push(`position ${n} ${[x, y, z].map((v) => +v.toFixed(3)).join(",")}`),
    setNodeRotation: (n: number, x: number, y: number) => calls.push(`rotation ${n} ${+x.toFixed(3)},${+y.toFixed(3)}`),
  } as unknown as ViroSceneApi;
  return { scene, calls };
}

const element = {
  clientWidth: 800,
  clientHeight: 600,
  addEventListener: () => {},
  removeEventListener: () => {},
  querySelector: () => null,
} as unknown as HTMLElement;

describe("attachVirtualCamera3D", () => {
  it("makes its own camera the point of view at the origin, with the renderer's 90-degree field", () => {
    const { scene, calls } = fakeScene();
    const ready = jest.fn();
    const detach = attachVirtualCamera3D(scene, 1, element, { onReady: ready });
    expect(calls).toContain("active 100");
    expect(calls).toContain("position 100 0,0,0");
    expect(ready).toHaveBeenCalled();
    expect(cameraView(scene)).toMatchObject({ fx: 400, fy: 400, cx: 400, cy: 300 });
    // Looking from the right of the target turns the camera +90 degrees about Y.
    ready.mock.calls[0][0].lookFrom([1, 0, -1], [0, 0, -1]);
    expect(calls[calls.length - 1]).toBe(`rotation 100 0,${+(Math.PI / 2).toFixed(3)}`);
    detach();
    expect(calls).toContain("destroy 100");
    expect(cameraView(scene)).toBeNull();
  });

  it("stands aside while the scene's own camera is active, and takes over again after", () => {
    const { scene, calls } = fakeScene();
    const detach = attachVirtualCamera3D(scene, 1, element);
    setSceneCameraActive(scene, 7, true);
    expect(cameraView(scene)).toBeNull();
    calls.length = 0;
    setSceneCameraActive(scene, 7, false);
    expect(calls).toEqual(["active 100"]);
    expect(cameraView(scene)).not.toBeNull();
    detach();
  });

  it("starts aside when the scene's camera is already active", () => {
    const { scene, calls } = fakeScene();
    setSceneCameraActive(scene, 7, true);
    const ready = jest.fn();
    const detach = attachVirtualCamera3D(scene, 1, element, { onReady: ready });
    expect(calls).not.toContain("active 100");
    expect(ready).not.toHaveBeenCalled();
    expect(cameraView(scene)).toBeNull();
    detach();
  });
});
