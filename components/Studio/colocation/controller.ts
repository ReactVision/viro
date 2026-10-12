import {
  getColocationPeers,
  getColocationState,
  joinColocation,
  leaveColocation,
  setColocationLocalPose,
  VIRO_POSE_INTERVAL_MS,
  type ViroColocationPeer,
  type ViroColocationState,
} from "../../AR/ViroColocation";
import {
  createColocationRoom,
  lookupColocationRoom,
  type ViroColocationRoom,
  type ViroColocationRoomsConfig,
  type ViroRoomFrame,
} from "../../AR/ViroColocationRooms";
import {
  cloudAnchorFrameSource,
  metaSpatialAnchorFrameSource,
  visionOSSharedSpaceFrameSource,
  type ViroFrameOutcome,
  type ViroFrameSource,
  type ViroFrameSupport,
  type ViroSharedFrameValue,
} from "../../AR/ViroFrameSource";
import { parseLocationTransform, poseCsv } from "../../AR/ViroLocationFrame";
import {
  ViroReplicationClient,
  type ViroReplicationConfig,
  type ViroReplicationRejection,
} from "../../AR/ViroReplication";
import type { ViroScanStatus } from "../../Types/ViroEvents";
import { isQuest } from "../../Utilities/ViroPlatform";
import { onRoomMoved } from "../../Utilities/VRModuleOpenXR";
import { showStudioAlert } from "../domain/questAlertStore";
import { studioApiError } from "../domain/studioApiError";
import type { StudioSceneResponse } from "../types";
import { type StudioAuthContext, VRTStudioModule } from "../VRTStudioModule";
import {
  estimateSharedEntities,
  STUDIO_COLOCATION_ENTITY_LIMIT,
} from "./budget";
import {
  errorMessage,
  frameKindUnsupportedFailure,
  metaSharingUnavailableFailure,
  originRejectFailure,
  relayErrorCode,
  resolveErrorCode,
  ROOM_PEER_LIMIT,
  roomErrorCode,
  type StudioColocationFailure,
} from "./errors";
import {
  fromPositionEuler,
  fromPositionQuat,
  IDENTITY,
  invert,
  type Mat4,
  multiply,
  parseOriginFields,
  rotateDirection,
  toPositionQuat,
  transformPoint,
  type Vec3,
} from "./frameMath";
import type { StudioColocationOriginPrompt } from "./indicatorContent";
import {
  roomSceneNeedsNavigation,
  STUDIO_COLOCATION_CURRENT_SCENE_ENTITY,
  type StudioRoomScene,
  StudioRoomSceneStore,
} from "./navigation";
import { probeRelayRoom, type RelayProbeResult } from "./relayProbe";
import {
  type StudioSharedSceneHooks,
  type StudioSharedSceneStores,
  StudioSharedState,
} from "./sharedState";
import type {
  StudioColocationErrorCode,
  StudioColocationFrameKind,
  StudioColocationOptions,
  StudioColocationRoom,
  StudioColocationState,
} from "./types";

export const STUDIO_COLOCATION_DEFAULT_RELAY_URL =
  "https://colocation.reactvision.xyz";
export const STUDIO_COLOCATION_ORIGIN_ENTITY = "scene:origin";

const JOIN_URL_BASE = "https://studio.reactvision.xyz/j/";
const SCAN_STATUS_POLL_MS = 500;
const RESOLVE_PROGRESS_POLL_MS = 500;
/** How long a scan runs before Done is offered when native reports no coverage. */
const SCAN_FALLBACK_MS = 10000;
/**
 * Native's own floor is 2 keyframes, and its other gates open about 5 s into a
 * scan (12 keyframes on a Pixel 6 Pro). Pixel maps of 96 and 211 features
 * resolved on no device; a 20 s walk gave 662.
 */
const MIN_SCAN_KEYFRAMES = 30;
const RESOLVE_ATTEMPTS = 3;
const RESOLVE_RETRY_DELAY_MS = 1000;
const CHANNEL_POLL_MS = 500;
const HOST_ANCHOR_TTL_DAYS = 1;
const FOLLOW_ATTEMPTS = 3;
const FOLLOW_RETRY_DELAY_MS = 1000;
/**
 * A Meta anchor is shared or found in seconds, but the native call is queued
 * unanswered while the headset has no mixed-reality session to run it in.
 */
const SHARED_FRAME_TIMEOUT_MS = 30000;
/** The default `connectTimeoutMs`. */
export const STUDIO_COLOCATION_CONNECT_TIMEOUT_MS = 60000;

/** Same set as ViroSharedFrame: a failure that another window can change. */
const RETRYABLE_RESOLVE_STATES: ReadonlySet<string> = new Set([
  "ErrorResolvingLocalizationNoMatch",
  "ErrorNetworkFailure",
  "ErrorHostingServiceUnavailable",
  "ErrorInternal",
  "TaskInProgress",
]);

const IDLE: StudioColocationState = { status: "idle" };

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

export const STUDIO_COLOCATION_OFF_FRAME: StudioColocationFrame = {
  phase: "off",
  role: null,
  authority: false,
  needsOrigin: false,
  sceneId: null,
  sceneMount: null,
  location: null,
  origin: null,
  sceneToWorld: null,
  worldToScene: null,
};

/**
 * Quest roots a scene in ViroScene (StudioARScene says why), except the scene
 * on screen while a session is set up or shared, and outside a session a scene
 * that can use the room's planes (`questPlanes`). The OpenXR session, where a
 * Meta shared anchor lives, is attached only to the selected scene, and the
 * Quest navigator sends shared-frame calls to its first ViroARScene child, so
 * a scene under a push must stay ViroScene while a session runs.
 */
export function studioSceneRootsInAR(
  frame: Pick<StudioColocationFrame, "phase" | "sceneMount">,
  mount: number,
  quest: boolean,
  questPlanes = false
): boolean {
  if (!quest) return true;
  if (frame.phase === "off") return questPlanes;
  // A scene renders before it attaches, and only the one being pushed can be
  // newer than the attached scene.
  return frame.sceneMount === null || mount >= frame.sceneMount;
}

/**
 * Pushes a scene onto the navigator with the props the navigator gives every
 * scene. `skipOnLoadFunction` when the room took this device there.
 */
export type StudioScenePusher = (
  sceneData: StudioSceneResponse,
  options: { skipOnLoadFunction: boolean }
) => void;

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
  /** Quest: a recentre moved world coordinates against the room. */
  onRoomMoved: (listener: (move: Mat4) => void) => () => void;
};

function defaultFrameSourceFor(
  room: ViroColocationRoom
): ViroFrameSource | null {
  switch (room.frameKind) {
    case "cloud_anchor":
      return room.cloudAnchorId
        ? cloudAnchorFrameSource(room.cloudAnchorId)
        : null;
    case "meta_group":
      return room.frameRef
        ? metaSpatialAnchorFrameSource(room.frameRef, "join")
        : null;
    case "visionos_space":
      return visionOSSharedSpaceFrameSource(room.roomId);
    default:
      return null;
  }
}

/** What native accepts as a group id: 32 hex digits, hyphens anywhere. */
function isGroupUuid(value: string): boolean {
  return /^[0-9a-f]{32}$/i.test(value.replace(/-/g, ""));
}

function randomUuid(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

async function loadStudioScene(sceneId: string): Promise<StudioSceneResponse> {
  const result = await VRTStudioModule.rvGetScene(sceneId);
  if (!result?.success) throw studioApiError("rvGetScene", result?.error);
  if (typeof result.data !== "string") {
    throw new Error("rvGetScene returned no data");
  }
  return JSON.parse(result.data);
}

function outsideProjectError(sceneId: string): Error {
  return new Error(`Scene ${sceneId} is not in the shared session's project.`);
}

/** As a NAVIGATE on its own reports a scene that failed to load. */
function reportNavigationError(error: unknown): void {
  console.error("[Studio] Error navigating to scene:", error);
  showStudioAlert("Navigation Error", "Failed to load scene");
}

const DEFAULT_DEPS: StudioColocationDeps = {
  getAuth: () => VRTStudioModule.rvGetAuthHeaders(),
  setCloudAnchorProject: (projectId) =>
    VRTStudioModule.rvSetCloudAnchorProject(projectId),
  createRoom: createColocationRoom,
  lookupRoom: lookupColocationRoom,
  probeRelay: probeRelayRoom,
  joinChannel: joinColocation,
  leaveChannel: leaveColocation,
  setLocalPose: setColocationLocalPose,
  getChannelState: getColocationState,
  getPeers: getColocationPeers,
  createReplication: () => new ViroReplicationClient(),
  frameSourceFor: defaultFrameSourceFor,
  hostFrameKind: () => (isQuest ? "meta_group" : "cloud_anchor"),
  hostSupport: () => cloudAnchorFrameSource("").support,
  // Not a room: an id to describe, which runs the relay's gate and creates nothing.
  newProbeRoomId: randomUuid,
  newGroupId: randomUuid,
  now: () => Date.now(),
  loadScene: loadStudioScene,
  onNavigationError: reportNavigationError,
  onRoomMoved,
};

function optionsKey(options: StudioColocationOptions): string {
  const relay = options.relayUrl ?? "";
  return options.mode === "host"
    ? `host|${relay}`
    : `join|${options.code.replace(/\s+/g, "").toUpperCase()}|${relay}`;
}

function asFrameKind(value: string | null): StudioColocationFrameKind | null {
  return value === "cloud_anchor" ||
    value === "meta_group" ||
    value === "visionos_space"
    ? value
    : null;
}

function headerValue(
  headers: Record<string, string>,
  name: string
): string | undefined {
  const key = Object.keys(headers).find((k) => k.toLowerCase() === name);
  return key === undefined ? undefined : headers[key];
}

/**
 * The matches a resolve has reached. Native reports the count only inside its
 * progress message, as "Anchor seen, keep moving slowly (1/3)".
 */
export function resolveMatches(
  message: string | null | undefined
): { matches: number; needed: number } | null {
  const m = message ? /\((\d+)\/(\d+)\)\s*$/.exec(message) : null;
  if (!m) return null;
  const matches = Number(m[1]);
  const needed = Number(m[2]);
  return matches > 0 && needed > 0 ? { matches, needed } : null;
}

function isCount(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v) && v >= 0;
}

/** The scan's triangulated points and their floor, when native reports both. */
export function scanPoints(
  status: ViroScanStatus | null
): { count: number; needed: number } | null {
  if (!status?.available) return null;
  const count = status.triangulatedPoints;
  const needed = status.minTriangulatedPoints;
  return isCount(count) && isCount(needed) ? { count, needed } : null;
}

/** Every coverage gate native reports, or null when it reports none. */
function scanGuidance(status: ViroScanStatus | null): boolean | null {
  if (!status?.available) return null;
  const points = scanPoints(status);
  const gates = [
    status.meetsKeyframes,
    status.meetsViewpointPairs,
    status.meetsSpread,
    typeof status.keyframes === "number"
      ? status.keyframes >= MIN_SCAN_KEYFRAMES
      : undefined,
    points ? points.count >= points.needed : undefined,
  ].filter((g): g is boolean => typeof g === "boolean");
  return gates.length === 0 ? null : gates.every(Boolean);
}

function frameToLocation(frame: ViroSharedFrameValue): Mat4 {
  return (
    parseLocationTransform(frame.transform) ??
    fromPositionEuler(frame.position, frame.rotation, frame.scale)
  );
}

function sameMatrix(a: Mat4 | null, b: Mat4 | null): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return a.every((v, i) => Math.abs(v - b[i]) < 1e-5);
}

function sameState(
  a: StudioColocationState,
  b: StudioColocationState
): boolean {
  switch (a.status) {
    case "scanning":
      return (
        b.status === "scanning" &&
        a.canFinish === b.canFinish &&
        a.points?.count === b.points?.count &&
        a.points?.needed === b.points?.needed
      );
    case "resolving":
      return (
        b.status === "resolving" &&
        a.attempt === b.attempt &&
        a.seen?.matches === b.seen?.matches &&
        a.seen?.needed === b.seen?.needed
      );
    case "live":
      return b.status === "live" && a.room === b.room && a.peers === b.peers;
    case "waiting_for_host":
    case "reconnecting":
      return b.status === a.status && a.room === b.room;
    case "failed":
      return (
        b.status === "failed" && a.code === b.code && a.message === b.message
      );
    default:
      return a.status === b.status;
  }
}

/**
 * One instance lives as long as the navigator and reaches every scene through
 * passProps. `request()` starts a session once per distinct `colocation`
 * value, so a re-render with an equal value, or a scene push, changes nothing.
 */
export class StudioColocationController {
  onStateChange?: (state: StudioColocationState) => void;
  /** Once per room: when the host has its code, or when a joiner is in. */
  onRoom?: (room: StudioColocationRoom) => void;
  onOriginPrompt?: (prompt: StudioColocationOriginPrompt | null) => void;

  private deps: StudioColocationDeps;
  private getNavigator: () => any = () => null;

  private options: StudioColocationOptions | null = null;
  private requestedKey: string | null = null;
  private scene: StudioSceneResponse | null = null;
  private sceneMount: number | null = null;
  private mountCount = 0;
  private sceneStores: StudioSharedSceneStores | null = null;
  private sceneHooks: StudioSharedSceneHooks | null = null;
  private pushScene: StudioScenePusher | null = null;
  /** This session's copy of `scene:current`. */
  private navigation: StudioRoomSceneStore | null = null;
  /** Bumped per navigation, so a scene that loads after a later one was asked for is dropped. */
  private navigationSeq = 0;
  private pendingStart = false;
  /** A flow is running; its first state can be a few awaits away. */
  private active = false;
  private run = 0;
  private cleanups: Array<() => void> = [];

  private state: StudioColocationState = IDLE;
  private room: StudioColocationRoom | null = null;
  private announced = false;
  private auth: StudioAuthContext | null = null;
  private projectId: string | null = null;
  private relayUrl = STUDIO_COLOCATION_DEFAULT_RELAY_URL;
  private anchorProjectSet = false;
  /**
   * A scan, a host or a resolve is running natively. Leaving asks native to
   * cancel it: the ReactVision provider closes the scan window and reports
   * pending hosts and resolves as `ErrorCancelled`. An upload already in flight
   * can still finish, and whatever an abandoned operation resolves with later
   * is dropped by its run check.
   */
  private nativeBusy = false;

  private location: Mat4 | null = null;
  private locationInverse: Mat4 | null = null;
  private origin: Mat4 | null = null;
  private proposedWorldOrigin: Mat4 | null = null;

  private replication: ViroReplicationClient | null = null;
  private sharedState: StudioSharedState | null = null;
  private channelJoined = false;
  private channelState: ViroColocationState = "idle";
  private peerCount = 0;
  private connectedOnce = false;
  /** The channel and the shared state were both up at least once this run. */
  private reachedConnected = false;
  private diagnosing = false;
  private lastPoseAt = -Infinity;
  private finishScanWaiter: (() => void) | null = null;
  private originPrompt: StudioColocationOriginPrompt | null = null;

  private frame: StudioColocationFrame = STUDIO_COLOCATION_OFF_FRAME;
  private listeners = new Set<() => void>();

  constructor(deps: Partial<StudioColocationDeps> = {}) {
    this.deps = { ...DEFAULT_DEPS, ...deps };
  }

  setNavigatorAccessor(accessor: () => any): void {
    this.getNavigator = accessor;
  }

  setScenePusher(push: StudioScenePusher | null): void {
    this.pushScene = push;
  }

  // ── Session lifecycle ─────────────────────────────────────────────────────

  /**
   * The navigator's `colocation` prop. A value equal to the one already
   * requested (same mode, code and relay) only refreshes the options, except
   * that it starts a failed session again unless `restartFailed` is false. A
   * session left under it stays left until the value changes or `retry()`.
   *
   * The navigator passes `restartFailed: false`: a host re-rendering with an
   * equal value after every state change would otherwise retry in a loop.
   */
  request(
    options: StudioColocationOptions | null,
    { restartFailed = true }: { restartFailed?: boolean } = {}
  ): void {
    const key = options ? optionsKey(options) : null;
    if (key === this.requestedKey) {
      if (options) this.options = options;
      if (options && restartFailed && this.state.status === "failed") {
        this.restart();
      }
      return;
    }
    this.requestedKey = key;
    this.options = options;
    this.restart();
  }

  /**
   * Starts the requested value's session again after it failed or was left.
   * False, changing nothing, while one is running or none is requested.
   */
  retry(): boolean {
    if (!this.options) return false;
    const stopped =
      this.state.status === "failed" ||
      (this.state.status === "idle" && !this.active && !this.pendingStart);
    if (!stopped) return false;
    this.restart();
    return true;
  }

  private restart(): void {
    this.teardown();
    this.pendingStart = this.options !== null;
    this.setState(IDLE);
    if (this.pendingStart && this.scene) this.begin();
    this.updateFrame();
  }

  /** Numbers a scene in mount order, at its first render. */
  claimSceneMount(): number {
    return ++this.mountCount;
  }

  /**
   * Called by each scene as it mounts; the latest one is the current scene,
   * and its stores are the ones a shared session shares.
   */
  attachScene(
    sceneData: StudioSceneResponse,
    stores?: StudioSharedSceneStores,
    hooks?: StudioSharedSceneHooks,
    mount?: number
  ): void {
    const prev = this.scene;
    this.scene = sceneData;
    this.sceneMount = mount ?? null;
    this.sceneStores = stores ?? null;
    this.sceneHooks = hooks ?? null;
    this.noteSceneShown(prev, sceneData);
    this.sharedState?.bindScene(sceneData, this.sceneStores, this.sceneHooks);
    if (this.pendingStart) this.begin();
    this.updateFrame();
  }

  /** A scene unmounting; ignored once a later scene has attached its own stores. */
  detachScene(stores: StudioSharedSceneStores): void {
    if (this.sceneStores !== stores) return;
    this.sceneStores = null;
    this.sceneHooks = null;
    this.sharedState?.bindScene(this.scene, null);
  }

  /**
   * A NAVIGATE while a session is set up or shared goes through the navigator
   * and into the room, so every device follows. False when no session runs:
   * the scene then navigates on its own.
   */
  navigate(targetSceneId: string): boolean {
    if (this.frame.phase === "off" || !this.pushScene) return false;
    const seq = ++this.navigationSeq;
    this.deps.loadScene(targetSceneId).then(
      (sceneData) => {
        if (seq !== this.navigationSeq) return;
        if (this.inSessionProject(sceneData)) this.enterScene(sceneData, false);
        else this.deps.onNavigationError(outsideProjectError(targetSceneId));
      },
      (error) => {
        if (seq === this.navigationSeq) this.deps.onNavigationError(error);
      }
    );
    return true;
  }

  /** A local animation trigger in the scene on screen, for the room's other devices. */
  shareAnimation(sceneId: string, assetId: string, key: string): void {
    if (this.isCurrentScene(sceneId)) {
      this.sharedState?.emitAnimation(sceneId, assetId, key);
    }
  }

  /** The same `colocation` value stays left until it changes. */
  leave(): void {
    this.teardown();
    this.pendingStart = false;
    this.setState(IDLE);
    this.updateFrame();
  }

  /**
   * Host: ends the scan and hosts it, once the scan covers enough
   * (`canFinish`). False, changing nothing, outside `scanning` or before then.
   */
  finishScan(): boolean {
    const state = this.state;
    if (state.status !== "scanning" || !state.canFinish) return false;
    const finish = this.finishScanWaiter;
    if (!finish) return false;
    finish();
    return true;
  }

  /** Unmount: leave, and forget the requested value so a remount starts afresh. */
  dispose(): void {
    this.requestedKey = null;
    this.options = null;
    this.leave();
  }

  // ── Reads ─────────────────────────────────────────────────────────────────

  getState(): StudioColocationState {
    return this.state;
  }

  getRoom(): StudioColocationRoom | null {
    return this.room;
  }

  isCurrentScene(sceneId: string): boolean {
    return this.scene?.scene.id === sceneId;
  }

  /** Stable between changes, so it can back useSyncExternalStore. */
  getFrame = (): StudioColocationFrame => this.frame;

  /** Fires on frame changes only (phase, origin, location), never on peers. */
  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  /** The room's replicated state, while a session is connected. */
  getReplication(): ViroReplicationClient | null {
    return this.replication;
  }

  readPeers = (): Promise<ViroColocationPeer[]> => this.deps.getPeers();

  // ── Scene input ───────────────────────────────────────────────────────────

  /**
   * Host: where the scene's origin sits, in this session's world coordinates.
   * The first proposal wins and later ones are ignored, including a pushed
   * scene's, since every scene in a room shares one origin.
   */
  proposeOrigin(worldPose: Mat4): void {
    if (!this.picksOrigin() || this.proposedWorldOrigin || this.origin) return;
    if (this.frame.phase === "off") return;
    this.proposedWorldOrigin = worldPose;
    this.updateFrame();
    if (this.replication && this.room) this.refresh(this.run);
  }

  /** Camera pose in world coordinates; sent in the location frame, throttled. */
  publishCameraPose(position: Vec3, forward: Vec3, up: Vec3): void {
    const status = this.state.status;
    if (status !== "live" && status !== "reconnecting") return;
    const inverse = this.locationInverse;
    if (!inverse) return;
    const now = this.deps.now();
    if (now - this.lastPoseAt < VIRO_POSE_INTERVAL_MS) return;
    this.lastPoseAt = now;
    const csv = poseCsv(
      transformPoint(inverse, position),
      rotateDirection(inverse, forward),
      rotateDirection(inverse, up)
    );
    this.deps.setLocalPose(csv).catch(() => {});
  }

  // ── Flows ─────────────────────────────────────────────────────────────────

  private begin(): void {
    const options = this.options;
    const scene = this.scene;
    if (!options || !scene) return;
    this.pendingStart = false;
    this.active = true;
    const run = this.run;
    this.relayUrl = options.relayUrl ?? STUDIO_COLOCATION_DEFAULT_RELAY_URL;
    // The anchor stays in the room, so its world pose moves with a recentre.
    this.cleanups.push(
      this.deps.onRoomMoved((move) => {
        if (this.location) this.setLocation(multiply(move, this.location));
      })
    );
    const flow =
      options.mode === "host"
        ? this.host(run, scene)
        : this.join(run, options.code, scene);
    flow.catch((e) =>
      this.fail(run, { code: "UNKNOWN", message: errorMessage(e) })
    );
    this.updateFrame();
  }

  private async host(run: number, scene: StudioSceneResponse): Promise<void> {
    if (!this.checkBudget(run, scene)) return;
    const frameKind = this.deps.hostFrameKind();
    const nav = this.getNavigator();
    if (frameKind === "cloud_anchor") {
      const support = this.deps.hostSupport();
      if (!support.ok) {
        return this.fail(run, {
          code: "FRAME_KIND_UNSUPPORTED",
          message: support.reason,
        });
      }
      if (
        typeof nav?.startScan !== "function" ||
        typeof nav?.finishScan !== "function"
      ) {
        return this.fail(run, {
          code: "UNKNOWN",
          message: "The scene navigator cannot scan a space.",
        });
      }
    }
    if (!(await this.prepare(run, scene))) return;

    // Before the frame: scanning and hosting take close to a minute, and a
    // refused plan or credential would otherwise surface only at room creation.
    const probe = await this.deps.probeRelay(
      this.relayUrl,
      this.deps.newProbeRoomId(),
      this.relayHeaders()
    );
    if (!this.isCurrent(run)) return;
    const refused = probeFailure(probe);
    if (refused) return this.fail(run, refused);

    const frame =
      frameKind === "meta_group"
        ? await this.hostSharedFrame(run)
        : await this.hostCloudAnchor(run, nav);
    if (!frame || !this.isCurrent(run)) return;

    this.setState({ status: "creating_room" });
    if (!(await this.reloadAuth(run))) return;
    const name = this.options?.mode === "host" ? this.options.name : undefined;
    const created = await this.deps.createRoom(this.roomsConfig(), {
      ...frame,
      name,
      sceneId: scene.scene.id,
    });
    if (!this.isCurrent(run)) return;
    if (!created.success) {
      return this.fail(run, {
        code: roomErrorCode(created.status, created.code),
        message: created.error,
      });
    }
    this.room = this.toStudioRoom(created.room, true, frame.frameKind);
    this.announce();
    this.updateFrame();
    this.startConnectTimeout(run);
    await this.connect(run);
  }

  /** Phone: the scan is hosted as a cloud anchor, whose location frame is the room's. */
  private async hostCloudAnchor(
    run: number,
    nav: any
  ): Promise<ViroRoomFrame | null> {
    this.nativeBusy = true;
    nav.startScan();
    this.setState({ status: "scanning", canFinish: false });
    await this.scan(run, nav);
    if (!this.isCurrent(run)) return null;

    this.setState({ status: "hosting" });
    let hosted: any;
    try {
      hosted = await nav.finishScan(HOST_ANCHOR_TTL_DAYS);
    } catch (e) {
      if (!this.isCurrent(run)) return null;
      this.nativeBusy = false;
      this.fail(run, { code: "HOST_FAILED", message: errorMessage(e) });
      return null;
    }
    // Left while hosting: this anchor belongs to nobody now.
    if (!this.isCurrent(run)) return null;
    this.nativeBusy = false;
    const location = parseLocationTransform(hosted?.locationTransform);
    if (!hosted?.success || !hosted.cloudAnchorId || !location) {
      this.fail(run, {
        code: "HOST_FAILED",
        message: hosted?.error ?? "Hosting the scan returned no anchor.",
      });
      return null;
    }
    this.setLocation(location);
    return { frameKind: "cloud_anchor", cloudAnchorId: hosted.cloudAnchorId };
  }

  /**
   * Quest: a Meta anchor shared to a fresh group is the room's frame, and the
   * scene sits on the anchor itself, so there is no origin to pick.
   */
  private async hostSharedFrame(run: number): Promise<ViroRoomFrame | null> {
    const groupId = this.deps.newGroupId();
    const source = metaSpatialAnchorFrameSource(groupId, "create");
    if (!source.support.ok) {
      this.fail(run, {
        code: "FRAME_KIND_UNSUPPORTED",
        message: source.support.reason,
      });
      return null;
    }
    const frame = await this.acquire(run, source, "host", "meta_group");
    if (!frame) return null;
    this.setLocation(frameToLocation(frame));
    this.setOrigin(IDENTITY);
    return { frameKind: "meta_group", frameRef: groupId };
  }

  private async join(
    run: number,
    code: string,
    scene: StudioSceneResponse
  ): Promise<void> {
    if (!this.checkBudget(run, scene)) return;
    if (!(await this.prepare(run, scene))) return;

    this.setState({ status: "looking_up" });
    const found = await this.deps.lookupRoom(this.roomsConfig(), code);
    if (!this.isCurrent(run)) return;
    if (!found.success) {
      return this.fail(run, {
        code: roomErrorCode(found.status, found.code),
        message: found.error,
      });
    }
    const frameKind = asFrameKind(found.room.frameKind);
    const source = frameKind ? this.deps.frameSourceFor(found.room) : null;
    if (!frameKind || !source) {
      return this.fail(run, {
        code: "FRAME_KIND_UNSUPPORTED",
        message: "This room has no shared frame to align to.",
      });
    }
    if (!source.support.ok) {
      return this.fail(run, frameKindUnsupportedFailure(frameKind));
    }
    if (frameKind === "meta_group" && !isGroupUuid(found.room.frameRef ?? "")) {
      return this.fail(run, {
        code: "FRAME_KIND_UNSUPPORTED",
        message:
          "This room's Meta anchor group is not a UUID, so no headset can join it.",
      });
    }
    this.room = this.toStudioRoom(found.room, false, frameKind);

    // Before the resolve, which can take a minute of walking: a full room or a
    // relay refusal is known now.
    const probe = await this.deps.probeRelay(
      this.relayUrl,
      this.room.roomId,
      this.relayHeaders()
    );
    if (!this.isCurrent(run)) return;
    const refused = probeFailure(probe);
    if (refused) return this.fail(run, refused);

    const frame = await this.acquire(run, source, "join", frameKind);
    if (!frame || !this.isCurrent(run)) return;
    this.setLocation(frameToLocation(frame));
    this.startConnectTimeout(run);
    await this.connect(run);
  }

  private checkBudget(run: number, scene: StudioSceneResponse): boolean {
    const estimate = estimateSharedEntities(scene);
    if (estimate <= STUDIO_COLOCATION_ENTITY_LIMIT) return true;
    this.fail(run, {
      code: "SCENE_TOO_LARGE",
      message: `This scene needs about ${estimate} shared entities and a shared session holds ${STUDIO_COLOCATION_ENTITY_LIMIT}.`,
    });
    return false;
  }

  /** Credentials, project and anchor project; false once the run has failed or moved on. */
  private async prepare(
    run: number,
    scene: StudioSceneResponse
  ): Promise<boolean> {
    const auth = await this.deps.getAuth();
    if (!this.isCurrent(run)) return false;
    if (auth.mode === "none" || !auth.baseUrl) {
      this.fail(run, {
        code: "NOT_AUTHORIZED",
        message: "No ReactVision API key or signed-in session is available.",
      });
      return false;
    }
    const projectId = scene.scene.belongs_to_project;
    if (!projectId) {
      this.fail(run, {
        code: "UNKNOWN",
        message: "The scene names no project.",
      });
      return false;
    }
    this.auth = auth;
    this.projectId = projectId;
    this.anchorProjectSet = true;
    await this.deps.setCloudAnchorProject(projectId);
    return this.isCurrent(run);
  }

  /**
   * A session token can expire during a scan or a long session, so a call made
   * well after prepare() reads the credential again. The mode and base URL stay
   * the ones the session started with.
   */
  private async reloadAuth(run: number): Promise<boolean> {
    const auth = await this.deps.getAuth();
    if (!this.isCurrent(run)) return false;
    const started = this.auth;
    if (!started || auth.mode !== started.mode) {
      this.fail(run, {
        code: "NOT_AUTHORIZED",
        message:
          "The ReactVision credential changed during the shared session.",
      });
      return false;
    }
    this.auth = { ...started, headers: auth.headers };
    return true;
  }

  private scan(run: number, nav: any): Promise<void> {
    return new Promise<void>((resolve) => {
      const startedAt = this.deps.now();
      let polling = false;
      const poll = async () => {
        if (polling || this.state.status !== "scanning") return;
        polling = true;
        let status: ViroScanStatus | null = null;
        try {
          status =
            typeof nav.getScanStatus === "function"
              ? await nav.getScanStatus()
              : null;
        } catch {
          status = null;
        }
        polling = false;
        if (!this.isCurrent(run) || this.state.status !== "scanning") return;
        const canFinish =
          scanGuidance(status) ??
          this.deps.now() - startedAt >= SCAN_FALLBACK_MS;
        const points = scanPoints(status);
        this.setState(
          points
            ? { status: "scanning", canFinish, points }
            : { status: "scanning", canFinish }
        );
      };
      const stop = this.every(run, SCAN_STATUS_POLL_MS, poll);
      // Resolved on teardown too, so a scan left mid-way does not hold the flow open.
      this.cleanups.push(resolve);
      this.finishScanWaiter = () => {
        this.finishScanWaiter = null;
        stop();
        resolve();
      };
    });
  }

  /**
   * The frame from `source`, with ViroSharedFrame's retries. A Meta anchor
   * that never answers is not retried: nothing will run the next call either.
   */
  private async acquire(
    run: number,
    source: ViroFrameSource,
    role: "host" | "join",
    frameKind: StudioColocationFrameKind
  ): Promise<ViroSharedFrameValue | null> {
    const timeoutMs =
      frameKind === "meta_group" ? SHARED_FRAME_TIMEOUT_MS : null;
    for (let attempt = 1; ; attempt++) {
      this.setState(
        role === "host"
          ? { status: "hosting" }
          : { status: "resolving", attempt }
      );
      this.nativeBusy = true;
      const stopProgress =
        role === "join" && source.progress
          ? this.every(run, RESOLVE_PROGRESS_POLL_MS, async () => {
              const message = await source.progress!({
                arSceneNavigator: this.getNavigator(),
              });
              const seen = resolveMatches(message);
              if (
                seen &&
                this.state.status === "resolving" &&
                this.state.attempt === attempt
              ) {
                this.setState({ status: "resolving", attempt, seen });
              }
            })
          : () => {};
      const outcome = await this.acquireOnce(run, source, timeoutMs);
      stopProgress();
      if (!this.isCurrent(run)) return null;
      this.nativeBusy = false;
      if (!outcome) {
        const needs =
          role === "host"
            ? "Sharing a room on Quest needs"
            : "Joining a room on Quest needs";
        this.fail(run, {
          code: role === "host" ? "HOST_FAILED" : "RESOLVE_NO_MATCH",
          message: `The headset did not answer within ${SHARED_FRAME_TIMEOUT_MS / 1000} seconds. ${needs} the app to be allowed to use spatial data.`,
        });
        return null;
      }
      if (outcome.success) return outcome.frame;
      const unavailable =
        frameKind === "meta_group"
          ? metaSharingUnavailableFailure(outcome.error)
          : null;
      if (unavailable) {
        this.fail(run, unavailable);
        return null;
      }
      const retryable =
        outcome.state === undefined ||
        RETRYABLE_RESOLVE_STATES.has(outcome.state);
      if (retryable && attempt < RESOLVE_ATTEMPTS) {
        await this.wait(run, RESOLVE_RETRY_DELAY_MS);
        if (!this.isCurrent(run)) return null;
        continue;
      }
      this.fail(run, {
        code: role === "host" ? "HOST_FAILED" : resolveErrorCode(outcome.state),
        message: outcome.error,
      });
      return null;
    }
  }

  /** Null when `timeoutMs` passes first, or the session ends. */
  private acquireOnce(
    run: number,
    source: ViroFrameSource,
    timeoutMs: number | null
  ): Promise<ViroFrameOutcome | null> {
    const outcome = source.acquire({ arSceneNavigator: this.getNavigator() });
    if (timeoutMs === null) return outcome;
    return new Promise((resolve) => {
      const id = setTimeout(() => resolve(null), timeoutMs);
      const settle = (value: ViroFrameOutcome | null) => {
        clearTimeout(id);
        resolve(value);
      };
      this.cleanups.push(() => settle(null));
      outcome.then(settle, (e) =>
        settle({ success: false, error: errorMessage(e) })
      );
      if (!this.isCurrent(run)) settle(null);
    });
  }

  private async connect(run: number): Promise<void> {
    const auth = this.auth;
    const projectId = this.projectId;
    const room = this.room;
    if (!auth || !projectId || !room) return;

    let apiKey: string;
    let config: ViroReplicationConfig;
    switch (auth.mode) {
      case "api_key":
        apiKey = headerValue(auth.headers, "x-api-key") ?? "";
        config = {
          roomId: room.roomId,
          projectId,
          endpoint: this.relayUrl,
          apiKey,
        };
        break;
      case "session":
        apiKey = "";
        config = {
          roomId: room.roomId,
          projectId,
          endpoint: this.relayUrl,
          // Read per connect, so a reconnect after a refresh sends the new token.
          headers: () => this.deps.getAuth().then((a) => a.headers),
        };
        break;
      case "none":
        return this.fail(run, {
          code: "NOT_AUTHORIZED",
          message: "No ReactVision API key or signed-in session is available.",
        });
      default: {
        const unknown: never = auth.mode;
        return this.fail(run, {
          code: "NOT_AUTHORIZED",
          message: `Unknown credential kind ${String(unknown)}.`,
        });
      }
    }
    this.channelJoined = true;
    const joined = await this.deps.joinChannel({
      roomId: room.roomId,
      apiKey,
      projectId,
      endpoint: this.relayUrl,
    });
    if (!this.isCurrent(run)) {
      // Left while the join was in flight: the teardown's leave may have run
      // first, and a device stays in a room until told to leave it.
      if (joined.success && !this.channelJoined) {
        this.deps.leaveChannel().catch(() => {});
      }
      return;
    }
    if (!joined.success) {
      return this.fail(run, {
        code: "UNAVAILABLE",
        message: joined.error ?? "Failed to join the co-location channel.",
      });
    }

    const client = this.deps.createReplication();
    this.replication = client;
    const unsubscribe = client.subscribe(() => this.refresh(run));
    const isHost = this.options?.mode === "host";
    // Subscribed after the refresh above, so each change reaches it with the
    // origin already read.
    const shared = new StudioSharedState(client, {
      origin: () => this.origin,
      worldToLocation: () => this.locationInverse,
      role: isHost ? "host" : "join",
      onAuthorityChange: () => this.updateFrame(),
    });
    // The host's scene is the room's first; a joiner's is its own until it
    // reads the room's.
    const navigation = new StudioRoomSceneStore(
      { sceneId: this.scene?.scene.id ?? "", n: isHost ? 0 : null },
      (next, prev) => this.followRoom(run, next, prev)
    );
    this.navigation = navigation;
    shared.bindNavigation(navigation);
    shared.bindScene(this.scene, this.sceneStores, this.sceneHooks);
    this.sharedState = shared;
    client.onReject = (rejection) => {
      this.handleReject(run, client, rejection);
      shared.handleReject(rejection);
    };
    this.cleanups.push(() => {
      unsubscribe();
      shared.dispose();
      if (this.sharedState === shared) this.sharedState = null;
      if (this.navigation === navigation) this.navigation = null;
      client.onReject = undefined;
      client.disconnect();
    });
    client.connect(config);

    let polling = false;
    this.every(run, CHANNEL_POLL_MS, async () => {
      if (polling) return;
      polling = true;
      try {
        const [channel, peers] = await Promise.all([
          this.deps.getChannelState(),
          this.deps.getPeers(),
        ]);
        if (!this.isCurrent(run)) return;
        this.channelState = channel.state;
        this.peerCount = peers.length;
        this.refresh(run);
      } catch {
        // A failed read is not a failed channel; the next poll asks again.
      } finally {
        polling = false;
      }
    });
    this.refresh(run);
  }

  private refresh(run: number): void {
    const client = this.replication;
    const room = this.room;
    if (!this.isCurrent(run) || !client || !room || this.diagnosing) return;

    if (client.state === "failed") {
      void this.diagnose(
        run,
        client.error ?? "The shared state connection failed."
      );
      return;
    }
    if (this.channelState === "failed") {
      void this.diagnose(run, "The co-location channel failed.");
      return;
    }
    if (client.state === "synced") this.syncOrigin(client);
    const connected =
      this.channelState === "joined" && client.state === "synced";
    if (connected) this.reachedConnected = true;
    if (!this.origin) {
      // A joiner is aligned and in the room, and only the host's origin is missing.
      if (connected && !room.isHost) {
        this.setState({ status: "waiting_for_host", room });
      }
      return;
    }

    if (connected) {
      this.connectedOnce = true;
      this.setState({ status: "live", room, peers: this.peerCount });
      this.announce();
    } else if (this.connectedOnce) {
      this.setState({ status: "reconnecting", room });
    }
  }

  private syncOrigin(client: ViroReplicationClient): void {
    const entity = client.get(STUDIO_COLOCATION_ORIGIN_ENTITY);
    const remote = entity ? parseOriginFields(entity.fields) : null;
    if (remote) {
      if (!sameMatrix(remote, this.origin)) this.setOrigin(remote);
      return;
    }
    // The host (re)asserts the origin whenever the room has none.
    const inverse = this.locationInverse;
    const world = this.proposedWorldOrigin;
    if (this.options?.mode !== "host" || !inverse) return;
    if (this.origin) {
      // Deferred: a refused write's rollback reaches here before onReject, and
      // writing again at once would repeat the refusal every round trip.
      const run = this.run;
      const origin = this.origin;
      void Promise.resolve().then(() => {
        if (
          this.isCurrent(run) &&
          this.replication === client &&
          this.origin === origin &&
          !client.get(STUDIO_COLOCATION_ORIGIN_ENTITY)
        ) {
          this.writeOrigin(client, origin);
        }
      });
      return;
    }
    if (!world) return;
    const { p, q } = toPositionQuat(multiply(inverse, world));
    // Stored as it will read back, so the echo is not a change.
    const origin = fromPositionQuat(p, q);
    this.setOrigin(origin);
    this.writeOrigin(client, origin);
  }

  private writeOrigin(client: ViroReplicationClient, origin: Mat4): void {
    const { p, q } = toPositionQuat(origin);
    client.set(
      STUDIO_COLOCATION_ORIGIN_ENTITY,
      { p, q, sceneId: this.scene?.scene.id ?? null },
      { optimistic: true }
    );
  }

  /**
   * Only a refused origin ends the session, since joiners never go live without
   * one. A refused create leaves no local copy, which is how a refusal that
   * carries no `current` is matched to it.
   */
  private handleReject(
    run: number,
    client: ViroReplicationClient,
    rejection: ViroReplicationRejection
  ): void {
    if (!this.isCurrent(run) || this.options?.mode !== "host" || !this.origin)
      return;
    const aboutOrigin = rejection.current
      ? rejection.current.id === STUDIO_COLOCATION_ORIGIN_ENTITY
      : !client.get(STUDIO_COLOCATION_ORIGIN_ENTITY);
    if (aboutOrigin) this.fail(run, originRejectFailure(rejection.reason));
  }

  /**
   * A socket gave up. The relay's gate says why when it refused (a plan that
   * lapsed, a member removed, a full room); otherwise it is the network.
   */
  private async diagnose(run: number, message: string): Promise<void> {
    this.diagnosing = true;
    let probe: RelayProbeResult;
    try {
      if (!(await this.reloadAuth(run))) return;
      probe = await this.deps.probeRelay(
        this.relayUrl,
        this.room?.roomId ?? this.deps.newProbeRoomId(),
        this.relayHeaders()
      );
    } catch (e) {
      probe = { ok: false, message: errorMessage(e) };
    }
    if (!this.isCurrent(run)) return;
    const refused = probeFailure(probe);
    this.fail(
      run,
      refused && refused.code !== "UNAVAILABLE"
        ? refused
        : { code: "UNAVAILABLE", message }
    );
  }

  /**
   * From the frame on: a host must connect, and a joiner go live, within
   * `connectTimeoutMs`. A host placing its origin is not timed, since that
   * waits on the person holding the device.
   */
  private startConnectTimeout(run: number): void {
    const ms =
      this.options?.connectTimeoutMs ?? STUDIO_COLOCATION_CONNECT_TIMEOUT_MS;
    if (!(ms > 0) || !Number.isFinite(ms)) return;
    const id = setTimeout(() => {
      if (!this.isCurrent(run)) return;
      const isHost = this.options?.mode === "host";
      if (isHost ? this.reachedConnected : this.connectedOnce) return;
      const seconds = Math.round(ms / 1000);
      this.fail(
        run,
        !isHost && this.reachedConnected
          ? {
              code: "HOST_TIMEOUT",
              message: `Connected to the room, but the host did not place the scene within ${seconds} seconds.`,
            }
          : {
              code: "CONNECT_TIMEOUT",
              message: `Could not connect to the room within ${seconds} seconds.`,
            }
      );
    }, ms);
    this.cleanups.push(() => clearTimeout(id));
  }

  // ── Shared navigation ─────────────────────────────────────────────────────

  /**
   * A scene this device put on screen other than by following the room, such
   * as a host changing `sceneId`: a navigation of this device's own.
   */
  private noteSceneShown(
    prev: StudioSceneResponse | null,
    next: StudioSceneResponse
  ): void {
    const navigation = this.navigation;
    if (!navigation || navigation.get().sceneId === next.scene.id) return;
    this.navigationSeq++;
    if (prev) this.sharedState?.removeSceneRows(prev);
    navigation.set({ sceneId: next.scene.id, n: this.nextSceneNumber() });
  }

  /**
   * `followed`: the room took this device here, so the device that navigated
   * owns the new scene's on_load function and removed the old scene's rows.
   */
  private enterScene(sceneData: StudioSceneResponse, followed: boolean): void {
    const navigation = this.navigation;
    if (!followed && navigation) {
      if (this.scene) this.sharedState?.removeSceneRows(this.scene);
      navigation.set({
        sceneId: sceneData.scene.id,
        n: this.nextSceneNumber(),
      });
    }
    this.sceneHooks?.leave?.();
    this.pushScene?.(sceneData, { skipOnLoadFunction: followed });
  }

  private followRoom(
    run: number,
    next: StudioRoomScene,
    prev: StudioRoomScene
  ): void {
    if (!this.pushScene || !roomSceneNeedsNavigation(prev, next)) return;
    void this.follow(run, ++this.navigationSeq, next.sceneId);
  }

  private async follow(
    run: number,
    seq: number,
    sceneId: string
  ): Promise<void> {
    const current = () => this.isCurrent(run) && seq === this.navigationSeq;
    let failure: unknown;
    for (let attempt = 0; attempt < FOLLOW_ATTEMPTS; attempt++) {
      if (attempt > 0) await this.wait(run, FOLLOW_RETRY_DELAY_MS * attempt);
      if (!current()) return;
      try {
        const sceneData = await this.deps.loadScene(sceneId);
        if (!current()) return;
        // Any peer with the room's credential can write the room's scene.
        if (this.inSessionProject(sceneData)) this.enterScene(sceneData, true);
        else this.deps.onNavigationError(outsideProjectError(sceneId));
        return;
      } catch (e) {
        failure = e;
      }
    }
    if (current()) this.deps.onNavigationError(failure);
  }

  /** The room, its rows and the anchor project all belong to one project. */
  private inSessionProject(sceneData: StudioSceneResponse): boolean {
    const project = this.projectId ?? this.scene?.scene.belongs_to_project;
    return !!project && sceneData.scene.belongs_to_project === project;
  }

  private nextSceneNumber(): number {
    const room = this.replication?.get(STUDIO_COLOCATION_CURRENT_SCENE_ENTITY)
      ?.fields.n;
    const roomN = typeof room === "number" && Number.isFinite(room) ? room : 0;
    return Math.max(this.navigation?.get().n ?? 0, roomN) + 1;
  }

  // ── State ─────────────────────────────────────────────────────────────────

  private isCurrent(run: number): boolean {
    return run === this.run;
  }

  /** A phone host places the scene by its plane mode; a Quest host's origin is the anchor. */
  private picksOrigin(): boolean {
    return (
      this.options?.mode === "host" &&
      this.deps.hostFrameKind() === "cloud_anchor"
    );
  }

  private fail(run: number, failure: StudioColocationFailure): void {
    if (!this.isCurrent(run)) return;
    this.teardown();
    this.setState({
      status: "failed",
      code: failure.code,
      message: failure.message,
    });
    this.updateFrame();
  }

  private teardown(): void {
    this.run++;
    const cleanups = this.cleanups;
    this.cleanups = [];
    cleanups.forEach((fn) => fn());
    this.finishScanWaiter = null;
    this.active = false;
    if (this.nativeBusy) this.getNavigator()?.cancelCloudAnchorOperations?.();
    this.nativeBusy = false;
    this.replication = null;
    if (this.channelJoined) this.deps.leaveChannel().catch(() => {});
    this.channelJoined = false;
    if (this.anchorProjectSet)
      this.deps.setCloudAnchorProject(null).catch(() => {});
    this.anchorProjectSet = false;
    this.room = null;
    this.announced = false;
    this.auth = null;
    this.projectId = null;
    this.location = null;
    this.locationInverse = null;
    this.origin = null;
    this.proposedWorldOrigin = null;
    this.channelState = "idle";
    this.peerCount = 0;
    this.connectedOnce = false;
    this.reachedConnected = false;
    this.diagnosing = false;
    this.lastPoseAt = -Infinity;
  }

  private setState(next: StudioColocationState): void {
    if (sameState(this.state, next)) return;
    this.state = next;
    this.updateFrame();
    this.onStateChange?.(next);
  }

  private setLocation(location: Mat4): void {
    this.location = location;
    this.locationInverse = invert(location);
    this.updateFrame();
  }

  private setOrigin(origin: Mat4): void {
    this.origin = origin;
    this.updateFrame();
    this.sharedState?.refreshFrame();
  }

  private announce(): void {
    const room = this.room;
    if (!room || this.announced) return;
    if (!room.isHost && this.state.status !== "live") return;
    this.announced = true;
    this.onRoom?.(room);
  }

  private updateFrame(): void {
    const status = this.state.status;
    const phase: StudioColocationPhase =
      status === "live" || status === "reconnecting"
        ? "shared"
        : this.pendingStart ||
            this.active ||
            (status !== "idle" && status !== "failed")
          ? "pending"
          : "off";
    const role =
      phase === "off" ? null : this.options?.mode === "host" ? "host" : "join";
    const authority =
      phase === "off"
        ? false
        : (this.sharedState?.hasAuthority() ?? role === "host");
    const needsOrigin =
      phase === "pending" &&
      this.picksOrigin() &&
      !this.proposedWorldOrigin &&
      !this.origin;
    const sceneId = phase === "off" ? null : (this.scene?.scene.id ?? null);
    const sceneMount = phase === "off" ? null : this.sceneMount;
    this.updateOriginPrompt(needsOrigin);
    const prev = this.frame;
    if (
      prev.phase === phase &&
      prev.role === role &&
      prev.authority === authority &&
      prev.needsOrigin === needsOrigin &&
      prev.sceneId === sceneId &&
      prev.sceneMount === sceneMount &&
      prev.location === this.location &&
      prev.origin === this.origin
    ) {
      return;
    }
    const sameMatrices =
      prev.location === this.location && prev.origin === this.origin;
    const sceneToWorld = sameMatrices
      ? prev.sceneToWorld
      : this.location && this.origin
        ? multiply(this.location, this.origin)
        : null;
    const worldToScene = sameMatrices
      ? prev.worldToScene
      : sceneToWorld
        ? invert(sceneToWorld)
        : null;
    this.frame =
      phase === "off"
        ? STUDIO_COLOCATION_OFF_FRAME
        : {
            phase,
            role,
            authority,
            needsOrigin,
            sceneId,
            sceneMount,
            location: this.location,
            origin: this.origin,
            sceneToWorld,
            worldToScene,
          };
    if (this.frame !== prev) [...this.listeners].forEach((fn) => fn());
  }

  /**
   * Host: the room exists and the plane-mode scene waits for a surface. NONE
   * never waits, since the scene proposes its world origin at once.
   */
  private updateOriginPrompt(needsOrigin: boolean): void {
    const room = this.room;
    const mode = String(
      this.scene?.scene.plane_detection ?? "NONE"
    ).toUpperCase();
    const next: StudioColocationOriginPrompt | null =
      room?.isHost &&
      needsOrigin &&
      this.state.status === "creating_room" &&
      (mode === "AUTOMATIC" || mode === "MANUAL")
        ? { joinCode: room.joinCode, tap: mode === "MANUAL" }
        : null;
    const prev = this.originPrompt;
    if (
      prev === next ||
      (prev && next && prev.joinCode === next.joinCode && prev.tap === next.tap)
    )
      return;
    this.originPrompt = next;
    this.onOriginPrompt?.(next);
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private roomsConfig(): ViroColocationRoomsConfig {
    return {
      endpoint: this.auth?.baseUrl ?? undefined,
      headers: this.auth?.headers ?? {},
      projectId: this.projectId ?? undefined,
    };
  }

  private relayHeaders(): Record<string, string> {
    return { ...this.auth?.headers, "x-project-id": this.projectId ?? "" };
  }

  private toStudioRoom(
    room: ViroColocationRoom,
    isHost: boolean,
    frameKind: StudioColocationFrameKind
  ): StudioColocationRoom {
    return {
      id: room.id,
      roomId: room.roomId,
      joinCode: room.joinCode,
      joinUrl: room.joinCode ? `${JOIN_URL_BASE}${room.joinCode}` : null,
      projectId: room.projectId ?? this.projectId ?? "",
      sceneId: room.sceneId,
      frameKind,
      isHost,
    };
  }

  private every(
    run: number,
    ms: number,
    fn: () => void | Promise<void>
  ): () => void {
    const id = setInterval(() => {
      if (this.isCurrent(run)) void fn();
    }, ms);
    const stop = () => clearInterval(id);
    this.cleanups.push(stop);
    return stop;
  }

  private wait(run: number, ms: number): Promise<void> {
    return new Promise<void>((resolve) => {
      const id = setTimeout(resolve, ms);
      this.cleanups.push(() => {
        clearTimeout(id);
        resolve();
      });
      if (!this.isCurrent(run)) resolve();
    });
  }
}

function probeFailure(probe: RelayProbeResult): StudioColocationFailure | null {
  if (probe.ok) {
    return probe.peers >= ROOM_PEER_LIMIT
      ? { code: "ROOM_FULL", message: "This room is full." }
      : null;
  }
  const code: StudioColocationErrorCode = relayErrorCode(
    probe.status,
    probe.code
  );
  return { code, message: probe.message };
}
