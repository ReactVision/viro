/**
 * The web camera reads (onCameraTransformUpdate, getCameraOrientationAsync) and
 * AR hit tests answer in native's shapes.
 */
import type { ArPlaneAnchor, ViroSceneApi } from "@reactvision/viro-web-renderer";
import { cameraOrientation, cameraOrientationAsync } from "../components/Web/viroCameraTransform";
import { holdCustomCamera, setCameraView, type CameraView } from "../components/Web/viroDrag";
import { hitTestPlanes } from "../components/Web/viroHitTest";
import { quatFromEulerDegrees, quatToEulerDegrees } from "../components/Web/viroMath";
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
    setCameraView(scene, { position: [0, 0, 0], orientation: [0, 0, 0, 1], fx: 1, fy: 1, cx: 0, cy: 0, element: {} as HTMLElement });
    const release = holdCustomCamera(scene);
    jest.spyOn(console, "warn").mockImplementation(() => {});
    await expect(cameraOrientationAsync(scene)).rejects.toThrow();
    release();
    await expect(cameraOrientationAsync(scene)).resolves.toMatchObject({ position: [0, 0, 0] });
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
