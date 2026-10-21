import { formatJoinCode } from "../../AR/ViroColocationRooms";
import type { StudioColocationErrorCode, StudioColocationState } from "./types";

/** Host: the room exists and waits for the scene's origin to be picked. */
export type StudioColocationOriginPrompt = {
  joinCode: string | null;
  /** MANUAL: a tap picks the surface; AUTOMATIC takes the first one found. */
  tap: boolean;
};

export type StudioColocationIndicatorContent = {
  title: string;
  detail: string | null;
  /** The join code to read out, on the host's pill once the room exists. */
  code: string | null;
  /** Host scanning: the Done button, enabled once the scan covers enough. */
  done: { enabled: boolean } | null;
  tone: "progress" | "live" | "error";
};

function peersLine(peers: number): string {
  if (peers === 0) return "No one else is here yet";
  return peers === 1 ? "1 other device" : `${peers} other devices`;
}

/** A headset hosts a Meta anchor with no scan, and joins without walking a scanned area. */
export type StudioColocationDevice = "phone" | "headset";

/** What both indicator variants show for a state; null shows nothing. */
export function studioColocationIndicatorContent(
  state: StudioColocationState,
  originPrompt: StudioColocationOriginPrompt | null = null,
  device: StudioColocationDevice = "phone"
): StudioColocationIndicatorContent | null {
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
            ? formatJoinCode(originPrompt.joinCode)
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
        code:
          state.room.isHost && state.room.joinCode
            ? formatJoinCode(state.room.joinCode)
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
        detail: failureDetail(state.code, headset),
        code: null,
        done: null,
        tone: "error",
      };
  }
}

// By code, not the failure's message, which can be a transport error or a
// server's text and is meant for logs.
function failureDetail(
  code: StudioColocationErrorCode,
  headset: boolean
): string {
  switch (code) {
    case "PAID_PLAN_REQUIRED":
      return "Co-location is available on paid plans.";
    case "ROOM_NOT_FOUND":
      return "The room was not found. Only members of the host's team can join its rooms.";
    case "ROOM_FULL":
      return "This room is full.";
    case "RELAY_AT_CAPACITY":
      return "Co-location is at capacity right now.";
    case "FRAME_KIND_UNSUPPORTED":
      return `This ${headset ? "headset" : "device"} cannot share or join this room.`;
    case "RESOLVE_NO_MATCH":
      return headset
        ? "Failed to find the host's space. Stay in the room the host is in."
        : "Failed to find the scanned area. Stand where the host scanned and move your device slowly.";
    case "HOST_FAILED":
      return headset
        ? "Failed to share this space."
        : "Failed to save the scan. Scan more of the area, moving your device slowly.";
    case "NOT_AUTHORIZED":
      return "Your access to this project could not be verified.";
    case "SCENE_TOO_LARGE":
      return "This scene has too many assets and variables to share.";
    case "UNAVAILABLE":
      return "Failed to reach the co-location service. Check your internet connection.";
    case "CONNECT_TIMEOUT":
      return "The room took too long to connect. Check your internet connection.";
    case "HOST_TIMEOUT":
      return "The host has not placed the scene in the room yet.";
    case "UNKNOWN":
      return "An unknown error occurred.";
  }
}
