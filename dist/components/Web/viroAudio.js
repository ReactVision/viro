"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAudioContext = getAudioContext;
/**
 * Shared Web Audio context for spatial sound. Lazily created (browsers require a
 * user gesture to resume it; callers should catch play() rejections).
 */
let ctx = null;
function getAudioContext() {
    if (!ctx) {
        const Ctor = window.AudioContext || window.webkitAudioContext;
        ctx = new Ctor();
    }
    return ctx;
}
