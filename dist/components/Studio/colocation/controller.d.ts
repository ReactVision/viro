import { getColocationPeers, getColocationState, joinColocation, leaveColocation, setColocationLocalPose, type ViroColocationPeer } from "../../AR/ViroColocation";
import { createColocationRoom, lookupColocationRoom, type ViroColocationRoom } from "../../AR/ViroColocationRooms";
import { type ViroFrameSource, type ViroFrameSupport } from "../../AR/ViroFrameSource";
import { ViroReplicationClient } from "../../AR/ViroReplication";
import type { ViroScanStatus } from "../../Types/ViroEvents";
import type { StudioSceneResponse } from "../types";
import { type StudioAuthContext } from "../VRTStudioModule";
import { type Mat4, type Vec3 } from "./frameMath";
import type { StudioColocationOriginPrompt } from "./indicatorContent";
import { probeRelayRoom } from "./relayProbe";
import { type StudioSharedSceneHooks, type StudioSharedSceneStores } from "./sharedState";
import type { StudioColocationOptions, StudioColocationRoom, StudioColocationState } from "./types";
export declare const STUDIO_COLOCATION_DEFAULT_RELAY_URL = "https://colocation.reactvision.xyz";
export declare const STUDIO_COLOCATION_ORIGIN_ENTITY = "scene:origin";
/** The default `connectTimeoutMs`. */
export declare const STUDIO_COLOCATION_CONNECT_TIMEOUT_MS = 60000;
/**
 * `off`: render the scene alone. `pending`: a shared session is being set up
 * and scene content is withheld. `shared`: content renders in the shared frame.
 */
export type StudioColocationPhase = "off" | "pending" | "shared";
export type StudioColocationFrame = {
    phase: StudioColocationPhase;
    role: "host" | "join" | null;
    /**
     * This device runs the room's once-per-room logic (collision bindings): the
     * host while it is connected, else the connected device with the lowest
     * peer id. False while off.
     */
    authority: boolean;
    /** Host only: nothing has said yet where the scene's origin goes. */
    needsOrigin: boolean;
    /** The scene attached last, the one on screen. Null while off. */
    sceneId: string | null;
    /** Its `claimSceneMount()` number, which tells two mounts of one scene apart. */
    sceneMount: number | null;
    /** Location frame to world, this session. */
    location: Mat4 | null;
    /** Scene (content) frame to location frame, the same on every device. */
    origin: Mat4 | null;
    sceneToWorld: Mat4 | null;
    worldToScene: Mat4 | null;
};
export declare const STUDIO_COLOCATION_OFF_FRAME: StudioColocationFrame;
/**
 * Quest roots a scene in ViroScene (StudioARScene says why), except the scene
 * on screen while a session is set up or shared. The OpenXR session, where a
 * Meta shared anchor lives, is attached only to the selected scene, and the
 * Quest navigator sends shared-frame calls to its first ViroARScene child, so
 * a scene under a push must stay ViroScene.
 */
export declare function studioSceneRootsInAR(frame: Pick<StudioColocationFrame, "phase" | "sceneMount">, mount: number, quest: boolean): boolean;
/**
 * Pushes a scene onto the navigator with the props the navigator gives every
 * scene. `skipOnLoadFunction` when the room took this device there.
 */
export type StudioScenePusher = (sceneData: StudioSceneResponse, options: {
    skipOnLoadFunction: boolean;
}) => void;
export type StudioColocationDeps = {
    getAuth: () => Promise<StudioAuthContext>;
    setCloudAnchorProject: (projectId: string | null) => Promise<void>;
    createRoom: typeof createColocationRoom;
    lookupRoom: typeof lookupColocationRoom;
    probeRelay: typeof probeRelayRoom;
    joinChannel: typeof joinColocation;
    leaveChannel: typeof leaveColocation;
    setLocalPose: typeof setColocationLocalPose;
    getChannelState: typeof getColocationState;
    getPeers: typeof getColocationPeers;
    createReplication: () => ViroReplicationClient;
    frameSourceFor: (room: ViroColocationRoom) => ViroFrameSource | null;
    /** How this device hosts: a Meta anchor on Quest, a scanned cloud anchor elsewhere. */
    hostFrameKind: () => "cloud_anchor" | "meta_group";
    /** Whether a cloud anchor can be hosted here. */
    hostSupport: () => ViroFrameSupport;
    newProbeRoomId: () => string;
    newGroupId: () => string;
    now: () => number;
    loadScene: (sceneId: string) => Promise<StudioSceneResponse>;
    onNavigationError: (error: unknown) => void;
};
/**
 * The matches a resolve has reached. Native reports the count only inside its
 * progress message, as "Anchor seen, keep moving slowly (1/3)".
 */
export declare function resolveMatches(message: string | null | undefined): {
    matches: number;
    needed: number;
} | null;
/** The scan's triangulated points and their floor, when native reports both. */
export declare function scanPoints(status: ViroScanStatus | null): {
    count: number;
    needed: number;
} | null;
/**
 * One instance lives as long as the navigator and reaches every scene through
 * passProps. `request()` starts a session once per distinct `colocation`
 * value, so a re-render with an equal value, or a scene push, changes nothing.
 */
export declare class StudioColocationController {
    onStateChange?: (state: StudioColocationState) => void;
    /** Once per room: when the host has its code, or when a joiner is in. */
    onRoom?: (room: StudioColocationRoom) => void;
    onOriginPrompt?: (prompt: StudioColocationOriginPrompt | null) => void;
    private deps;
    private getNavigator;
    private options;
    private requestedKey;
    private scene;
    private sceneMount;
    private mountCount;
    private sceneStores;
    private sceneHooks;
    private pushScene;
    /** This session's copy of `scene:current`. */
    private navigation;
    /** Bumped per navigation, so a scene that loads after a later one was asked for is dropped. */
    private navigationSeq;
    private pendingStart;
    /** A flow is running; its first state can be a few awaits away. */
    private active;
    private run;
    private cleanups;
    private state;
    private room;
    private announced;
    private auth;
    private projectId;
    private relayUrl;
    private anchorProjectSet;
    /**
     * A scan, a host or a resolve is running natively. Leaving asks native to
     * cancel it: the ReactVision provider closes the scan window and reports
     * pending hosts and resolves as `ErrorCancelled`. An upload already in flight
     * can still finish, and whatever an abandoned operation resolves with later
     * is dropped by its run check.
     */
    private nativeBusy;
    private location;
    private locationInverse;
    private origin;
    private proposedWorldOrigin;
    private replication;
    private sharedState;
    private channelJoined;
    private channelState;
    private peerCount;
    private connectedOnce;
    /** The channel and the shared state were both up at least once this run. */
    private reachedConnected;
    private diagnosing;
    private lastPoseAt;
    private finishScanWaiter;
    private originPrompt;
    private frame;
    private listeners;
    constructor(deps?: Partial<StudioColocationDeps>);
    setNavigatorAccessor(accessor: () => any): void;
    setScenePusher(push: StudioScenePusher | null): void;
    /**
     * The navigator's `colocation` prop. A value equal to the one already
     * requested (same mode, code and relay) only refreshes the options, except
     * that it starts a failed session again unless `restartFailed` is false. A
     * session left under it stays left until the value changes or `retry()`.
     *
     * The navigator passes `restartFailed: false`: a host re-rendering with an
     * equal value after every state change would otherwise retry in a loop.
     */
    request(options: StudioColocationOptions | null, { restartFailed }?: {
        restartFailed?: boolean;
    }): void;
    /**
     * Starts the requested value's session again after it failed or was left.
     * False, changing nothing, while one is running or none is requested.
     */
    retry(): boolean;
    private restart;
    /** Numbers a scene in mount order, at its first render. */
    claimSceneMount(): number;
    /**
     * Called by each scene as it mounts; the latest one is the current scene,
     * and its stores are the ones a shared session shares.
     */
    attachScene(sceneData: StudioSceneResponse, stores?: StudioSharedSceneStores, hooks?: StudioSharedSceneHooks, mount?: number): void;
    /** A scene unmounting; ignored once a later scene has attached its own stores. */
    detachScene(stores: StudioSharedSceneStores): void;
    /**
     * A NAVIGATE while a session is set up or shared goes through the navigator
     * and into the room, so every device follows. False when no session runs:
     * the scene then navigates on its own.
     */
    navigate(targetSceneId: string): boolean;
    /** A local animation trigger in the scene on screen, for the room's other devices. */
    shareAnimation(sceneId: string, assetId: string, key: string): void;
    /** The same `colocation` value stays left until it changes. */
    leave(): void;
    /**
     * Host: ends the scan and hosts it, once the scan covers enough
     * (`canFinish`). False, changing nothing, outside `scanning` or before then.
     */
    finishScan(): boolean;
    /** Unmount: leave, and forget the requested value so a remount starts afresh. */
    dispose(): void;
    getState(): StudioColocationState;
    getRoom(): StudioColocationRoom | null;
    isCurrentScene(sceneId: string): boolean;
    /** Stable between changes, so it can back useSyncExternalStore. */
    getFrame: () => StudioColocationFrame;
    /** Fires on frame changes only (phase, origin, location), never on peers. */
    subscribe: (listener: () => void) => (() => void);
    /** The room's replicated state, while a session is connected. */
    getReplication(): ViroReplicationClient | null;
    readPeers: () => Promise<ViroColocationPeer[]>;
    /**
     * Host: where the scene's origin sits, in this session's world coordinates.
     * The first proposal wins and later ones are ignored, including a pushed
     * scene's, since every scene in a room shares one origin.
     */
    proposeOrigin(worldPose: Mat4): void;
    /** Camera pose in world coordinates; sent in the location frame, throttled. */
    publishCameraPose(position: Vec3, forward: Vec3, up: Vec3): void;
    private begin;
    private host;
    /** Phone: the scan is hosted as a cloud anchor, whose location frame is the room's. */
    private hostCloudAnchor;
    /**
     * Quest: a Meta anchor shared to a fresh group is the room's frame, and the
     * scene sits on the anchor itself, so there is no origin to pick.
     */
    private hostSharedFrame;
    private join;
    private checkBudget;
    /** Credentials, project and anchor project; false once the run has failed or moved on. */
    private prepare;
    /**
     * A session token can expire during a scan or a long session, so a call made
     * well after prepare() reads the credential again. The mode and base URL stay
     * the ones the session started with.
     */
    private reloadAuth;
    private scan;
    /**
     * The frame from `source`, with ViroSharedFrame's retries. A Meta anchor
     * that never answers is not retried: nothing will run the next call either.
     */
    private acquire;
    /** Null when `timeoutMs` passes first, or the session ends. */
    private acquireOnce;
    private connect;
    private refresh;
    private syncOrigin;
    private writeOrigin;
    /**
     * Only a refused origin ends the session, since joiners never go live without
     * one. A refused create leaves no local copy, which is how a refusal that
     * carries no `current` is matched to it.
     */
    private handleReject;
    /**
     * A socket gave up. The relay's gate says why when it refused (a plan that
     * lapsed, a member removed, a full room); otherwise it is the network.
     */
    private diagnose;
    /**
     * From the frame on: a host must connect, and a joiner go live, within
     * `connectTimeoutMs`. A host placing its origin is not timed, since that
     * waits on the person holding the device.
     */
    private startConnectTimeout;
    /**
     * A scene this device put on screen other than by following the room, such
     * as a host changing `sceneId`: a navigation of this device's own.
     */
    private noteSceneShown;
    /**
     * `followed`: the room took this device here, so the device that navigated
     * owns the new scene's on_load function and removed the old scene's rows.
     */
    private enterScene;
    private followRoom;
    private follow;
    /** The room, its rows and the anchor project all belong to one project. */
    private inSessionProject;
    private nextSceneNumber;
    private isCurrent;
    /** A phone host places the scene by its plane mode; a Quest host's origin is the anchor. */
    private picksOrigin;
    private fail;
    private teardown;
    private setState;
    private setLocation;
    private setOrigin;
    private announce;
    private updateFrame;
    /**
     * Host: the room exists and the plane-mode scene waits for a surface. NONE
     * never waits, since the scene proposes its world origin at once.
     */
    private updateOriginPrompt;
    private roomsConfig;
    private relayHeaders;
    private toStudioRoom;
    private every;
    private wait;
}
