/**
 * Copyright © 2026 ReactVision
 *
 * Frame sources — where a shared coordinate frame comes from.
 *
 * Co-location needs every device in a space to agree on one origin. *How* that
 * origin is established is a platform question, not a co-location question:
 *
 *   - phones     → a resolved ReactVision cloud anchor (SIFT relocalisation)
 *   - Quest      → a shared Meta spatial anchor
 *   - visionOS   → ARKit's shared coordinate space
 *
 * The channel that carries poses between devices (`RVCCAColocationSession`)
 * never asks which of these produced the frame — it only ever moves coordinates
 * *in* the frame. This interface is that seam made explicit, so a new platform
 * is an adapter rather than a fork of the feature.
 *
 * Cross-family co-location is deliberately out of scope: a Quest on a Meta
 * anchor and a phone on a cloud anchor are in unrelated frames, and nothing has
 * observed both. See `plans/viro-colocation-plan.md` §5 decision 6.
 *
 * @providesModule ViroFrameSource
 */
import { ViroCloudAnchorState } from "../Types/ViroEvents";
/** Whether a source can run at all on the device it finds itself on. */
export type ViroFrameSupport = {
    ok: true;
} | {
    ok: false;
    reason: string;
};
/** A resolved frame, in this session's world coordinates. */
export type ViroSharedFrameValue = {
    position: [number, number, number];
    /** Euler degrees, matching ViroNode's `rotation` prop. */
    rotation: [number, number, number];
    scale: [number, number, number];
    /**
     * Opaque token for the frame. Pass to `loadWorldMeshFromFile()` as-is, or to
     * `parseLocationTransform()` when converting coordinates for another device.
     */
    transform: string;
};
export type ViroFrameOutcome = {
    success: true;
    frame: ViroSharedFrameValue;
} | {
    success: false;
    error: string;
    state?: ViroCloudAnchorState;
};
/** What a source is given to do its job. */
export type ViroFrameSourceContext = {
    /** The navigator the scene was handed by its ViroXRSceneNavigator. */
    arSceneNavigator: any;
};
export interface ViroFrameSource {
    /**
     * Stable identifier for the frame this source produces.
     *
     * Doubles as the room key for the co-location channel: two devices acquiring
     * the same key are, by definition, in the same space.
     */
    readonly key: string;
    /** For logs and error messages — "cloud anchor", "Meta spatial anchor". */
    readonly name: string;
    /** Checked before `acquire()` so an unsupported platform fails immediately. */
    readonly support: ViroFrameSupport;
    acquire(ctx: ViroFrameSourceContext): Promise<ViroFrameOutcome>;
}
/**
 * Frame from a ReactVision cloud anchor — the phone path.
 *
 * Unsupported on both headsets, and structurally so rather than for want of
 * wiring: Quest's OpenXR session stubs cloud anchors and produces no camera
 * frame for the SIFT localiser to run on, and visionOS builds exclude the AR
 * subsystem entirely (zero `VROAR*` objects in the shipped library) on top of
 * gating passthrough camera access behind an enterprise entitlement.
 *
 * Use `metaSpatialAnchorFrameSource` / `visionOSSharedSpaceFrameSource` there.
 */
export declare function cloudAnchorFrameSource(cloudAnchorId: string): ViroFrameSource;
/**
 * Frame from a Meta shared spatial anchor — the Quest path (CL-H).
 *
 * Nothing is uploaded and nothing is relocalised from camera imagery, which is
 * the point: Quest gives no camera frames to the SIFT localiser, but its own
 * spatial anchors already solve co-location. One device calls this with
 * `create`, the rest with `join`, and `groupId` — a UUID the app picks — names
 * the space, the frame and the co-location room all at once.
 *
 * @param groupId  UUID shared out-of-band, exactly like a cloud anchor id.
 * @param mode     `"create"` publishes a new frame; `"join"` recovers one.
 */
export declare function metaSpatialAnchorFrameSource(groupId: string, mode?: "create" | "join"): ViroFrameSource;
/**
 * Frame from ARKit's shared coordinate space — the visionOS path (CL-I).
 *
 * Shaped differently from the other two, and the difference is the whole point:
 * phone and Quest hand back an anchor to locate, whereas visionOS aligns the
 * **world origin itself** across participants. So there is no transform to
 * apply — once the space converges the frame is identity, and content placed at
 * a world position is already in the same physical spot everywhere.
 *
 * ARKit does not move the alignment data. Poll
 * `ViroVisionOSModule.sharedSpaceNextOutgoing()` and deliver whatever it
 * returns to the other participants, over whatever transport the app already
 * has; they call `sharedSpacePushIncoming()`. Until both sides pump, the space
 * never converges and this never resolves.
 *
 * @param sessionId  Names the co-location room. Not used by ARKit, which
 *                   discovers participants itself — it exists so the channel
 *                   has a room key, like the other sources.
 * @param timeoutMs  How long to wait for convergence before giving up.
 */
export declare function visionOSSharedSpaceFrameSource(sessionId: string, timeoutMs?: number): ViroFrameSource;
