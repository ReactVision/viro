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
import type { ViroVPSCredentialsSource } from "./ViroVPSClient";
import { keepUserTokenFresh, readCredentials } from "./ViroUserTokens";

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
  /**
   * Not needed with `credentials`. An empty string is reserved for first-party
   * apps: native then joins with the internal Studio session
   * (`VRTStudioModule.rvSetStudioSession`), and fails the join when none is set.
   */
  apiKey?: string;
  /** Required unless `credentials` are given, which carry it. Replaces theirs. */
  projectId?: string;
  /** Defaults to the production platform endpoint. */
  endpoint?: string;
  /**
   * Credentials as `<ViroVPS credentials>` takes them, in place of `apiKey`.
   * A user token from createUserTokenCredentials() goes on the handshake as
   * `Authorization: Bearer` with no `x-api-key`, and while the device is in
   * the room viro hands the channel a renewed one before it expires, which the
   * next reconnect sends. Credentials with an `apiKey` join as `apiKey` does.
   */
  credentials?: ViroVPSCredentialsSource;
} & (
  | { apiKey: string; projectId: string }
  | { credentials: ViroVPSCredentialsSource }
);

/**
 * False when ReactVisionCCA is not linked, or the platform has no WebSocket
 * transport. Check before joining; every other call is inert in that case.
 */
export async function isColocationAvailable(): Promise<boolean> {
  if (!VRTColocationModule?.isAvailable) return false;
  return VRTColocationModule.isAvailable();
}

// Bumped per join and leave. A join overtaken during one of its awaits makes no
// further native call and starts no renewal.
let joinSeq = 0;
let stopRenewal: (() => void) | null = null;
// True while native may hold a token from a join with credentials.
let tokenSet = false;

const superseded = (): ViroColocationJoinResult => ({
  success: false,
  error: "A later join or leave replaced this one",
});

/** Join a room. Leaves any room already joined — a device is in one at a time. */
export async function joinColocation(
  config: ViroColocationConfig
): Promise<ViroColocationJoinResult> {
  if (!VRTColocationModule?.join) {
    return { success: false, error: "Co-location channel unavailable" };
  }
  const seq = ++joinSeq;
  stopRenewal?.();
  stopRenewal = null;
  const endpoint = config.endpoint ?? "";

  let apiKey = config.apiKey ?? "";
  let projectId = config.projectId ?? "";
  let token: string | undefined;
  if (config.credentials !== undefined) {
    try {
      const credentials = await readCredentials(config.credentials);
      projectId = config.projectId ?? credentials.projectId;
      if ("accessToken" in credentials) {
        apiKey = "";
        token = credentials.accessToken;
      } else {
        apiKey = credentials.apiKey;
      }
    } catch (e) {
      return {
        success: false,
        error: `Could not get credentials: ${e instanceof Error ? e.message : String(e)}`,
      };
    }
    if (seq !== joinSeq) return superseded();
  }

  if (token !== undefined) {
    const canSet = typeof VRTColocationModule.setAccessToken === "function";
    // Set before the call, so a join or leave that overtakes it clears the token.
    if (canSet) tokenSet = true;
    const set = canSet ? await VRTColocationModule.setAccessToken(token) : false;
    if (set === false) {
      return {
        success: false,
        error: "This native build cannot join with a user token; rebuild with the matching ViroReact",
      };
    }
    if (seq !== joinSeq) return superseded();
  } else if (tokenSet) {
    tokenSet = false;
    await VRTColocationModule.setAccessToken?.("");
    if (seq !== joinSeq) return superseded();
  }

  const result: ViroColocationJoinResult = await VRTColocationModule.join(
    config.roomId,
    apiKey,
    projectId,
    endpoint
  );
  if (
    result?.success &&
    token !== undefined &&
    typeof config.credentials === "function" &&
    seq === joinSeq
  ) {
    stopRenewal = keepUserTokenFresh(config.credentials, token, (next) =>
      VRTColocationModule.setAccessToken(next)
    );
  }
  return result;
}

export async function leaveColocation(): Promise<void> {
  joinSeq++;
  stopRenewal?.();
  stopRenewal = null;
  tokenSet = false;
  if (!VRTColocationModule?.leave) return;
  // Clears the token native holds as well.
  await VRTColocationModule.leave();
}

/**
 * How often it is worth building a pose, in ms.
 *
 * Mirrors the native `poseSendHz` default of 20, which drops anything sent
 * sooner, so publishing faster puts nothing extra on the wire. Calling more
 * often is safe and only costs the string: this exists so an app driving from a
 * camera callback at 90 Hz does not format 16 floats nine times per frame that
 * reaches the socket. **Keep in step with `RVCCAColocationSession.h`.**
 */
export const VIRO_POSE_INTERVAL_MS = 50;

/**
 * Publish the local pose, **in the location frame**.
 *
 * Pass the transform as 16 comma-separated floats, column-major — the same
 * encoding `onLocalized`'s `transform` uses, which `poseCsv()` builds from a
 * position and a look direction. Safe to call every frame: the outbound rate
 * limit lives in native.
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

/**
 * The device id the native channel sends as x-rv-device, for the replication
 * socket to send too: the relay bills a device once while either socket is
 * open. Null without a native channel (web).
 */
export async function getColocationDeviceId(): Promise<string | null> {
  if (!VRTColocationModule?.getDeviceId) return null;
  try {
    const id = await VRTColocationModule.getDeviceId();
    return typeof id === "string" && id.length > 0 ? id : null;
  } catch {
    return null;
  }
}

let knownDeviceId: string | null | undefined;

/**
 * getColocationDeviceId for a socket about to open: synchronous once the id is
 * known, and when there is no native module to ask, so a client that never
 * had one connects exactly as it did before.
 */
export function colocationDeviceIdNow(): string | null | Promise<string | null> {
  if (knownDeviceId !== undefined) return knownDeviceId;
  if (!VRTColocationModule?.getDeviceId) return (knownDeviceId = null);
  return getColocationDeviceId().then((id) => (knownDeviceId = id));
}

/** Peers currently in the room, excluding this device. */
export async function getColocationPeers(): Promise<ViroColocationPeer[]> {
  if (!VRTColocationModule?.getPeers) return [];
  return VRTColocationModule.getPeers();
}
