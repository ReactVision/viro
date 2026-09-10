import {
  ViroReplicationClient,
  type ViroReplicatedEntity,
} from "../components/AR/ViroReplication";

/** Minimal WebSocket stand-in: records what was sent, injects what arrives. */
class FakeSocket {
  static last: FakeSocket | null = null;

  readyState = 0;
  sent: Record<string, unknown>[] = [];
  onopen: (() => void) | null = null;
  onmessage: ((ev: { data: unknown }) => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;

  constructor(public url: string) {
    FakeSocket.last = this;
  }

  send(data: string) { this.sent.push(JSON.parse(data)); }
  close() { this.readyState = 3; }

  open() { this.readyState = 1; this.onopen?.(); }
  deliver(msg: unknown) { this.onmessage?.({ data: JSON.stringify(msg) }); }
  drop() { this.readyState = 3; this.onclose?.(); }
}

const CONFIG = {
  roomId: "room-1",
  apiKey: "k",
  projectId: "p",
  endpoint: "http://localhost:8787",
};

const entity = (over: Partial<ViroReplicatedEntity> = {}): ViroReplicatedEntity => ({
  id: "cube",
  fields: { x: 1 },
  version: 1,
  owner: null,
  ...over,
});

let client: ViroReplicationClient;

beforeEach(() => {
  (globalThis as any).WebSocket = FakeSocket;
  jest.useFakeTimers();
  client = new ViroReplicationClient();
});

afterEach(() => {
  client.disconnect();
  jest.useRealTimers();
});

const connectAndWelcome = (entities: ViroReplicatedEntity[] = [], seq = 0) => {
  client.connect(CONFIG);
  const s = FakeSocket.last!;
  s.open();
  s.deliver({ t: "welcome", you: "me", seq, entities });
  return s;
};

describe("connection", () => {
  it("builds a ws:// url from an http endpoint and passes credentials", () => {
    client.connect(CONFIG);
    const url = FakeSocket.last!.url;
    expect(url).toContain("ws://localhost:8787/functions/v1/replication/room-1");
    expect(url).toContain("apiKey=k");
    expect(url).toContain("projectId=p");
  });

  it("is only synced once the welcome arrives, not when the socket opens", () => {
    client.connect(CONFIG);
    const s = FakeSocket.last!;
    expect(client.state).toBe("connecting");

    // An open socket with no snapshot has nothing to answer reads with.
    s.open();
    expect(client.state).toBe("connecting");

    s.deliver({ t: "welcome", you: "me", seq: 0, entities: [] });
    expect(client.state).toBe("synced");
    expect(client.localPeerId).toBe("me");
  });

  it("adopts the welcome state", () => {
    connectAndWelcome([entity()], 4);
    expect(client.get("cube")?.fields.x).toBe(1);
  });
});

describe("ordering", () => {
  it("applies deltas in sequence", () => {
    const s = connectAndWelcome([], 0);
    s.deliver({ t: "delta", ops: [{ kind: "upsert", seq: 1, entity: entity(), by: "me" }] });
    s.deliver({
      t: "delta",
      ops: [{ kind: "upsert", seq: 2, entity: entity({ fields: { x: 2 }, version: 2 }), by: "me" }],
    });
    expect(client.get("cube")?.fields.x).toBe(2);
  });

  it("ignores a delta it has already applied", () => {
    const s = connectAndWelcome([], 5);
    s.deliver({ t: "delta", ops: [{ kind: "upsert", seq: 3, entity: entity(), by: "x" }] });
    expect(client.get("cube")).toBeUndefined();
  });

  it("asks for a resync on a gap instead of applying past it", () => {
    const s = connectAndWelcome([], 0);
    s.sent.length = 0;

    // seq 3 with nothing at 1 or 2 means two deltas never arrived.
    s.deliver({ t: "delta", ops: [{ kind: "upsert", seq: 3, entity: entity(), by: "x" }] });

    expect(s.sent).toEqual([{ op: "resync", sinceSeq: 0 }]);
    expect(client.get("cube")).toBeUndefined();
  });

  it("replaces everything on a snapshot", () => {
    const s = connectAndWelcome([entity({ id: "old" })], 1);
    s.deliver({ t: "snapshot", seq: 9, entities: [entity({ id: "new" })] });
    expect(client.get("old")).toBeUndefined();
    expect(client.get("new")).toBeDefined();
  });
});

describe("authority", () => {
  it("sends claim and release", () => {
    const s = connectAndWelcome();
    s.sent.length = 0;
    client.claim("cube");
    client.release("cube");
    expect(s.sent.map((m) => m.op)).toEqual(["claim", "release"]);
  });

  it("tracks ownership from an owner delta", () => {
    const s = connectAndWelcome();
    s.deliver({
      t: "delta",
      ops: [{ kind: "owner", seq: 1, id: "cube", owner: "me", version: 1, by: "me" }],
    });
    expect(client.get("cube")?.owner).toBe("me");
  });

  it("applies a release delta that frees a departed peer's entity", () => {
    const s = connectAndWelcome([entity({ owner: "other" })], 1);
    s.deliver({
      t: "delta",
      ops: [{ kind: "owner", seq: 2, id: "cube", owner: null, version: 2, by: "other" }],
    });
    expect(client.get("cube")?.owner).toBeNull();
  });
});

describe("conflict resolution", () => {
  it("passes expectVersion through, and omits it when absent", () => {
    const s = connectAndWelcome();
    s.sent.length = 0;

    client.set("cube", { x: 5 }, { expectVersion: 3 });
    expect(s.sent[0].expectVersion).toBe(3);

    client.set("cube", { x: 6 });
    expect("expectVersion" in s.sent[1]).toBe(false);
  });

  it("adopts the server's current value when a write is refused", () => {
    const s = connectAndWelcome([entity({ fields: { x: 1 }, version: 1 })], 1);

    client.set("cube", { x: 99 }, { expectVersion: 1 });
    s.deliver({
      t: "reject",
      ref: s.sent[s.sent.length - 1].ref,
      reason: "version-conflict",
      current: entity({ fields: { x: 42 }, version: 7 }),
    });

    // The point of the rejection is to hand back what should have been read.
    expect(client.get("cube")?.fields.x).toBe(42);
    expect(client.get("cube")?.version).toBe(7);
  });

  it("reports rejections to the caller", () => {
    const s = connectAndWelcome();
    const seen: string[] = [];
    client.onReject = (r) => seen.push(r.reason);

    client.claim("cube");
    s.deliver({
      t: "reject",
      ref: s.sent[s.sent.length - 1].ref,
      reason: "already-owned",
      current: entity({ owner: "other" }),
    });

    expect(seen).toEqual(["already-owned"]);
    expect(client.get("cube")?.owner).toBe("other");
  });
});

describe("optimistic writes", () => {
  it("is off by default — nothing shows until the server confirms", () => {
    const s = connectAndWelcome();
    client.set("cube", { x: 1 });
    expect(client.get("cube")).toBeUndefined();

    s.deliver({
      t: "delta",
      ops: [{ kind: "upsert", seq: 1, entity: entity(), by: "me" }],
    });
    expect(client.get("cube")?.fields.x).toBe(1);
  });

  it("shows the change immediately when asked", () => {
    connectAndWelcome();
    client.set("cube", { x: 7 }, { optimistic: true });
    expect(client.get("cube")?.fields.x).toBe(7);
  });

  it("rolls back to the server's value when the optimistic write is refused", () => {
    const s = connectAndWelcome([entity({ fields: { x: 1 } })], 1);

    client.set("cube", { x: 7 }, { optimistic: true });
    expect(client.get("cube")?.fields.x).toBe(7);

    s.deliver({
      t: "reject",
      ref: s.sent[s.sent.length - 1].ref,
      reason: "not-owner",
      current: entity({ fields: { x: 1 }, owner: "other" }),
    });

    expect(client.get("cube")?.fields.x).toBe(1);
    expect(client.get("cube")?.owner).toBe("other");
  });

  it("rolls back to nothing when the entity did not exist before", () => {
    const s = connectAndWelcome();
    client.set("brand-new", { x: 1 }, { optimistic: true });
    expect(client.get("brand-new")).toBeDefined();

    // No `current`: the server has no such entity, so neither should we.
    s.deliver({ t: "reject", ref: s.sent[s.sent.length - 1].ref, reason: "too-many-entities" });
    expect(client.get("brand-new")).toBeUndefined();
  });
});

describe("reconnection", () => {
  it("resyncs from the last applied sequence rather than starting over", () => {
    const s1 = connectAndWelcome([], 0);
    s1.deliver({ t: "delta", ops: [{ kind: "upsert", seq: 1, entity: entity(), by: "x" }] });

    s1.drop();
    expect(client.state).toBe("reconnecting");

    jest.advanceTimersByTime(500);
    const s2 = FakeSocket.last!;
    expect(s2).not.toBe(s1);

    s2.open();
    expect(s2.sent).toEqual([{ op: "resync", sinceSeq: 1 }]);
  });

  it("gives up after the backoff is exhausted", () => {
    const s = connectAndWelcome();
    let sock = s;
    // Five delays in the ladder; the sixth drop is terminal.
    for (const d of [500, 1000, 2000, 4000, 8000]) {
      sock.drop();
      jest.advanceTimersByTime(d);
      sock = FakeSocket.last!;
    }
    sock.drop();
    expect(client.state).toBe("failed");
    expect(client.error).toBeDefined();
  });

  it("does not reconnect after an explicit disconnect", () => {
    const s = connectAndWelcome();
    client.disconnect();
    const before = FakeSocket.last;

    s.drop();
    jest.advanceTimersByTime(10000);

    expect(FakeSocket.last).toBe(before);
    expect(client.state).toBe("idle");
  });
});

describe("subscribe", () => {
  it("notifies on state changes", () => {
    let calls = 0;
    const unsub = client.subscribe(() => calls++);
    connectAndWelcome();
    expect(calls).toBeGreaterThan(0);

    const at = calls;
    unsub();
    FakeSocket.last!.deliver({
      t: "delta",
      ops: [{ kind: "upsert", seq: 1, entity: entity(), by: "x" }],
    });
    expect(calls).toBe(at);
  });
});

describe("sending while disconnected", () => {
  it("drops the operation rather than throwing", () => {
    // Nothing is queued: a write made while offline would arrive out of order
    // and against a version that has moved on.
    expect(() => client.set("cube", { x: 1 })).not.toThrow();
    expect(client.get("cube")).toBeUndefined();
  });
});
