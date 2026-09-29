import {
  lookupColocationRoom,
  type ViroColocationRoom,
} from "../components/AR/ViroColocationRooms";
import type {
  ViroReplicatedEntity,
  ViroReplicationConfig,
  ViroReplicationRejection,
  ViroReplicationRejectReason,
  ViroReplicationState,
} from "../components/AR/ViroReplication";
import {
  resolveMatches,
  StudioColocationController,
  type StudioColocationDeps,
} from "../components/Studio/colocation/controller";
import {
  fromPositionEuler,
  fromPositionQuat,
  IDENTITY,
  invert,
  multiply,
  toPositionQuat,
  transformPoint,
} from "../components/Studio/colocation/frameMath";
import type { StudioColocationOriginPrompt } from "../components/Studio/colocation/indicatorContent";
import type { RelayProbeResult } from "../components/Studio/colocation/relayProbe";
import type { StudioColocationState } from "../components/Studio/colocation/types";
import type { StudioAuthContext } from "../components/Studio/VRTStudioModule";
import type { StudioSceneResponse } from "../components/Studio/types";
import { StudioPlacementStore } from "../components/Studio/domain/placementStore";
import { StudioVariableStore } from "../components/Studio/domain/variableStore";
import { StudioVisibilityStore } from "../components/Studio/domain/visibilityStore";

jest.mock("react-native", () => ({
  Platform: { OS: "ios", constants: {} },
  NativeModules: {},
}));

const SESSION: StudioAuthContext = {
  mode: "session",
  baseUrl: "https://supabase.example",
  headers: { Authorization: "Bearer t1", "x-rv-client": "studio-go" },
  projectId: null,
};

const API_KEY: StudioAuthContext = {
  mode: "api_key",
  baseUrl: "https://platform.reactvision.xyz",
  headers: { "x-api-key": "rv_live_k" },
  projectId: "manifest-project",
};

const HOST_LOCATION = fromPositionEuler([1, 0, -2], [0, 30, 0]);
const JOINER_LOCATION = fromPositionEuler([-2, 0.5, 1], [0, -80, 0]);
const csv = (m: number[]) => m.join(",");

const ROOM: ViroColocationRoom = {
  id: "row-1",
  roomId: "room-1",
  joinCode: "K7M2QX",
  frameKind: "cloud_anchor",
  cloudAnchorId: "anchor-1",
  frameRef: null,
  name: "Lab",
  projectId: "proj-1",
  sceneId: "scene-1",
};

function scene(
  over: Partial<StudioSceneResponse["scene"]> = {},
  assets: StudioSceneResponse["assets"] = []
): StudioSceneResponse {
  return {
    scene: {
      id: "scene-1",
      name: "Scene",
      belongs_to_project: "proj-1",
      plane_detection: "NONE",
      plane_direction: null,
      on_load_function: null,
      physics_world_config: null,
      created_at: "",
      created_by: null,
      ...over,
    },
    project: {} as StudioSceneResponse["project"],
    assets,
    collision_bindings: [],
    animations: [],
    functions: [],
    variables: [],
    meta: { request_id: "r" },
  };
}

/** The slice of ViroReplicationClient the controller uses, driven by the test. */
class FakeReplication {
  state: ViroReplicationState = "idle";
  error: string | undefined;
  config: ViroReplicationConfig | null = null;
  disconnected = false;
  writes: Array<{ id: string; fields: Record<string, unknown> }> = [];
  ops: Array<{ op: string; id: string }> = [];
  onReject?: (rejection: ViroReplicationRejection) => void;
  private entities = new Map<string, ViroReplicatedEntity>();
  private listeners = new Set<() => void>();

  localPeerId = "me";

  subscribe(fn: () => void) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
  getEntities() {
    return [...this.entities.values()].map((e) => ({
      ...e,
      fields: { ...e.fields },
    }));
  }
  connect(config: ViroReplicationConfig) {
    this.config = config;
    this.state = "connecting";
    this.emit();
  }
  disconnect() {
    this.disconnected = true;
    this.state = "idle";
  }
  get(id: string) {
    const e = this.entities.get(id);
    return e ? { ...e, fields: { ...e.fields } } : undefined;
  }
  set(
    id: string,
    fields: Record<string, unknown>,
    opts: { optimistic?: boolean } = {}
  ) {
    this.writes.push({ id, fields });
    this.ops.push({ op: "set", id });
    if (opts.optimistic) {
      this.entities.set(id, { id, fields, version: 1, owner: null });
      this.emit();
    }
  }
  claim(id: string) {
    this.ops.push({ op: "claim", id });
  }
  release(id: string) {
    this.ops.push({ op: "release", id });
  }
  delete(id: string) {
    this.ops.push({ op: "delete", id });
  }
  /** One accepted write from another device, as a delta delivers it. */
  upsert(entity: ViroReplicatedEntity) {
    this.entities.set(entity.id, entity);
    this.emit();
  }
  /** The relay accepting this device's last write to `id`. */
  echo(id: string) {
    const write = [...this.writes].reverse().find((w) => w.id === id);
    if (!write) throw new Error(`nothing written to ${id}`);
    const version = (this.entities.get(id)?.version ?? 0) + 1;
    this.upsert({ id, fields: write.fields, version, owner: null });
  }
  sync(entities: ViroReplicatedEntity[] = []) {
    this.entities = new Map(entities.map((e) => [e.id, e]));
    this.state = "synced";
    this.emit();
  }
  drive(state: ViroReplicationState, error?: string) {
    this.state = state;
    this.error = error;
    this.emit();
  }
  /** As the client rolls back a refused create: drop it, emit, then report. */
  refuse(id: string, reason: ViroReplicationRejectReason) {
    this.entities.delete(id);
    this.emit();
    this.onReject?.({ reason });
  }
  private emit() {
    [...this.listeners].forEach((fn) => fn());
  }
}

type Harness = {
  controller: StudioColocationController;
  deps: jest.Mocked<StudioColocationDeps>;
  nav: Record<string, jest.Mock>;
  replication: FakeReplication;
  states: StudioColocationState[];
  rooms: unknown[];
  channel: { state: string };
  last: () => StudioColocationState;
};

function harness(over: Partial<StudioColocationDeps> = {}): Harness {
  const replication = new FakeReplication();
  const channel = { state: "joined" };
  const nav = {
    startScan: jest.fn(),
    finishScan: jest.fn().mockResolvedValue({
      success: true,
      cloudAnchorId: "anchor-1",
      locationTransform: csv(HOST_LOCATION),
    }),
    getScanStatus: jest.fn().mockResolvedValue({
      available: true,
      scanning: true,
      meetsKeyframes: true,
      meetsViewpointPairs: true,
      meetsSpread: true,
    }),
    cancelCloudAnchorOperations: jest.fn(),
  };
  const resolvedFrame = {
    position: [-2, 0.5, 1] as [number, number, number],
    rotation: [0, -80, 0] as [number, number, number],
    scale: [1, 1, 1] as [number, number, number],
    transform: csv(JOINER_LOCATION),
  };
  const deps = {
    getAuth: jest.fn().mockResolvedValue(SESSION),
    setCloudAnchorProject: jest.fn().mockResolvedValue(undefined),
    createRoom: jest.fn().mockResolvedValue({ success: true, room: ROOM }),
    lookupRoom: jest.fn().mockResolvedValue({ success: true, room: ROOM }),
    probeRelay: jest.fn().mockResolvedValue({ ok: true, peers: 0 }),
    joinChannel: jest.fn().mockResolvedValue({ success: true }),
    leaveChannel: jest.fn().mockResolvedValue(undefined),
    setLocalPose: jest.fn().mockResolvedValue(undefined),
    getChannelState: jest.fn(async () => ({
      state: channel.state as any,
      localPeerId: "me",
    })),
    getPeers: jest.fn().mockResolvedValue([]),
    createReplication: jest.fn(() => replication as any),
    frameSourceFor: jest.fn(() => ({
      key: "anchor-1",
      name: "cloud anchor",
      support: { ok: true as const },
      acquire: jest
        .fn()
        .mockResolvedValue({ success: true, frame: resolvedFrame }),
    })),
    hostSupport: jest.fn(() => ({ ok: true as const })),
    newProbeRoomId: jest.fn(() => "probe-room"),
    now: jest.fn(() => Date.now()),
    loadScene: jest.fn(async (sceneId: string) => scene({ id: sceneId })),
    onNavigationError: jest.fn(),
    ...over,
  } as unknown as jest.Mocked<StudioColocationDeps>;

  const controller = new StudioColocationController(deps);
  controller.setNavigatorAccessor(() => nav);
  const states: StudioColocationState[] = [];
  const rooms: unknown[] = [];
  controller.onStateChange = (s) => states.push(s);
  controller.onRoom = (r) => rooms.push(r);
  return {
    controller,
    deps,
    nav,
    replication,
    states,
    rooms,
    channel,
    last: () => controller.getState(),
  };
}

async function flush() {
  for (let i = 0; i < 50; i++) await Promise.resolve();
}

const advance = (ms: number) => jest.advanceTimersByTimeAsync(ms);

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

/** Host through to live on a NONE-mode scene. */
async function hostToLive(h: Harness, sceneData = scene()) {
  h.controller.request({ mode: "host", name: "Lab" });
  h.controller.attachScene(sceneData);
  await flush();
  h.controller.finishScan();
  await flush();
  h.controller.proposeOrigin(IDENTITY);
  h.replication.sync();
  await advance(500);
}

describe("StudioColocationController: host", () => {
  it("scans, hosts, creates the room with the scene and goes live", async () => {
    const h = harness();
    h.controller.request({ mode: "host", name: "Lab" });
    // Requested but no scene yet: content is withheld, nothing has started.
    expect(h.controller.getFrame().phase).toBe("pending");
    expect(h.deps.getAuth).not.toHaveBeenCalled();

    h.controller.attachScene(scene());
    await flush();
    expect(h.deps.setCloudAnchorProject).toHaveBeenCalledWith("proj-1");
    expect(h.deps.probeRelay).toHaveBeenCalledWith(
      "https://colocation.reactvision.xyz",
      "probe-room",
      { ...SESSION.headers, "x-project-id": "proj-1" }
    );
    expect(h.nav.startScan).toHaveBeenCalledTimes(1);
    expect(h.last()).toEqual({ status: "scanning", canFinish: false });

    await advance(500);
    expect(h.last()).toEqual({ status: "scanning", canFinish: true });

    h.controller.finishScan();
    await flush();
    expect(h.states.map((s) => s.status)).toContain("hosting");
    expect(h.nav.finishScan).toHaveBeenCalledWith(1);
    expect(h.deps.createRoom).toHaveBeenCalledWith(
      {
        endpoint: SESSION.baseUrl,
        headers: SESSION.headers,
        projectId: "proj-1",
      },
      {
        frameKind: "cloud_anchor",
        cloudAnchorId: "anchor-1",
        name: "Lab",
        sceneId: "scene-1",
      }
    );
    expect(h.rooms).toEqual([
      {
        id: "row-1",
        roomId: "room-1",
        joinCode: "K7M2QX",
        joinUrl: "https://studio.reactvision.xyz/j/K7M2QX",
        projectId: "proj-1",
        sceneId: "scene-1",
        frameKind: "cloud_anchor",
        isHost: true,
      },
    ]);
    expect(h.deps.joinChannel).toHaveBeenCalledWith({
      roomId: "room-1",
      apiKey: "",
      projectId: "proj-1",
      endpoint: "https://colocation.reactvision.xyz",
    });
    const config = h.replication.config!;
    expect(config.apiKey).toBeUndefined();
    expect(config.roomId).toBe("room-1");
    await expect(Promise.resolve(config.headers!())).resolves.toEqual(
      SESSION.headers
    );

    // The origin: a NONE scene proposes its world origin, written on sync.
    expect(h.controller.getFrame().needsOrigin).toBe(true);
    h.controller.proposeOrigin(IDENTITY);
    expect(h.controller.getFrame().needsOrigin).toBe(false);
    h.replication.sync();
    // The room's first scene is the host's.
    expect(h.replication.writes.map((w) => w.id)).toEqual([
      "scene:origin",
      "scene:current",
    ]);
    expect(h.replication.writes[1].fields).toEqual({
      sceneId: "scene-1",
      n: 0,
    });
    const written = h.replication.writes[0];
    const expected = toPositionQuat(invert(HOST_LOCATION)!);
    (written.fields.p as number[]).forEach((v, i) =>
      expect(v).toBeCloseTo(expected.p[i], 5)
    );
    expect(written.fields.sceneId).toBe("scene-1");
    expect(h.last().status).toBe("creating_room");

    await advance(500);
    expect(h.last()).toEqual({ status: "live", room: h.rooms[0], peers: 0 });
    const frame = h.controller.getFrame();
    expect(frame.phase).toBe("shared");
    frame.sceneToWorld!.forEach((v, i) =>
      expect(v).toBeCloseTo(IDENTITY[i], 5)
    );
  });

  it("holds Done until the scan has 30 keyframes", async () => {
    const h = harness();
    const gatesMet = {
      available: true,
      scanning: true,
      meetsKeyframes: true,
      meetsViewpointPairs: true,
      meetsSpread: true,
    };
    h.nav.getScanStatus.mockResolvedValue({ ...gatesMet, keyframes: 29 });
    h.controller.request({ mode: "host" });
    h.controller.attachScene(scene());
    await flush();
    await advance(500);
    expect(h.last()).toEqual({ status: "scanning", canFinish: false });
    h.nav.getScanStatus.mockResolvedValue({ ...gatesMet, keyframes: 30 });
    await advance(500);
    expect(h.last()).toEqual({ status: "scanning", canFinish: true });
  });

  it("offers Done after 10 s when native reports no scan coverage", async () => {
    const h = harness();
    h.nav.getScanStatus.mockResolvedValue({ available: false });
    h.controller.request({ mode: "host" });
    h.controller.attachScene(scene());
    await flush();
    await advance(9500);
    expect(h.last()).toEqual({ status: "scanning", canFinish: false });
    await advance(500);
    expect(h.last()).toEqual({ status: "scanning", canFinish: true });
  });

  it("publishes poses in the location frame, throttled", async () => {
    const h = harness();
    await hostToLive(h);
    expect(h.last().status).toBe("live");

    // Standing at the location frame's origin, looking down its -Z.
    const forward = [-Math.sin(Math.PI / 6), 0, -Math.cos(Math.PI / 6)] as [
      number,
      number,
      number,
    ];
    h.controller.publishCameraPose([1, 0, -2], forward, [0, 1, 0]);
    h.controller.publishCameraPose([1, 0, -2], forward, [0, 1, 0]);
    expect(h.deps.setLocalPose).toHaveBeenCalledTimes(1);
    const m = (h.deps.setLocalPose.mock.calls[0][0] as string)
      .split(",")
      .map(Number);
    [m[12], m[13], m[14]].forEach((v) => expect(v).toBeCloseTo(0, 5));
    [m[8], m[9], m[10]].forEach((v, i) =>
      expect(v).toBeCloseTo([0, 0, 1][i], 5)
    );

    await advance(50);
    h.controller.publishCameraPose([1, 0, -2], forward, [0, 1, 0]);
    expect(h.deps.setLocalPose).toHaveBeenCalledTimes(2);
  });

  it("uses the manifest key on the pose channel and the replication socket", async () => {
    const h = harness({ getAuth: jest.fn().mockResolvedValue(API_KEY) });
    await hostToLive(h);
    expect(h.deps.joinChannel.mock.calls[0][0].apiKey).toBe("rv_live_k");
    expect(h.replication.config).toMatchObject({
      apiKey: "rv_live_k",
      projectId: "proj-1",
    });
    expect(h.replication.config!.headers).toBeUndefined();
  });

  it("reports reconnecting and comes back", async () => {
    const h = harness();
    await hostToLive(h);
    h.replication.drive("reconnecting");
    expect(h.last().status).toBe("reconnecting");
    // A resync that lost the origin: the host writes it again.
    h.replication.sync();
    expect(h.last().status).toBe("live");
    await flush();
    const ids = h.replication.writes.map((w) => w.id);
    expect(ids.filter((id) => id === "scene:origin")).toHaveLength(2);
    expect(ids.filter((id) => id === "scene:current")).toHaveLength(2);
    h.channel.state = "reconnecting";
    await advance(500);
    expect(h.last().status).toBe("reconnecting");
    h.channel.state = "joined";
    await advance(500);
    expect(h.last().status).toBe("live");
  });

  it("leaves both sockets and clears the anchor project", async () => {
    const h = harness();
    await hostToLive(h);
    h.controller.leave();
    expect(h.deps.leaveChannel).toHaveBeenCalled();
    expect(h.replication.disconnected).toBe(true);
    expect(h.deps.setCloudAnchorProject).toHaveBeenLastCalledWith(null);
    expect(h.last()).toEqual({ status: "idle" });
    expect(h.controller.getFrame().phase).toBe("off");
    expect(h.controller.getRoom()).toBeNull();
  });

  it("ignores Done outside a scan", async () => {
    const h = harness();
    h.controller.finishScan();
    await hostToLive(h);
    h.controller.finishScan();
    await flush();
    expect(h.nav.finishScan).toHaveBeenCalledTimes(1);
  });

  it("withholds content while its first awaits are in flight", async () => {
    let giveAuth!: (auth: StudioAuthContext) => void;
    let giveProbe!: (probe: RelayProbeResult) => void;
    const h = harness({
      getAuth: jest.fn(
        () => new Promise<StudioAuthContext>((r) => (giveAuth = r))
      ),
      probeRelay: jest.fn(
        () => new Promise<RelayProbeResult>((r) => (giveProbe = r))
      ),
    });
    h.controller.request({ mode: "host" });
    h.controller.attachScene(scene());
    await flush();
    expect(h.last().status).toBe("idle");
    expect(h.controller.getFrame().phase).toBe("pending");
    giveAuth(SESSION);
    await flush();
    expect(h.deps.probeRelay).toHaveBeenCalled();
    expect(h.controller.getFrame().phase).toBe("pending");
    giveProbe({ ok: true, peers: 0 });
    await flush();
    expect(h.last().status).toBe("scanning");
    expect(h.controller.getFrame().phase).toBe("pending");
  });

  it("reads the credential again for the room and for a diagnosis", async () => {
    const h = harness();
    h.controller.request({ mode: "host" });
    h.controller.attachScene(scene());
    await flush();
    const later = {
      ...SESSION,
      headers: { ...SESSION.headers, Authorization: "Bearer t2" },
    };
    h.deps.getAuth.mockResolvedValue(later);
    h.controller.finishScan();
    await flush();
    expect(h.deps.createRoom).toHaveBeenCalledWith(
      {
        endpoint: SESSION.baseUrl,
        headers: later.headers,
        projectId: "proj-1",
      },
      expect.any(Object)
    );
    h.controller.proposeOrigin(IDENTITY);
    h.replication.sync();
    await advance(500);
    expect(h.last().status).toBe("live");

    const latest = {
      ...SESSION,
      headers: { ...SESSION.headers, Authorization: "Bearer t3" },
    };
    h.deps.getAuth.mockResolvedValue(latest);
    h.replication.drive("failed", "socket closed");
    await flush();
    expect(h.deps.probeRelay).toHaveBeenLastCalledWith(
      "https://colocation.reactvision.xyz",
      "room-1",
      { ...latest.headers, "x-project-id": "proj-1" }
    );
    expect(h.last()).toEqual({
      status: "failed",
      code: "UNAVAILABLE",
      message: "socket closed",
    });
  });

  it("fails when the credential kind changes before the room is created", async () => {
    const h = harness();
    h.controller.request({ mode: "host" });
    h.controller.attachScene(scene());
    await flush();
    h.deps.getAuth.mockResolvedValue({
      mode: "none",
      baseUrl: null,
      headers: {},
      projectId: null,
    });
    h.controller.finishScan();
    await flush();
    expect(h.deps.createRoom).not.toHaveBeenCalled();
    expect(h.last()).toMatchObject({
      status: "failed",
      code: "NOT_AUTHORIZED",
    });
    expect(h.controller.getFrame().phase).toBe("off");
  });

  it("stops at a refused origin instead of writing it again", async () => {
    const h = harness();
    await hostToLive(h);
    expect(h.last().status).toBe("live");
    h.replication.refuse("scene:origin", "room-too-large");
    await flush();
    expect(h.replication.writes.map((w) => w.id)).toEqual([
      "scene:origin",
      "scene:current",
    ]);
    expect(h.last()).toEqual({
      status: "failed",
      code: "SCENE_TOO_LARGE",
      message: "The relay refused the shared scene origin (room-too-large).",
    });
    expect(h.replication.disconnected).toBe(true);
    expect(h.deps.leaveChannel).toHaveBeenCalled();
  });

  it("keeps the session when another entity's write is refused", async () => {
    const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
    const h = harness();
    await hostToLive(h);
    h.replication.refuse("var:score", "field-too-large");
    await flush();
    expect(h.last().status).toBe("live");
    expect(h.replication.writes).toHaveLength(2);
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("refused a change (field-too-large)")
    );
    warn.mockRestore();
  });

  it("asks for a surface once a plane-mode room exists, with its code", async () => {
    const h = harness();
    const prompts: Array<StudioColocationOriginPrompt | null> = [];
    h.controller.onOriginPrompt = (p) => prompts.push(p);
    h.controller.request({ mode: "host" });
    h.controller.attachScene(scene({ plane_detection: "MANUAL" }));
    await flush();
    expect(prompts).toEqual([]);
    h.controller.finishScan();
    await flush();
    h.replication.sync();
    await advance(500);
    expect(h.last().status).toBe("creating_room");
    expect(prompts).toEqual([{ joinCode: "K7M2QX", tap: true }]);
    h.controller.proposeOrigin(IDENTITY);
    expect(prompts).toEqual([{ joinCode: "K7M2QX", tap: true }, null]);
    await advance(500);
    expect(h.last().status).toBe("live");

    const none = harness();
    const nonePrompts: unknown[] = [];
    none.controller.onOriginPrompt = (p) => nonePrompts.push(p);
    await hostToLive(none);
    expect(nonePrompts).toEqual([]);
  });

  it("names the scene attached last, the one on screen", async () => {
    const h = harness();
    await hostToLive(h);
    const before = h.controller.getFrame();
    expect(before.sceneId).toBe("scene-1");
    h.controller.attachScene(scene({ id: "scene-2" }));
    expect(h.controller.getFrame().sceneId).toBe("scene-2");
    // The frame itself has not moved, so its matrices keep their identity.
    expect(h.controller.getFrame().sceneToWorld).toBe(before.sceneToWorld);
    expect(h.controller.getFrame().worldToScene).toBe(before.worldToScene);
    expect(h.controller.isCurrentScene("scene-1")).toBe(false);
    expect(h.controller.isCurrentScene("scene-2")).toBe(true);
    h.controller.leave();
    expect(h.controller.getFrame().sceneId).toBeNull();
  });
});

describe("StudioColocationController: join", () => {
  it("reads the match count from native's progress message", () => {
    expect(
      resolveMatches("Looking for the anchor, move around the space")
    ).toBeNull();
    expect(resolveMatches("Anchor seen, keep moving slowly (0/3)")).toBeNull();
    expect(resolveMatches("Anchor seen, keep moving slowly (2/3)")).toEqual({
      matches: 2,
      needed: 3,
    });
    expect(resolveMatches(null)).toBeNull();
  });

  it("reports native's matches while resolving", async () => {
    let finish: (value: unknown) => void = () => {};
    const progress = jest
      .fn()
      .mockResolvedValue("Looking for the anchor, move around the space");
    const h = harness({
      frameSourceFor: jest.fn(() => ({
        key: "anchor-1",
        name: "cloud anchor",
        support: { ok: true as const },
        acquire: jest.fn(() => new Promise((resolve) => (finish = resolve))),
        progress,
      })),
    });
    h.controller.request({ mode: "join", code: "k7m 2qx" });
    h.controller.attachScene(scene());
    await flush();
    await advance(500);
    expect(h.last()).toEqual({ status: "resolving", attempt: 1 });

    progress.mockResolvedValue("Anchor seen, keep moving slowly (1/3)");
    await advance(500);
    expect(h.last()).toEqual({
      status: "resolving",
      attempt: 1,
      seen: { matches: 1, needed: 3 },
    });

    progress.mockResolvedValue("Anchor seen, keep moving slowly (2/3)");
    await advance(500);
    expect(h.last()).toEqual({
      status: "resolving",
      attempt: 1,
      seen: { matches: 2, needed: 3 },
    });

    finish({
      success: true,
      frame: {
        position: [0, 0, 0],
        rotation: [0, 0, 0],
        scale: [1, 1, 1],
        transform: "",
      },
    });
    await flush();
    const polls = progress.mock.calls.length;
    await advance(1500);
    expect(progress.mock.calls.length).toBe(polls);
  });

  it("looks up, resolves with retries, waits for the origin and goes live", async () => {
    const acquire = jest
      .fn()
      .mockResolvedValueOnce({
        success: false,
        error: "no match",
        state: "ErrorResolvingLocalizationNoMatch",
      })
      .mockResolvedValue({
        success: true,
        frame: {
          position: [0, 0, 0],
          rotation: [0, 0, 0],
          scale: [1, 1, 1],
          transform: csv(JOINER_LOCATION),
        },
      });
    const h = harness({
      frameSourceFor: jest.fn(() => ({
        key: "anchor-1",
        name: "cloud anchor",
        support: { ok: true as const },
        acquire,
      })),
    });
    h.controller.request({ mode: "join", code: "k7m 2qx" });
    h.controller.attachScene(scene());
    await flush();
    expect(h.deps.lookupRoom).toHaveBeenCalledWith(
      {
        endpoint: SESSION.baseUrl,
        headers: SESSION.headers,
        projectId: "proj-1",
      },
      "k7m 2qx"
    );
    expect(h.deps.probeRelay).toHaveBeenCalledWith(
      "https://colocation.reactvision.xyz",
      "room-1",
      expect.objectContaining({ "x-project-id": "proj-1" })
    );
    expect(h.last()).toEqual({ status: "resolving", attempt: 1 });

    await advance(1000);
    await flush();
    expect(h.states).toContainEqual({ status: "resolving", attempt: 2 });
    expect(h.deps.joinChannel).toHaveBeenCalled();

    // Connected, but nothing is shown until the host's origin arrives.
    h.replication.sync();
    await advance(500);
    expect(h.last().status).toBe("resolving");
    expect(h.controller.getFrame().phase).toBe("pending");
    expect(h.rooms).toEqual([]);

    const originInLocation = multiply(
      invert(HOST_LOCATION)!,
      fromPositionEuler([0.5, -1, -1], [0, 15, 0])
    );
    const { p, q } = toPositionQuat(originInLocation);
    h.replication.sync([
      {
        id: "scene:origin",
        fields: { p, q, sceneId: "scene-1" },
        version: 1,
        owner: null,
      },
    ]);
    expect(h.last()).toMatchObject({ status: "live", peers: 0 });
    expect(h.rooms).toEqual([expect.objectContaining({ isHost: false })]);
    expect(h.replication.writes).toEqual([]);

    const frame = h.controller.getFrame();
    const expected = multiply(JOINER_LOCATION, originInLocation);
    frame.sceneToWorld!.forEach((v, i) =>
      expect(v).toBeCloseTo(expected[i], 4)
    );

    // Only the host writes the origin; a joiner keeps the one it has.
    h.replication.sync();
    expect(h.replication.writes).toEqual([]);
    expect(h.controller.getFrame().sceneToWorld).toBe(frame.sceneToWorld);
  });

  it("does not restart for an equal value, and stays left until it changes", async () => {
    const h = harness();
    h.controller.request({ mode: "join", code: "K7M2QX" });
    h.controller.attachScene(scene());
    await flush();
    h.controller.request({ mode: "join", code: "k7m 2qx" });
    h.controller.attachScene(scene({ id: "scene-2" }));
    await flush();
    expect(h.deps.lookupRoom).toHaveBeenCalledTimes(1);

    h.controller.leave();
    h.controller.request({ mode: "join", code: "K7M2QX" });
    await flush();
    expect(h.deps.lookupRoom).toHaveBeenCalledTimes(1);

    h.controller.request(null);
    h.controller.request({ mode: "join", code: "K7M2QX" });
    await flush();
    expect(h.deps.lookupRoom).toHaveBeenCalledTimes(2);
  });

  it("leaves when the value is removed", async () => {
    const h = harness();
    h.controller.request({ mode: "join", code: "K7M2QX" });
    h.controller.attachScene(scene());
    await flush();
    h.controller.request(null);
    expect(h.deps.leaveChannel).toHaveBeenCalled();
    expect(h.nav.cancelCloudAnchorOperations).not.toHaveBeenCalled();
    expect(h.last()).toEqual({ status: "idle" });
  });

  it("maps a lookup refused by the real rooms client", async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: false,
      status: 403,
      json: async () => ({
        error: { code: "PAID_PLAN_REQUIRED", message: "Upgrade to share" },
      }),
    });
    (global as any).fetch = fetchMock;
    const h = harness({ lookupRoom: lookupColocationRoom });
    h.controller.request({ mode: "join", code: "K7M2QX" });
    h.controller.attachScene(scene());
    await flush();
    expect(fetchMock).toHaveBeenCalledWith(
      "https://supabase.example/functions/v1/colocation/rooms/K7M2QX",
      expect.objectContaining({
        method: "GET",
        headers: {
          "content-type": "application/json",
          Authorization: "Bearer t1",
          "x-rv-client": "studio-go",
          "x-project-id": "proj-1",
        },
      })
    );
    expect(h.last()).toEqual({
      status: "failed",
      code: "PAID_PLAN_REQUIRED",
      message: "Upgrade to share",
    });
    delete (global as any).fetch;
  });
});

describe("StudioColocationController: failures", () => {
  const failed = (h: Harness) => {
    const s = h.last();
    return s.status === "failed" ? s.code : `not failed: ${s.status}`;
  };

  async function startHost(h: Harness, sceneData = scene()) {
    h.controller.request({ mode: "host" });
    h.controller.attachScene(sceneData);
    await flush();
  }

  async function startJoin(h: Harness) {
    h.controller.request({ mode: "join", code: "K7M2QX" });
    h.controller.attachScene(scene());
    await flush();
  }

  it("refuses a scene over the entity budget before anything else", async () => {
    const assets = Array.from({ length: 470 }, (_, i) => ({
      id: `a${i}`,
      is_draggable: false,
      tap_to_place: false,
      trigger_image_url: null,
    })) as unknown as StudioSceneResponse["assets"];
    const h = harness();
    await startHost(h, scene({}, assets));
    expect(failed(h)).toBe("SCENE_TOO_LARGE");
    expect(h.deps.getAuth).not.toHaveBeenCalled();
    expect(h.controller.getFrame().phase).toBe("off");
  });

  it("refuses hosting where cloud anchors cannot run", async () => {
    const h = harness({
      hostSupport: jest.fn(() => ({ ok: false as const, reason: "no camera" })),
    });
    await startHost(h);
    expect(failed(h)).toBe("FRAME_KIND_UNSUPPORTED");
  });

  it("refuses without credentials", async () => {
    const h = harness({
      getAuth: jest.fn().mockResolvedValue({
        mode: "none",
        baseUrl: null,
        headers: {},
        projectId: null,
      }),
    });
    await startHost(h);
    expect(failed(h)).toBe("NOT_AUTHORIZED");
    expect(h.nav.startScan).not.toHaveBeenCalled();
  });

  it("learns a refused plan before the scan", async () => {
    const h = harness({
      probeRelay: jest.fn().mockResolvedValue({
        ok: false,
        status: 403,
        code: "PAID_PLAN_REQUIRED",
        message: "paid only",
      }),
    });
    await startHost(h);
    expect(failed(h)).toBe("PAID_PLAN_REQUIRED");
    expect(h.nav.startScan).not.toHaveBeenCalled();
    expect(h.deps.setCloudAnchorProject).toHaveBeenLastCalledWith(null);
  });

  it("fails hosting when the scan does not host", async () => {
    const h = harness();
    h.nav.finishScan.mockResolvedValue({
      success: false,
      error: "Scan too small",
    });
    await startHost(h);
    h.controller.finishScan();
    await flush();
    expect(h.last()).toEqual({
      status: "failed",
      code: "HOST_FAILED",
      message: "Scan too small",
    });
    expect(h.deps.createRoom).not.toHaveBeenCalled();
  });

  it.each([
    [403, "PAID_PLAN_REQUIRED", "PAID_PLAN_REQUIRED"],
    [403, "PROJECT_ACCESS_DENIED", "NOT_AUTHORIZED"],
    [500, "CREATE_FAILED", "UNAVAILABLE"],
    [409, "TOO_MANY_ROOMS", "UNKNOWN"],
  ])(
    "maps a room create refused %i %s to %s",
    async (status, code, expected) => {
      const h = harness({
        createRoom: jest
          .fn()
          .mockResolvedValue({ success: false, error: "no", code, status }),
      });
      await startHost(h);
      h.controller.finishScan();
      await flush();
      expect(failed(h)).toBe(expected);
      expect(h.deps.joinChannel).not.toHaveBeenCalled();
    }
  );

  it("maps a missing room", async () => {
    const h = harness({
      lookupRoom: jest.fn().mockResolvedValue({
        success: false,
        error: "Room not found",
        code: "ROOM_NOT_FOUND",
        status: 404,
      }),
    });
    await startJoin(h);
    expect(failed(h)).toBe("ROOM_NOT_FOUND");
  });

  it("refuses a frame kind this device cannot use", async () => {
    const h = harness({
      lookupRoom: jest.fn().mockResolvedValue({
        success: true,
        room: { ...ROOM, frameKind: "meta_group", frameRef: "group-1" },
      }),
    });
    // The real mapping: a Meta group only resolves on Quest.
    const { frameSourceFor: _mocked, ...deps } = h.deps;
    const real = new StudioColocationController(deps);
    real.setNavigatorAccessor(() => h.nav);
    real.request({ mode: "join", code: "K7M2QX" });
    real.attachScene(scene());
    await flush();
    const state = real.getState();
    expect(state).toMatchObject({
      status: "failed",
      code: "FRAME_KIND_UNSUPPORTED",
    });
    expect((state as { message: string }).message).toMatch(/Quest/);
  });

  it.each([
    [{ ok: true, peers: 16 }, "ROOM_FULL"],
    [
      { ok: false, status: 503, code: "ROOM_FULL", message: "full" },
      "ROOM_FULL",
    ],
    [
      { ok: false, status: 503, code: "RELAY_AT_CAPACITY", message: "busy" },
      "RELAY_AT_CAPACITY",
    ],
    [{ ok: false, message: "offline" }, "UNAVAILABLE"],
  ])(
    "refuses before resolving when the relay says %j",
    async (probe, expected) => {
      const h = harness({ probeRelay: jest.fn().mockResolvedValue(probe) });
      await startJoin(h);
      expect(failed(h)).toBe(expected);
      expect(
        h.deps.frameSourceFor.mock.results[0].value.acquire
      ).not.toHaveBeenCalled();
    }
  );

  it("gives up resolving after three windows", async () => {
    const acquire = jest.fn().mockResolvedValue({
      success: false,
      error: "no match",
      state: "ErrorResolvingLocalizationNoMatch",
    });
    const h = harness({
      frameSourceFor: jest.fn(() => ({
        key: "anchor-1",
        name: "cloud anchor",
        support: { ok: true as const },
        acquire,
      })),
    });
    await startJoin(h);
    await advance(1000);
    await flush();
    await advance(1000);
    await flush();
    expect(acquire).toHaveBeenCalledTimes(3);
    expect(h.states).toContainEqual({ status: "resolving", attempt: 3 });
    expect(failed(h)).toBe("RESOLVE_NO_MATCH");
    expect(h.deps.joinChannel).not.toHaveBeenCalled();
  });

  it("does not retry a resolve refused for credentials", async () => {
    const acquire = jest.fn().mockResolvedValue({
      success: false,
      error: "denied",
      state: "ErrorNotAuthorized",
    });
    const h = harness({
      frameSourceFor: jest.fn(() => ({
        key: "anchor-1",
        name: "cloud anchor",
        support: { ok: true as const },
        acquire,
      })),
    });
    await startJoin(h);
    expect(acquire).toHaveBeenCalledTimes(1);
    expect(failed(h)).toBe("NOT_AUTHORIZED");
  });

  it("cancels an in-flight resolve on leave", async () => {
    const h = harness({
      frameSourceFor: jest.fn(() => ({
        key: "anchor-1",
        name: "cloud anchor",
        support: { ok: true as const },
        acquire: jest.fn(() => new Promise(() => {})),
      })),
    });
    await startJoin(h);
    expect(h.last().status).toBe("resolving");
    h.controller.leave();
    expect(h.nav.cancelCloudAnchorOperations).toHaveBeenCalled();
    expect(h.last()).toEqual({ status: "idle" });
  });

  it("fails when the pose channel cannot be joined", async () => {
    const h = harness({
      joinChannel: jest
        .fn()
        .mockResolvedValue({ success: false, error: "No API key or session" }),
    });
    await startJoin(h);
    expect(h.last()).toEqual({
      status: "failed",
      code: "UNAVAILABLE",
      message: "No API key or session",
    });
    expect(h.deps.createReplication).not.toHaveBeenCalled();
  });

  it("asks the relay why a live session was cut off", async () => {
    const h = harness();
    await hostToLive(h);
    h.deps.probeRelay.mockResolvedValue({
      ok: false,
      status: 403,
      code: "PAID_PLAN_REQUIRED",
      message: "paid only",
    });
    h.replication.drive(
      "failed",
      "these credentials or this plan can no longer join the room"
    );
    await flush();
    expect(failed(h)).toBe("PAID_PLAN_REQUIRED");
    expect(h.deps.probeRelay).toHaveBeenLastCalledWith(
      "https://colocation.reactvision.xyz",
      "room-1",
      expect.any(Object)
    );
    expect(h.replication.disconnected).toBe(true);
    expect(h.deps.leaveChannel).toHaveBeenCalled();
  });

  it("reports the network when the relay itself is fine", async () => {
    const h = harness();
    await hostToLive(h);
    h.channel.state = "failed";
    await advance(500);
    await flush();
    expect(h.last()).toEqual({
      status: "failed",
      code: "UNAVAILABLE",
      message: "The co-location channel failed.",
    });
  });
});

describe("StudioColocationController: shared scene state", () => {
  function sharedScene(): StudioSceneResponse {
    const lamp = {
      id: "lamp",
      hidden_on_load: false,
      is_draggable: false,
      tap_to_place: true,
      tap_to_place_order: 1,
      trigger_image_url: null,
    } as unknown as StudioSceneResponse["assets"][number];
    return {
      ...scene({}, [lamp]),
      variables: [
        { id: "v1", name: "score", type: "NUMBER", initial_value: 0 },
      ],
    };
  }

  function stores(sceneData: StudioSceneResponse) {
    const variables = new StudioVariableStore();
    variables.seed(sceneData.variables ?? []);
    const visibility = new StudioVisibilityStore();
    visibility.seed(sceneData.assets);
    const placement = new StudioPlacementStore();
    placement.seed(sceneData.assets);
    return { variables, visibility, placement };
  }

  async function hostSharing(h: Harness) {
    const sceneData = sharedScene();
    const s = stores(sceneData);
    h.controller.request({ mode: "host", name: "Lab" });
    h.controller.attachScene(sceneData, s);
    await flush();
    h.controller.finishScan();
    await flush();
    h.controller.proposeOrigin(IDENTITY);
    h.replication.sync();
    await advance(500);
    return s;
  }

  it("writes the attached scene's changes once the room syncs", async () => {
    const h = harness();
    const s = await hostSharing(h);
    expect(h.last().status).toBe("live");
    s.variables.set("score", 2);
    expect(h.replication.writes.map((w) => w.id)).toEqual([
      "scene:origin",
      "scene:current",
      "var:score",
    ]);
    expect(h.replication.writes[2].fields).toEqual({ v: 2 });
  });

  it("places a joiner's rows through the scene origin the room holds", async () => {
    const h = harness();
    const sceneData = sharedScene();
    const s = stores(sceneData);
    h.controller.request({ mode: "join", code: "K7M2QX" });
    h.controller.attachScene(sceneData, s);
    await flush();
    expect(h.deps.joinChannel).toHaveBeenCalled();
    await advance(500);

    const origin = fromPositionEuler([0.5, -1, -1], [0, 15, 0]);
    const { p, q } = toPositionQuat(origin);
    const tapInScene: [number, number, number] = [0.2, 0, -0.4];
    h.replication.sync([
      {
        id: "scene:origin",
        fields: { p, q, sceneId: "scene-1" },
        version: 1,
        owner: null,
      },
      {
        id: "place:lamp",
        fields: {
          p: transformPoint(fromPositionQuat(p, q), tapInScene),
          f: null,
          u: null,
        },
        version: 1,
        owner: null,
      },
      { id: "var:score", fields: { v: 5 }, version: 1, owner: null },
    ]);
    expect(h.last().status).toBe("live");
    s.placement
      .getPosition("lamp")!
      .forEach((v, i) => expect(v).toBeCloseTo(tapInScene[i], 5));
    expect(s.variables.get("score")).toBe(5);
    expect(h.replication.writes).toEqual([]);
  });

  it("follows the scene that attached last", async () => {
    const h = harness();
    const first = await hostSharing(h);
    const next = stores(sharedScene());
    h.controller.attachScene(
      { ...sharedScene(), scene: { ...sharedScene().scene, id: "scene-2" } },
      next
    );
    first.visibility.apply("lamp", "HIDDEN");
    next.visibility.apply("lamp", "HIDDEN");
    // Attaching another scene is a navigation of this device's own.
    expect(h.replication.writes.map((w) => w.id)).toEqual([
      "scene:origin",
      "scene:current",
      "scene:current",
      "vis:lamp",
    ]);
  });

  it("stops sharing when the session is left", async () => {
    const h = harness();
    const s = await hostSharing(h);
    h.controller.leave();
    s.variables.set("score", 3);
    expect(h.replication.writes.map((w) => w.id)).toEqual([
      "scene:origin",
      "scene:current",
    ]);
  });
});

describe("StudioColocationController: shared navigation", () => {
  const lamp = {
    id: "lamp",
    hidden_on_load: false,
    is_draggable: true,
    tap_to_place: false,
    trigger_image_url: null,
  } as unknown as StudioSceneResponse["assets"][number];

  const row = (
    id: string,
    fields: Record<string, unknown>,
    version = 1
  ): ViroReplicatedEntity => ({ id, fields, version, owner: null });

  const originRow = () => {
    const { p, q } = toPositionQuat(IDENTITY);
    return row("scene:origin", { p, q, sceneId: "scene-1" });
  };

  function withNavigator(h: Harness) {
    const pushed: Array<{ sceneId: string; skipOnLoadFunction: boolean }> = [];
    h.controller.setScenePusher((sceneData, { skipOnLoadFunction }) =>
      pushed.push({ sceneId: sceneData.scene.id, skipOnLoadFunction })
    );
    return pushed;
  }

  /** Host live on scene-1, its first scene:current accepted by the relay. */
  async function liveHost(h: Harness, sceneData = scene()) {
    const leave = jest.fn();
    h.controller.request({ mode: "host", name: "Lab" });
    h.controller.attachScene(sceneData, undefined, { leave });
    await flush();
    h.controller.finishScan();
    await flush();
    h.controller.proposeOrigin(IDENTITY);
    h.replication.sync();
    await advance(500);
    h.replication.echo("scene:current");
    expect(h.last().status).toBe("live");
    return leave;
  }

  async function joinerSynced(h: Harness, entities: ViroReplicatedEntity[]) {
    h.controller.request({ mode: "join", code: "K7M2QX" });
    h.controller.attachScene(scene());
    await flush();
    h.replication.sync([originRow(), ...entities]);
    await flush();
  }

  const currentWrites = (h: Harness) =>
    h.replication.writes
      .filter((w) => w.id === "scene:current")
      .map((w) => w.fields);

  it("leaves a NAVIGATE with no session to the scene", () => {
    const h = harness();
    withNavigator(h);
    expect(h.controller.navigate("scene-2")).toBe(false);
    expect(h.deps.loadScene).not.toHaveBeenCalled();
  });

  it("takes a NAVIGATE while live into the room and through the navigator", async () => {
    const h = harness();
    const pushed = withNavigator(h);
    const leave = await liveHost(h);
    expect(h.controller.navigate("scene-2")).toBe(true);
    await flush();
    expect(h.deps.loadScene).toHaveBeenCalledWith("scene-2");
    expect(currentWrites(h)).toEqual([
      { sceneId: "scene-1", n: 0 },
      { sceneId: "scene-2", n: 1 },
    ]);
    // The device that navigated runs the new scene's on_load itself.
    expect(pushed).toEqual([{ sceneId: "scene-2", skipOnLoadFunction: false }]);
    expect(leave).toHaveBeenCalledTimes(1);

    // The pushed scene mounting is not a navigation of its own.
    h.controller.attachScene(scene({ id: "scene-2" }));
    await advance(100);
    expect(currentWrites(h)).toHaveLength(2);
  });

  it("follows the room's scene without running its on_load, and writes nothing back", async () => {
    const h = harness();
    const pushed = withNavigator(h);
    const leave = await liveHost(h);
    h.replication.upsert(row("scene:current", { sceneId: "scene-3", n: 1 }, 2));
    await flush();
    expect(h.deps.loadScene).toHaveBeenCalledWith("scene-3");
    expect(pushed).toEqual([{ sceneId: "scene-3", skipOnLoadFunction: true }]);
    expect(leave).toHaveBeenCalledTimes(1);
    h.controller.attachScene(scene({ id: "scene-3" }));
    await advance(100);
    expect(currentWrites(h)).toEqual([{ sceneId: "scene-1", n: 0 }]);
  });

  it("numbers a navigation past the room's count", async () => {
    const h = harness();
    withNavigator(h);
    await liveHost(h);
    h.replication.upsert(row("scene:current", { sceneId: "scene-3", n: 7 }, 2));
    await flush();
    h.controller.attachScene(scene({ id: "scene-3" }));
    h.controller.navigate("scene-4");
    await flush();
    expect(currentWrites(h).pop()).toEqual({ sceneId: "scene-4", n: 8 });
  });

  it("moves a joiner on another scene to the room's once it syncs", async () => {
    const h = harness();
    const pushed = withNavigator(h);
    await joinerSynced(h, [row("scene:current", { sceneId: "scene-3", n: 4 })]);
    expect(pushed).toEqual([{ sceneId: "scene-3", skipOnLoadFunction: true }]);
    expect(h.replication.writes).toEqual([]);
  });

  it("keeps a joiner already on the room's scene, and follows the room re-entering it", async () => {
    const h = harness();
    const pushed = withNavigator(h);
    await joinerSynced(h, [row("scene:current", { sceneId: "scene-1", n: 4 })]);
    expect(pushed).toEqual([]);
    expect(h.deps.loadScene).not.toHaveBeenCalled();
    h.replication.upsert(row("scene:current", { sceneId: "scene-1", n: 5 }, 2));
    await flush();
    expect(pushed).toEqual([{ sceneId: "scene-1", skipOnLoadFunction: true }]);
  });

  it("removes the old scene's rows on the device that navigated only", async () => {
    const sceneData = scene({}, [lamp]);
    const host = harness();
    withNavigator(host);
    await liveHost(host, sceneData);
    for (const id of ["vis:lamp", "place:lamp", "drag:lamp", "var:score"]) {
      host.replication.upsert(row(id, { v: 1 }));
    }
    host.controller.navigate("scene-2");
    await flush();
    expect(
      host.replication.ops
        .filter((o) => o.op === "delete")
        .map((o) => o.id)
        .sort()
    ).toEqual(["drag:lamp", "place:lamp", "vis:lamp"]);
    // Gone before the room hears where it went.
    const order = host.replication.ops.map((o) => `${o.op} ${o.id}`);
    const announced = order.lastIndexOf("set scene:current");
    expect(order.lastIndexOf("delete vis:lamp")).toBeLessThan(announced);
    expect(order.lastIndexOf("delete drag:lamp")).toBeLessThan(announced);
    expect(currentWrites(host).pop()).toEqual({ sceneId: "scene-2", n: 1 });

    const joiner = harness();
    withNavigator(joiner);
    joiner.controller.request({ mode: "join", code: "K7M2QX" });
    joiner.controller.attachScene(sceneData);
    await flush();
    joiner.replication.sync([
      originRow(),
      row("scene:current", { sceneId: "scene-1", n: 0 }),
      row("vis:lamp", { visible: false }),
    ]);
    joiner.replication.upsert(
      row("scene:current", { sceneId: "scene-2", n: 1 }, 2)
    );
    await flush();
    expect(joiner.replication.ops.filter((o) => o.op === "delete")).toEqual([]);
  });

  it("pushes only the latest of two navigations when the first loads last", async () => {
    const loads = new Map<string, (s: StudioSceneResponse) => void>();
    const h = harness({
      loadScene: jest.fn(
        (sceneId: string) =>
          new Promise<StudioSceneResponse>((resolve) =>
            loads.set(sceneId, resolve)
          )
      ),
    });
    const pushed = withNavigator(h);
    await liveHost(h);
    h.controller.navigate("scene-2");
    h.controller.navigate("scene-3");
    loads.get("scene-3")!(scene({ id: "scene-3" }));
    await flush();
    loads.get("scene-2")!(scene({ id: "scene-2" }));
    await flush();
    expect(pushed.map((p) => p.sceneId)).toEqual(["scene-3"]);
    expect(currentWrites(h).map((f) => f.sceneId)).toEqual([
      "scene-1",
      "scene-3",
    ]);
  });

  it("retries a scene the room moved to, then reports it once", async () => {
    const failure = new Error("offline");
    const h = harness({ loadScene: jest.fn().mockRejectedValue(failure) });
    const pushed = withNavigator(h);
    await liveHost(h);
    h.replication.upsert(row("scene:current", { sceneId: "scene-3", n: 1 }, 2));
    await flush();
    await advance(1000);
    await flush();
    await advance(2000);
    await flush();
    expect(h.deps.loadScene).toHaveBeenCalledTimes(3);
    expect(h.deps.onNavigationError).toHaveBeenCalledTimes(1);
    expect(h.deps.onNavigationError).toHaveBeenCalledWith(failure);
    expect(pushed).toEqual([]);
  });

  it("reports a NAVIGATE whose scene fails to load, and writes nothing", async () => {
    const h = harness({
      loadScene: jest.fn().mockRejectedValue(new Error("gone")),
    });
    const pushed = withNavigator(h);
    await liveHost(h);
    h.controller.navigate("scene-2");
    await flush();
    expect(h.deps.onNavigationError).toHaveBeenCalledTimes(1);
    expect(pushed).toEqual([]);
    expect(currentWrites(h)).toHaveLength(1);
  });

  describe("a scene of another project", () => {
    const elsewhere = () =>
      harness({
        loadScene: jest.fn(async (sceneId: string) =>
          scene({ id: sceneId, belongs_to_project: "proj-2" })
        ),
      });

    it("is not followed when the room names it, and is reported", async () => {
      const h = elsewhere();
      const pushed = withNavigator(h);
      const leave = await liveHost(h);
      h.replication.upsert(
        row("scene:current", { sceneId: "scene-9", n: 1 }, 2)
      );
      await flush();
      expect(h.deps.loadScene).toHaveBeenCalledWith("scene-9");
      expect(pushed).toEqual([]);
      expect(leave).not.toHaveBeenCalled();
      expect(h.deps.onNavigationError).toHaveBeenCalledTimes(1);
      expect(currentWrites(h)).toEqual([{ sceneId: "scene-1", n: 0 }]);
    });

    it("is not navigated to, and the room's scene stays", async () => {
      const h = elsewhere();
      const pushed = withNavigator(h);
      await liveHost(h);
      expect(h.controller.navigate("scene-9")).toBe(true);
      await flush();
      expect(pushed).toEqual([]);
      expect(h.deps.onNavigationError).toHaveBeenCalledTimes(1);
      expect(currentWrites(h)).toHaveLength(1);
    });
  });

  it("takes the room's scene back after navigating while reconnecting", async () => {
    const h = harness();
    const pushed = withNavigator(h);
    await liveHost(h);
    h.replication.drive("reconnecting");
    h.controller.navigate("scene-2");
    await flush();
    expect(pushed).toEqual([{ sceneId: "scene-2", skipOnLoadFunction: false }]);
    h.controller.attachScene(scene({ id: "scene-2" }));
    h.replication.sync([
      originRow(),
      row("scene:current", { sceneId: "scene-1", n: 0 }),
    ]);
    await flush();
    expect(pushed).toEqual([
      { sceneId: "scene-2", skipOnLoadFunction: false },
      { sceneId: "scene-1", skipOnLoadFunction: true },
    ]);
  });

  it("writes the room's scene again when a re-welcome lost it", async () => {
    const h = harness();
    withNavigator(h);
    await liveHost(h);
    h.replication.drive("reconnecting");
    h.replication.sync([originRow()]);
    await flush();
    expect(currentWrites(h)).toEqual([
      { sceneId: "scene-1", n: 0 },
      { sceneId: "scene-1", n: 0 },
    ]);
  });

  it("stops following once the session is left", async () => {
    let finish!: (s: StudioSceneResponse) => void;
    const h = harness({
      loadScene: jest.fn(
        () => new Promise<StudioSceneResponse>((resolve) => (finish = resolve))
      ),
    });
    const pushed = withNavigator(h);
    await liveHost(h);
    h.replication.upsert(row("scene:current", { sceneId: "scene-3", n: 1 }, 2));
    await flush();
    h.controller.leave();
    finish(scene({ id: "scene-3" }));
    await flush();
    expect(pushed).toEqual([]);
  });

  it("shares an animation trigger from the scene on screen only", async () => {
    const h = harness();
    await liveHost(h);
    h.controller.shareAnimation("scene-1", "lamp", "spin");
    h.controller.shareAnimation("scene-9", "lamp", "spin");
    const events = h.replication.writes.filter((w) => w.id.startsWith("evt:"));
    expect(events).toEqual([
      {
        id: "evt:1",
        fields: expect.objectContaining({
          n: 1,
          kind: "animation",
          sceneId: "scene-1",
          assetId: "lamp",
          key: "spin",
          from: "me",
        }),
      },
    ]);
  });
});
