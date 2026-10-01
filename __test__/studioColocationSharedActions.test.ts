import {
  ViroReplicationClient,
  type ViroReplicatedEntity,
} from "../components/AR/ViroReplication";
import {
  STUDIO_DRAG_IDLE_MS,
  STUDIO_DRAG_PREFIX,
} from "../components/Studio/colocation/drags";
import {
  STUDIO_EVENT_WAIT_MS,
  sceneAudioUrls,
} from "../components/Studio/colocation/events";
import {
  fromPositionEuler,
  invert,
  type Mat4,
  transformPoint,
  type Vec3,
} from "../components/Studio/colocation/frameMath";
import {
  STUDIO_SHARED_PENDING_TIMEOUT_MS,
  StudioSharedState,
} from "../components/Studio/colocation/sharedState";
import { StudioAnimationSlots } from "../components/Studio/domain/animationSlots";
import { StudioDragStore } from "../components/Studio/domain/dragStore";
import {
  executeOnLoadFunction,
  SequenceScheduler,
} from "../components/Studio/domain/sceneNavigationHandler";
import { StudioPlacementStore } from "../components/Studio/domain/placementStore";
import { StudioSoundManager } from "../components/Studio/domain/soundManager";
import { StudioVariableStore } from "../components/Studio/domain/variableStore";
import { StudioVisibilityStore } from "../components/Studio/domain/visibilityStore";
import type {
  StudioAnimation,
  StudioAsset,
  StudioSceneFunction,
  StudioSceneResponse,
} from "../components/Studio/types";

jest.mock("react-native", () => ({
  Alert: { alert: jest.fn() },
  AppState: { addEventListener: jest.fn(() => ({ remove: jest.fn() })) },
  Platform: { OS: "ios", constants: {} },
  NativeModules: {},
}));
jest.mock("../components/Utilities/ViroPlatform", () => ({
  isQuest: false,
  isWeb: false,
}));

type Op = {
  op: string;
  id?: string;
  fields?: Record<string, unknown>;
  ref?: string;
};

const clone = (e: ViroReplicatedEntity): ViroReplicatedEntity => ({
  ...e,
  fields: { ...e.fields },
});

/**
 * The relay's replication room as the real one decides: ownership gates every
 * change, each accepted op is broadcast on its own to every peer (the sender
 * included), and a peer that leaves releases what it held.
 */
class FakeRelay {
  entities = new Map<string, ViroReplicatedEntity>();
  received: Array<{ peer: string; op: Op }> = [];
  private seq = 0;
  private peers = new Map<RelaySocket, string>();
  private queue: Array<{ socket: RelaySocket; op: Op }> = [];
  private nextPeer = 1;

  accept(socket: RelaySocket): string {
    const peer = `peer-${this.nextPeer++}`;
    this.peers.set(socket, peer);
    socket.open();
    socket.deliver({
      t: "welcome",
      you: peer,
      seq: this.seq,
      entities: [...this.entities.values()].map(clone),
    });
    return peer;
  }

  inbound(socket: RelaySocket, op: Op): void {
    if (op.op === "resync") return;
    this.received.push({ peer: this.peers.get(socket) ?? "?", op });
    this.queue.push({ socket, op });
  }

  process(): void {
    while (this.queue.length) {
      const { socket, op } = this.queue.shift()!;
      this.apply(socket, op);
    }
  }

  /** As process(), with every op applied delivered to each peer in one delta. */
  processBatched(): void {
    this.batch = [];
    this.process();
    const ops = this.batch;
    this.batch = null;
    for (const peer of this.peers.keys()) peer.deliver({ t: "delta", ops });
  }

  private batch: unknown[] | null = null;

  drop(socket: RelaySocket): void {
    const peer = this.peers.get(socket);
    this.peers.delete(socket);
    if (!peer) return;
    for (const e of this.entities.values()) {
      if (e.owner !== peer) continue;
      const next = { ...e, owner: null, version: e.version + 1 };
      this.entities.set(e.id, next);
      this.broadcast({
        kind: "owner",
        seq: ++this.seq,
        id: e.id,
        owner: null,
        version: next.version,
        by: peer,
      });
    }
  }

  seed(id: string, fields: Record<string, unknown>, version = 1): void {
    this.entities.set(id, { id, fields, version, owner: null });
    this.seq++;
  }

  ops(peer: string, prefix = ""): Op[] {
    return this.received
      .filter((r) => r.peer === peer && (r.op.id ?? "").startsWith(prefix))
      .map((r) => r.op);
  }

  private apply(socket: RelaySocket, op: Op): void {
    const by = this.peers.get(socket);
    if (!by || !op.id) return;
    const id = op.id;
    const e = this.entities.get(id);
    const reject = (reason: string, current?: ViroReplicatedEntity) =>
      socket.deliver({
        t: "reject",
        ref: op.ref,
        reason,
        ...(current ? { current: clone(current) } : {}),
      });
    const heldElsewhere = !!e?.owner && e.owner !== by;
    switch (op.op) {
      case "claim": {
        if (heldElsewhere) return reject("already-owned", e);
        const base = e ?? { id, fields: {}, version: 0, owner: null };
        const next = { ...base, owner: by, version: base.version + 1 };
        this.entities.set(id, next);
        return this.broadcast({
          kind: "owner",
          seq: ++this.seq,
          id,
          owner: by,
          version: next.version,
          by,
        });
      }
      case "release": {
        if (!e) return reject("no-such-entity");
        if (e.owner !== by) return reject("not-owner", e);
        const next = { ...e, owner: null, version: e.version + 1 };
        this.entities.set(id, next);
        return this.broadcast({
          kind: "owner",
          seq: ++this.seq,
          id,
          owner: null,
          version: next.version,
          by,
        });
      }
      case "set": {
        if (heldElsewhere) return reject("not-owner", e);
        const base = e ?? { id, fields: {}, version: 0, owner: null };
        const next = {
          ...base,
          fields: { ...base.fields, ...op.fields },
          version: base.version + 1,
        };
        this.entities.set(id, next);
        return this.broadcast({
          kind: "upsert",
          seq: ++this.seq,
          entity: clone(next),
          by,
        });
      }
      case "delete": {
        if (!e) return reject("no-such-entity");
        if (heldElsewhere) return reject("not-owner", e);
        this.entities.delete(id);
        return this.broadcast({ kind: "delete", seq: ++this.seq, id, by });
      }
    }
  }

  private broadcast(applied: unknown): void {
    if (this.batch) {
      this.batch.push(applied);
      return;
    }
    for (const peer of this.peers.keys()) {
      peer.deliver({ t: "delta", ops: [applied] });
    }
  }
}

let relay: FakeRelay;
let lastSocket: RelaySocket | null = null;

class RelaySocket {
  readyState = 0;
  onopen: (() => void) | null = null;
  onmessage: ((ev: { data: unknown }) => void) | null = null;
  onclose: ((ev?: { code?: number; reason?: string }) => void) | null = null;
  onerror: (() => void) | null = null;

  constructor() {
    lastSocket = this;
  }
  send(data: string) {
    relay.inbound(this, JSON.parse(data));
  }
  close() {
    this.readyState = 3;
    relay.drop(this);
  }
  open() {
    this.readyState = 1;
    this.onopen?.();
  }
  deliver(msg: unknown) {
    this.onmessage?.({ data: JSON.stringify(msg) });
  }
  dropConnection() {
    this.readyState = 3;
    relay.drop(this);
    this.onclose?.({ code: 1006 });
  }
}

const CLIP = "https://cdn.example/door.mp3";

function asset(id: string, over: Partial<StudioAsset> = {}): StudioAsset {
  return {
    id,
    hidden_on_load: false,
    is_draggable: false,
    tap_to_place: false,
    tap_to_place_order: null,
    trigger_image_url: null,
    scene_function: null,
    ...over,
  } as unknown as StudioAsset;
}

const SPIN: StudioAnimation = {
  id: "anim-1",
  scene_id: "scene-1",
  target_asset_id: "crate",
  animation_key: "spin",
  properties: {},
  duration_ms: 500,
  delay_ms: 0,
  easing: null,
  loop: false,
  interruptible: false,
  on_start_function: null,
  on_finish_function: "count",
};

/** x = x + 1, as the animation's on_finish function. */
const COUNT = {
  id: "count",
  scene: "scene-1",
  function_type: "SET_VARIABLE",
  scene_set_variable: {
    id: "sv-1",
    variable_id: "v-x",
    name: "x",
    type: "NUMBER",
    expression: "x + 1",
  },
} as unknown as StudioSceneFunction;

const PLAY_CLIP = {
  id: "fn-sound",
  scene: "scene-1",
  function_type: "SOUND",
  scene_sound: {
    id: "s-1",
    action: "PLAY",
    audio_asset_id: "door-clip",
    audio_url: CLIP,
    target_asset_id: null,
    volume: 0.8,
    loop: false,
    stop_other_sounds: false,
  },
} as unknown as StudioSceneFunction;

function scene(id = "scene-1"): StudioSceneResponse {
  return {
    scene: { id, belongs_to_project: "proj-1" },
    assets: [
      asset("crate", { is_draggable: true }),
      asset("poster", {
        is_draggable: true,
        trigger_image_url: "https://cdn.example/poster.jpg",
      }),
      asset("door"),
    ],
    collision_bindings: [],
    animations: [SPIN],
    functions: [COUNT, PLAY_CLIP],
    variables: [{ id: "v-x", name: "x", type: "NUMBER", initial_value: 0 }],
  } as unknown as StudioSceneResponse;
}

/** Scene frame to location frame; the same on every device in a room. */
const ORIGIN: Mat4 = fromPositionEuler([1, 0, -2], [0, 90, 0]);
/** Where the location frame sits in each device's own world. */
const LOCATIONS: Mat4[] = [
  fromPositionEuler([0.5, 0, 0], [0, 30, 0]),
  fromPositionEuler([-2, 0.3, 1], [0, -70, 0]),
  fromPositionEuler([3, -0.2, 2], [0, 160, 0]),
];

type Device = {
  client: ViroReplicationClient;
  shared: StudioSharedState;
  variables: StudioVariableStore;
  visibility: StudioVisibilityStore;
  placement: StudioPlacementStore;
  drags: StudioDragStore;
  sounds: StudioSoundManager;
  played: Array<[string, string]>;
  location: Mat4;
  peer: string;
  socket: RelaySocket;
  connect: () => void;
};

let devices = 0;

function device(sceneData = scene(), role: "host" | "join" = "join"): Device {
  const location = LOCATIONS[devices++ % LOCATIONS.length];
  const variables = new StudioVariableStore();
  variables.seed(sceneData.variables ?? []);
  const visibility = new StudioVisibilityStore();
  visibility.seed(sceneData.assets);
  const placement = new StudioPlacementStore();
  placement.seed(sceneData.assets);
  const drags = new StudioDragStore();
  const sounds = new StudioSoundManager();
  const client = new ViroReplicationClient();
  const shared = new StudioSharedState(client, {
    origin: () => ORIGIN,
    worldToLocation: () => invert(location),
    role,
  });
  client.onReject = (rejection) => shared.handleReject(rejection);
  const played: Array<[string, string]> = [];
  shared.bindScene(
    sceneData,
    { variables, visibility, placement, drags, sounds },
    { playAnimation: (assetId, key) => played.push([assetId, key]) }
  );
  const d = {
    client,
    shared,
    variables,
    visibility,
    placement,
    drags,
    sounds,
    played,
    location,
    peer: "",
    socket: null as unknown as RelaySocket,
    connect: () => {
      client.connect({ roomId: "room-1", apiKey: "k", projectId: "proj-1" });
      d.socket = lastSocket!;
      d.peer = relay.accept(d.socket);
    },
  };
  return d;
}

function online(sceneData = scene(), role: "host" | "join" = "join") {
  const d = device(sceneData, role);
  d.connect();
  return d;
}

/** A scene-frame point dragged to on `d`, in that device's world. */
const worldOf = (d: Device, sceneFrame: Vec3): Vec3 =>
  transformPoint(d.location, transformPoint(ORIGIN, sceneFrame));

const expectVec = (got: Vec3 | undefined, want: Vec3) => {
  expect(got).toBeTruthy();
  got!.forEach((v, i) => expect(v).toBeCloseTo(want[i], 6));
};

beforeEach(() => {
  (globalThis as any).WebSocket = RelaySocket;
  jest.useFakeTimers();
  relay = new FakeRelay();
  devices = 0;
});

afterEach(() => {
  jest.useRealTimers();
});

describe("shared drags", () => {
  it("claims at the first move, writes the location frame at most every 33 ms, and releases when the drag goes idle", () => {
    const a = online();
    a.drags.moved("crate", worldOf(a, [0, 0, -1]));
    a.drags.moved("crate", worldOf(a, [0.1, 0, -1]));
    a.drags.moved("crate", worldOf(a, [0.2, 0, -1]));
    let ops = relay.ops(a.peer, STUDIO_DRAG_PREFIX);
    expect(ops.map((o) => o.op)).toEqual(["claim", "set"]);
    expectVec(ops[1].fields!.p as Vec3, transformPoint(ORIGIN, [0, 0, -1]));

    jest.advanceTimersByTime(33);
    ops = relay.ops(a.peer, STUDIO_DRAG_PREFIX);
    expect(ops.map((o) => o.op)).toEqual(["claim", "set", "set"]);
    expectVec(ops[2].fields!.p as Vec3, transformPoint(ORIGIN, [0.2, 0, -1]));

    a.drags.moved("crate", worldOf(a, [0.3, 0, -1]));
    jest.advanceTimersByTime(STUDIO_DRAG_IDLE_MS - 1);
    expect(relay.ops(a.peer, STUDIO_DRAG_PREFIX).map((o) => o.op)).toEqual([
      "claim",
      "set",
      "set",
      "set",
    ]);
    jest.advanceTimersByTime(1);
    ops = relay.ops(a.peer, STUDIO_DRAG_PREFIX);
    expect(ops.map((o) => o.op)).toEqual([
      "claim",
      "set",
      "set",
      "set",
      "release",
    ]);
    expect(ops.every((o) => o.id === "drag:crate")).toBe(true);
  });

  it("sends a drag's last move as a trailing write before the release", () => {
    const a = online();
    a.drags.moved("crate", worldOf(a, [0, 0, -1]));
    jest.advanceTimersByTime(20);
    a.drags.moved("crate", worldOf(a, [0.4, 0, -1]));
    jest.advanceTimersByTime(STUDIO_DRAG_IDLE_MS);
    const ops = relay.ops(a.peer, STUDIO_DRAG_PREFIX);
    expect(ops.map((o) => o.op)).toEqual(["claim", "set", "set", "release"]);
    expectVec(ops[2].fields!.p as Vec3, transformPoint(ORIGIN, [0.4, 0, -1]));
  });

  it("moves the asset on another device through its drag store, locked while held", () => {
    const a = online();
    const b = online();
    const repaints: number[] = [];
    b.drags.subscribe("crate", () => repaints.push(1));
    const door: number[] = [];
    b.drags.subscribe("door", () => door.push(1));

    a.drags.moved("crate", worldOf(a, [0.5, 0, -1]));
    relay.process();
    expectVec(b.drags.getPosition("crate"), [0.5, 0, -1]);
    expect(b.drags.isLocked("crate")).toBe(true);
    expect(repaints.length).toBeGreaterThan(0);
    expect(door).toEqual([]);

    jest.advanceTimersByTime(STUDIO_DRAG_IDLE_MS);
    relay.process();
    expect(b.drags.isLocked("crate")).toBe(false);
    expectVec(b.drags.getPosition("crate"), [0.5, 0, -1]);
    expect(relay.ops(b.peer, STUDIO_DRAG_PREFIX)).toEqual([]);
  });

  it("does not move its own node back to its own echoes", () => {
    const a = online();
    a.drags.moved("crate", worldOf(a, [0.5, 0, -1]));
    relay.process();
    jest.advanceTimersByTime(STUDIO_DRAG_IDLE_MS);
    relay.process();
    expect(a.drags.getPosition("crate")).toBeUndefined();
    expect(a.drags.isLocked("crate")).toBe(false);
  });

  it("writes nothing for a drag the room refused, and snaps back to the holder's position when it ends", () => {
    const a = online();
    const b = online();
    a.drags.moved("crate", worldOf(a, [0.5, 0, -1]));
    // b grabs it before hearing that a holds it.
    b.drags.moved("crate", worldOf(b, [-1, 0, -1]));
    relay.process();
    expect(relay.entities.get("drag:crate")!.owner).toBe(a.peer);
    expect(b.drags.isLocked("crate")).toBe(true);
    const before = b.drags.revision("crate");

    b.drags.moved("crate", worldOf(b, [-1.2, 0, -1]));
    jest.advanceTimersByTime(STUDIO_DRAG_IDLE_MS);
    relay.process();
    const bOps = relay.ops(b.peer, STUDIO_DRAG_PREFIX).map((o) => o.op);
    // The set that raced the claim is the only one it sent.
    expect(bOps).toEqual(["claim", "set"]);
    expectVec(b.drags.getPosition("crate"), [0.5, 0, -1]);
    expect(b.drags.revision("crate")).toBe(before + 1);
  });

  it("does not let this device start a drag on an asset another device holds", () => {
    const a = online();
    const b = online();
    a.drags.moved("crate", worldOf(a, [0.5, 0, -1]));
    relay.process();
    b.drags.moved("crate", worldOf(b, [2, 0, 2]));
    expect(relay.ops(b.peer, STUDIO_DRAG_PREFIX)).toEqual([]);
  });

  it("snaps a move that raced the lock back to the holder's position when it ends", () => {
    const a = online();
    const b = online();
    a.drags.moved("crate", worldOf(a, [0.5, 0, -1]));
    relay.process();
    expect(b.drags.isLocked("crate")).toBe(true);
    const before = b.drags.revision("crate");
    // The renderer moved b's node before the lock reached it.
    b.drags.moved("crate", worldOf(b, [2, 0, 2]));
    jest.advanceTimersByTime(STUDIO_DRAG_IDLE_MS);
    expect(relay.ops(b.peer, STUDIO_DRAG_PREFIX)).toEqual([]);
    expectVec(b.drags.getPosition("crate"), [0.5, 0, -1]);
    expect(b.drags.revision("crate")).toBe(before + 1);
  });

  it("frees an asset whose holder disconnected mid-drag", () => {
    const a = online();
    const b = online();
    a.drags.moved("crate", worldOf(a, [0.5, 0, -1]));
    relay.process();
    expect(b.drags.isLocked("crate")).toBe(true);
    a.socket.dropConnection();
    expect(b.drags.isLocked("crate")).toBe(false);
    expectVec(b.drags.getPosition("crate"), [0.5, 0, -1]);
    // a's timers died with its session: nothing more goes out for the drag.
    jest.advanceTimersByTime(STUDIO_DRAG_IDLE_MS);
    expect(relay.ops(a.peer, STUDIO_DRAG_PREFIX).map((o) => o.op)).toEqual([
      "claim",
      "set",
    ]);
  });

  it("claims again after a reconnect if the drag is still going", () => {
    const a = online();
    a.drags.moved("crate", worldOf(a, [0.5, 0, -1]));
    relay.process();
    a.socket.dropConnection();
    jest.advanceTimersByTime(500);
    const rejoined = relay.accept(lastSocket!);
    a.drags.moved("crate", worldOf(a, [0.6, 0, -1]));
    expect(relay.ops(rejoined, STUDIO_DRAG_PREFIX).map((o) => o.op)).toEqual([
      "claim",
      "set",
    ]);
  });

  it("shows a late joiner where a drag left an asset", () => {
    relay.seed("drag:crate", { p: transformPoint(ORIGIN, [0.7, 0, -0.5]) });
    const b = online();
    expectVec(b.drags.getPosition("crate"), [0.7, 0, -0.5]);
    expect(b.drags.isLocked("crate")).toBe(false);
  });

  it("keeps drags of image-triggered content on the device", () => {
    const a = online();
    a.drags.moved("poster", [1, 1, 1]);
    jest.advanceTimersByTime(STUDIO_DRAG_IDLE_MS);
    expect(relay.ops(a.peer, STUDIO_DRAG_PREFIX)).toEqual([]);
  });

  it("puts an asset back where the scene has it when its row is deleted", () => {
    relay.seed("drag:crate", { p: transformPoint(ORIGIN, [0.7, 0, -0.5]) });
    const a = online();
    const b = online();
    a.shared.removeSceneRows(scene());
    relay.process();
    expect(b.drags.getPosition("crate")).toBeUndefined();
  });
});

describe("shared events", () => {
  it("fires another device's animation trigger once and never its own", () => {
    const a = online();
    const b = online();
    a.shared.emitAnimation("scene-1", "crate", "spin");
    relay.process();
    expect(b.played).toEqual([["crate", "spin"]]);
    expect(a.played).toEqual([]);
    jest.advanceTimersByTime(1000);
    relay.process();
    expect(b.played).toEqual([["crate", "spin"]]);
    expect(relay.ops(b.peer, "evt:")).toEqual([]);
  });

  it("writes every event to the device's own row, with its recent history", () => {
    const a = online();
    for (let i = 0; i < 10; i++) {
      a.shared.emitAnimation("scene-1", "crate", "spin");
      jest.advanceTimersByTime(40);
    }
    const ops = relay.ops(a.peer, "evt:");
    expect(new Set(ops.map((o) => o.id))).toEqual(new Set([`evt:${a.peer}`]));
    const last = ops[ops.length - 1].fields!.events as Array<{ s: number }>;
    expect(last.map((e) => e.s)).toEqual([3, 4, 5, 6, 7, 8, 9, 10]);
  });

  it("marks the rows a welcome carries seen without firing them", () => {
    relay.seed("evt:gone", {
      events: [
        {
          s: 5,
          kind: "animation",
          sceneId: "scene-1",
          assetId: "crate",
          key: "spin",
        },
      ],
    });
    const b = online();
    expect(b.played).toEqual([]);
    b.shared.emitAnimation("scene-1", "crate", "spin");
    // b is alone, so it is the room's authority and deletes the departed row.
    relay.process();
    expect(relay.entities.has("evt:gone")).toBe(false);
    const [op] = relay.ops(b.peer, `evt:${b.peer}`);
    expect(op.op).toBe("set");
    expect(op.fields!.events).toEqual([expect.objectContaining({ s: 1 })]);
  });

  it("does not replay what happened while it was reconnecting", () => {
    const a = online();
    const b = online();
    b.socket.dropConnection();
    a.shared.emitAnimation("scene-1", "crate", "spin");
    relay.process();
    jest.advanceTimersByTime(500);
    relay.accept(lastSocket!);
    expect(b.played).toEqual([]);
  });

  it("fires both of two devices' simultaneous events on a third", () => {
    const a = online();
    const b = online();
    const c = online();
    a.shared.emitAnimation("scene-1", "crate", "spin");
    b.shared.emitAnimation("scene-1", "door", "open");
    relay.processBatched();
    expect(relay.ops(a.peer, "evt:")[0].id).not.toBe(
      relay.ops(b.peer, "evt:")[0].id
    );
    expect(c.played).toEqual([
      ["crate", "spin"],
      ["door", "open"],
    ]);
    expect(a.played).toEqual([["door", "open"]]);
    expect(b.played).toEqual([["crate", "spin"]]);
  });

  it("fires every event of a row whose versions arrive folded together", () => {
    const a = online();
    const b = online();
    for (let i = 0; i < 3; i++) {
      a.shared.emitAnimation("scene-1", "crate", `k${i}`);
      jest.advanceTimersByTime(40);
    }
    relay.processBatched();
    expect(b.played).toEqual([
      ["crate", "k0"],
      ["crate", "k1"],
      ["crate", "k2"],
    ]);
  });

  it("writes a new row after a reconnect and removes the old one", () => {
    const a = online();
    const b = online();
    a.shared.emitAnimation("scene-1", "crate", "spin");
    relay.process();
    const before = a.peer;
    a.socket.dropConnection();
    jest.advanceTimersByTime(500);
    const rejoined = relay.accept(lastSocket!);
    relay.process();
    jest.advanceTimersByTime(100);
    relay.process();
    expect(relay.entities.has(`evt:${before}`)).toBe(false);
    a.shared.emitAnimation("scene-1", "crate", "again");
    relay.process();
    expect(relay.entities.get(`evt:${rejoined}`)?.fields.events).toEqual([
      expect.objectContaining({ s: 1, key: "again" }),
    ]);
    expect(b.played).toEqual([
      ["crate", "spin"],
      ["crate", "again"],
    ]);
  });

  it("repeats a sound command on the scene's own sound manager, without echo", () => {
    const a = online();
    const b = online();
    a.sounds.play({
      audioAssetId: "door-clip",
      url: CLIP,
      position: [0, 1, 0],
      volume: 0.8,
      loop: false,
      stopOthers: false,
    });
    relay.process();
    expect(b.sounds.getActive()).toEqual([
      expect.objectContaining({
        audioAssetId: "door-clip",
        url: CLIP,
        position: [0, 1, 0],
        volume: 0.8,
      }),
    ]);
    a.sounds.stop("door-clip");
    // One row per device: a second write within the interval trails it.
    jest.advanceTimersByTime(40);
    relay.process();
    expect(b.sounds.getActive()).toEqual([]);
    expect(relay.ops(b.peer, "evt:")).toEqual([]);
    const events = relay.ops(a.peer, "evt:").map(
      (o) => o.fields!.events as Array<{ action: string }>
    );
    expect(events[events.length - 1].map((e) => e.action)).toEqual([
      "play",
      "stop",
    ]);
  });

  it("keeps the sounds a device-only dispatch plays off the ring", () => {
    const a = online();
    const b = online();
    const run = (effectOrigin?: "device") =>
      executeOnLoadFunction(
        PLAY_CLIP.id,
        [PLAY_CLIP],
        undefined,
        [],
        undefined,
        undefined,
        {
          scheduler: new SequenceScheduler(),
          soundManager: a.sounds,
          effectOrigin,
        }
      );
    run("device");
    relay.process();
    expect(a.sounds.getActive()).toHaveLength(1);
    expect(b.sounds.getActive()).toEqual([]);
    expect(relay.ops(a.peer, "evt:")).toEqual([]);
    run();
    relay.process();
    expect(b.sounds.getActive()).toHaveLength(1);
  });

  it("drops a stale position from an earlier event in the same slot", () => {
    const a = online();
    const b = online();
    const play = (position?: Vec3) =>
      a.sounds.play({
        audioAssetId: "door-clip",
        url: CLIP,
        position,
        volume: 1,
        loop: false,
        stopOthers: true,
      });
    play([0, 1, 0]);
    for (let i = 0; i < 15; i++) {
      a.shared.emitAnimation("scene-1", "crate", "spin");
      jest.advanceTimersByTime(40);
    }
    play(undefined);
    relay.process();
    const active = b.sounds.getActive();
    expect(active).toHaveLength(1);
    expect(active[0].position).toBeUndefined();
  });

  it("plays only clips the scene's own functions play", () => {
    const a = online();
    const b = online();
    a.sounds.play({
      audioAssetId: "x",
      url: "https://elsewhere.example/track.mp3",
      volume: 1,
      loop: true,
      stopOthers: false,
    });
    relay.process();
    expect(b.sounds.getActive()).toEqual([]);
  });

  it("holds an event for a scene still loading until it attaches, and drops it after the wait", () => {
    const a = online();
    const b = online();
    a.shared.bindScene(scene("scene-2"), {
      sounds: a.sounds,
      drags: a.drags,
    });
    a.shared.emitAnimation("scene-2", "crate", "spin");
    relay.process();
    expect(b.played).toEqual([]);
    b.shared.bindScene(
      scene("scene-2"),
      { sounds: b.sounds },
      {
        playAnimation: (assetId, key) => b.played.push([assetId, key]),
      }
    );
    expect(b.played).toEqual([["crate", "spin"]]);

    a.shared.emitAnimation("scene-3", "crate", "spin");
    relay.process();
    jest.advanceTimersByTime(STUDIO_EVENT_WAIT_MS + 1);
    b.shared.bindScene(
      scene("scene-3"),
      { sounds: b.sounds },
      {
        playAnimation: (assetId, key) => b.played.push([assetId, key]),
      }
    );
    expect(b.played).toEqual([["crate", "spin"]]);
  });

  it("finds a clip however deeply the scene nests it", () => {
    const nested = {
      ...scene(),
      functions: [
        {
          id: "seq",
          function_type: "SEQUENCE",
          scene_sequence: {
            id: "s",
            steps: [
              {
                function: {
                  function_type: "BRANCH",
                  scene_branch: {
                    conditions: [],
                    no_match_sequence: { steps: [{ function: PLAY_CLIP }] },
                  },
                },
              },
            ],
          },
        },
      ],
    } as unknown as StudioSceneResponse;
    expect([...sceneAudioUrls(nested)]).toEqual([CLIP]);
  });
});

describe("effects, not functions", () => {
  /**
   * StudioAnimationSlots and the event ring with an on_finish dispatch written
   * here in StudioARScene's shape; StudioARScene's own callbacks are not run.
   * `trigger` is a local trigger, `playAnimation` another device's.
   */
  function scenePlayer(d: Device) {
    const slots = new StudioAnimationSlots();
    const scheduler = new SequenceScheduler();
    const runtimeCtx = { scheduler, variableStore: d.variables };
    const start = (remote: boolean) => {
      slots.request(SPIN, true, remote ? "remote" : "local");
      if (slots.runsOnStart(SPIN.target_asset_id) && SPIN.on_start_function) {
        throw new Error("no on_start in this scene");
      }
    };
    const finish = () => {
      if (slots.finish(SPIN.target_asset_id) && SPIN.on_finish_function) {
        executeOnLoadFunction(
          SPIN.on_finish_function,
          [COUNT],
          undefined,
          [SPIN],
          undefined,
          undefined,
          runtimeCtx
        );
      }
    };
    d.shared.bindScene(
      scene(),
      {
        variables: d.variables,
        visibility: d.visibility,
        placement: d.placement,
      },
      { playAnimation: () => start(true) }
    );
    return {
      trigger: () => {
        start(false);
        d.shared.emitAnimation("scene-1", "crate", "spin");
      },
      finish,
    };
  }

  it("runs an animation's on_finish x = x + 1 on the triggering device only, so the room gets x = 1", () => {
    const a = online();
    const b = online();
    const pa = scenePlayer(a);
    const pb = scenePlayer(b);
    pa.trigger();
    relay.process();
    // Both devices play it to the end.
    pb.finish();
    pa.finish();
    relay.process();
    expect(a.variables.get("x")).toBe(1);
    expect(b.variables.get("x")).toBe(1);
    expect(relay.ops(b.peer, "var:")).toEqual([]);
  });
});

describe("removing a scene's rows", () => {
  it("deletes the rows of the scene's assets only, paced like writes", () => {
    relay.seed("vis:door", { visible: false });
    relay.seed("place:crate", { p: [0, 0, 0], f: null, u: null });
    relay.seed("drag:crate", { p: [0, 0, 0] });
    relay.seed("vis:elsewhere", { visible: false });
    relay.seed("var:x", { v: 4 });
    const a = online();
    a.shared.removeSceneRows(scene());
    relay.process();
    expect(
      relay
        .ops(a.peer)
        .filter((o) => o.op === "delete")
        .map((o) => o.id)
        .sort()
    ).toEqual(["drag:crate", "place:crate", "vis:door"]);
    expect(
      [...relay.entities.keys()].filter((id) => !id.startsWith("peer:")).sort()
    ).toEqual(["var:x", "vis:elsewhere"]);
  });

  /** The same scene entered again: fresh stores, as a new StudioARScene has. */
  function reentered(d: Device, sceneData: StudioSceneResponse) {
    const stores = {
      variables: d.variables,
      visibility: new StudioVisibilityStore(),
      placement: new StudioPlacementStore(),
      drags: new StudioDragStore(),
      sounds: new StudioSoundManager(),
    };
    stores.visibility.seed(sceneData.assets);
    stores.placement.seed(sceneData.assets);
    d.shared.bindScene(sceneData, stores);
    return stores;
  }

  const withLamp = () => {
    const s = scene();
    return {
      ...s,
      assets: [...s.assets, asset("lamp", { tap_to_place: true })],
    };
  };

  it("keeps the rows it removed out of the scene it enters next, before and after the deletes come back", () => {
    relay.seed("vis:door", { visible: false });
    relay.seed("place:lamp", {
      p: transformPoint(ORIGIN, [1, 0, -1]),
      f: null,
      u: null,
    });
    relay.seed("drag:crate", { p: transformPoint(ORIGIN, [0.7, 0, -0.5]) });
    const a = online(withLamp());
    expect(a.visibility.isVisible("door")).toBe(false);
    expect(a.placement.isPlaced("lamp")).toBe(true);
    a.shared.removeSceneRows(withLamp());
    const next = reentered(a, withLamp());
    const check = () => {
      expect(next.visibility.isVisible("door")).toBe(true);
      expect(next.placement.isPlaced("lamp")).toBe(false);
      expect(next.drags.getPosition("crate")).toBeUndefined();
    };
    check();
    relay.process();
    check();
    expect(
      [...relay.entities.keys()].filter((id) => !id.startsWith("peer:"))
    ).toEqual([]);
  });

  it("takes back a row whose delete the room refused", () => {
    const a = online();
    const b = online();
    b.drags.moved("crate", worldOf(b, [0.5, 0, -1]));
    relay.process();
    a.shared.removeSceneRows(scene());
    const next = reentered(a, scene());
    expect(next.drags.getPosition("crate")).toBeUndefined();
    relay.process();
    expectVec(next.drags.getPosition("crate"), [0.5, 0, -1]);
    expect(next.drags.isLocked("crate")).toBe(true);
  });

  it("takes back a row whose delete never comes back", () => {
    relay.seed("vis:door", { visible: false });
    const a = online();
    a.shared.removeSceneRows(scene());
    const next = reentered(a, scene());
    expect(next.visibility.isVisible("door")).toBe(true);
    jest.advanceTimersByTime(STUDIO_SHARED_PENDING_TIMEOUT_MS);
    expect(next.visibility.isVisible("door")).toBe(false);
  });

  it("removes nothing while the link is down", () => {
    relay.seed("vis:door", { visible: false });
    const a = online();
    a.socket.dropConnection();
    a.shared.removeSceneRows(scene());
    expect(relay.ops(a.peer).filter((o) => o.op === "delete")).toEqual([]);
  });
});

describe("authority", () => {
  it("is the host while it is connected", () => {
    const host = online(scene(), "host");
    const b = online();
    const c = online();
    relay.process();
    expect(host.shared.hasAuthority()).toBe(true);
    expect(b.shared.hasAuthority()).toBe(false);
    expect(c.shared.hasAuthority()).toBe(false);
  });

  it("passes to the connected device with the lowest peer id when the host leaves, and back", () => {
    const host = online(scene(), "host");
    const b = online();
    const c = online();
    relay.process();
    host.socket.dropConnection();
    expect(b.shared.hasAuthority()).toBe(true);
    expect(c.shared.hasAuthority()).toBe(false);

    // The host reconnects under a new peer id and takes it back.
    jest.advanceTimersByTime(500);
    relay.accept(lastSocket!);
    relay.process();
    expect(host.shared.hasAuthority()).toBe(true);
    expect(b.shared.hasAuthority()).toBe(false);
    expect(c.shared.hasAuthority()).toBe(false);
  });

  it("passes on again when that device leaves too", () => {
    const host = online(scene(), "host");
    const b = online();
    const c = online();
    relay.process();
    host.socket.dropConnection();
    b.socket.dropConnection();
    expect(c.shared.hasAuthority()).toBe(true);
  });

  it("removes the presence and event rows of devices that left", () => {
    const host = online(scene(), "host");
    const b = online();
    relay.process();
    b.shared.emitAnimation("scene-1", "crate", "spin");
    relay.process();
    expect(relay.entities.has(`evt:${b.peer}`)).toBe(true);
    b.socket.dropConnection();
    relay.process();
    expect(relay.entities.has(`evt:${b.peer}`)).toBe(false);
    expect(relay.entities.has(`peer:join:${b.peer}`)).toBe(false);
    expect(relay.entities.has(`peer:host:${host.peer}`)).toBe(true);
    expect(relay.ops(host.peer, "evt:").map((o) => o.op)).toEqual(["delete"]);
  });

  it("reports a change of authority", () => {
    const changes = jest.fn();
    const client = new ViroReplicationClient();
    const shared = new StudioSharedState(client, {
      origin: () => ORIGIN,
      role: "join",
      onAuthorityChange: changes,
    });
    const host = online(scene(), "host");
    relay.process();
    client.connect({ roomId: "room-1", apiKey: "k", projectId: "proj-1" });
    relay.accept(lastSocket!);
    relay.process();
    expect(shared.hasAuthority()).toBe(false);
    host.socket.dropConnection();
    expect(shared.hasAuthority()).toBe(true);
    expect(changes).toHaveBeenCalledTimes(1);
  });
});
