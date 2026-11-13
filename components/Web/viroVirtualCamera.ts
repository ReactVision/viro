/**
 * A camera the viewer moves with the mouse or two fingers, standing in for the
 * device pose when an AR scene is previewed without a camera or tracking (a
 * desktop browser). The pose goes to virocore through the same `arSetPose` a
 * live session feeds, so the scene renders exactly as it would at that pose.
 *
 * Input that belongs to the scene is left alone: a primary-button press or a
 * single finger is a tap or drag on the content, as on a phone. Only
 * right/middle-button drags, the wheel and two-finger gestures move the camera,
 * and those are stopped in the capture phase so virocore never sees them as
 * touches.
 */
import { ViroTrackingState, type ViroSceneApi } from "@reactvision/viro-web-renderer";
import { setCameraView, type CameraView } from "./viroDrag";

type Vec3 = [number, number, number];
type Quat = [number, number, number, number];

export type ViroVirtualCameraOptions = {
  /** The point the camera orbits. Default [0, 0, -1], one metre ahead of the session origin. */
  target?: Vec3;
  /**
   * Height of the floor handed to ViroARPlane as a detected horizontal plane.
   * Default -1. `null` reports no plane.
   */
  floorY?: number | null;
  /** Receives the camera's controls once it is driving the scene. */
  onReady?: (controls: ViroVirtualCameraControls) => void;
};

export type ViroVirtualCameraControls = {
  /** Returns the camera to its starting pose. */
  reset(): void;
  /** Puts the camera at `position`, looking at `target`, which it then orbits. */
  lookFrom(position: Vec3, target: Vec3): void;
};

const LONG_AXIS_FOV_DEG = 67;
const MIN_DISTANCE = 0.05;
const MAX_DISTANCE = 50;
const MAX_PITCH = Math.PI / 2 - 0.01;

function quatFromYawPitch(yaw: number, pitch: number): Quat {
  // q = qYaw (about +Y) * qPitch (about +X); identity looks down -Z.
  const cy = Math.cos(yaw / 2), sy = Math.sin(yaw / 2);
  const cp = Math.cos(pitch / 2), sp = Math.sin(pitch / 2);
  return [cy * sp, sy * cp, -sy * sp, cy * cp];
}

function rotate(q: Quat, v: Vec3): Vec3 {
  const [x, y, z, w] = q;
  const tx = 2 * (y * v[2] - z * v[1]);
  const ty = 2 * (z * v[0] - x * v[2]);
  const tz = 2 * (x * v[1] - y * v[0]);
  return [
    v[0] + w * tx + (y * tz - z * ty),
    v[1] + w * ty + (z * tx - x * tz),
    v[2] + w * tz + (x * ty - y * tx),
  ];
}

export function floorAnchorFor(floorY: number) {
  return {
    id: "viro-virtual-floor",
    // Two metres ahead, so content placed on it is in view from the start pose.
    center: [0, floorY, -2] as Vec3,
    normal: [0, 1, 0] as Vec3,
    rotation: [0, 0, 0] as Vec3,
    width: 4,
    height: 4,
    alignment: "HorizontalUpward" as const,
    confidence: 1,
  };
}

/**
 * Starts driving the AR camera from `element`'s input. The starting pose is the
 * session origin looking down -Z, which is where a phone's camera is when a
 * session starts. Returns a detach function.
 */
export function attachVirtualCamera(
  scene: ViroSceneApi,
  element: HTMLElement,
  options: ViroVirtualCameraOptions = {},
): () => void {
  const home = options.target ?? [0, 0, -1];
  let target: Vec3 = [...home];
  // The origin sits `distance` behind the target along +Z: start there.
  let distance = Math.hypot(home[0], home[1], home[2]) || 1;
  let yaw = 0;
  let pitch = 0;

  // Until initAR() the scene draws through its default camera and ignores
  // injected poses; a live session calls it when it starts.
  scene.initAR();
  // Published for dragging, which has to cast its own rays: the renderer cannot report the camera.
  const view: CameraView = { position: [0, 0, 0], orientation: [0, 0, 0, 1], fx: 1, fy: 1, cx: 0, cy: 0, element };
  setCameraView(scene, view);
  const sizeCamera = () => {
    const w = Math.max(1, Math.round(element.clientWidth));
    const h = Math.max(1, Math.round(element.clientHeight));
    // A phone camera's long axis spans about 67 degrees (ARKit's 1920x1440
    // format has fx near 1440), and a phone held upright shows all of it
    // vertically. The session's 60-degree default cuts off content a device shows.
    const f = Math.max(w, h) / 2 / Math.tan((LONG_AXIS_FOV_DEG * Math.PI) / 360);
    if (scene.arSetCameraIntrinsics(f, f, w / 2, h / 2, w, h)) {
      Object.assign(view, { fx: f, fy: f, cx: w / 2, cy: h / 2 });
    } else {
      scene.arSetCameraImageSize(w, h);
      // The image-size path projects through a fixed 60-degree vertical field of view.
      const f60 = h / 2 / Math.tan(Math.PI / 6);
      Object.assign(view, { fx: f60, fy: f60, cx: w / 2, cy: h / 2 });
    }
  };
  sizeCamera();
  const resizeObserver = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(sizeCamera);
  resizeObserver?.observe(element);

  const apply = () => {
    const q = quatFromYawPitch(yaw, pitch);
    const back = rotate(q, [0, 0, distance]);
    view.orientation = q;
    view.position = [target[0] + back[0], target[1] + back[1], target[2] + back[2]];
    scene.arSetPose(
      q[0], q[1], q[2], q[3],
      view.position[0], view.position[1], view.position[2],
      ViroTrackingState.Normal,
    );
  };

  const reset = () => {
    target = [...home];
    distance = Math.hypot(home[0], home[1], home[2]) || 1;
    yaw = 0;
    pitch = 0;
    apply();
  };

  const lookFrom = (position: Vec3, to: Vec3) => {
    const back: Vec3 = [position[0] - to[0], position[1] - to[1], position[2] - to[2]];
    const d = Math.hypot(back[0], back[1], back[2]);
    if (!(d > 0)) return;
    target = [...to];
    distance = Math.max(MIN_DISTANCE, Math.min(MAX_DISTANCE, d));
    // The inverse of apply(): back = yaw(pitch([0, 0, distance])).
    yaw = Math.atan2(back[0], back[2]);
    pitch = Math.max(-MAX_PITCH, Math.min(MAX_PITCH, -Math.asin(back[1] / d)));
    apply();
  };

  const orbit = (dx: number, dy: number) => {
    const scale = Math.PI / Math.max(element.clientHeight, 1);
    yaw -= dx * scale;
    pitch = Math.max(-MAX_PITCH, Math.min(MAX_PITCH, pitch - dy * scale));
    apply();
  };

  const pan = (dx: number, dy: number) => {
    const q = quatFromYawPitch(yaw, pitch);
    const perPixel = (2 * distance * Math.tan(Math.PI / 6)) / Math.max(element.clientHeight, 1);
    const right = rotate(q, [1, 0, 0]);
    const up = rotate(q, [0, 1, 0]);
    for (let i = 0; i < 3; i++) target[i] += (-dx * right[i] + dy * up[i]) * perPixel;
    apply();
  };

  const dolly = (factor: number) => {
    distance = Math.max(MIN_DISTANCE, Math.min(MAX_DISTANCE, distance * factor));
    apply();
  };

  // Mouse: right or middle drag, or shift and left drag to pan. Touch: two
  // fingers (orbit with their midpoint, pinch to zoom).
  let mouse: { x: number; y: number; pan: boolean } | null = null;
  const touches = new Map<number, { x: number; y: number }>();
  let twoFinger: { x: number; y: number; spread: number } | null = null;

  const midpoint = () => {
    const [a, b] = [...touches.values()];
    return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, spread: Math.hypot(a.x - b.x, a.y - b.y) };
  };

  const stop = (e: Event) => {
    e.stopPropagation();
    e.preventDefault();
  };

  const onDown = (e: PointerEvent) => {
    if (e.pointerType === "touch") {
      touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (touches.size === 2) {
        twoFinger = midpoint();
        // The first finger already reached virocore as a touch down; end it so
        // the scene does not see a drag that is really a camera gesture.
        element.querySelector("canvas")?.dispatchEvent(
          new PointerEvent("pointercancel", { pointerId: e.pointerId, clientX: e.clientX, clientY: e.clientY }),
        );
      }
      if (touches.size >= 2) stop(e);
      return;
    }
    const shiftPan = e.button === 0 && e.shiftKey;
    if (e.button !== 1 && e.button !== 2 && !shiftPan) return;
    mouse = { x: e.clientX, y: e.clientY, pan: e.button === 1 || e.shiftKey };
    stop(e);
    try {
      element.setPointerCapture(e.pointerId);
    } catch {
      // No active pointer with that id (a synthesized event); drag without capture.
    }
  };

  const onMove = (e: PointerEvent) => {
    if (e.pointerType === "touch") {
      if (!touches.has(e.pointerId)) return;
      touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (touches.size >= 2 && twoFinger) {
        const now = midpoint();
        orbit(now.x - twoFinger.x, now.y - twoFinger.y);
        if (twoFinger.spread > 0 && now.spread > 0) dolly(twoFinger.spread / now.spread);
        twoFinger = now;
        stop(e);
      }
      return;
    }
    if (!mouse) return;
    const dx = e.clientX - mouse.x;
    const dy = e.clientY - mouse.y;
    mouse.x = e.clientX;
    mouse.y = e.clientY;
    if (mouse.pan || e.shiftKey) pan(dx, dy);
    else orbit(dx, dy);
    stop(e);
  };

  const onUp = (e: PointerEvent) => {
    if (e.pointerType === "touch") {
      const wasGesture = touches.size >= 2;
      touches.delete(e.pointerId);
      if (touches.size < 2) twoFinger = null;
      if (wasGesture) stop(e);
      return;
    }
    if (!mouse) return;
    mouse = null;
    stop(e);
  };

  const onWheel = (e: WheelEvent) => {
    dolly(Math.exp(e.deltaY * 0.0015));
    e.preventDefault();
  };

  const onContextMenu = (e: Event) => e.preventDefault();

  element.addEventListener("pointerdown", onDown, true);
  element.addEventListener("pointermove", onMove, true);
  element.addEventListener("pointerup", onUp, true);
  element.addEventListener("pointercancel", onUp, true);
  element.addEventListener("wheel", onWheel, { passive: false });
  element.addEventListener("contextmenu", onContextMenu);
  apply();
  options.onReady?.({ reset, lookFrom });

  return () => {
    setCameraView(scene, null);
    resizeObserver?.disconnect();
    element.removeEventListener("pointerdown", onDown, true);
    element.removeEventListener("pointermove", onMove, true);
    element.removeEventListener("pointerup", onUp, true);
    element.removeEventListener("pointercancel", onUp, true);
    element.removeEventListener("wheel", onWheel);
    element.removeEventListener("contextmenu", onContextMenu);
  };
}
