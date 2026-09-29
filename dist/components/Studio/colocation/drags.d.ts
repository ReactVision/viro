import type { ViroReplicatedEntity, ViroReplicationRejectReason } from "../../AR/ViroReplication";
import type { StudioDragStore } from "../domain/dragStore";
import type { StudioSceneResponse } from "../types";
import { type Mat4 } from "./frameMath";
export declare const STUDIO_DRAG_PREFIX = "drag:";
/**
 * The renderer reports a drag's moves and never its end, so this long without
 * a move ends it. Longer than a pause mid-drag, since the end gives up the claim.
 */
export declare const STUDIO_DRAG_IDLE_MS = 500;
export type StudioDragHost = {
    isSynced(): boolean;
    localPeerId(): string;
    claim(id: string): void;
    release(id: string): void;
    set(id: string, fields: Record<string, unknown>): void;
    remove(id: string): void;
    entity(id: string): ViroReplicatedEntity | undefined;
    entities(prefix: string): ViroReplicatedEntity[];
    /** Scene (content) frame to location frame. */
    origin(): Mat4 | null;
    worldToLocation(): Mat4 | null;
    now(): number;
};
/**
 * `drag:<assetId>` = `{ p }` in the location frame. A drag here claims the row
 * at its first move, writes the position at most once per write interval and
 * releases the row when it ends; while another device holds a row this device
 * cannot drag that asset. The relay releases a departed peer's rows itself.
 *
 * Rows are applied to the scene's drag store, never to scene state, so a drag
 * elsewhere repaints only the node it moves.
 */
export declare class StudioDragBridge {
    private host;
    private intervalMs;
    private idleMs;
    private store;
    private unsubscribe;
    private shareable;
    private drags;
    /** This device's last write per asset: its echo is where the node already is. */
    private written;
    constructor(host: StudioDragHost, intervalMs?: number, idleMs?: number);
    /** Draggable assets outside image markers, whose content stays per device. */
    bind(store: StudioDragStore | null, sceneData: StudioSceneResponse | null): void;
    receive(assetId: string, entity: ViroReplicatedEntity): void;
    removed(assetId: string): void;
    rejected(assetId: string, reason: ViroReplicationRejectReason, current: ViroReplicatedEntity | undefined): void;
    sync(): void;
    /** The scene origin changed, so every row converts differently. */
    refresh(): void;
    /** The relay released this device's rows with its socket. */
    unsynced(): void;
    dispose(): void;
    private onMove;
    private schedule;
    private send;
    /** The last position goes out before the release, which the relay orders after it. */
    private end;
    private stopTimers;
    private adoptAll;
    /**
     * `force` repaints the room's position even where it has not changed: the
     * node was moved natively by a drag the room refused.
     */
    private applyRow;
}
