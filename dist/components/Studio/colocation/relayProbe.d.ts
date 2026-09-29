export type RelayProbeResult = {
    ok: true;
    peers: number;
} | {
    ok: false;
    status?: number;
    code?: string;
    message: string;
};
/**
 * A plain GET on the relay's channel path. The relay runs its whole admission
 * gate for it (credentials, membership, plan) and answers with the room's peer
 * count instead of upgrading, and it does not create the room. A refused
 * WebSocket upgrade hides its status and body from JS, so this is how a
 * refusal reaches the app with its code.
 */
export declare function probeRelayRoom(endpoint: string, roomId: string, headers: Record<string, string>): Promise<RelayProbeResult>;
