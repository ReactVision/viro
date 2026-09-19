/**
 * Copyright © 2026 ReactVision
 *
 * @providesModule useViroSmoothing
 */
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.useViroSmoothedPeers = useViroSmoothedPeers;
exports.useViroSmoothedEntities = useViroSmoothedEntities;
const react_1 = require("react");
const ViroSmoothing_1 = require("../AR/ViroSmoothing");
const DEFAULT_HALF_LIFE_MS = 35;
/**
 * Drive a blend toward the latest target every frame.
 *
 * Timing comes from the frame callback and nothing else. A pose carries the
 * sender's clock, device clocks are not synchronised, and differencing one
 * against the local clock is what makes the device with the longer uptime
 * flicker while the other never settles.
 *
 * The loop runs whenever this is enabled, because a frame of arithmetic over a
 * handful of entries costs nothing. What is gated is the state update, which is
 * the part that re-renders every consumer, so a still room is free.
 */
function useSmoothedList(targets, keyOf, blend, options) {
    const { halfLifeMs = DEFAULT_HALF_LIFE_MS, snapEpsilon = ViroSmoothing_1.DEFAULT_SNAP_EPSILON, enabled = true, } = options ?? {};
    const [smoothed, setSmoothed] = (0, react_1.useState)(targets);
    const targetsRef = (0, react_1.useRef)(targets);
    (0, react_1.useEffect)(() => {
        targetsRef.current = targets;
    });
    const currentRef = (0, react_1.useRef)(new Map());
    const emittedRef = (0, react_1.useRef)([]);
    (0, react_1.useEffect)(() => {
        if (!enabled)
            return;
        let frame = 0;
        let last = 0;
        let cancelled = false;
        const tick = (nowMs) => {
            if (cancelled)
                return;
            const factor = (0, ViroSmoothing_1.approachFactor)(last ? nowMs - last : 16, halfLifeMs);
            last = nowMs;
            const live = targetsRef.current;
            const map = currentRef.current;
            const next = live.map((target) => {
                const key = keyOf(target);
                // Someone who just joined is adopted where they are. Blending them in
                // from nothing would fly their marker across the room on arrival.
                const previous = map.get(key);
                const value = previous === undefined
                    ? target
                    : blend(previous, target, factor, snapEpsilon);
                map.set(key, value);
                return value;
            });
            if (map.size > live.length) {
                const present = new Set(live.map(keyOf));
                for (const key of [...map.keys()])
                    if (!present.has(key))
                        map.delete(key);
            }
            // Reference equality throughout: the approach helpers hand back the
            // target itself once it is reached, so a settled list produces the same
            // references every frame and never reaches setState.
            const previous = emittedRef.current;
            const changed = next.length !== previous.length ||
                next.some((v, i) => v !== previous[i]);
            if (changed) {
                emittedRef.current = next;
                setSmoothed(next);
            }
            frame = requestAnimationFrame(tick);
        };
        frame = requestAnimationFrame(tick);
        return () => {
            cancelled = true;
            cancelAnimationFrame(frame);
        };
    }, [enabled, halfLifeMs, snapEpsilon, keyOf, blend]);
    return enabled ? smoothed : targets;
}
function peerKey(peer) {
    return peer.peerId;
}
function blendPeer(previous, target, factor, snapEpsilon) {
    const position = (0, ViroSmoothing_1.approachVec3)(previous.position, target.position, factor, snapEpsilon);
    const rotation = (0, ViroSmoothing_1.approachQuat)(previous.rotation, target.rotation, factor, snapEpsilon);
    if (position === target.position && rotation === target.rotation)
        return target;
    return { ...target, position, rotation };
}
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
function useViroSmoothedPeers(peers, options) {
    return useSmoothedList(peers, peerKey, blendPeer, options);
}
function entityKey(entity) {
    return entity.id;
}
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
function useViroSmoothedEntities(entities, fields, options) {
    const fieldsRef = (0, react_1.useRef)(fields);
    const localPeerIdRef = (0, react_1.useRef)(options?.localPeerId);
    (0, react_1.useEffect)(() => {
        fieldsRef.current = fields;
        localPeerIdRef.current = options?.localPeerId;
    });
    const blend = (0, react_1.useRef)((previous, target, factor, snapEpsilon) => {
        const mine = localPeerIdRef.current;
        if (mine && target.owner === mine)
            return target;
        let moved;
        for (const name of Object.keys(fieldsRef.current)) {
            const kind = fieldsRef.current[name];
            const to = target.fields[name];
            const from = previous.fields[name];
            let value;
            if (kind === "vec3" && (0, ViroSmoothing_1.isVec3)(from) && (0, ViroSmoothing_1.isVec3)(to)) {
                value = (0, ViroSmoothing_1.approachVec3)(from, to, factor, snapEpsilon);
            }
            else if (kind === "quat" && (0, ViroSmoothing_1.isQuat)(from) && (0, ViroSmoothing_1.isQuat)(to)) {
                value = (0, ViroSmoothing_1.approachQuat)(from, to, factor, snapEpsilon);
            }
            else {
                continue;
            }
            if (value === to)
                continue;
            moved = moved ?? { ...target.fields };
            moved[name] = value;
        }
        return moved ? { ...target, fields: moved } : target;
    }).current;
    return useSmoothedList(entities, entityKey, blend, options);
}
