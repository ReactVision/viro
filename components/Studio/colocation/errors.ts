import type { ViroReplicationRejectReason } from "../../AR/ViroReplication";
import type { ViroCloudAnchorState } from "../../Types/ViroEvents";
import type {
  StudioColocationErrorCode,
  StudioColocationFrameKind,
} from "./types";

export type StudioColocationFailure = {
  code: StudioColocationErrorCode;
  message: string;
};

/** The relay's own per-room peer ceiling. */
export const ROOM_PEER_LIMIT = 16;

/**
 * A room REST refusal, from `createColocationRoom` / `lookupColocationRoom`.
 * No status means no response arrived, apart from the client's own local
 * refusals, which carry a code.
 */
export function roomErrorCode(
  status: number | undefined,
  code: string | undefined
): StudioColocationErrorCode {
  switch (code) {
    case "PAID_PLAN_REQUIRED":
      return "PAID_PLAN_REQUIRED";
    case "ROOM_NOT_FOUND":
    case "INVALID_JOIN_CODE":
      return "ROOM_NOT_FOUND";
    case "MISSING_API_KEY":
      return "NOT_AUTHORIZED";
  }
  if (status === undefined) return code ? "UNKNOWN" : "UNAVAILABLE";
  if (status === 401 || status === 403) return "NOT_AUTHORIZED";
  if (status === 429 || status >= 500) return "UNAVAILABLE";
  return "UNKNOWN";
}

/**
 * A relay handshake refusal. 404 is a deploy in progress on the relay's host,
 * which clears on its own, so it reads as unavailable rather than missing.
 */
export function relayErrorCode(
  status: number | undefined,
  code: string | undefined
): StudioColocationErrorCode {
  switch (code) {
    case "ROOM_FULL":
      return "ROOM_FULL";
    case "RELAY_AT_CAPACITY":
      return "RELAY_AT_CAPACITY";
    case "PAID_PLAN_REQUIRED":
      return "PAID_PLAN_REQUIRED";
  }
  if (status === undefined) return "UNAVAILABLE";
  if (status === 401 || status === 403) return "NOT_AUTHORIZED";
  if (status === 404 || status === 429 || status >= 500) return "UNAVAILABLE";
  return "UNKNOWN";
}

/** A resolve that failed for good, after any retries. */
export function resolveErrorCode(
  state: ViroCloudAnchorState | undefined
): StudioColocationErrorCode {
  switch (state) {
    case "ErrorNotAuthorized":
    case "ErrorAuthenticationFailed":
      return "NOT_AUTHORIZED";
    case "ErrorResourceExhausted":
    case "ErrorNetworkFailure":
    case "ErrorHostingServiceUnavailable":
      return "UNAVAILABLE";
    case "ErrorNotSupported":
      return "FRAME_KIND_UNSUPPORTED";
    default:
      return "RESOLVE_NO_MATCH";
  }
}

const FRAME_KIND_HOSTS: Record<
  StudioColocationFrameKind,
  { host: string; devices: string }
> = {
  cloud_anchor: { host: "a phone", devices: "phones" },
  meta_group: {
    host: "a Meta Quest headset",
    devices: "Meta Quest headsets",
  },
  visionos_space: {
    host: "an Apple Vision Pro",
    devices: "Apple Vision Pro",
  },
};

/**
 * A room whose frame this device cannot align to. Frames do not cross device
 * families: a cloud anchor and a Meta anchor are unrelated coordinate frames.
 */
export function frameKindUnsupportedFailure(
  frameKind: StudioColocationFrameKind
): StudioColocationFailure {
  const { host, devices } = FRAME_KIND_HOSTS[frameKind];
  return {
    code: "FRAME_KIND_UNSUPPORTED",
    message: `This room was hosted from ${host}, and only ${devices} can join it.`,
  };
}

// Native's refusal on a runtime without XR_META_spatial_entity_group_sharing.
// The frame source reports every Meta failure as ErrorInternal, so the message
// is the only thing that tells it apart.
const META_SHARING_UNAVAILABLE = "Shared frames unavailable";

/** A Meta shared-frame failure that no retry changes, or null. */
export function metaSharingUnavailableFailure(
  error: string
): StudioColocationFailure | null {
  if (!error.startsWith(META_SHARING_UNAVAILABLE)) return null;
  return {
    code: "FRAME_KIND_UNSUPPORTED",
    message:
      "This headset cannot share spatial anchors, which a shared session on Meta Quest needs.",
  };
}

/** The relay refused the host's scene origin write. */
export function originRejectFailure(
  reason: ViroReplicationRejectReason
): StudioColocationFailure {
  const message = `The relay refused the shared scene origin (${reason}).`;
  switch (reason) {
    case "too-many-entities":
    case "room-too-large":
      return { code: "SCENE_TOO_LARGE", message };
    case "org-too-large":
      return { code: "UNAVAILABLE", message };
    default:
      return { code: "UNKNOWN", message };
  }
}

export function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return typeof error === "string" ? error : String(error);
}
