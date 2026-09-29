import type { ViroReplicationRejectReason } from "../../AR/ViroReplication";
import type { ViroCloudAnchorState } from "../../Types/ViroEvents";
import type { StudioColocationErrorCode, StudioColocationFrameKind } from "./types";
export type StudioColocationFailure = {
    code: StudioColocationErrorCode;
    message: string;
};
/** The relay's own per-room peer ceiling. */
export declare const ROOM_PEER_LIMIT = 16;
/**
 * A room REST refusal, from `createColocationRoom` / `lookupColocationRoom`.
 * No status means no response arrived, apart from the client's own local
 * refusals, which carry a code.
 */
export declare function roomErrorCode(status: number | undefined, code: string | undefined): StudioColocationErrorCode;
/**
 * A relay handshake refusal. 404 is a deploy in progress on the relay's host,
 * which clears on its own, so it reads as unavailable rather than missing.
 */
export declare function relayErrorCode(status: number | undefined, code: string | undefined): StudioColocationErrorCode;
/** A resolve that failed for good, after any retries. */
export declare function resolveErrorCode(state: ViroCloudAnchorState | undefined): StudioColocationErrorCode;
/**
 * A room whose frame this device cannot align to. Frames do not cross device
 * families: a cloud anchor and a Meta anchor are unrelated coordinate frames.
 */
export declare function frameKindUnsupportedFailure(frameKind: StudioColocationFrameKind): StudioColocationFailure;
/** A Meta shared-frame failure that no retry changes, or null. */
export declare function metaSharingUnavailableFailure(error: string): StudioColocationFailure | null;
/** The relay refused the host's scene origin write. */
export declare function originRejectFailure(reason: ViroReplicationRejectReason): StudioColocationFailure;
export declare function errorMessage(error: unknown): string;
