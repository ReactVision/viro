/**
 * The navigators' project and unproject on the web, worked out from the camera
 * the navigator publishes (viroDrag) the way VRORenderer::projectPoint and
 * unprojectPoint do. Screen points are in the canvas's CSS pixels from its top
 * left, the space pointer events use.
 */
import type { ViroSceneApi, ViroWebRenderer } from "@reactvision/viro-web-renderer";
import { cameraView, type CameraView, type Vec3 } from "./viroDrag";
import { rotateByQuaternion } from "./viroMath";

// virocore's kZNear and kZFar. Its far plane grows past 50 m for a scene that
// reaches further, which the web cannot read, so unproject's depth assumes 50.
const NEAR = 0.01;
const FAR = 50;

export function requireScene(renderer: ViroWebRenderer | null): ViroSceneApi {
  if (!renderer) throw new Error("[Viro web] The renderer has not started yet.");
  return renderer.scene;
}

function currentView(scene: ViroSceneApi): CameraView {
  const view = cameraView(scene);
  if (!view) {
    throw new Error(
      "[Viro web] project and unproject need the camera's pose, which is not known before the AR session starts or while a ViroCamera is the point of view.",
    );
  }
  return view;
}

export function projectPoint(scene: ViroSceneApi, point: readonly number[]): { screenPosition: [number, number] } {
  const view = currentView(scene);
  const [x, y, z, w] = view.orientation;
  const offset: Vec3 = [point[0] - view.position[0], point[1] - view.position[1], point[2] - view.position[2]];
  const local = rotateByQuaternion([-x, -y, -z, w], offset);
  return {
    screenPosition: [view.cx + (view.fx * local[0]) / -local[2], view.cy - (view.fy * local[1]) / -local[2]],
  };
}

/** `point[2]` runs from 0 at the near plane to 1 at the far plane, as on native. */
export function unprojectPoint(scene: ViroSceneApi, point: readonly number[]): { position: Vec3 } {
  const view = currentView(scene);
  const dir = rotateByQuaternion(view.orientation, [(point[0] - view.cx) / view.fx, -(point[1] - view.cy) / view.fy, -1]);
  const len = Math.hypot(dir[0], dir[1], dir[2]);
  const along = NEAR + (point[2] ?? 0) * (FAR - NEAR);
  return {
    position: [0, 1, 2].map((i) => view.position[i] + dir[i] * NEAR + (dir[i] / len) * along) as Vec3,
  };
}
