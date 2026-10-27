import * as fs from "fs";
import * as path from "path";
import type { ViroColocationRoom } from "../components/AR/ViroColocationRooms";
import type {
  ViroReplicatedEntity,
  ViroReplicationConfig,
  ViroReplicationState,
} from "../components/AR/ViroReplication";
import {
  StudioColocationController,
  type StudioColocationDeps,
  studioSceneRootsInAR,
} from "../components/Studio/colocation/controller";
import { frameKindUnsupportedFailure } from "../components/Studio/colocation/errors";
import {
  fromPositionEuler,
  IDENTITY,
  type Mat4,
  multiply,
} from "../components/Studio/colocation/frameMath";
import { studioColocationIndicatorContent } from "../components/Studio/colocation/indicatorContent";
import type {
  StudioColocationRoom,
  StudioColocationState,
} from "../components/Studio/colocation/types";
import type { StudioSceneResponse } from "../components/Studio/types";
import type { StudioAuthContext } from "../components/Studio/VRTStudioModule";

jest.mock("react-native", () => ({
  Platform: { OS: "android", constants: {} },
  NativeModules: {},
}));
jest.mock("../components/Utilities/ViroPlatform", () => ({
  isQuest: true,
  isVisionOS: false,
  isWeb: false,
}));

const SESSION: StudioAuthContext = {
  mode: "session",
  baseUrl: "https://supabase.example",
  headers: { Authorization: "Bearer t1", "x-rv-client": "studio-go" },
  projectId: null,
};

const GROUP = "7c1e4a88-0000-4000-8000-0123456789ab";
// Created at the host's reference-space origin, so close to its identity; a
// joiner finds it wherever its own session put its world origin.
const HOST_ANCHOR = fromPositionEuler([0.01, 0, -0.02], [0, 2, 0]);
const JOINER_ANCHOR = fromPositionEuler([-2, 0.5, 1], [0, -80, 0]);
const csv = (m: Mat4) => m.join(",");
const SHARING_UNAVAILABLE =
  "Shared frames unavailable: XR_META_spatial_entity_group_sharing not present";

const META_ROOM: ViroColocationRoom = {
  id: "row-1",
  roomId: "room-1",
  joinCode: "K7M2QX",
  frameKind: "meta_group",
  cloudAnchorId: null,
  frameRef: GROUP,
  name: "Lab",
  projectId: "proj-1",
  sceneId: "scene-1",
};

function scene(
  over: Partial<StudioSceneResponse["scene"]> = {}
): StudioSceneResponse {
  return {
    scene: {
      id: "scene-1",
      name: "Scene",
      belongs_to_project: "proj-1",
      plane_detection: "AUTOMATIC",
      plane_direction: "Horizontal",
      on_load_function: null,
      physics_world_config: null,
      created_at: "",
      created_by: null,
      ...over,
    },
    project: {} as StudioSceneResponse["project"],
    assets: [],
    collision_bindings: [],
    animations: [],
    functions: [],
    variables: [],
    meta: { request_id: "r" },
  };
}

/** The slice of ViroReplicationClient a session uses, driven by the test. */
class FakeReplication {
  state: ViroReplicationState = "idle";
  error: string | undefined;
  config: ViroReplicationConfig | null = null;
  writes: Array<{ id: string; fields: Record<string, unknown> }> = [];
  onReject?: () => void;
  localPeerId = "me";
  private entities = new Map<string, ViroReplicatedEntity>();
  private listeners = new Set<() => void>();

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
    if (opts.optimistic) {
      this.entities.set(id, { id, fields, version: 1, owner: null });
      this.emit();
    }
  }
  claim() {}
  release() {}
  delete() {}
  sync(entities: ViroReplicatedEntity[] = []) {
    this.entities = new Map(entities.map((e) => [e.id, e]));
    this.state = "synced";
    this.emit();
  }
  private emit() {
    [...this.listeners].forEach((fn) => fn());
  }
}

function harness(over: Partial<StudioColocationDeps> = {}) {
  const replication = new FakeReplication();
  // The Quest navigator bridge: shared frames, and no scan at all.
  const nav = {
    rvCreateSharedFrame: jest.fn().mockResolvedValue({
      success: true,
      frameId: "anchor-uuid",
      transform: csv(HOST_ANCHOR),
    }),
    rvJoinSharedFrame: jest.fn().mockResolvedValue({
      success: true,
      frameId: "anchor-uuid",
      transform: csv(JOINER_ANCHOR),
    }),
  };
  const deps = {
    getAuth: jest.fn().mockResolvedValue(SESSION),
    setCloudAnchorProject: jest.fn().mockResolvedValue(undefined),
    createRoom: jest.fn().mockResolvedValue({ success: true, room: META_ROOM }),
    lookupRoom: jest.fn().mockResolvedValue({ success: true, room: META_ROOM }),
    probeRelay: jest.fn().mockResolvedValue({ ok: true, peers: 0 }),
    joinChannel: jest.fn().mockResolvedValue({ success: true }),
    leaveChannel: jest.fn().mockResolvedValue(undefined),
    setLocalPose: jest.fn().mockResolvedValue(undefined),
    getChannelState: jest.fn(async () => ({
      state: "joined" as const,
      localPeerId: "me",
    })),
    getPeers: jest.fn().mockResolvedValue([]),
    createReplication: jest.fn(() => replication as any),
    newProbeRoomId: jest.fn(() => "probe-room"),
    newGroupId: jest.fn(() => GROUP),
    now: jest.fn(() => Date.now()),
    loadScene: jest.fn(async (sceneId: string) => scene({ id: sceneId })),
    onNavigationError: jest.fn(),
    ...over,
  };
  const controller = new StudioColocationController(deps);
  controller.setNavigatorAccessor(() => nav);
  const states: StudioColocationState[] = [];
  const rooms: StudioColocationRoom[] = [];
  controller.onStateChange = (s) => states.push(s);
  controller.onRoom = (r) => rooms.push(r);
  return { controller, deps, nav, replication, states, rooms };
}

type Harness = ReturnType<typeof harness>;

async function flush() {
  for (let i = 0; i < 50; i++) await Promise.resolve();
}

const advance = (ms: number) => jest.advanceTimersByTimeAsync(ms);

function expectMatrix(actual: Mat4 | null, expected: Mat4) {
  expect(actual).not.toBeNull();
  actual!.forEach((v, i) => expect(v).toBeCloseTo(expected[i], 5));
}

function failure(h: Harness) {
  const s = h.controller.getState();
  return s.status === "failed" ? s : null;
}

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

describe("StudioColocationController on Quest: host", () => {
  it("shares a Meta anchor to a fresh group, with no scan and no origin to pick", async () => {
    const h = harness();
    h.controller.request({ mode: "host", name: "Lab" });
    h.controller.attachScene(scene());
    // A plane-mode scene, and still nothing waits for a plane.
    expect(h.controller.getFrame().needsOrigin).toBe(false);
    await flush();

    expect(h.nav.rvCreateSharedFrame).toHaveBeenCalledWith(GROUP);
    expect(h.nav.rvJoinSharedFrame).not.toHaveBeenCalled();
    expect(h.states.map((s) => s.status)).not.toContain("scanning");
    expect(h.states.map((s) => s.status)).toContain("hosting");
    expect(h.deps.createRoom).toHaveBeenCalledWith(
      {
        endpoint: SESSION.baseUrl,
        headers: SESSION.headers,
        projectId: "proj-1",
      },
      {
        frameKind: "meta_group",
        frameRef: GROUP,
        name: "Lab",
        sceneId: "scene-1",
      }
    );
    expect(h.rooms).toEqual([
      expect.objectContaining({ frameKind: "meta_group", isHost: true }),
    ]);

    // The origin is the anchor itself, and a proposal changes nothing.
    h.controller.proposeOrigin(fromPositionEuler([3, 0, 3], [0, 90, 0]));
    expect(h.controller.getFrame().origin).toEqual(IDENTITY);
    expect(h.controller.getFrame().needsOrigin).toBe(false);

    h.replication.sync();
    await flush();
    const origin = h.replication.writes.find((w) => w.id === "scene:origin");
    expect(origin?.fields).toEqual({
      p: [0, 0, 0],
      q: [0, 0, 0, 1],
      sceneId: "scene-1",
    });

    await advance(500);
    expect(h.controller.getState()).toEqual({
      status: "live",
      room: h.rooms[0],
      peers: 0,
    });
    expectMatrix(h.controller.getFrame().sceneToWorld, HOST_ANCHOR);
  });

  it("keeps the shared frame in the room when the wearer recentres", async () => {
    const listeners = new Set<(move: Mat4) => void>();
    const h = harness({
      onRoomMoved: (listener) => {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
    });
    h.controller.request({ mode: "host", name: "Lab" });
    h.controller.attachScene(scene());
    await flush();
    h.replication.sync();
    await flush();
    await advance(500);
    expect(h.controller.getState().status).toBe("live");

    const move = fromPositionEuler([1, 0, -2], [0, 90, 0]);
    listeners.forEach((fn) => fn(move));
    const frame = h.controller.getFrame();
    expectMatrix(frame.location, multiply(move, HOST_ANCHOR));
    expectMatrix(frame.sceneToWorld, multiply(move, HOST_ANCHOR));

    h.controller.leave();
    expect(listeners.size).toBe(0);
  });

  it("tries again when the new anchor is not locatable yet", async () => {
    const h = harness();
    h.nav.rvCreateSharedFrame
      .mockResolvedValueOnce({
        success: false,
        error: "shared frame is not locatable yet",
      })
      .mockResolvedValueOnce({ success: true, transform: csv(HOST_ANCHOR) });
    h.controller.request({ mode: "host" });
    h.controller.attachScene(scene());
    await flush();
    expect(h.controller.getState()).toEqual({ status: "hosting" });
    expect(h.deps.createRoom).not.toHaveBeenCalled();

    await advance(1000);
    expect(h.nav.rvCreateSharedFrame).toHaveBeenCalledTimes(2);
    expect(h.deps.createRoom).toHaveBeenCalledTimes(1);
  });

  it("fails hosting with the headset's reason once the attempts run out", async () => {
    const h = harness();
    h.nav.rvCreateSharedFrame.mockResolvedValue({
      success: false,
      error: "Co-location needs a mixed-reality scene.",
    });
    h.controller.request({ mode: "host" });
    h.controller.attachScene(scene());
    await flush();
    await advance(1000);
    await advance(1000);

    expect(h.nav.rvCreateSharedFrame).toHaveBeenCalledTimes(3);
    expect(failure(h)).toEqual({
      status: "failed",
      code: "HOST_FAILED",
      message: "Co-location needs a mixed-reality scene.",
    });
    expect(h.deps.createRoom).not.toHaveBeenCalled();
    expect(h.controller.getFrame().phase).toBe("off");
  });

  it("gives up on a headset that never answers, and does not ask again", async () => {
    const h = harness();
    h.nav.rvCreateSharedFrame.mockReturnValue(new Promise(() => {}));
    h.controller.request({ mode: "host" });
    h.controller.attachScene(scene());
    await flush();
    await advance(29000);
    expect(h.controller.getState()).toEqual({ status: "hosting" });

    await advance(1000);
    expect(failure(h)).toMatchObject({ code: "HOST_FAILED" });
    expect(failure(h)?.message).toMatch(/30 seconds/);
    expect(h.nav.rvCreateSharedFrame).toHaveBeenCalledTimes(1);
    expect(h.deps.createRoom).not.toHaveBeenCalled();
  });

  it("fails at once, as unsupported, on a runtime that cannot share anchors", async () => {
    const h = harness();
    h.nav.rvCreateSharedFrame.mockResolvedValue({
      success: false,
      error: SHARING_UNAVAILABLE,
    });
    h.controller.request({ mode: "host" });
    h.controller.attachScene(scene());
    await flush();
    await advance(3000);

    expect(h.nav.rvCreateSharedFrame).toHaveBeenCalledTimes(1);
    expect(failure(h)).toMatchObject({ code: "FRAME_KIND_UNSUPPORTED" });
    expect(h.deps.createRoom).not.toHaveBeenCalled();
  });

  it("leaves quietly while the anchor is still being shared", async () => {
    const h = harness();
    h.nav.rvCreateSharedFrame.mockReturnValue(new Promise(() => {}));
    h.controller.request({ mode: "host" });
    h.controller.attachScene(scene());
    await flush();
    h.controller.leave();
    await advance(30000);
    expect(h.controller.getState()).toEqual({ status: "idle" });
    expect(h.states.map((s) => s.status)).not.toContain("failed");
  });
});

describe("StudioColocationController on Quest: join", () => {
  it("recovers the room's group and waits for the host's origin", async () => {
    const h = harness();
    h.controller.request({ mode: "join", code: "K7M2QX" });
    h.controller.attachScene(scene());
    await flush();

    expect(h.nav.rvJoinSharedFrame).toHaveBeenCalledWith(GROUP);
    expect(h.nav.rvCreateSharedFrame).not.toHaveBeenCalled();
    expect(h.states).toContainEqual({ status: "resolving", attempt: 1 });
    expect(h.controller.getFrame().needsOrigin).toBe(false);

    // Joined, with no origin yet: nothing to show.
    await advance(500);
    expect(h.controller.getFrame().phase).toBe("pending");

    h.replication.sync([
      {
        id: "scene:origin",
        fields: { p: [0, 0, 0], q: [0, 0, 0, 1], sceneId: "scene-1" },
        version: 1,
        owner: null,
      },
    ]);
    await advance(500);
    expect(h.controller.getState()).toMatchObject({
      status: "live",
      room: { frameKind: "meta_group", isHost: false },
    });
    expectMatrix(h.controller.getFrame().sceneToWorld, JOINER_ANCHOR);
    expect(h.replication.writes.map((w) => w.id)).not.toContain("scene:origin");
  });

  it("fails at once, as unsupported, on a runtime that cannot share anchors", async () => {
    const h = harness();
    h.nav.rvJoinSharedFrame.mockResolvedValue({
      success: false,
      error: SHARING_UNAVAILABLE,
    });
    h.controller.request({ mode: "join", code: "K7M2QX" });
    h.controller.attachScene(scene());
    await flush();
    await advance(3000);

    expect(h.nav.rvJoinSharedFrame).toHaveBeenCalledTimes(1);
    expect(failure(h)).toMatchObject({ code: "FRAME_KIND_UNSUPPORTED" });
    expect(h.deps.joinChannel).not.toHaveBeenCalled();
  });

  it("names joining, not sharing, when the headset never answers", async () => {
    const h = harness();
    h.nav.rvJoinSharedFrame.mockReturnValue(new Promise(() => {}));
    h.controller.request({ mode: "join", code: "K7M2QX" });
    h.controller.attachScene(scene());
    await flush();
    await advance(30000);

    expect(failure(h)).toMatchObject({ code: "RESOLVE_NO_MATCH" });
    expect(failure(h)?.message).toMatch(/Joining a room on Quest/);
  });

  it.each([
    ["a name", "lab-1", false],
    ["a UUID without hyphens", GROUP.replace(/-/g, ""), true],
  ])(
    "asks native to join a group named by %s only when it is a UUID",
    async (_label, frameRef, joins) => {
      const h = harness({
        lookupRoom: jest.fn().mockResolvedValue({
          success: true,
          room: { ...META_ROOM, frameRef },
        }),
      });
      h.controller.request({ mode: "join", code: "K7M2QX" });
      h.controller.attachScene(scene());
      await flush();

      if (joins) {
        expect(h.nav.rvJoinSharedFrame).toHaveBeenCalledWith(frameRef);
      } else {
        expect(h.nav.rvJoinSharedFrame).not.toHaveBeenCalled();
        expect(failure(h)).toMatchObject({ code: "FRAME_KIND_UNSUPPORTED" });
        expect(h.deps.probeRelay).not.toHaveBeenCalled();
      }
    }
  );

  it("refuses a room hosted from a phone, naming the devices that can join it", async () => {
    const h = harness({
      lookupRoom: jest.fn().mockResolvedValue({
        success: true,
        room: {
          ...META_ROOM,
          frameKind: "cloud_anchor",
          cloudAnchorId: "anchor-1",
          frameRef: null,
        },
      }),
    });
    h.controller.request({ mode: "join", code: "K7M2QX" });
    h.controller.attachScene(scene());
    await flush();

    expect(failure(h)).toEqual({
      status: "failed",
      code: "FRAME_KIND_UNSUPPORTED",
      message:
        "This room was hosted from a phone, and only phones can join it.",
    });
    expect(h.deps.probeRelay).not.toHaveBeenCalled();
    expect(h.deps.joinChannel).not.toHaveBeenCalled();
  });
});

describe("frameKindUnsupportedFailure", () => {
  it.each([
    ["cloud_anchor", /only phones can join/],
    ["meta_group", /only Meta Quest headsets can join/],
    ["visionos_space", /only Apple Vision Pro can join/],
  ] as const)("names the device family %s needs", (frameKind, family) => {
    const failed = frameKindUnsupportedFailure(frameKind);
    expect(failed.code).toBe("FRAME_KIND_UNSUPPORTED");
    expect(failed.message).toMatch(family);
  });
});

describe("the headset's copy", () => {
  it("tells a headset what it is doing rather than asking it to walk a scan", () => {
    const hosting = studioColocationIndicatorContent(
      { status: "hosting" },
      null,
      "headset"
    );
    expect(hosting?.detail).toMatch(/headset/);
    const resolving = studioColocationIndicatorContent(
      { status: "resolving", attempt: 1 },
      null,
      "headset"
    );
    expect(resolving?.detail).toBe("Look around the room the host is in.");
    // Phones keep theirs.
    expect(
      studioColocationIndicatorContent({ status: "resolving", attempt: 1 })
        ?.detail
    ).toMatch(/area the host scanned/);
  });
});

describe("the scene root", () => {
  const rootsInAR = (h: Harness, mounts: number[], quest = true) =>
    mounts.map((m) => studioSceneRootsInAR(h.controller.getFrame(), m, quest));

  it("roots a Quest scene in ViroARScene only while a session is set up or shared", async () => {
    const h = harness();
    const mount = h.controller.claimSceneMount();
    h.controller.attachScene(scene(), undefined, undefined, mount);
    expect(rootsInAR(h, [mount])).toEqual([false]);
    expect(rootsInAR(h, [mount], false)).toEqual([true]);

    h.controller.request({ mode: "host" });
    expect(rootsInAR(h, [mount])).toEqual([true]);
    await flush();
    h.replication.sync();
    await advance(500);
    expect(h.controller.getFrame().phase).toBe("shared");
    expect(rootsInAR(h, [mount])).toEqual([true]);

    h.controller.leave();
    expect(rootsInAR(h, [mount])).toEqual([false]);
  });

  it("roots only the scene on screen when a NAVIGATE left others under it", () => {
    // The Quest navigator sends a shared-frame call to its first ViroARScene
    // child, and only the scene on screen has the OpenXR session.
    const h = harness();
    const stack = ["scene-1", "scene-2", "scene-1"].map((id) => {
      const mount = h.controller.claimSceneMount();
      h.controller.attachScene(scene({ id }), undefined, undefined, mount);
      return mount;
    });
    h.controller.request({ mode: "host" });
    expect(rootsInAR(h, stack)).toEqual([false, false, true]);

    // A pushed scene renders before it attaches, and roots in AR from then.
    const pushed = h.controller.claimSceneMount();
    expect(rootsInAR(h, [pushed])).toEqual([true]);
    h.controller.attachScene(
      scene({ id: "scene-2" }),
      undefined,
      undefined,
      pushed
    );
    expect(rootsInAR(h, [...stack, pushed])).toEqual([
      false,
      false,
      false,
      true,
    ]);
  });

  it("roots a Quest plane scene in AR outside a session, and only the scene on screen in one", () => {
    const h = harness();
    const stack = ["scene-1", "scene-2"].map((id) => {
      const mount = h.controller.claimSceneMount();
      h.controller.attachScene(scene({ id }), undefined, undefined, mount);
      return mount;
    });
    const withPlanes = () =>
      stack.map((m) =>
        studioSceneRootsInAR(h.controller.getFrame(), m, true, true)
      );
    expect(withPlanes()).toEqual([true, true]);
    expect(rootsInAR(h, stack)).toEqual([false, false]);

    h.controller.request({ mode: "host" });
    expect(withPlanes()).toEqual([false, true]);
  });

  it("roots the first scene in AR from its first render when the session was asked for before it mounted", () => {
    const h = harness();
    h.controller.request({ mode: "join", code: "K7M2QX" });
    expect(rootsInAR(h, [h.controller.claimSceneMount()])).toEqual([true]);
  });

  it("is what StudioARScene decides its Quest root by", () => {
    const source = fs.readFileSync(
      path.resolve(
        __dirname,
        "..",
        "components",
        "Studio",
        "StudioARScene.tsx"
      ),
      "utf-8"
    );
    expect(source).toMatch(
      /useState\(\(\) => colocation\?\.claimSceneMount\(\) \?\? 0\)/
    );
    expect(source).toMatch(/colocation\.attachScene\([^;]*sceneMount\s*\);/);
    expect(source).toMatch(
      /const rootsInAR = studioSceneRootsInAR\(\s*colocationFrame,\s*sceneMount,\s*isQuest,\s*questSpatialData === true\s*\);/
    );
    expect(source).toMatch(/if \(!rootsInAR\) \{\s*return \(\s*<ViroScene/);
    expect(source).not.toMatch(/if \(isQuest\) \{\s*return \(\s*<ViroScene/);
  });

  it("keeps plane components out of a ViroScene root", () => {
    // VRTARPlane casts its scene to VRTARScene, so a plane under ViroScene
    // crashed the app on Quest.
    const source = fs.readFileSync(
      path.resolve(
        __dirname,
        "..",
        "components",
        "Studio",
        "StudioARScene.tsx"
      ),
      "utf-8"
    );
    expect(source).toMatch(
      /const renderAssets = \(\) => \{\s*if \(!rootsInAR \|\| questPlaneFallback\) return <>\{renderedPlaneAssets\}<\/>;/
    );
    expect(source).toMatch(
      /const renderOriginPicker = \(\) => \{\s*if \(!rootsInAR\) return null;/
    );
  });
});
