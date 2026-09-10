/**
 * Copyright © 2026 ReactVision
 *
 * @providesModule useViroColocation
 */
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.useViroColocation = useViroColocation;
const react_1 = require("react");
const ViroColocation_1 = require("../AR/ViroColocation");
/**
 * Join a co-location room and track its peers.
 *
 * ```tsx
 * const { peers, publishPose } = useViroColocation({
 *   roomId: cloudAnchorId, apiKey, projectId,
 *   enabled: frameReady,
 * });
 * ```
 *
 * Poses on this channel are **location-frame** coordinates. Convert before
 * publishing and after receiving — see `ViroLocationFrame`.
 */
function useViroColocation(options) {
    const { roomId, apiKey, projectId, endpoint, enabled = true, pollMs = 100 } = options;
    const [available, setAvailable] = (0, react_1.useState)(false);
    const [state, setState] = (0, react_1.useState)("idle");
    const [localPeerId, setLocalPeerId] = (0, react_1.useState)("");
    const [peers, setPeers] = (0, react_1.useState)([]);
    const [error, setError] = (0, react_1.useState)();
    // Guards every async continuation: joining and polling both outlive an
    // unmount, and a room switch has to invalidate the previous join's result.
    const activeRoom = (0, react_1.useRef)(null);
    (0, react_1.useEffect)(() => {
        let cancelled = false;
        let timer;
        const run = async () => {
            const ok = await (0, ViroColocation_1.isColocationAvailable)();
            if (cancelled)
                return;
            setAvailable(ok);
            if (!ok || !enabled || !roomId)
                return;
            activeRoom.current = roomId;
            const result = await (0, ViroColocation_1.joinColocation)({ roomId, apiKey, projectId, endpoint });
            if (cancelled || activeRoom.current !== roomId)
                return;
            if (!result.success) {
                setError(result.error ?? "Join failed");
                setState("failed");
                return;
            }
            setError(undefined);
            timer = setInterval(async () => {
                const [s, p] = await Promise.all([(0, ViroColocation_1.getColocationState)(), (0, ViroColocation_1.getColocationPeers)()]);
                if (cancelled || activeRoom.current !== roomId)
                    return;
                setState(s.state);
                setLocalPeerId(s.localPeerId);
                setPeers(p);
            }, pollMs);
        };
        run();
        return () => {
            cancelled = true;
            activeRoom.current = null;
            if (timer)
                clearInterval(timer);
            // Leaving on unmount is right even mid-join: the native session is
            // process-wide, so a stale membership would outlive the component.
            (0, ViroColocation_1.leaveColocation)();
            setPeers([]);
            setLocalPeerId("");
            setState("idle");
        };
    }, [roomId, apiKey, projectId, endpoint, enabled, pollMs]);
    return {
        available,
        state,
        localPeerId,
        peers,
        error,
        publishPose: ViroColocation_1.setColocationLocalPose,
    };
}
