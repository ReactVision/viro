"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.studioColocationIndicatorContent = studioColocationIndicatorContent;
const ViroColocationRooms_1 = require("../../AR/ViroColocationRooms");
function peersLine(peers) {
    if (peers === 0)
        return "No one else is here yet";
    return peers === 1 ? "1 other device" : `${peers} other devices`;
}
/** What both indicator variants show for a state; null shows nothing. */
function studioColocationIndicatorContent(state, originPrompt = null, device = "phone") {
    const headset = device === "headset";
    switch (state.status) {
        case "idle":
            return null;
        case "scanning": {
            const points = state.points
                ? ` ${state.points.count} of ${state.points.needed} points mapped.`
                : "";
            return {
                title: "Scan the area",
                detail: state.canFinish
                    ? "That is enough to share. Tap Done, or keep walking to cover more."
                    : `Walk slowly around the area everyone will share, pointing at walls and furniture.${points}`,
                code: null,
                done: { enabled: state.canFinish },
                tone: "progress",
            };
        }
        case "hosting":
            return {
                title: "Saving the scan",
                detail: headset
                    ? "Keep the headset on, this takes a few seconds."
                    : "Keep the app open, this can take up to a minute.",
                code: null,
                done: null,
                tone: "progress",
            };
        case "creating_room":
            if (originPrompt) {
                return {
                    title: "Place the scene",
                    detail: originPrompt.tap
                        ? "Tap a surface to place the scene."
                        : "Point your device at a surface to place the scene.",
                    code: originPrompt.joinCode
                        ? (0, ViroColocationRooms_1.formatJoinCode)(originPrompt.joinCode)
                        : null,
                    done: null,
                    tone: "progress",
                };
            }
            return {
                title: "Creating the room",
                detail: null,
                code: null,
                done: null,
                tone: "progress",
            };
        case "looking_up":
            return {
                title: "Finding the room",
                detail: null,
                code: null,
                done: null,
                tone: "progress",
            };
        case "resolving":
            return {
                title: "Finding the scanned area",
                detail: headset
                    ? state.attempt > 1
                        ? "Still looking. Look around the room the host is in."
                        : "Look around the room the host is in."
                    : state.seen
                        ? `Matched the area ${state.seen.matches} of ${state.seen.needed} times. Keep moving your device slowly.`
                        : state.attempt > 1
                            ? "Still looking. Move slowly around the area the host scanned."
                            : "Move your device slowly around the area the host scanned.",
                code: null,
                done: null,
                tone: "progress",
            };
        case "waiting_for_host":
            return {
                title: "Waiting for the host",
                detail: "Connected. The scene appears once the host has placed it.",
                code: null,
                done: null,
                tone: "progress",
            };
        case "live":
            return {
                title: state.room.isHost ? "Sharing this room" : "Joined this room",
                detail: peersLine(state.peers),
                code: state.room.isHost && state.room.joinCode
                    ? (0, ViroColocationRooms_1.formatJoinCode)(state.room.joinCode)
                    : null,
                done: null,
                tone: "live",
            };
        case "reconnecting":
            return {
                title: "Reconnecting...",
                detail: null,
                code: null,
                done: null,
                tone: "progress",
            };
        case "failed":
            return {
                title: "Co-location stopped",
                detail: state.message,
                code: null,
                done: null,
                tone: "error",
            };
    }
}
