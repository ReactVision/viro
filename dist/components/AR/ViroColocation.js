/**
 * Copyright © 2026 ReactVision
 *
 * The co-location channel — what devices sharing a frame say to each other.
 *
 * A frame source (see `ViroFrameSource`) gets every device onto one coordinate
 * frame. This carries frame-native data across it: where each peer is, and
 * whether they have localised.
 *
 * **Scope is deliberately narrow.** Application state — whose turn, what score,
 * which model spawned — does not belong here. It would mean every app payload
 * crossing JS → bridge → C++ → socket and back, and would force a schema-less
 * pub/sub on a library that has no reason to be one. Keep your own channel for
 * your own domain.
 *
 * **Coordinates.** Everything on this channel is in the shared location frame.
 * World coordinates are per-session — each AR session picks its origin wherever
 * tracking started — so they mean nothing to the peer receiving them. Convert
 * with `worldToLocation()` before publishing, and `locationToWorld()` on
 * arrival.
 *
 * @providesModule ViroColocation
 */
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isColocationAvailable = isColocationAvailable;
exports.joinColocation = joinColocation;
exports.leaveColocation = leaveColocation;
exports.setColocationLocalPose = setColocationLocalPose;
exports.getColocationState = getColocationState;
exports.getColocationPeers = getColocationPeers;
const react_native_1 = require("react-native");
const { VRTColocationModule } = react_native_1.NativeModules;
/** Native reports the state as an ordinal; this is that enum. */
const STATES = [
    "idle",
    "joining",
    "joined",
    "reconnecting",
    "failed",
];
/**
 * False when ReactVisionCCA is not linked, or the platform has no WebSocket
 * transport. Check before joining; every other call is inert in that case.
 */
async function isColocationAvailable() {
    if (!VRTColocationModule?.isAvailable)
        return false;
    return VRTColocationModule.isAvailable();
}
/** Join a room. Leaves any room already joined — a device is in one at a time. */
async function joinColocation(config) {
    if (!VRTColocationModule?.join) {
        return { success: false, error: "Co-location channel unavailable" };
    }
    return VRTColocationModule.join(config.roomId, config.apiKey, config.projectId, config.endpoint ?? "");
}
async function leaveColocation() {
    if (!VRTColocationModule?.leave)
        return;
    await VRTColocationModule.leave();
}
/**
 * Publish the local pose, **in the location frame**.
 *
 * Pass the transform as 16 comma-separated floats, column-major — the same
 * encoding `onLocalized`'s `transform` uses. Safe to call every frame: the
 * outbound rate limit lives in native.
 */
async function setColocationLocalPose(locationFramePoseCsv) {
    if (!VRTColocationModule?.setLocalPose)
        return;
    await VRTColocationModule.setLocalPose(locationFramePoseCsv);
}
async function getColocationState() {
    if (!VRTColocationModule?.getState) {
        return { state: "idle", localPeerId: "" };
    }
    const raw = await VRTColocationModule.getState();
    return {
        state: STATES[raw?.state ?? 0] ?? "idle",
        localPeerId: raw?.localPeerId ?? "",
    };
}
/** Peers currently in the room, excluding this device. */
async function getColocationPeers() {
    if (!VRTColocationModule?.getPeers)
        return [];
    return VRTColocationModule.getPeers();
}
