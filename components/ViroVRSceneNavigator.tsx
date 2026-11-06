/**
 * Copyright (c) 2018-present, Viro Media, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule ViroVRSceneNavigator
 * @flow
 */

import * as React from "react";
import {
  findNodeHandle,
  NativeModules,
  NativeSyntheticEvent,
  requireNativeComponent,
  StyleSheet,
  Text,
  View,
  ViewProps,
} from "react-native";
import {
  ViroExitViroEvent,
  ViroHandUpdateEvent,
} from "./Types/ViroEvents";
import {
  Viro3DPoint,
  ViroNativeRef,
  ViroScene,
  ViroSceneDictionary,
} from "./Types/ViroUtils";
import { withoutRootTag } from "./Utilities/ViroAppProps";
import { isVisionOS } from "./Utilities/ViroPlatform";
import { warnUnsupported } from "./Utilities/ViroUnsupported";
import { VRCapture } from "./Utilities/VRModuleOpenXR";
import {
  sendViroUsagePing,
  ViroUsagePingSuppressed,
} from "./Utilities/ViroUsagePing";
const ViroSceneNavigatorModule = NativeModules.VRTSceneNavigatorModule;
const VRModuleOpenXR = NativeModules.VRModuleOpenXR as {
  recenterTracking: (viewTag: number) => void;
  setPassthroughEnabled: (viewTag: number, enabled: boolean) => void;
} | undefined;

type State = {
  sceneDictionary: ViroSceneDictionary;
  sceneHistory: string[];
  currentSceneIndex: number;
};

var mathRandomOffset = 0;

type Props = ViewProps & {
  /**
   * Calling vrModeEnabled allows switching to and from VR mode.
   * When set to false, it transitions back to pre-VR (mono) mode.
   * When set to true, we set thie view into a full VR mode.
   * This is set to true by default.
   */
  vrModeEnabled?: boolean;

  initialSceneKey?: string;

  autofocus?: boolean;

  /**
   * A flag to enable/disable some debug features
   */
  debug?: boolean;

  /**
   * ViroSceneNavigator uses "scene" objects like the following to
   * describe a scene.
   */
  initialScene?: {
    scene: () => React.JSX.Element;
  };

  /**
   * Called when either the user physically decides to exit vr (hits
   * the "X" buton).
   */
  onExitViro?: () => void;

  viroAppProps?: any; // TODO: what is the type of this?
  /**
   * Renderer settings that can be used to enable or disable various
   * renderer capabilities and algorithms.
   */
  hdrEnabled?: boolean;
  pbrEnabled?: boolean;
  bloomEnabled?: boolean;
  shadowsEnabled?: boolean;
  multisamplingEnabled?: boolean;

  /** Enable XR_FB_passthrough mixed-reality camera feed (Quest 3 / Quest Pro). */
  passthroughEnabled?: boolean;

  /**
   * Enable skeletal hand tracking (Quest only; needs horizonos.permission.HAND_TRACKING in the manifest, which the Expo plugin declares for Quest builds).
   * Pinch and grab gestures fire the same onClick/onDrag events as controller buttons.
   */
  handTrackingEnabled?: boolean;

  /**
   * Hand occlusion for Meta Quest passthrough: the tracked hands are drawn
   * depth-only before the scene, so the real (passthrough) hands show through
   * virtual content in front of them. Only draws while `passthroughEnabled`
   * and `handTrackingEnabled` are both on; otherwise a no-op. Quest only.
   * Defaults to false.
   */
  handOcclusion?: boolean;

  /**
   * Geometry used for hand occlusion. `"mesh"` (default) uses the runtime's
   * hand mesh (XR_FB_hand_tracking_mesh) and falls back to `"capsules"` when
   * that extension is unavailable; `"capsules"` approximates each bone with a
   * capsule.
   */
  handOcclusionMode?: "capsules" | "mesh";

  /**
   * How far the hand occluder is inflated past the tracked hand, in
   * millimetres, to hide tracking error at the edges. Defaults to 2.
   */
  handOcclusionInflateMm?: number;

  /**
   * Per-frame skeletal hand joint data. Fires at display refresh rate (72/90 Hz).
   * null for a hand means it is not currently tracked.
   */
  onHandUpdate?: (event: NativeSyntheticEvent<ViroHandUpdateEvent>) => void;
};

/**
 * ViroVRSceneNavigator is used to transition between multiple scenes.
 * Intended for OVR / Google Cardboard VR mode on non-Quest Android devices.
 * On Meta Quest use ViroXRSceneNavigator instead.
 */
export class ViroVRSceneNavigator extends React.Component<Props, State> {
  _component: ViroNativeRef = null;

  static contextType = ViroUsagePingSuppressed;
  declare context: React.ContextType<typeof ViroUsagePingSuppressed>;

  componentDidMount() {
    if (!this.context) {
      sendViroUsagePing("vr", {
        vr_mode_enabled: this.props.vrModeEnabled,
        passthrough_enabled: this.props.passthroughEnabled,
        hand_tracking_enabled: this.props.handTrackingEnabled,
      });
    }
  }

  /**
   * Called from native when either the user physically decides to exit vr (hits
   * the "X" buton).
   */
  _onExitViro = (_event: NativeSyntheticEvent<ViroExitViroEvent>) => {
    this.props.onExitViro && this.props.onExitViro();
  };

  constructor(props: Props) {
    super(props);
    let initialSceneTag = props.initialSceneKey;
    if (initialSceneTag == null) {
      initialSceneTag = this.getRandomTag();
    }
    const scene = {
      sceneClass: props.initialScene,
      tag: initialSceneTag,
      referenceCount: 1,
    };
    const sceneDict: ViroSceneDictionary = {};
    sceneDict[scene.tag] = scene;
    this.state = {
      sceneDictionary: sceneDict,
      sceneHistory: [scene.tag],
      currentSceneIndex: 0,
    };
  }

  getRandomTag() {
    var randomTag = Math.random() + mathRandomOffset;
    mathRandomOffset++;
    return randomTag.toString();
  }

  /**
   * Pushes a scene and reference it with the given key if provided.
   * If the scene has been previously pushed, we simply show the scene again.
   * Note that the back history order of which scenes were pushed is preserved.
   * Also note that scenes are reference counted and only a unique set of
   * scenes are stored and mapped to within sceneDictionary.
   *
   * Can take in either 1 or two parameters in the form:
   * push ("sceneKey");
   * push ("sceneKey", scene);
   * push (scene);
   *
   * @todo: use Typescript function overloading rather than this inaccurate solution
   */
  push = (param1?: ViroScene | string, param2?: ViroScene) => {
    var sceneKey = undefined;
    var scene = undefined;
    if (typeof param1 == "string") {
      sceneKey = param1;
      scene = param2;
    } else {
      scene = param1;
    }

    if (scene == undefined && sceneKey == undefined) {
      console.log(
        "ERROR: pushing requires either the scene tag, or both the tag and scene."
      );
      return;
    } else if (
      scene == undefined &&
      sceneKey != undefined &&
      !(sceneKey in this.state.sceneDictionary)
    ) {
      console.log(
        "ERROR: Cannot push with a new sceneKey with no associated scene."
      );
      return;
    }

    if (
      sceneKey == undefined ||
      (typeof sceneKey == "string" && sceneKey.trim().length <= 0)
    ) {
      sceneKey = this.getRandomTag();
    }

    this.incrementSceneReference(scene as ViroScene, sceneKey, false);
    this.addToHistory(sceneKey);
  };

  /**
   * Replace the top scene in the stack with the given scene. The remainder of the back
   * history is kept in the same order as before.
   *
   * Can take in either 1 or two parameters in the form:
   * replace ("sceneKey");
   * replace ("sceneKey", scene);
   * replace (scene);
   *
   * @todo: use Typescript function overloading rather than this inaccurate solution
   */
  replace = (param1?: ViroScene | string, param2?: ViroScene) => {
    var sceneKey = undefined;
    var scene = undefined;
    if (typeof param1 == "string") {
      sceneKey = param1;
      scene = param2;
    } else {
      scene = param1;
    }

    if (scene == undefined && sceneKey == undefined) {
      console.log(
        "ERROR: replacing requires either the scene tag, or both the tag and scene."
      );
      return;
    } else if (
      scene == undefined &&
      sceneKey != undefined &&
      !(sceneKey in this.state.sceneDictionary)
    ) {
      console.log(
        "ERROR: Cannot replace with a new sceneKey with no associated scene."
      );
      return;
    }

    if (
      sceneKey == undefined ||
      (typeof sceneKey == "string" && sceneKey.trim().length <= 0)
    ) {
      sceneKey = this.getRandomTag();
    }

    // The scene being replaced is released below, so keep its definition for
    // when the same key is re-added.
    if (scene == undefined) {
      scene = this.state.sceneDictionary[sceneKey]?.sceneClass;
    }

    // Pop 1 off the scene history (do not use popN because in this case we allow
    // popping the root), then push this scene
    this.decrementReferenceForLastNScenes(1);
    this.popHistoryByN(1);
    this.incrementSceneReference(scene as ViroScene, sceneKey, false);
    this.addToHistory(sceneKey);
  };

  /**
   * Jumps to a given scene that had been previously pushed. If the scene was not pushed, we
   * then push and jump to it. The back history is re-ordered such that jumped to scenes are
   * re-ordered to the front. As such, only the back order of sequential jumps are preserved.
   *
   * Can take in either 1 or two parameters in the form:
   * jump ("sceneKey");
   * jump ("sceneKey", scene);
   * jump (scene);
   *
   * @todo: use Typescript function overloading rather than this inaccurate solution
   */
  jump = (param1?: ViroScene | string, param2?: ViroScene) => {
    var sceneKey = undefined;
    var scene = undefined;
    if (typeof param1 == "string") {
      sceneKey = param1;
      scene = param2;
    } else {
      scene = param1;
    }

    if (scene == undefined && sceneKey == undefined) {
      console.log(
        "ERROR: jumping requires either the scene tag, or both the tag and scene."
      );
      return;
    } else if (
      scene == undefined &&
      sceneKey != undefined &&
      !(sceneKey in this.state.sceneDictionary)
    ) {
      console.log(
        "ERROR: Cannot jump with a new sceneKey with no associated scene."
      );
      return;
    }

    if (
      sceneKey == undefined ||
      (typeof sceneKey == "string" && sceneKey.trim().length <= 0)
    ) {
      sceneKey = this.getRandomTag();
    }

    this.incrementSceneReference(scene as ViroScene, sceneKey, true);
    this.reorderHistory(sceneKey);
  };

  pop = () => {
    this.popN(1);
  };

  popN = (n: number) => {
    if (n === 0) {
      return;
    }

    if (this.state.sceneHistory.length - n <= 0) {
      console.log(
        "WARN: Attempted to pop the root scene in ViroSceneNavigator!"
      );
      return;
    }

    this.decrementReferenceForLastNScenes(n);
    this.popHistoryByN(n);
  };

  /**
   * Increments the reference count for a scene within sceneDictionary that is
   * mapped to the given sceneKey. If no scenes are found / mapped, we create
   * one, initialize it with a reference count of 1, and store it within the
   * sceneDictionary for future reference.
   */
  incrementSceneReference(
    scene: ViroScene,
    sceneKey: string,
    limitOne: boolean
  ) {
    this.setState((prev) => {
      const sceneDictionary = { ...prev.sceneDictionary };
      const existing = sceneDictionary[sceneKey] ?? {
        sceneClass: scene,
        tag: sceneKey,
        referenceCount: 0,
      };

      // Update the scene's reference count and then the sceneDictionary
      const referenceCount =
        limitOne && existing.referenceCount >= 1
          ? existing.referenceCount
          : existing.referenceCount + 1;
      sceneDictionary[sceneKey] = { ...existing, referenceCount };
      return { sceneDictionary };
    });
  }

  /**
   * Decrements the reference count for the last N scenes within
   * the sceneHistory by 1. If nothing else references that given scene
   * (counts equals 0), we then remove that scene from sceneDictionary.
   */
  decrementReferenceForLastNScenes(n: number) {
    this.setState((prev) => {
      const { sceneHistory } = prev;
      // the root never pops: two pops queued in one tick both passed popN's
      // guard on the same stale state, so count against the history as it is now
      const k = Math.min(n, sceneHistory.length - 1);
      if (k <= 0) {
        return null;
      }
      const sceneDictionary = { ...prev.sceneDictionary };

      // Now update and release any reference counts
      for (let i = 1; i <= k; i++) {
        const sceneTag = sceneHistory[sceneHistory.length - i];
        const scene = sceneDictionary[sceneTag];
        if (scene == undefined) {
          continue;
        }
        const referenceCount = scene.referenceCount - 1;
        if (referenceCount <= 0) {
          delete sceneDictionary[sceneTag];
        } else {
          sceneDictionary[sceneTag] = { ...scene, referenceCount };
        }
      }
      return { sceneDictionary };
    });
  }

  /**
   * Adds the given sceneKey to the sceneHistory and updates the currentSceneIndex to point
   * to the scene on the top of the history stack (the most recent scene).
   */
  addToHistory(sceneKey: string) {
    this.setState((prev) => ({
      currentSceneIndex: this.getSceneIndex(sceneKey, prev.sceneDictionary),
      sceneHistory: prev.sceneHistory.concat([sceneKey]),
    }));
  }

  /**
   * Instead of preserving history, we find the last pushed sceneKey within the history stack
   * matching the given sceneKey and re-order it to the front. We then update the
   * currentSceneIndex to point to the scene on the top of the history stack
   * (the most recent scene).
   */
  reorderHistory(sceneKey: string) {
    this.setState((prev) => {
      // Find the last sceneKey within sceneHistory and remove it.
      const sceneHistory = [...prev.sceneHistory];
      for (let i = sceneHistory.length - 1; i >= 0; i--) {
        if (sceneKey == sceneHistory[i]) {
          sceneHistory.splice(i, 1);
          break;
        }
      }

      // Add back the sceneKey to the front of the History stack.
      return {
        currentSceneIndex: this.getSceneIndex(sceneKey, prev.sceneDictionary),
        sceneHistory: sceneHistory.concat([sceneKey]),
      };
    });
  }

  popHistoryByN(n: number) {
    this.setState((prev) => {
      const k = Math.min(n, prev.sceneHistory.length - 1);
      if (k <= 0) {
        return null;
      }
      const sceneHistory = [...prev.sceneHistory];
      sceneHistory.splice(sceneHistory.length - k, k);
      return {
        currentSceneIndex: this.getSceneIndex(
          sceneHistory[sceneHistory.length - 1],
          prev.sceneDictionary
        ),
        sceneHistory,
      };
    });
  }

  getSceneIndex(
    sceneTag: string,
    sceneDictionary = this.state.sceneDictionary
  ) {
    var i = 0;
    for (var sceneKey in sceneDictionary) {
      if (sceneTag == sceneDictionary[sceneKey].tag) {
        return i;
      }
      i++;
    }
    // Unable to find the given sceneTag, return -1
    return -1;
  }

  _recenterTracking = () => {
    ViroSceneNavigatorModule.recenterTracking(findNodeHandle(this));
  };

  _project = async (point: Viro3DPoint) => {
    return await ViroSceneNavigatorModule.project(findNodeHandle(this), point);
  };

  _unproject = async (point: Viro3DPoint) => {
    return await ViroSceneNavigatorModule.unproject(
      findNodeHandle(this),
      point
    );
  };

  /**
   * Takes a screenshot of the rendered scene, as ViroARSceneNavigator does.
   *
   * Meta Quest only: the left eye of the next frame, saved as `fileName`.jpg in
   * app storage and also to the gallery when `saveToCameraRoll`. Resolves
   * `{ success, url, errorCode }` and never rejects. Elsewhere it resolves with
   * `RECORD_ERROR_UNSUPPORTED_PLATFORM`, and on Quest with
   * `RECORD_ERROR_NOT_READY` until the XR session is rendering. A capture of a
   * passthrough scene holds the virtual content only.
   */
  _takeScreenshot = async (fileName: string, saveToCameraRoll: boolean) => {
    return await VRCapture.takeScreenshot(
      findNodeHandle(this),
      fileName,
      saveToCameraRoll
    );
  };

  /**
   * Starts recording the rendered scene (left eye) and the microphone, as
   * ViroARSceneNavigator does. Meta Quest only; `onError` receives a
   * ViroRecordingErrorConstants code, `RECORD_ERROR_UNSUPPORTED_PLATFORM`
   * elsewhere.
   */
  _startVideoRecording = (
    fileName: string,
    saveToCameraRoll: boolean,
    onError: (errorCode: number) => void
  ) => {
    VRCapture.startVideoRecording(
      findNodeHandle(this),
      fileName,
      saveToCameraRoll,
      onError
    );
  };

  /** Stops the recording. Resolves `{ success, url, errorCode }`. */
  _stopVideoRecording = async () => {
    return await VRCapture.stopVideoRecording(findNodeHandle(this));
  };

  _renderSceneStackItems() {
    let views = [];
    var i = 0;
    var sceneDictionary = this.state.sceneDictionary;
    for (var scene in sceneDictionary) {
      var Scene = sceneDictionary[scene].sceneClass.scene;
      var props = sceneDictionary[scene].sceneClass.passProps;
      views.push(
        <Scene
          key={sceneDictionary[scene].tag}
          sceneNavigator={this.sceneNavigator}
          {...props}
        />
      );
      i++;
    }
    return views;
  }

  sceneNavigator = {
    push: this.push,
    pop: this.pop,
    popN: this.popN,
    jump: this.jump,
    replace: this.replace,
    // exitViro: this.exitViro, // not defined?
    project: this._project,
    unproject: this._unproject,
    recenterTracking: this._recenterTracking,
    // Screen capture, with ViroARSceneNavigator's signatures and results, so a
    // scene captures through `sceneNavigator` on any platform. Meta Quest only;
    // elsewhere they report RECORD_ERROR_UNSUPPORTED_PLATFORM.
    takeScreenshot: this._takeScreenshot,
    startVideoRecording: this._startVideoRecording,
    stopVideoRecording: this._stopVideoRecording,
    viroAppProps: {} as any,
  };

  render() {
    // ViroVRSceneNavigator's view manager is excluded from the visionOS renderer, so React has no view
    // config for it and mounting fails with "View config not found". A message rather than
    // null: this is the root of a screen, and a blank one says nothing about why.
    if (isVisionOS) {
      warnUnsupported("ViroVRSceneNavigator", "Apple Vision Pro", "Use ViroXRSceneNavigator: visionOS is not a phone in a headset and has no stereo view to size.");
      return (
        <View style={styles.viroVisionOSFallback}>
          <Text style={styles.viroVisionOSFallbackText}>
            ViroVRSceneNavigator is not supported on Apple Vision Pro.
          </Text>
        </View>
      );
    }
    const items = this._renderSceneStackItems();

    // Uncomment this line to check for misnamed props
    //checkMisnamedProps("ViroVRSceneNavigator", this.props)

    // update the sceneNavigator with the latest given props on every render
    // If the user simply passes us the props from the root React component,
    // then we'll have an extra 'rootTag' key which React automatically includes
    // so remove it from a copy, leaving the user's object untouched.
    const appProps = withoutRootTag(this.props.viroAppProps);
    this.sceneNavigator.viroAppProps = appProps;

    return (
      <VRTVRSceneNavigator
        ref={(component) => {
          this._component = component;
        }}
        {...this.props}
        viroAppProps={appProps ?? {}}
        currentSceneIndex={this.state.currentSceneIndex}
        style={[styles.container, this.props.style]}
        hasOnExitViroCallback={this.props.onExitViro != undefined}
        onExitViro={this._onExitViro}
      >
        {items}
      </VRTVRSceneNavigator>
    );
  }
}

var styles = StyleSheet.create({
  viroVisionOSFallback: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#000",
    padding: 24,
  },
  viroVisionOSFallbackText: {
    color: "#fff",
    fontSize: 16,
    textAlign: "center",
  },
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
});


var VRTVRSceneNavigator = requireNativeComponent<any>(
  "VRTVRSceneNavigator",
  // @ts-ignore
  ViroVRSceneNavigator,
  {
    nativeOnly: {
      currentSceneIndex: true,
      onExitViro: true,
      hasOnExitViroCallback: true,
    },
  }
);
