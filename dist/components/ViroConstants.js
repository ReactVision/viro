"use strict";
/**
 * Copyright (c) 2017-present, Viro, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule ViroRecordingErrorConstants
 * @providesModule ViroRecordingErrorConstants
 * @providesModule ViroARTrackingReasonConstants
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ViroARTrackingReasonConstants = exports.ViroTrackingStateConstants = exports.ViroRecordingErrorConstants = void 0;
var ViroRecordingErrorConstants;
(function (ViroRecordingErrorConstants) {
    // Viro recording error constants
    ViroRecordingErrorConstants[ViroRecordingErrorConstants["RECORD_ERROR_NONE"] = -1] = "RECORD_ERROR_NONE";
    ViroRecordingErrorConstants[ViroRecordingErrorConstants["RECORD_ERROR_UNKNOWN"] = 0] = "RECORD_ERROR_UNKNOWN";
    ViroRecordingErrorConstants[ViroRecordingErrorConstants["RECORD_ERROR_NO_PERMISSION"] = 1] = "RECORD_ERROR_NO_PERMISSION";
    ViroRecordingErrorConstants[ViroRecordingErrorConstants["RECORD_ERROR_INITIALIZATION"] = 2] = "RECORD_ERROR_INITIALIZATION";
    ViroRecordingErrorConstants[ViroRecordingErrorConstants["RECORD_ERROR_WRITE_TO_FILE"] = 3] = "RECORD_ERROR_WRITE_TO_FILE";
    ViroRecordingErrorConstants[ViroRecordingErrorConstants["RECORD_ERROR_ALREADY_RUNNING"] = 4] = "RECORD_ERROR_ALREADY_RUNNING";
    ViroRecordingErrorConstants[ViroRecordingErrorConstants["RECORD_ERROR_ALREADY_STOPPED"] = 5] = "RECORD_ERROR_ALREADY_STOPPED";
})(ViroRecordingErrorConstants = exports.ViroRecordingErrorConstants || (exports.ViroRecordingErrorConstants = {}));
var ViroTrackingStateConstants;
(function (ViroTrackingStateConstants) {
    // Viro AR Tracking constants,
    ViroTrackingStateConstants[ViroTrackingStateConstants["TRACKING_UNAVAILABLE"] = 1] = "TRACKING_UNAVAILABLE";
    ViroTrackingStateConstants[ViroTrackingStateConstants["TRACKING_LIMITED"] = 2] = "TRACKING_LIMITED";
    ViroTrackingStateConstants[ViroTrackingStateConstants["TRACKING_NORMAL"] = 3] = "TRACKING_NORMAL";
})(ViroTrackingStateConstants = exports.ViroTrackingStateConstants || (exports.ViroTrackingStateConstants = {}));
var ViroARTrackingReasonConstants;
(function (ViroARTrackingReasonConstants) {
    // Viro AR Tracking reason constants,
    ViroARTrackingReasonConstants[ViroARTrackingReasonConstants["TRACKING_REASON_NONE"] = 1] = "TRACKING_REASON_NONE";
    ViroARTrackingReasonConstants[ViroARTrackingReasonConstants["TRACKING_REASON_EXCESSIVE_MOTION"] = 2] = "TRACKING_REASON_EXCESSIVE_MOTION";
    ViroARTrackingReasonConstants[ViroARTrackingReasonConstants["TRACKING_REASON_INSUFFICIENT_FEATURES"] = 3] = "TRACKING_REASON_INSUFFICIENT_FEATURES";
})(ViroARTrackingReasonConstants = exports.ViroARTrackingReasonConstants || (exports.ViroARTrackingReasonConstants = {}));
