/**
 * Copyright (c) 2018-present, Viro Media, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule ViroSceneNavigator
 * @flow
 */
"use strict";

import * as React from "react";
import {
  findNodeHandle,
  requireNativeComponent,
  StyleSheet,
  View,
  NativeModules,
  ViewProps,
  NativeSyntheticEvent,
} from "react-native";
import { ViroExitViroEvent } from "./Types/ViroEvents";
import { Viro3DPoint } from "./Types/ViroUtils";
import { ViroSceneDictionary } from "./Types/ViroUtils";
import { ViroScene } from "./ViroScene";
import { withoutRootTag } from "./Utilities/ViroAppProps";
import { isVisionOS } from "./Utilities/ViroPlatform";
import { unsupportedCapture } from "./Utilities/VRModuleOpenXR";
import {
  sendViroUsagePing,
  ViroUsagePingSuppressed,
} from "./Utilities/ViroUsagePing";

var ViroSceneNavigatorModule = NativeModules.VRTSceneNavigatorModule;

var mathRandomOffset = 0;

type Props = ViewProps & {
  initialSceneKey?: string;
  /**
   * Calling vrModeEnabled allows switching to and from VR mode.
   * When set to false, it transitions back to pre-VR (mono) mode.
   * When set to true, we set thie view into a full VR mode.
   * This is set to true by default.
   *
   * @deprecated This property was unused.
   */
  vrModeEnabled?: boolean;
  /**
   * A flag to enable/disable some debug features
   */
  debug?: boolean;
  /**
   * ViroSceneNavigator uses "scene" objects like the following to
   * describe a scene.
   */
  initialScene: {
    /**
     * The React component to render for this scene.
     *
     * Typed as a component, not as a `ViroScene` instance: at runtime this is mounted as
     * `<Component />` (see `sceneClass.scene` below), exactly as ViroARSceneNavigator does.
     * The old `ViroScene` annotation described a value this navigator never receives.
     */
    scene: () => React.JSX.Element;
  };
  viroAppProps?: any; // TODO: what is the type of this?

  /**
   * Called when either the user physically decides to exit vr (hits
   * the "X" buton).
   */
  onExitViro?: () => void;
};

type State = {
  sceneDictionary: ViroSceneDictionary;
  sceneHistory: string[];
  currentSceneIndex: number;
};

let warnedDeprecated = false;

/**
 * ##### DEPRECATION WARNING - ViroSceneNavigator may be removed in future releases. Use ViroVRSceneNavigator instead #####
 * ViroSceneNavigator is used to transition between multiple scenes.
 *
 * @deprecated
 */
export class ViroSceneNavigator extends React.Component<Props, State> {
  // TODO: type of this component (native component)
  _component: any;

  static contextType = ViroUsagePingSuppressed;
  declare context: React.ContextType<typeof ViroUsagePingSuppressed>;

  componentDidMount() {
    if (!this.context) {
      sendViroUsagePing("scene", {
        vr_mode_enabled: this.props.vrModeEnabled ?? true,
      });
    }
  }

  sceneNavigator = {
    push: this.push,
    pop: this.pop,
    popN: this.popN,
    jump: this.jump,
    replace: this.replace,
    // exitViro: this.exitViro, TODO: this was unused
    recenterTracking: this._recenterTracking,
    project: this._project,
    unproject: this._unproject,
    // No capture on this navigator (visionOS, iOS VR): the names are here so a
    // scene written for AR or Quest gets RECORD_ERROR_UNSUPPORTED_PLATFORM
    // back instead of calling something undefined.
    takeScreenshot: unsupportedCapture.takeScreenshot,
    startVideoRecording: unsupportedCapture.startVideoRecording,
    stopVideoRecording: unsupportedCapture.stopVideoRecording,
    viroAppProps: this.props.viroAppProps || {},
  };

  /**
   * Called from native when either the user physically decides to exit vr (hits
   * the "X" buton).
   */
  _onExitViro = (_event: NativeSyntheticEvent<ViroExitViroEvent>) => {
    this.props.onExitViro && this.props.onExitViro();
  };

  constructor(props: Props) {
    super(props);
    var initialSceneTag = this.props.initialSceneKey;
    if (initialSceneTag == null) {
      initialSceneTag = this.getRandomTag();
    }
    var scene = {
      sceneClass: this.props.initialScene,
      tag: initialSceneTag,
      referenceCount: 1,
    };
    var sceneDict: ViroSceneDictionary = {};
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
   * @todo add typescript to overload the function, rather than the string | ViroScene typings
   */
  push(param1?: string | ViroScene, param2?: string | ViroScene) {
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
  }

  /**
   * Replace the top scene in the stack with the given scene. The remainder of the back
   * history is kept in the same order as before.
   *
   * Can take in either 1 or two parameters in the form:
   * replace ("sceneKey");
   * replace ("sceneKey", scene);
   * replace (scene);
   *
   * @todo add typescript to overload the function, rather than the string | ViroScene typings
   */
  replace(param1?: string | ViroScene, param2?: string | ViroScene) {
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
  }

  /**
   * Jumps to a given scene that had been previously pushed. If the scene was not pushed, we
   * then push and jump to it. The back history is re-ordered such that jumped to scenes are
   * re-ordered to the front. As such, only the back order of sequential jumps are preserved.
   *
   * Can take in either 1 or two parameters in the form:
   * jump ("sceneKey");
   * jump ("sceneKey", scene);
   * jump (scene);
   */
  jump(param1?: string | ViroScene, param2?: string | ViroScene) {
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
      sceneKey === undefined ||
      (typeof sceneKey == "string" && sceneKey.trim().length <= 0)
    ) {
      sceneKey = this.getRandomTag();
    }

    this.incrementSceneReference(scene as ViroScene, sceneKey, true);
    this.reorderHistory(sceneKey);
  }

  pop() {
    this.popN(1);
  }

  popN(n: number) {
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
  }

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
      const sceneDictionary = { ...prev.sceneDictionary };

      // Now update and release any reference counts
      for (let i = 1; i <= n; i++) {
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
      const sceneHistory = [...prev.sceneHistory];
      sceneHistory.splice(sceneHistory.length - n, n);
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

  async _project(point: Viro3DPoint) {
    return await ViroSceneNavigatorModule.project(findNodeHandle(this), point);
  }

  async _unproject(point: Viro3DPoint) {
    return await ViroSceneNavigatorModule.unproject(
      findNodeHandle(this),
      point
    );
  }

  _recenterTracking() {
    ViroSceneNavigatorModule.recenterTracking(findNodeHandle(this));
  }

  _renderSceneStackItems() {
    let views = [];
    var i = 0;
    var sceneDictionary = this.state.sceneDictionary;
    for (var scene in sceneDictionary) {
      var Component = sceneDictionary[scene].sceneClass.scene;
      var props = sceneDictionary[scene].sceneClass.passProps;
      views.push(
        <Component
          key={sceneDictionary[scene].tag}
          sceneNavigator={this.sceneNavigator}
          {...props}
        />
      );
      i++;
    }
    return views;
  }

  render() {
    // Uncomment this line to check for misnamed props
    //checkMisnamedProps("ViroSceneNavigator", this.props);

    // Not on visionOS: there the replacement does not exist. ViroVRSceneNavigator renders
    // VRTVRSceneNavigator, which is the Android/OpenXR host and is excluded from the xros
    // build, while VRTSceneNavigator — this component — is the one that is registered. Sending
    // visionOS users to a component that cannot mount would be worse than saying nothing, and
    // the warning would fire on every render of a supported configuration.
    if (!isVisionOS && !warnedDeprecated) {
      warnedDeprecated = true;
      console.warn(
        "<ViroSceneNavigator> has been DEPRECATED. Please use <ViroVRSceneNavigator> instead."
      );
    }
    var items = this._renderSceneStackItems();

    // update the sceneNavigator with the latest given props on every render
    // If the user simply passes us the props from the root React component,
    // then we'll have an extra 'rootTag' key which React automatically includes
    // so remove it from a copy, leaving the user's object untouched.
    const appProps = withoutRootTag(this.props.viroAppProps);
    this.sceneNavigator.viroAppProps = appProps;

    const {
      vrModeEnabled = true, // default to true
    } = this.props;

    return (
      <VRTSceneNavigator
        ref={(component) => {
          this._component = component;
        }}
        {...this.props}
        vrModeEnabled={vrModeEnabled}
        viroAppProps={appProps ?? {}}
        currentSceneIndex={this.state.currentSceneIndex}
        style={[styles.container, this.props.style]}
        hasOnExitViroCallback={this.props.onExitViro != undefined}
        onExitViro={this._onExitViro}
      >
        {items}
      </VRTSceneNavigator>
    );
  }
}

var styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
});

var VRTSceneNavigator = requireNativeComponent<any>(
  "VRTSceneNavigator",
  // @ts-ignore
  ViroSceneNavigator,
  {
    nativeOnly: {
      currentSceneIndex: true,
      onExitViro: true,
      hasOnExitViroCallback: true,
    },
  }
);
