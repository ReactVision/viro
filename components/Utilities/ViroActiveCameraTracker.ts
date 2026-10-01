import { findNodeHandle } from "react-native";
import type { ViroCamera } from "../ViroCamera";
import type { ViroOrbitCamera } from "../ViroOrbitCamera";

export type ViroSceneCamera = ViroCamera | ViroOrbitCamera;

/**
 * What a scene hands its cameras through `ViroSceneContext`. A `ViroCamera` or
 * `ViroOrbitCamera` reports its mount, its unmount and every change of `active`.
 */
export type ViroSceneCameraCallbacks = {
  cameraDidMount: (camera: ViroSceneCamera) => void;
  cameraWillUnmount: (camera: ViroSceneCamera) => void;
  cameraDidUpdate: (camera: ViroSceneCamera, active: boolean) => void;
};

/**
 * Decides which camera a scene draws from, and tells the scene when that changes.
 *
 * The scene used to forward each camera report to `VRTCameraModule` as it arrived, and the
 * module looked the camera's view up in the native view registry. Under the New Architecture
 * that lookup can fail: React Native's legacy interop holds back a child inserted anywhere but
 * at the end of its parent until that parent next updates, so a camera mounted between its
 * siblings — a remount through a new `key`, a conditional camera mid-scene — has no native
 * view to find. The module gave up after a second and the scene stayed on its default camera.
 *
 * The tracker resolves the active camera to its React tag and hands that to the scene, which
 * passes it to the native scene as the `activeCameraTag` prop. That prop change is itself the
 * parent update the interop was waiting for, so the camera's view is inserted before the
 * native scene reads the tag; and the native scene keeps the tag, so a camera that joins the
 * tree later still attaches. The last camera to become active wins, as before.
 */
export class ViroActiveCameraTracker implements ViroSceneCameraCallbacks {
  private _activeTag: number | null = null;
  private readonly _onChange: (activeTag: number | null) => void;

  constructor(onChange: (activeTag: number | null) => void) {
    this._onChange = onChange;
  }

  /** The React tag of the camera the scene should draw from, or null for its default camera. */
  get activeTag(): number | null {
    return this._activeTag;
  }

  cameraDidMount = (camera: ViroSceneCamera) => {
    if (camera.props.active) {
      this._activate(camera);
    }
  };

  cameraWillUnmount = (camera: ViroSceneCamera) => {
    this._deactivate(camera);
  };

  cameraDidUpdate = (camera: ViroSceneCamera, active: boolean) => {
    if (active) {
      this._activate(camera);
    } else {
      this._deactivate(camera);
    }
  };

  private _activate(camera: ViroSceneCamera) {
    const tag = findNodeHandle(camera);
    if (tag == null || tag === this._activeTag) {
      return;
    }
    this._activeTag = tag;
    this._onChange(tag);
  }

  // Only the camera the scene draws from can clear the tag: a camera that lost the slot to a
  // later active one, or was never active, leaves it alone.
  private _deactivate(camera: ViroSceneCamera) {
    const tag = findNodeHandle(camera);
    if (tag == null || tag !== this._activeTag) {
      return;
    }
    this._activeTag = null;
    this._onChange(null);
  }
}
