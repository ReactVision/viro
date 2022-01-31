/**
 * Copyright (c) 2018-present, Viro Media, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule VRTARTrackingTargets
 * @flow
 */

import { NativeModules } from "react-native";
// @ts-ignore
import resolveAssetSource from "react-native/Libraries/Image/resolveAssetSource";
const ARTrackingTargetsModule = NativeModules.VRTARTrackingTargetsModule;

// // Currently only used for reference purposes (we manually validate)
// var ARTrackingTargetsPropTypes = {
//   source: PropTypes.oneOfType([
//     PropTypes.shape({
//       uri: PropTypes.string,
//     }),
//     // Opaque type returned by require('./image.jpg')
//     PropTypes.number,
//   ]).isRequired,
//   orientation: PropTypes.oneOf(["Up", "Down", "Left", "Right"]),
//   physicalWidth: PropTypes.number,
//   type: PropTypes.oneOf(["Image", "Object"]), // default is 'Image'
// };

export type ViroARTrackingTargetsMap = {
  [key: string]: ViroARTrackingTarget;
};

export type ViroARTrackingTarget = any;

export class ViroARTrackingTargets {
  static createTargets(targets: ViroARTrackingTargetsMap) {
    for (var key in targets) {
      var target = targets[key];

      // Check for required props
      ViroARTrackingTargets.checkForRequiredProps(key, target);

      // resolve asset source if applicable and update the object
      var resultSource = resolveAssetSource(target.source);
      target.source = resultSource;
    }

    // call the createTargets function in the native module
    ARTrackingTargetsModule.createTargets(targets);
  }

  static checkForRequiredProps(_key: string, target: ViroARTrackingTarget) {
    // source is required
    if (target.source == undefined) {
      console.error(
        "ViroTrackingTarget [" + target + "] requires a `source` property"
      );
    }

    // physicalWidth is required for Image targets
    if (!target.type || target.type == "Image") {
      if (target.physicalWidth == undefined) {
        console.error(
          "ViroTrackingTarget [" +
            target +
            "] requires a `physicalWidth` property"
        );
      }
    }
  }

  static deleteTarget(targetName: string) {
    ARTrackingTargetsModule.deleteTarget(targetName);
  }
}
