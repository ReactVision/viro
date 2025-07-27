"use strict";
/**
 * ViroEvents
 *
 * Type definitions for Viro event handling.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ViroRecordingErrorConstants = exports.ViroARTrackingReasonConstants = exports.ViroTrackingStateConstants = exports.ViroRotateStateTypes = exports.ViroPinchStateTypes = exports.ViroClickStateTypes = void 0;
// Click state types
var ViroClickStateTypes;
(function (ViroClickStateTypes) {
    ViroClickStateTypes[ViroClickStateTypes["CLICK_DOWN"] = 1] = "CLICK_DOWN";
    ViroClickStateTypes[ViroClickStateTypes["CLICK_UP"] = 2] = "CLICK_UP";
    ViroClickStateTypes[ViroClickStateTypes["CLICKED"] = 3] = "CLICKED";
})(ViroClickStateTypes || (exports.ViroClickStateTypes = ViroClickStateTypes = {}));
// Pinch state types
var ViroPinchStateTypes;
(function (ViroPinchStateTypes) {
    ViroPinchStateTypes[ViroPinchStateTypes["PINCH_START"] = 1] = "PINCH_START";
    ViroPinchStateTypes[ViroPinchStateTypes["PINCH_MOVE"] = 2] = "PINCH_MOVE";
    ViroPinchStateTypes[ViroPinchStateTypes["PINCH_END"] = 3] = "PINCH_END";
})(ViroPinchStateTypes || (exports.ViroPinchStateTypes = ViroPinchStateTypes = {}));
// Rotate state types
var ViroRotateStateTypes;
(function (ViroRotateStateTypes) {
    ViroRotateStateTypes[ViroRotateStateTypes["ROTATE_START"] = 1] = "ROTATE_START";
    ViroRotateStateTypes[ViroRotateStateTypes["ROTATE_MOVE"] = 2] = "ROTATE_MOVE";
    ViroRotateStateTypes[ViroRotateStateTypes["ROTATE_END"] = 3] = "ROTATE_END";
})(ViroRotateStateTypes || (exports.ViroRotateStateTypes = ViroRotateStateTypes = {}));
// Tracking state constants
var ViroTrackingStateConstants;
(function (ViroTrackingStateConstants) {
    ViroTrackingStateConstants[ViroTrackingStateConstants["TRACKING_NORMAL"] = 0] = "TRACKING_NORMAL";
    ViroTrackingStateConstants[ViroTrackingStateConstants["TRACKING_LIMITED"] = 1] = "TRACKING_LIMITED";
    ViroTrackingStateConstants[ViroTrackingStateConstants["TRACKING_UNAVAILABLE"] = 2] = "TRACKING_UNAVAILABLE";
})(ViroTrackingStateConstants || (exports.ViroTrackingStateConstants = ViroTrackingStateConstants = {}));
var ViroARTrackingReasonConstants;
(function (ViroARTrackingReasonConstants) {
    ViroARTrackingReasonConstants[ViroARTrackingReasonConstants["TRACKING_REASON_NONE"] = 0] = "TRACKING_REASON_NONE";
    ViroARTrackingReasonConstants[ViroARTrackingReasonConstants["TRACKING_REASON_EXCESSIVE_MOTION"] = 1] = "TRACKING_REASON_EXCESSIVE_MOTION";
    ViroARTrackingReasonConstants[ViroARTrackingReasonConstants["TRACKING_REASON_INSUFFICIENT_FEATURES"] = 2] = "TRACKING_REASON_INSUFFICIENT_FEATURES";
})(ViroARTrackingReasonConstants || (exports.ViroARTrackingReasonConstants = ViroARTrackingReasonConstants = {}));
// Recording constants
var ViroRecordingErrorConstants;
(function (ViroRecordingErrorConstants) {
    ViroRecordingErrorConstants[ViroRecordingErrorConstants["RECORD_ERROR_NONE"] = 0] = "RECORD_ERROR_NONE";
    ViroRecordingErrorConstants[ViroRecordingErrorConstants["RECORD_ERROR_UNKNOWN"] = 1] = "RECORD_ERROR_UNKNOWN";
    ViroRecordingErrorConstants[ViroRecordingErrorConstants["RECORD_ERROR_NO_PERMISSION"] = 2] = "RECORD_ERROR_NO_PERMISSION";
    ViroRecordingErrorConstants[ViroRecordingErrorConstants["RECORD_ERROR_INITIALIZATION"] = 3] = "RECORD_ERROR_INITIALIZATION";
    ViroRecordingErrorConstants[ViroRecordingErrorConstants["RECORD_ERROR_WRITE_TO_FILE"] = 4] = "RECORD_ERROR_WRITE_TO_FILE";
    ViroRecordingErrorConstants[ViroRecordingErrorConstants["RECORD_ERROR_ALREADY_RUNNING"] = 5] = "RECORD_ERROR_ALREADY_RUNNING";
    ViroRecordingErrorConstants[ViroRecordingErrorConstants["RECORD_ERROR_ALREADY_STOPPED"] = 6] = "RECORD_ERROR_ALREADY_STOPPED";
})(ViroRecordingErrorConstants || (exports.ViroRecordingErrorConstants = ViroRecordingErrorConstants = {}));
