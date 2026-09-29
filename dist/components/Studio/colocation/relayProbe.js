"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.probeRelayRoom = probeRelayRoom;
/**
 * A plain GET on the relay's channel path. The relay runs its whole admission
 * gate for it (credentials, membership, plan) and answers with the room's peer
 * count instead of upgrading, and it does not create the room. A refused
 * WebSocket upgrade hides its status and body from JS, so this is how a
 * refusal reaches the app with its code.
 */
async function probeRelayRoom(endpoint, roomId, headers) {
    const base = endpoint.replace(/\/+$/, "");
    const url = `${base}/functions/v1/colocation/${encodeURIComponent(roomId)}`;
    let response;
    try {
        response = await fetch(url, { method: "GET", headers });
    }
    catch (e) {
        return { ok: false, message: e?.message ?? "Network request failed" };
    }
    let parsed = null;
    try {
        parsed = await response.json();
    }
    catch {
        // A status without a body still says enough.
    }
    if (!response.ok) {
        return {
            ok: false,
            status: response.status,
            code: parsed?.error?.code,
            message: parsed?.error?.message ?? `Request failed (${response.status})`,
        };
    }
    return {
        ok: true,
        peers: typeof parsed?.peers === "number" ? parsed.peers : 0,
    };
}
