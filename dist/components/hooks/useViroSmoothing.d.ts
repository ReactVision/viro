/**
 * Copyright © 2026 ReactVision
 *
 * @providesModule useViroSmoothing
 */
import type { ViroColocationPeer } from "../AR/ViroColocation";
import type { ViroReplicatedEntity } from "../AR/ViroReplication";
export type ViroSmoothingOptions = {
    /**
     * Time to cover half the remaining distance. Lower tracks harder and keeps
     * more of the step; higher glides and trails further behind.
     *
     * The default is deliberately short. Smoothing trades lag for continuity, and
     * a peer marker is a safety cue rather than decoration: at 35 ms the rendered
     * position sits roughly 50 ms behind a continuously moving target, which buys
     * the removal of the 100 ms jumps that make a marker read as unreliable.
     */
    halfLifeMs?: number;
    /** Distance below which the value is set to the target outright. */
    snapEpsilon?: number;
    /** Set false to pass targets straight through, with no frame loop at all. */
    enabled?: boolean;
};
/** Which fields of an entity are worth smoothing, and what they hold. */
export type ViroSmoothedFields = Record<string, "vec3" | "quat">;
export type ViroEntitySmoothingOptions = ViroSmoothingOptions & {
    /**
     * This device's peer id, from `useViroReplicatedState`.
     *
     * Entities it owns are passed straight through. Smoothing exists to hide the
     * gap between one peer's writes and the next, and there is no gap in what
     * this device is holding: the renderer is already moving the node under the
     * finger every frame, and the values arriving are its own writes coming
     * back. Blending them only puts the rendered position behind the hand, which
     * is visible as the object trailing and snapping back on a fast drag.
     */
    localPeerId?: string;
};
/**
 * Glide peer markers between poses instead of stepping between them.
 *
 * Poses go out at `poseSendHz`, 20 by default, so an unsmoothed marker moves in
 * 50 ms jumps. That rate was chosen on the assumption that receivers
 * interpolate, which is this.
 *
 * ```tsx
 * const { peers } = useViroColocation({ roomId, apiKey, projectId });
 * const smoothPeers = useViroSmoothedPeers(peers);
 * ```
 *
 * Updates land at frame rate while anyone is moving, so call it in the
 * component that draws the markers rather than one that draws the whole scene.
 */
export declare function useViroSmoothedPeers(peers: ViroColocationPeer[], options?: ViroSmoothingOptions): ViroColocationPeer[];
/**
 * Glide replicated transforms between writes instead of stepping between them.
 *
 * Only the named fields are touched, because an entity holds whatever the app
 * put in it and a score or a step index must not be averaged on its way to the
 * screen. Anything that is not the shape its entry claims is passed through.
 *
 * ```tsx
 * const { entities } = useViroReplicatedState({ roomId, apiKey, projectId });
 * const smooth = useViroSmoothedEntities(entities, { position: "vec3" });
 * ```
 *
 * Pass `localPeerId` whenever anything here can be dragged: what this device
 * owns is then left alone, which is the half of the contract that keeps a drag
 * tracking the hand.
 */
export declare function useViroSmoothedEntities(entities: ViroReplicatedEntity[], fields: ViroSmoothedFields, options?: ViroEntitySmoothingOptions): ViroReplicatedEntity[];
