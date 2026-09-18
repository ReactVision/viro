"use strict";
/**
 * Shared Web Audio context for spatial sound, and the listener that follows the
 * camera.
 *
 * Lazily created (browsers require a user gesture to resume it; callers should
 * catch play() rejections).
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAudioContext = getAudioContext;
exports.trackAudioListener = trackAudioListener;
const viroMath_1 = require("./viroMath");
let ctx = null;
function getAudioContext() {
    if (!ctx) {
        const Ctor = window.AudioContext || window.webkitAudioContext;
        ctx = new Ctor();
    }
    return ctx;
}
function setListenerPose(listener, position, quaternion) {
    // virocore's camera convention is the one Web Audio's forward/up vectors use,
    // so the basis carries over rotated with no axis swap.
    const { forward, up } = (0, viroMath_1.cameraBasis)(quaternion);
    const [fx, fy, fz] = forward;
    const [ux, uy, uz] = up;
    const [px, py, pz] = position;
    if (listener.positionX) {
        listener.positionX.value = px;
        listener.positionY.value = py;
        listener.positionZ.value = pz;
        listener.forwardX.value = fx;
        listener.forwardY.value = fy;
        listener.forwardZ.value = fz;
        listener.upX.value = ux;
        listener.upY.value = uy;
        listener.upZ.value = uz;
        return;
    }
    // Deprecated fallback for older Safari, which has no AudioParam listener.
    const legacy = listener;
    legacy.setPosition(px, py, pz);
    legacy.setOrientation(fx, fy, fz, ux, uy, uz);
}
/**
 * Keep the Web Audio listener on the camera for as long as at least one caller
 * wants it there.
 *
 * One loop no matter how many sounds are playing: the listener is a property of
 * the context, not of any sound, so a loop per sound would write the same values
 * several times a frame. Returns the release for this caller; the loop stops
 * when the last one releases.
 */
function trackAudioListener(source) {
    listenerSources.add(source);
    if (rafId === null) {
        const step = () => {
            const current = listenerSources.values().next().value;
            if (current) {
                const { position, quaternion } = current.cameraPose;
                setListenerPose(getAudioContext().listener, position, quaternion);
            }
            rafId = requestAnimationFrame(step);
        };
        rafId = requestAnimationFrame(step);
    }
    let released = false;
    return () => {
        if (released)
            return;
        released = true;
        listenerSources.delete(source);
        if (listenerSources.size === 0 && rafId !== null) {
            cancelAnimationFrame(rafId);
            rafId = null;
        }
    };
}
const listenerSources = new Set();
let rafId = null;
