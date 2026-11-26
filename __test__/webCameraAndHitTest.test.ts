/**
 * The web camera reads (onCameraTransformUpdate, getCameraOrientationAsync) and
 * AR hit tests answer in native's shapes.
 */
import type { ArPlaneAnchor, ViroSceneApi } from "@reactvision/viro-web-renderer";
import { cameraOrientation, cameraOrientationAsync } from "../components/Web/viroCameraTransform";
import { activateSceneCamera, cameraView, installDefaultCamera, rayAt, setCameraView, setSceneCameraOrthographic, type CameraView } from "../components/Web/viroDrag";
import { hitTestPlanes } from "../components/Web/viroHitTest";
import { cameraBasis, lookAtEulerDegrees, quatFromEulerDegrees, quatToEulerDegrees } from "../components/Web/viroMath";
import { projectPoint, unprojectPoint } from "../components/Web/viroProjection";

const close = (a: number[], b: number[]) => a.forEach((v, i) => expect(v).toBeCloseTo(b[i]!, 5));

describe("camera reads", () => {
  it("inverts virocore's Euler order", () => {
    for (const e of [[10, 20, 30], [-45, 60, 170], [80, -10, -120]]) {
      close(quatToEulerDegrees(quatFromEulerDegrees(e)), e);
    }
  });

  it("reports a camera turned to look down +X as native does", () => {
    const scene = {} as ViroSceneApi;
    const view: CameraView = {
      position: [1, 1.5, 0],
      orientation: quatFromEulerDegrees([0, -90, 0]),
      fx: 1,
      fy: 1,
      cx: 0,
      cy: 0,
      element: {} as HTMLElement,
    };
    setCameraView(scene, view);
    const now = cameraOrientation(scene)!;
    close(now.position, [1, 1.5, 0]);
    close(now.rotation, [0, -90, 0]);
    close(now.forward, [1, 0, 0]);
    close(now.up, [0, 1, 0]);
  });

  it("rejects where no camera is known", async () => {
    const scene = {} as ViroSceneApi;
    await expect(cameraOrientationAsync(scene)).rejects.toThrow();
  });

  it("reads a camera component's drawn pose, and the default camera once it is released", async () => {
    let drawn = false;
    const scene = {
      setActiveCameraNode: jest.fn(),
      createNode: () => 99,
      setNodeCamera: () => {},
      addChildNode: () => {},
      getNodeWorldTransform: () =>
        drawn ? { position: [0, 4, -3], rotation: [-90, 0, 0], scale: [1, 1, 1] } : { position: [0, 0, 0], rotation: [0, 0, 0], scale: [0, 0, 0] },
    } as unknown as ViroSceneApi;
    setCameraView(scene, { position: [0, 0, 0], orientation: [0, 0, 0, 1], fx: 1, fy: 1, cx: 0, cy: 0, element: { clientWidth: 2, clientHeight: 2 } as HTMLElement });
    installDefaultCamera(scene, 1);
    const release = activateSceneCamera(scene, 7);
    expect(scene.setActiveCameraNode).toHaveBeenLastCalledWith(7);
    // Not drawn yet: unknown rather than the origin.
    await expect(cameraOrientationAsync(scene)).rejects.toThrow();
    drawn = true;
    const now = await cameraOrientationAsync(scene);
    close(now.position, [0, 4, -3]);
    close(now.forward, [0, -1, 0]);
    release();
    expect(scene.setActiveCameraNode).toHaveBeenLastCalledWith(99);
    await expect(cameraOrientationAsync(scene)).resolves.toMatchObject({ position: [0, 0, 0] });
  });

  it("goes to the default camera, not an earlier one, when the drawing camera is released", () => {
    const scene = { setActiveCameraNode: jest.fn(), createNode: () => 99, setNodeCamera: () => {}, addChildNode: () => {} } as unknown as ViroSceneApi;
    installDefaultCamera(scene, 1);
    const releaseA = activateSceneCamera(scene, 7);
    const releaseB = activateSceneCamera(scene, 8);
    releaseA();
    expect(scene.setActiveCameraNode).toHaveBeenLastCalledWith(8);
    releaseB();
    expect(scene.setActiveCameraNode).toHaveBeenLastCalledWith(99);
  });

  it("does not report an orthographic camera component", async () => {
    const scene = {
      setActiveCameraNode: () => {},
      getNodeWorldTransform: () => ({ position: [0, 1, 0], rotation: [0, 0, 0], scale: [1, 1, 1] }),
    } as unknown as ViroSceneApi;
    setCameraView(scene, { position: [0, 0, 0], orientation: [0, 0, 0, 1], fx: 1, fy: 1, cx: 0, cy: 0, element: {} as HTMLElement });
    activateSceneCamera(scene, 7);
    setSceneCameraOrthographic(scene, 7, true);
    jest.spyOn(console, "warn").mockImplementation(() => {});
    await expect(cameraOrientationAsync(scene)).rejects.toThrow();
  });

  it("in AR, reads a camera component where it stands, turned by the device, through the device's projection", async () => {
    let transform = { position: [0, 1, 0], rotation: [0, 90, 0], scale: [1, 1, 1] };
    const scene = {
      setActiveCameraNode: () => {},
      getNodeWorldTransform: () => transform,
    } as unknown as ViroSceneApi;
    const element = { getBoundingClientRect: () => ({ left: 0, top: 0 }) } as HTMLElement;
    const device: CameraView = { position: [5, 5, 5], orientation: [0, 0, 0, 1], fx: 300, fy: 300, cx: 200, cy: 100, element, ar: true };
    setCameraView(scene, device);
    const release = activateSceneCamera(scene, 7);
    // AR projects through the device whatever the camera asks for.
    setSceneCameraOrthographic(scene, 7, true);
    const view = cameraView(scene)!;
    expect(view).toMatchObject({ fx: 300, fy: 300, cx: 200, cy: 100 });
    close(view.position, [0, 1, 0]);
    close(rayAt(view, 200, 100).dir, [-1, 0, 0]);
    // A drag keeps the view it started with, so later moves must reach it.
    device.orientation = quatFromEulerDegrees([90, 0, 0]);
    transform = { position: [2, 0, 0], rotation: [0, 90, 0], scale: [1, 1, 1] };
    close(view.position, [2, 0, 0]);
    // The device's pitch first, then the node's yaw, as virocore composes them.
    close(rayAt(view, 200, 100).dir, [0, 1, 0]);
    const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
    warn.mockClear();
    close((await cameraOrientationAsync(scene)).forward, [0, 1, 0]);
    expect(warn).not.toHaveBeenCalled();
    setSceneCameraOrthographic(scene, 7, false);
    release();
    await expect(cameraOrientationAsync(scene)).resolves.toMatchObject({ position: [5, 5, 5] });
  });

  it("aims an orbit camera at its focal point", () => {
    for (const [from, to] of [[[3, 4, 5], [0, 0, 0]], [[2, 1, 0], [0.8, -0.4, -3]], [[3, 0, 0], [0, 0, 0]], [[0, 0, 3], [0, 0, 0]]]) {
      const d = to!.map((v, i) => v - from![i]!);
      const n = Math.hypot(...d);
      close(cameraBasis(quatFromEulerDegrees(lookAtEulerDegrees(from!, to!))).forward, d.map((v) => v / n));
    }
  });
});

describe("AR hit tests", () => {
  const floor: ArPlaneAnchor = {
    id: "floor",
    center: [0, -1, -2],
    normal: [0, 1, 0],
    rotation: [0, 0, 0],
    width: 1,
    height: 1,
    alignment: "Horizontal",
    confidence: 1,
  };
  const wall: ArPlaneAnchor = {
    id: "wall",
    center: [0, 0, -5],
    normal: [0, 0, 1],
    rotation: [90, 0, 0],
    width: 4,
    height: 2,
    alignment: "Vertical",
    confidence: 1,
  };

  it("returns native results, nearest first, typed by the plane's extent", () => {
    const down = hitTestPlanes([wall, floor], [0, 0, 0], [0, -1, -2]);
    expect(down.map((r) => r.type)).toEqual(["ExistingPlaneUsingExtent", "ExistingPlane"]);
    close(down[0]!.transform.position, [0, -1, -2]);
    expect(down[0]).toMatchObject({ transform: { rotation: [0, 0, 0], scale: [1, 1, 1] }, hasDepthData: false });

    // On the wall within its 4 x 2 rectangle: local Z is world -Y after its 90-degree turn.
    const ahead = hitTestPlanes([wall], [0, 0, 0], [0.3, 0.9, -5]);
    expect(ahead[0]!.type).toBe("ExistingPlaneUsingExtent");
    expect(hitTestPlanes([wall], [0, 0, 0], [0.3, 1.1, -5])[0]!.type).toBe("ExistingPlane");
  });

  it("stops at maxDistance and ignores planes behind the ray", () => {
    expect(hitTestPlanes([floor, wall], [0, 0, 0], [0, -1, -2], 2)).toHaveLength(0);
    expect(hitTestPlanes([floor], [0, 0, 0], [0, 1, 0])).toHaveLength(0);
  });
});

describe("navigator project and unproject", () => {
  const turned = (): ViroSceneApi => {
    const scene = {} as ViroSceneApi;
    setCameraView(scene, {
      position: [1, 1.5, 0],
      orientation: quatFromEulerDegrees([0, -90, 0]),
      fx: 400,
      fy: 400,
      cx: 300,
      cy: 200,
      element: {} as HTMLElement,
    });
    return scene;
  };

  it("projects a point ahead of a turned camera to the view's centre, with +Y up the screen", () => {
    const scene = turned();
    close(projectPoint(scene, [3, 1.5, 0]).screenPosition, [300, 200]);
    close(projectPoint(scene, [3, 2, 0]).screenPosition, [300, 100]);
  });

  it("unprojects along the ray, from the near plane at depth 0 to the far plane at 1", () => {
    const scene = turned();
    close(unprojectPoint(scene, [300, 200, 0]).position, [1.02, 1.5, 0]);
    close(unprojectPoint(scene, [300, 200, 1]).position, [51.01, 1.5, 0]);
    const back = unprojectPoint(scene, [...projectPoint(scene, [3, 2, 0.5]).screenPosition, 0.5]).position;
    // Same ray from the camera as the point that was projected.
    const ray = [back[0] - 1, back[1] - 1.5, back[2] - 0];
    close([ray[1] / ray[0], ray[2] / ray[0]], [0.25, 0.25]);
  });

  it("rejects while no camera is known", () => {
    expect(() => projectPoint({} as ViroSceneApi, [0, 0, -1])).toThrow("camera's pose");
  });
});
