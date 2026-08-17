"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ViroSoundField = ViroSoundField;
/**
 * Web implementation of ViroSoundField — ambient/background audio. Native uses
 * ambisonic playback; on web it plays as non-positional stereo audio (same as
 * ViroSound). `rotation` (ambisonic orientation) has no web equivalent yet.
 */
const ViroSound_web_1 = require("./ViroSound.web");
function ViroSoundField(props) {
    return (0, ViroSound_web_1.ViroSound)(props);
}
