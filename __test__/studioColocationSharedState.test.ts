import {
  ViroReplicationClient,
  type ViroReplicatedEntity,
} from "../components/AR/ViroReplication";
import {
  fromPositionEuler,
  invert,
  type Mat4,
  rotateDirection,
  transformPoint,
  type Vec3,
} from "../components/Studio/colocation/frameMath";
import type { StudioOutboxOptions } from "../components/Studio/colocation/outbox";
import {
  STUDIO_SHARED_PENDING_TIMEOUT_MS,
  StudioSharedState,
} from "../components/Studio/colocation/sharedState";
import { StudioPlacementStore } from "../components/Studio/domain/placementStore";
import type { StudioChangeOrigin } from "../components/Studio/domain/utils";
import { StudioVariableStore } from "../components/Studio/domain/variableStore";
import { StudioVisibilityStore } from "../components/Studio/domain/visibilityStore";
import type {
  StudioAsset,
  StudioSceneResponse,
} from "../components/Studio/types";

jest.mock("react-native", () => ({
  Platform: { OS: "ios", constants: {} },
  NativeModules: {},
}));

type Op = {
  op: string;
  id?: string;
  fields?: Record<string, unknown>;
  ref?: string;
};

/**
 * The relay's replication room: applies ops in arrival order when told to and
 * broadcasts each to every peer, the sender included, as the relay does.
 */
class FakeRelay {
  entities = new Map<string, ViroReplicatedEntity>();
  received: Array<{ peer: string; op: Op }> = [];
  private seq = 0;
  private peers = new Map<RelaySocket, string>();
  private queue: Array<{ socket: RelaySocket; op: Op }> = [];
  private refuseNext: { reason: string; withCurrent: boolean } | null = null;
  private nextPeer = 1;

  accept(socket: RelaySocket): string {
    const peer = `peer-${this.nextPeer++}`;
    this.peers.set(socket, peer);
    socket.open();
    socket.deliver({
      t: "welcome",
      you: peer,
      seq: this.seq,
      entities: [...this.entities.values()],
    });
    return peer;
  }

  inbound(socket: RelaySocket, op: Op): void {
    if (op.op === "resync") return;
    this.received.push({ peer: this.peers.get(socket) ?? "?", op });
    this.queue.push({ socket, op });
  }

  drop(socket: RelaySocket): void {
    this.peers.delete(socket);
  }

  refuseNextSet(reason: string, withCurrent: boolean): void {
    this.refuseNext = { reason, withCurrent };
  }

  /**
   * Every op that has arrived, in order. `together` sends them as one delta,
   * as a resync answer does.
   */
  process(together = false): void {
    const batch: unknown[] = [];
    while (this.queue.length) {
      const { socket, op } = this.queue.shift()!;
      const by = this.peers.get(socket);
      if (!by || op.op !== "set" || !op.id) continue;
      if (this.refuseNext) {
        const { reason, withCurrent } = this.refuseNext;
        this.refuseNext = null;
        const current = this.entities.get(op.id);
        socket.deliver({
          t: "reject",
          ref: op.ref,
          reason,
          ...(withCurrent && current ? { current } : {}),
        });
        continue;
      }
      const before = this.entities.get(op.id);
      const entity: ViroReplicatedEntity = {
        id: op.id,
        fields: { ...before?.fields, ...op.fields },
        version: (before?.version ?? 0) + 1,
        owner: null,
      };
      this.entities.set(op.id, entity);
      const applied = { kind: "upsert", seq: ++this.seq, entity, by };
      if (together) {
        batch.push(applied);
        continue;
      }
      for (const peer of this.peers.keys()) {
        peer.deliver({ t: "delta", ops: [applied] });
      }
    }
    if (batch.length) {
      for (const peer of this.peers.keys()) {
        peer.deliver({ t: "delta", ops: batch });
      }
    }
  }

  /** Another client wrote this row while nobody here was listening. */
  seed(id: string, fields: Record<string, unknown>): void {
    const before = this.entities.get(id);
    this.entities.set(id, {
      id,
      fields,
      version: (before?.version ?? 0) + 1,
      owner: null,
    });
    this.seq++;
  }

  sets(peer: string, prefix = ""): Op[] {
    return this.received
      .filter((r) => r.peer === peer && r.op.op === "set")
      .map((r) => r.op)
      .filter((op) => op.id!.startsWith(prefix));
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

const ASSETS = [
  asset("cube", { hidden_on_load: false }),
  asset("door", { hidden_on_load: true }),
  asset("lamp", { tap_to_place: true, tap_to_place_order: 1 }),
  asset("sign", { tap_to_place: true, tap_to_place_order: 2 }),
];

function asset(id: string, over: Partial<StudioAsset> = {}): StudioAsset {
  return {
    id,
    hidden_on_load: false,
    tap_to_place: false,
    tap_to_place_order: null,
    trigger_image_url: null,
    ...over,
  } as unknown as StudioAsset;
}

function scene(assets: StudioAsset[] = ASSETS): StudioSceneResponse {
  return {
    scene: { id: "scene-1", belongs_to_project: "proj-1" },
    assets,
    collision_bindings: [],
    animations: [],
    functions: [],
    variables: [
      { id: "v1", name: "score", type: "NUMBER", initial_value: 0 },
      { id: "v2", name: "lives", type: "NUMBER", initial_value: 3 },
      { id: "v3", name: "open", type: "BOOLEAN", initial_value: false },
    ],
  } as unknown as StudioSceneResponse;
}

/** Scene frame to location frame; the same on every device in a room. */
const ORIGIN: Mat4 = fromPositionEuler([1, 0, -2], [0, 90, 0]);

type Device = {
  client: ViroReplicationClient;
  shared: StudioSharedState;
  variables: StudioVariableStore;
  visibility: StudioVisibilityStore;
  placement: StudioPlacementStore;
  origin: { current: Mat4 | null };
  socket: () => RelaySocket;
  peer: string;
  changes: Array<[string | null, StudioChangeOrigin]>;
  connect: () => void;
};

/** A device with the scene mounted and its stores seeded, not yet connected. */
function device(
  sceneData = scene(),
  role: "host" | "join" = "join",
  outbox?: StudioOutboxOptions
): Device {
  const variables = new StudioVariableStore();
  variables.seed(sceneData.variables ?? []);
  const visibility = new StudioVisibilityStore();
  visibility.seed(sceneData.assets);
  const placement = new StudioPlacementStore();
  placement.seed(sceneData.assets);
  const client = new ViroReplicationClient();
  const origin = { current: ORIGIN as Mat4 | null };
  const shared = new StudioSharedState(
    client,
    { origin: () => origin.current, role },
    outbox
  );
  // As the controller wires it.
  client.onReject = (rejection) => shared.handleReject(rejection);
  shared.bindScene(sceneData, { variables, visibility, placement });
  const changes: Array<[string | null, StudioChangeOrigin]> = [];
  variables.subscribeChanges((k, o) => changes.push([k, o]));
  let socket: RelaySocket | null = null;
  const d: Device = {
    client,
    shared,
    variables,
    visibility,
    placement,
    origin,
    socket: () => socket!,
    peer: "",
    changes,
    connect: () => {
      client.connect({ roomId: "room-1", apiKey: "k", projectId: "proj-1" });
      socket = lastSocket!;
      d.peer = relay.accept(socket);
    },
  };
  return d;
}

function online(sceneData = scene()): Device {
  const d = device(sceneData);
  d.connect();
  return d;
}

const expectVec = (got: Vec3 | null | undefined, want: Vec3) => {
  expect(got).toBeTruthy();
  got!.forEach((v, i) => expect(v).toBeCloseTo(want[i], 6));
};

beforeEach(() => {
  (globalThis as any).WebSocket = RelaySocket;
  jest.useFakeTimers();
  relay = new FakeRelay();
});

afterEach(() => {
  jest.useRealTimers();
});

describe("shared variables", () => {
  it("writes a local change once and does not apply or rewrite its own echo", () => {
    const a = online();
    a.variables.set("score", 1);
    expect(relay.sets(a.peer)).toEqual([
      expect.objectContaining({ op: "set", id: "var:score", fields: { v: 1 } }),
    ]);
    relay.process();
    jest.advanceTimersByTime(1000);
    expect(relay.sets(a.peer)).toHaveLength(1);
    expect(a.variables.get("score")).toBe(1);
    expect(a.changes).toEqual([["score", "local"]]);
  });

  it("applies another device's change as a remote one and writes nothing back", () => {
    const a = online();
    const b = online();
    b.variables.set("score", 5);
    relay.process();
    expect(a.variables.get("score")).toBe(5);
    expect(a.changes).toEqual([["score", "remote"]]);
    jest.advanceTimersByTime(1000);
    expect(relay.sets(a.peer)).toEqual([]);
  });

  it("skips a row ordered before its own write, so the local value never flickers back", () => {
    const a = online();
    const b = online();
    b.variables.set("score", 2);
    a.variables.set("score", 1);
    // The relay ordered b's write first: a sees 2 while its own 1 is unanswered.
    relay.process();
    expect(a.variables.get("score")).toBe(1);
    expect(a.changes).toEqual([["score", "local"]]);
    expect(b.variables.get("score")).toBe(1);
    expect(relay.entities.get("var:score")!.fields).toEqual({ v: 1 });
  });

  it("takes a row written after its own when both arrive in one delta", () => {
    const a = online();
    const b = online();
    a.variables.set("score", 1);
    b.variables.set("score", 2);
    // A resync answer carries a's echo and b's later write together.
    relay.process(true);
    expect(a.variables.get("score")).toBe(2);
    expect(b.variables.get("score")).toBe(2);
  });

  it("ignores a remote value of the wrong type for a declared variable", () => {
    relay.seed("var:score", { v: "lots" });
    const b = online();
    expect(b.variables.get("score")).toBe(0);
  });
});

describe("welcome and snapshot precedence", () => {
  it("takes the room's rows, and the defaults where it has none, over a joiner's changes before the welcome", () => {
    relay.seed("var:score", { v: 7 });
    relay.seed("vis:door", { visible: true });
    const b = device();
    // Changed before the session synced, as a scene's on_load does.
    b.variables.set("score", 2);
    b.variables.set("lives", 1);
    b.visibility.apply("door", "HIDDEN");
    b.visibility.apply("cube", "HIDDEN");
    b.connect();
    expect(b.variables.get("score")).toBe(7);
    expect(b.variables.get("lives")).toBe(3);
    expect(b.visibility.isVisible("door")).toBe(true);
    expect(b.visibility.isVisible("cube")).toBe(true);
    expect(relay.sets(b.peer)).toEqual([]);
  });

  it("does not bring back what the host returned to its default before hosting", () => {
    const host = device(scene(), "host");
    host.visibility.apply("door", "VISIBLE");
    host.visibility.apply("door", "HIDDEN");
    host.connect();
    const joiner = device();
    const seen: Array<[string | null, StudioChangeOrigin]> = [];
    joiner.visibility.subscribeChanges((k, o) => seen.push([k, o]));
    joiner.visibility.apply("door", "VISIBLE");
    joiner.connect();
    relay.process();
    expect(joiner.visibility.isVisible("door")).toBe(false);
    expect(seen).toEqual([
      ["door", "local"],
      ["door", "remote"],
    ]);
    expect(host.visibility.isVisible("door")).toBe(false);
    // Presence claims only.
    expect(
      relay.received.filter((r) => !(r.op.id ?? "").startsWith("peer:"))
    ).toEqual([]);
  });

  it("writes only what differs from the scene's defaults into a new room", () => {
    const host = device(scene(), "host");
    host.variables.set("lives", 1);
    host.variables.set("score", 0);
    host.visibility.apply("door", "VISIBLE");
    host.connect();
    expect(relay.sets(host.peer)).toEqual([
      expect.objectContaining({ id: "var:lives", fields: { v: 1 } }),
      expect.objectContaining({ id: "vis:door", fields: { visible: true } }),
    ]);
    relay.process();
    const joiner = online();
    expect(joiner.variables.get("lives")).toBe(1);
    expect(joiner.visibility.isVisible("door")).toBe(true);
    expect(relay.sets(joiner.peer)).toEqual([]);
  });

  it("drops changes made while reconnecting in favour of the re-welcome's rows", () => {
    const a = online();
    const b = online();
    a.variables.set("score", 1);
    relay.process();
    a.socket().dropConnection();
    expect(a.client.state).toBe("reconnecting");
    a.variables.set("score", 9);
    b.variables.set("score", 4);
    relay.process();
    jest.advanceTimersByTime(500);
    const rejoined = relay.accept(lastSocket!);
    expect(a.variables.get("score")).toBe(4);
    expect(relay.sets(rejoined)).toEqual([]);
  });

  it("writes what it changed while reconnecting where the room has no row", () => {
    const a = online();
    const b = online();
    a.socket().dropConnection();
    a.variables.set("lives", 1);
    a.visibility.apply("door", "VISIBLE");
    jest.advanceTimersByTime(500);
    const rejoined = relay.accept(lastSocket!);
    expect(relay.sets(rejoined).map((op) => op.id)).toEqual([
      "var:lives",
      "vis:door",
    ]);
    relay.process();
    expect(b.variables.get("lives")).toBe(1);
    expect(b.visibility.isVisible("door")).toBe(true);
  });

  it("writes again what was unanswered or still queued when the link dropped", () => {
    const host = device(scene(), "host", { burst: 1 });
    host.variables.set("score", 5);
    host.variables.set("lives", 1);
    host.connect();
    expect(relay.sets(host.peer).map((op) => op.id)).toEqual(["var:score"]);
    host.socket().dropConnection();
    jest.advanceTimersByTime(500);
    const rejoined = relay.accept(lastSocket!);
    jest.advanceTimersByTime(100);
    expect(relay.sets(rejoined).map((op) => op.id)).toEqual([
      "var:score",
      "var:lives",
    ]);
    expect(host.variables.get("lives")).toBe(1);
  });

  it("re-applies the room's rows when the scene's store reseeds", () => {
    const a = online();
    const b = online();
    b.visibility.apply("door", "VISIBLE");
    relay.process();
    expect(a.visibility.isVisible("door")).toBe(true);
    a.visibility.reseed(ASSETS);
    expect(a.visibility.isVisible("door")).toBe(true);
    expect(relay.sets(a.peer)).toEqual([]);
  });
});

describe("coalescing", () => {
  it("sends one entity at most once per 33 ms, and the last value wins", () => {
    const a = online();
    a.variables.set("score", 1);
    a.variables.set("score", 2);
    a.variables.set("score", 3);
    expect(relay.sets(a.peer, "var:").map((op) => op.fields)).toEqual([
      { v: 1 },
    ]);
    jest.advanceTimersByTime(32);
    expect(relay.sets(a.peer, "var:")).toHaveLength(1);
    jest.advanceTimersByTime(1);
    expect(relay.sets(a.peer, "var:").map((op) => op.fields)).toEqual([
      { v: 1 },
      { v: 3 },
    ]);
  });

  it("does not hold one entity back for another", () => {
    const a = online();
    a.variables.set("score", 1);
    a.variables.set("lives", 2);
    a.visibility.apply("cube", "TOGGLE");
    expect(relay.sets(a.peer).map((op) => op.id)).toEqual([
      "var:score",
      "var:lives",
      "vis:cube",
    ]);
  });

  it("skips rows that arrive while its next write is still queued", () => {
    const a = online();
    const b = online();
    a.variables.set("score", 1);
    a.variables.set("score", 2);
    b.variables.set("score", 3);
    relay.process();
    // b's 3 was ordered after a's 1 but before a's queued 2.
    expect(a.variables.get("score")).toBe(2);
    jest.advanceTimersByTime(33);
    relay.process();
    expect(a.changes.every(([, origin]) => origin === "local")).toBe(true);
    expect(a.variables.get("score")).toBe(2);
    expect(b.variables.get("score")).toBe(2);
  });

  it("settles a trailing write's echo without applying the earlier one", () => {
    const a = online();
    a.variables.set("score", 1);
    a.variables.set("score", 2);
    relay.process();
    jest.advanceTimersByTime(33);
    relay.process();
    expect(a.variables.get("score")).toBe(2);
    expect(a.changes).toEqual([
      ["score", "local"],
      ["score", "local"],
    ]);
  });
});

describe("shared visibility", () => {
  it("writes a toggle as its result and applies it elsewhere without an echo", () => {
    const a = online();
    const b = online();
    const remote: Array<[string | null, StudioChangeOrigin]> = [];
    b.visibility.subscribeChanges((k, o) => remote.push([k, o]));
    a.visibility.apply("cube", "TOGGLE");
    expect(relay.sets(a.peer)).toEqual([
      expect.objectContaining({ id: "vis:cube", fields: { visible: false } }),
    ]);
    relay.process();
    expect(b.visibility.isVisible("cube")).toBe(false);
    expect(remote).toEqual([["cube", "remote"]]);
    expect(relay.sets(b.peer)).toEqual([]);
  });

  it("ignores rows for assets the scene on screen does not have", () => {
    relay.seed("vis:elsewhere", { visible: false });
    const a = online();
    expect(a.visibility.isVisible("elsewhere")).toBe(true);
  });
});

describe("shared tap-to-place", () => {
  const tap: Vec3 = [0.5, 0, -1];
  const forward: Vec3 = [0, 0, -1];
  const up: Vec3 = [0, 1, 0];

  it("writes a placement in the location frame and places it in the scene frame elsewhere", () => {
    const a = online();
    const b = online();
    a.placement.place("lamp", tap, forward, up);
    const [op] = relay.sets(a.peer, "place:");
    expect(op.id).toBe("place:lamp");
    expectVec(op.fields!.p as Vec3, transformPoint(ORIGIN, tap));
    expectVec(op.fields!.f as Vec3, rotateDirection(ORIGIN, forward));
    expectVec(op.fields!.u as Vec3, up);
    relay.process();
    const placed = b.placement.getPlacement("lamp");
    expectVec(placed?.position, tap);
    expectVec(placed?.forward, forward);
    expectVec(placed?.up, up);
    // The guided queue moves on for everyone.
    expect(b.placement.activeAssetId()).toBe("sign");
    expect(relay.sets(b.peer)).toEqual([]);
  });

  it("moves an asset already placed here when the relay orders another placement after it", () => {
    const a = online();
    const b = online();
    a.placement.place("lamp", tap, forward, up);
    b.placement.place("lamp", [2, 0, 2]);
    relay.process();
    for (const d of [a, b]) {
      expectVec(d.placement.getPosition("lamp"), [2, 0, 2]);
      expect(d.placement.getPlacement("lamp")?.forward).toBeNull();
    }
  });

  it("does not share placements made before the session", () => {
    // No origin until the session syncs, as in the controller.
    const a = device();
    a.origin.current = null;
    a.placement.place("lamp", [9, 9, 9], forward, up);
    a.connect();
    a.origin.current = ORIGIN;
    a.shared.refreshFrame();
    expect(relay.sets(a.peer, "place:")).toEqual([]);
  });

  it("puts the room's placements back when the scene reseeds its store", () => {
    // The scene drops its placements when it enters the shared frame.
    const a = online();
    const b = online();
    a.placement.place("lamp", tap, forward, up);
    relay.process();
    b.placement.reseed(ASSETS);
    expectVec(b.placement.getPosition("lamp"), tap);
    expect(b.placement.activeAssetId()).toBe("sign");
    expect(relay.sets(b.peer)).toEqual([]);
  });

  it("writes a placement made while reconnecting once the room has no row for it", () => {
    const a = online();
    a.socket().dropConnection();
    a.placement.place("lamp", tap, forward, up);
    expect(relay.sets(a.peer, "place:")).toEqual([]);
    jest.advanceTimersByTime(500);
    const rejoined = relay.accept(lastSocket!);
    expect(relay.sets(rejoined, "place:").map((op) => op.id)).toEqual([
      "place:lamp",
    ]);
  });

  it("waits for the scene origin before applying placement rows", () => {
    relay.seed("place:lamp", {
      p: transformPoint(ORIGIN, tap),
      f: null,
      u: null,
    });
    const b = device();
    b.origin.current = null;
    b.connect();
    expect(b.placement.isPlaced("lamp")).toBe(false);
    b.origin.current = ORIGIN;
    b.shared.refreshFrame();
    expectVec(b.placement.getPosition("lamp"), tap);
  });

  it("converts through each device's own origin matrix", () => {
    // Two scene origins would be a bug elsewhere; this pins the conversion
    // to the inverse of the origin rather than to identity.
    const b = device();
    const other = fromPositionEuler([0, 1, 0], [0, 0, 0]);
    b.origin.current = other;
    relay.seed("place:lamp", { p: [1, 1, 1], f: null, u: null });
    b.connect();
    expectVec(
      b.placement.getPosition("lamp"),
      transformPoint(invert(other)!, [1, 1, 1])
    );
  });
});

describe("refusals", () => {
  it("takes the current row a refusal carries", () => {
    const a = online();
    const b = online();
    b.variables.set("score", 4);
    relay.process();
    relay.refuseNextSet("version-conflict", true);
    a.variables.set("score", 8);
    relay.process();
    expect(a.variables.get("score")).toBe(4);
  });

  it("takes the room's row back when a write never comes back", () => {
    const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
    const a = online();
    const b = online();
    b.variables.set("score", 4);
    relay.process();
    relay.refuseNextSet("room-too-large", false);
    a.variables.set("score", 8);
    relay.process();
    expect(a.variables.get("score")).toBe(8);
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("refused a change (room-too-large)")
    );
    jest.advanceTimersByTime(STUDIO_SHARED_PENDING_TIMEOUT_MS);
    expect(a.variables.get("score")).toBe(4);
    warn.mockRestore();
  });
});

describe("binding", () => {
  it("stops writing a scene's stores once unbound, and adopts the next scene's", () => {
    const a = online();
    const b = online();
    b.visibility.apply("door", "VISIBLE");
    relay.process();
    a.shared.bindScene(null, null);
    a.variables.set("score", 3);
    expect(relay.sets(a.peer)).toEqual([]);

    const next = new StudioVisibilityStore();
    next.seed(ASSETS);
    a.shared.bindScene(scene(), { variables: a.variables, visibility: next });
    expect(next.isVisible("door")).toBe(true);
    // Changed while nothing shared it: the room has no row, so it holds the
    // default.
    expect(a.variables.get("score")).toBe(0);
    expect(relay.sets(a.peer)).toEqual([]);
  });
});
