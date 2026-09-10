/**
 * Copyright © 2026 ReactVision
 *
 * @providesModule useViroReplicatedState
 */
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.useViroReplicatedState = useViroReplicatedState;
const react_1 = require("react");
const ViroReplication_1 = require("../AR/ViroReplication");
/**
 * Replicated room state, ordered and conflict-resolved by the server.
 *
 * ```tsx
 * const { entities, claim, set, isMine } = useViroReplicatedState({
 *   roomId: cloudAnchorId, apiKey, projectId,
 *   enabled: frameReady,
 * });
 *
 * // Grab it, then move it — while held, nobody else can.
 * claim('cube');
 * if (isMine('cube')) set('cube', { position: [0, 0, -1] }, { optimistic: true });
 * ```
 *
 * Positions stored here are **location-frame** coordinates, same as the
 * channel: world coordinates are per-session and mean nothing to a peer.
 */
function useViroReplicatedState(options) {
    const { roomId, apiKey, projectId, endpoint, enabled = true, onReject } = options;
    const client = (0, react_1.useMemo)(() => new ViroReplication_1.ViroReplicationClient(), []);
    const [, force] = (0, react_1.useState)(0);
    // Kept in a ref so changing the handler does not tear down the connection.
    const rejectRef = (0, react_1.useRef)(onReject);
    rejectRef.current = onReject;
    (0, react_1.useEffect)(() => {
        client.onReject = (r) => rejectRef.current?.(r);
        const unsubscribe = client.subscribe(() => force((n) => n + 1));
        if (enabled && roomId) {
            client.connect({ roomId, apiKey, projectId, endpoint });
        }
        return () => {
            unsubscribe();
            client.onReject = undefined;
            client.disconnect();
        };
    }, [client, roomId, apiKey, projectId, endpoint, enabled]);
    return {
        state: client.state,
        localPeerId: client.localPeerId,
        entities: client.getEntities(),
        byId: (id) => client.get(id),
        error: client.error,
        claim: (id, opts) => client.claim(id, opts),
        release: (id) => client.release(id),
        set: (id, fields, opts) => client.set(id, fields, opts),
        remove: (id, opts) => client.delete(id, opts),
        isMine: (id) => {
            const e = client.get(id);
            return !!e && e.owner !== null && e.owner === client.localPeerId;
        },
    };
}
