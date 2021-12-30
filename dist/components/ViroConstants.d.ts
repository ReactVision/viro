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
export declare enum ViroRecordingErrorConstants {
    RECORD_ERROR_NONE = -1,
    RECORD_ERROR_UNKNOWN = 0,
    RECORD_ERROR_NO_PERMISSION = 1,
    RECORD_ERROR_INITIALIZATION = 2,
    RECORD_ERROR_WRITE_TO_FILE = 3,
    RECORD_ERROR_ALREADY_RUNNING = 4,
    RECORD_ERROR_ALREADY_STOPPED = 5
}
export declare enum ViroTrackingStateConstants {
    TRACKING_UNAVAILABLE = 1,
    TRACKING_LIMITED = 2,
    TRACKING_NORMAL = 3
}
export declare enum ViroARTrackingReasonConstants {
    TRACKING_REASON_NONE = 1,
    TRACKING_REASON_EXCESSIVE_MOTION = 2,
    TRACKING_REASON_INSUFFICIENT_FEATURES = 3
}
