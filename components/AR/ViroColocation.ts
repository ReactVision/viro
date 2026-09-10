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

import { NativeModules } from "react-native";

const { VRTColocationModule } = NativeModules;

export type ViroColocationState =
  | "idle"
  | "joining"
  | "joined"
  | "reconnecting"
  | "failed";

/** Native reports the state as an ordinal; this is that enum. */
const STATES: ViroColocationState[] = [
  "idle",
  "joining",
  "joined",
  "reconnecting",
  "failed",
];

export type ViroColocationPeer = {
  peerId: string;
  /** Location-frame position [x, y, z]. Never world coordinates. */
  position: [number, number, number];
  /** Quaternion [x, y, z, w]. */
  rotation: [number, number, number, number];
  /**
   * Sender's clock, milliseconds. Orders one peer's own updates and nothing
   * more — device clocks are not synchronised, so do not compare across peers.
   */
  timestampMs: number;
  localized: boolean;
};

export type ViroColocationJoinResult = {
  success: boolean;
  error?: string;
};

export type ViroColocationConfig = {
  /**
   * Names the room. Use the same id that names the frame — the cloud anchor
   * id, the Meta group id, or your visionOS session id — so one identifier
   * covers the space, the frame and the channel.
   */
  roomId: string;
  apiKey: string;
  projectId: string;
  /** Defaults to the production platform endpoint. */
  endpoint?: string;
};

/**
 * False when ReactVisionCCA is not linked, or the platform has no WebSocket
 * transport. Check before joining; every other call is inert in that case.
 */
export async function isColocationAvailable(): Promise<boolean> {
  if (!VRTColocationModule?.isAvailable) return false;
  return VRTColocationModule.isAvailable();
}

/** Join a room. Leaves any room already joined — a device is in one at a time. */
export async function joinColocation(
  config: ViroColocationConfig
): Promise<ViroColocationJoinResult> {
  if (!VRTColocationModule?.join) {
    return { success: false, error: "Co-location channel unavailable" };
  }
  return VRTColocationModule.join(
    config.roomId,
    config.apiKey,
    config.projectId,
    config.endpoint ?? ""
  );
}

export async function leaveColocation(): Promise<void> {
  if (!VRTColocationModule?.leave) return;
  await VRTColocationModule.leave();
}

/**
 * Publish the local pose, **in the location frame**.
 *
 * Pass the transform as 16 comma-separated floats, column-major — the same
 * encoding `onLocalized`'s `transform` uses. Safe to call every frame: the
 * outbound rate limit lives in native.
 */
export async function setColocationLocalPose(
  locationFramePoseCsv: string
): Promise<void> {
  if (!VRTColocationModule?.setLocalPose) return;
  await VRTColocationModule.setLocalPose(locationFramePoseCsv);
}

export async function getColocationState(): Promise<{
  state: ViroColocationState;
  localPeerId: string;
}> {
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
export async function getColocationPeers(): Promise<ViroColocationPeer[]> {
  if (!VRTColocationModule?.getPeers) return [];
  return VRTColocationModule.getPeers();
}
