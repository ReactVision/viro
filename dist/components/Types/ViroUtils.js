"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ViroEventSource = void 0;
/**
 * Numeric input-source ids reported in event payloads (event.nativeEvent.source),
 * mirroring the native ViroOculus::InputSource enum. Currently only the eye-gaze
 * source is needed on the JS side (to route onHover -> onGaze).
 */
exports.ViroEventSource = {
    EYE_GAZE: 12, // ViroOculus::EyeGaze (Quest Pro, XR_EXT_eye_gaze_interaction)
};
