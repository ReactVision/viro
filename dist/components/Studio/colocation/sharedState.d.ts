import type { ViroReplicationClient, ViroReplicationRejection } from "../../AR/ViroReplication";
import type { StudioDragStore } from "../domain/dragStore";
import type { StudioPlacementStore } from "../domain/placementStore";
import type { StudioSoundManager } from "../domain/soundManager";
import type { StudioVariableStore } from "../domain/variableStore";
import type { StudioVisibilityStore } from "../domain/visibilityStore";
import type { StudioSceneResponse } from "../types";
import type { StudioColocationFrame } from "./controller";
import { type Mat4 } from "./frameMath";
import { type StudioRoomSceneStore } from "./navigation";
import { type StudioOutboxOptions } from "./outbox";
export type StudioSharedSceneStores = {
    variables?: StudioVariableStore;
    visibility?: StudioVisibilityStore;
    placement?: StudioPlacementStore;
    drags?: StudioDragStore;
    sounds?: StudioSoundManager;
};
export type StudioSharedSceneHooks = {
    /** Another device's trigger: plays without on_start or on_finish. */
    playAnimation?: (assetId: string, key: string) => void;
    /** The room is moving this device to another scene. */
    leave?: () => void;
};
export type StudioReplicationPort = Pick<ViroReplicationClient, "state" | "localPeerId" | "getEntities" | "get" | "subscribe" | "set" | "claim" | "release" | "delete">;
export type StudioSharedStateContext = {
    /** Scene (content) frame to location frame; null until the origin exists. */
    origin: () => Mat4 | null;
    /** World to location frame. Without it drags stay on this device. */
    worldToLocation?: () => Mat4 | null;
    /** The host's state at its first sync defines the room. */
    role: "host" | "join";
};
/** A write not seen back by then was refused or lost, so the room's copy wins. */
export declare const STUDIO_SHARED_PENDING_TIMEOUT_MS = 5000;
/**
 * Physics simulates on every device, so one contact would run a collision
 * binding once per device; while shared only the host's contacts run them.
 * Gaze and proximity follow each device's own camera and run everywhere, and
 * what they change is shared like any other change.
 */
export declare function collisionBindingsRunHere(frame: StudioColocationFrame): boolean;
/**
 * A shared session's scene state over the room's replication client: one
 * bridge per store, one outbox for their writes. Created with the client and
 * disposed with it; the stores it bridges follow the scene on screen. Drags
 * write outside the outbox, in the half of the relay's rate it leaves them.
 */
export declare class StudioSharedState {
    private client;
    private context;
    private readonly outbox;
    private readonly variables;
    private readonly visibility;
    private readonly placement;
    private readonly navigation;
    private readonly bridges;
    private readonly drags;
    private readonly events;
    private readonly now;
    private readonly unsubscribe;
    private synced;
    private everSynced;
    private disposed;
    private peerId;
    /** Row versions last handed to a bridge, so an unchanged row is not decoded again. */
    private versions;
    /**
     * When each row deleted with the scene this device left was deleted. Until
     * the delete comes back, the scene entered next, even the same one again,
     * must not take the row.
     */
    private removing;
    private sweepTimer;
    private warned;
    constructor(client: StudioReplicationPort, context: StudioSharedStateContext, options?: StudioOutboxOptions);
    /** The scene on screen, its stores and hooks; null stops sharing them. */
    bindScene(sceneData: StudioSceneResponse | null, stores: StudioSharedSceneStores | null, hooks?: StudioSharedSceneHooks | null): void;
    /** This session's copy of the room's scene, for its whole life. */
    bindNavigation(store: StudioRoomSceneStore | null): void;
    /** A trigger on this device, played by the room's others. */
    emitAnimation(sceneId: string, assetId: string, key: string): void;
    /**
     * This device took the room from `sceneData` to another scene: its rows go,
     * as the scene's own state does when it is left alone. Paced like writes.
     */
    removeSceneRows(sceneData: StudioSceneResponse): void;
    /** The scene origin changed, so every placement and drag row converts differently. */
    refreshFrame(): void;
    handleReject(rejection: ViroReplicationRejection): void;
    dispose(): void;
    private handleChange;
    private deliver;
    /** A delete not seen back by then was refused or lost, so the room's row stands. */
    private expireRemovals;
    private unsync;
    private send;
    private rows;
    private bridgeFor;
    private tracked;
    private scheduleSweep;
    private cancelSweep;
}
