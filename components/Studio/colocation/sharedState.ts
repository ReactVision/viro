import type {
  ViroReplicatedEntity,
  ViroReplicationClient,
  ViroReplicationRejection,
  ViroReplicationRejectReason,
} from "../../AR/ViroReplication";
import type { StudioDragStore } from "../domain/dragStore";
import {
  type StudioVariableValue,
  valueMatchesType,
} from "../domain/expressionEvaluator";
import type {
  StudioPlacement,
  StudioPlacementStore,
} from "../domain/placementStore";
import type {
  StudioChangeOrigin,
  StudioStoreChangeListener,
} from "../domain/utils";
import type { StudioSoundManager } from "../domain/soundManager";
import type { StudioVariableStore } from "../domain/variableStore";
import type { StudioVisibilityStore } from "../domain/visibilityStore";
import type { StudioSceneResponse, StudioSceneVariable } from "../types";
import type { StudioColocationFrame } from "./controller";
import { STUDIO_DRAG_PREFIX, StudioDragBridge } from "./drags";
import { sceneAudioUrls, STUDIO_EVENT_PREFIX, StudioEventRing } from "./events";
import {
  invert,
  isVec3,
  type Mat4,
  rotateDirection,
  transformPoint,
  type Vec3,
} from "./frameMath";
import {
  STUDIO_COLOCATION_CURRENT_SCENE_ENTITY,
  type StudioRoomSceneStore,
} from "./navigation";
import { type StudioOutboxOptions, StudioReplicationOutbox } from "./outbox";

type Fields = Record<string, unknown>;

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

export type StudioReplicationPort = Pick<
  ViroReplicationClient,
  | "state"
  | "localPeerId"
  | "getEntities"
  | "get"
  | "subscribe"
  | "set"
  | "claim"
  | "release"
  | "delete"
>;

export type StudioSharedStateContext = {
  /** Scene (content) frame to location frame; null until the origin exists. */
  origin: () => Mat4 | null;
  /** World to location frame. Without it drags stay on this device. */
  worldToLocation?: () => Mat4 | null;
  /** The host's state at its first sync defines the room. */
  role: "host" | "join";
};

/** The rows that belong to one scene's assets, which leave with it. */
const SCENE_ROW_PREFIXES = ["vis:", "place:", STUDIO_DRAG_PREFIX];

/** A write not seen back by then was refused or lost, so the room's copy wins. */
export const STUDIO_SHARED_PENDING_TIMEOUT_MS = 5000;

const SIZE_REFUSALS: ReadonlySet<ViroReplicationRejectReason> =
  new Set<ViroReplicationRejectReason>([
    "too-many-entities",
    "field-too-large",
    "room-too-large",
    "org-too-large",
  ]);

/**
 * Physics simulates on every device, so one contact would run a collision
 * binding once per device; while shared only the host's contacts run them.
 * Gaze and proximity follow each device's own camera and run everywhere, and
 * what they change is shared like any other change.
 */
export function collisionBindingsRunHere(
  frame: StudioColocationFrame
): boolean {
  return frame.phase !== "shared" || frame.role === "host";
}

type BridgeHost = {
  isSynced(): boolean;
  isHost(): boolean;
  write(id: string, fields: Fields): void;
  isQueued(id: string): boolean;
  rows(prefix: string): Map<string, Fields>;
  row(id: string): Fields | undefined;
  origin(): Mat4 | null;
  scheduleSweep(): void;
};

/** Every field written reads back the same; fields another writer added do not count. */
function sameFields(room: Fields, written: Fields): boolean {
  return Object.keys(written).every(
    (k) => JSON.stringify(room[k]) === JSON.stringify(written[k])
  );
}

function isVariableValue(v: unknown): v is StudioVariableValue {
  return (
    typeof v === "boolean" ||
    typeof v === "string" ||
    (typeof v === "number" && Number.isFinite(v))
  );
}

/**
 * One store's rows in the room. Local changes are written through the outbox;
 * rows from the room are applied as remote changes, which the store reports
 * back with a remote origin and the bridge ignores, so nothing echoes.
 *
 * Writes are not optimistic. The store already shows the local value, and the
 * relay delivers in its own order to every peer, the writer included, so a row
 * that arrives while this device's write is queued or unanswered was ordered
 * before it and is skipped; the write's own echo settles it.
 */
abstract class StudioStoreBridge<Store> {
  abstract readonly prefix: string;
  protected store: Store | null = null;
  private unsubscribe: (() => void) | null = null;
  /** Writes sent and not yet seen back, oldest first. */
  private pending = new Map<string, { writes: Fields[]; sentAt: number }>();
  /**
   * Changed here while unsynced, or in flight when the link dropped; written
   * at the next sync where the room has no row for them.
   */
  protected readonly unsent = new Set<string>();
  private definesRoom = false;

  constructor(protected host: BridgeHost) {}

  bind(store: Store | null, sceneData: StudioSceneResponse | null): void {
    if (store !== this.store) {
      this.unsubscribe?.();
      this.unsubscribe = store ? this.subscribeTo(store, this.onChange) : null;
      this.store = store;
    }
    this.describe(sceneData);
    if (this.host.isSynced()) this.reconcile();
  }

  dispose(): void {
    this.unsubscribe?.();
    this.unsubscribe = null;
    this.store = null;
    this.pending.clear();
    this.unsent.clear();
  }

  protected abstract subscribeTo(
    store: Store,
    listener: StudioStoreChangeListener
  ): () => void;
  /** The scene now on screen: what its rows default to. */
  protected abstract describe(sceneData: StudioSceneResponse | null): void;
  /** The store's value for a key as the fields to write; null writes nothing. */
  protected abstract encode(key: string): Fields | null;
  /** The room's fields for a key into the store, as a remote change. */
  protected abstract apply(key: string, fields: Fields): void;
  /** Keys whose value here is not what a missing row means. */
  protected abstract unsharedKeys(): string[];
  /** What a missing row means for a key; null leaves the key as it is. */
  protected abstract defaultFields(key: string): Fields | null;

  private onChange = (key: string | null, origin: StudioChangeOrigin) => {
    if (origin === "remote") return;
    if (key === null) {
      // A reseed returns every key to its default, so there is nothing to
      // write, only the room's rows to put back.
      this.unsent.clear();
      if (this.host.isSynced()) this.adopt();
      return;
    }
    this.localChange(key);
  };

  protected localChange(key: string): void {
    if (!this.host.isSynced()) {
      this.unsent.add(key);
      return;
    }
    const fields = this.encode(key);
    if (fields) this.host.write(this.prefix + key, fields);
  }

  /** The outbox sent a write for this key. */
  sent(key: string, fields: Fields, now: number): void {
    const entry = this.pending.get(key);
    if (entry) {
      entry.writes.push(fields);
      entry.sentAt = now;
    } else {
      this.pending.set(key, { writes: [fields], sentAt: now });
    }
    this.host.scheduleSweep();
  }

  /**
   * A row the room changed, in the room's order. `skipped` means versions in
   * between went unseen, as in a resync answer or a snapshot.
   */
  receive(key: string, fields: Fields, skipped = false): void {
    if (this.host.isQueued(this.prefix + key)) return;
    const entry = this.pending.get(key);
    if (entry) {
      const i = entry.writes.findIndex((w) => sameFields(fields, w));
      if (i >= 0) {
        // The nth echo settles the nth write; earlier writes came back first.
        entry.writes.splice(0, i + 1);
        if (entry.writes.length === 0) this.pending.delete(key);
        return;
      }
      // An unseen version can be this device's write, so this row can be one
      // ordered after it.
      if (!skipped) return;
      this.pending.delete(key);
    }
    if (this.store) this.apply(key, fields);
  }

  /**
   * A welcome or a re-welcome: the room's rows win over what this device did
   * before it. At the first one the host's state defines the room, and a
   * joiner's own changes from before it are dropped.
   */
  sync(first: boolean): void {
    this.pending.clear();
    if (first) {
      this.definesRoom = this.host.isHost();
      if (!this.definesRoom) this.unsent.clear();
    }
    this.reconcile();
  }

  unsynced(queued: string[]): void {
    this.pending.forEach((_, key) => this.unsent.add(key));
    for (const id of queued) {
      if (id.startsWith(this.prefix)) {
        this.unsent.add(id.slice(this.prefix.length));
      }
    }
    this.pending.clear();
  }

  /** The relay refused a write and sent its current row. */
  rejected(key: string, fields: Fields): void {
    this.pending.delete(key);
    if (this.store && !this.host.isQueued(this.prefix + key)) {
      this.apply(key, fields);
    }
  }

  /** Drops writes sent before `cutoff` and takes the room's row. */
  expire(cutoff: number): boolean {
    for (const [key, entry] of this.pending) {
      if (entry.sentAt > cutoff) continue;
      this.pending.delete(key);
      const row = this.host.row(this.prefix + key);
      if (row && this.store && !this.host.isQueued(this.prefix + key)) {
        this.apply(key, row);
      }
    }
    return this.pending.size > 0;
  }

  /** The room's rows into the store, except where a write from here is in flight. */
  adopt(): Map<string, Fields> {
    const rows = this.host.rows(this.prefix);
    if (this.store) rows.forEach((fields, key) => this.receive(key, fields));
    return rows;
  }

  /**
   * adopt(), then the keys the room has no row for, which hold their default
   * once the host has synced. Each is written from here when this device
   * defines the room or changed it unsynced, and otherwise put back to that
   * default.
   */
  reconcile(): void {
    if (!this.store) return;
    const rows = this.adopt();
    for (const key of this.unsharedKeys()) {
      if (
        rows.has(key) ||
        this.pending.has(key) ||
        this.host.isQueued(this.prefix + key)
      ) {
        continue;
      }
      if (this.definesRoom || this.unsent.has(key)) {
        const fields = this.encode(key);
        if (fields) this.host.write(this.prefix + key, fields);
      } else {
        const fields = this.defaultFields(key);
        if (fields) this.apply(key, fields);
      }
    }
    this.definesRoom = false;
    this.unsent.clear();
  }
}

/** `var:<name>` = `{ v }`, last writer wins. */
class StudioVariableBridge extends StudioStoreBridge<StudioVariableStore> {
  readonly prefix = "var:";
  // Every scene attached this session: a name keeps its first declaration, as
  // the store's initialise-if-absent seeding does.
  private declared = new Map<string, StudioSceneVariable>();

  protected subscribeTo(
    store: StudioVariableStore,
    listener: StudioStoreChangeListener
  ) {
    return store.subscribeChanges(listener);
  }

  protected describe(sceneData: StudioSceneResponse | null): void {
    for (const decl of sceneData?.variables ?? []) {
      if (decl?.name && !this.declared.has(decl.name)) {
        this.declared.set(decl.name, decl);
      }
    }
  }

  protected encode(name: string): Fields | null {
    const v = this.store?.get(name);
    return v === undefined ? null : { v };
  }

  protected apply(name: string, fields: Fields): void {
    const v = fields.v;
    if (!isVariableValue(v)) return;
    const decl = this.declared.get(name);
    if (decl && !valueMatchesType(v, decl.type)) return;
    this.store?.set(name, v, "remote");
  }

  protected unsharedKeys(): string[] {
    const values = this.store?.snapshot() ?? {};
    return Object.keys(values).filter((name) => {
      const decl = this.declared.get(name);
      return !decl || !Object.is(decl.initial_value, values[name]);
    });
  }

  protected defaultFields(name: string): Fields | null {
    const decl = this.declared.get(name);
    return decl ? { v: decl.initial_value } : null;
  }
}

/** `vis:<assetId>` = `{ visible }`, last writer wins; TOGGLE is resolved before it is written. */
class StudioVisibilityBridge extends StudioStoreBridge<StudioVisibilityStore> {
  readonly prefix = "vis:";
  /** The scene's assets and their author-time visibility. */
  private defaults = new Map<string, boolean>();

  protected subscribeTo(
    store: StudioVisibilityStore,
    listener: StudioStoreChangeListener
  ) {
    return store.subscribeChanges(listener);
  }

  protected describe(sceneData: StudioSceneResponse | null): void {
    this.defaults = new Map(
      (sceneData?.assets ?? [])
        .filter((a) => !!a?.id)
        .map((a) => [a.id, !a.hidden_on_load] as [string, boolean])
    );
  }

  protected encode(assetId: string): Fields | null {
    if (!this.store || !this.defaults.has(assetId)) return null;
    return { visible: this.store.isVisible(assetId) };
  }

  protected apply(assetId: string, fields: Fields): void {
    if (!this.defaults.has(assetId) || typeof fields.visible !== "boolean") {
      return;
    }
    this.store?.apply(assetId, fields.visible ? "VISIBLE" : "HIDDEN", "remote");
  }

  protected unsharedKeys(): string[] {
    const store = this.store;
    if (!store) return [];
    const keys: string[] = [];
    this.defaults.forEach((visible, assetId) => {
      if (store.isVisible(assetId) !== visible) keys.push(assetId);
    });
    return keys;
  }

  protected defaultFields(assetId: string): Fields | null {
    const visible = this.defaults.get(assetId);
    return visible === undefined ? null : { visible };
  }
}

function samePlacement(
  a: StudioPlacement | undefined,
  b: StudioPlacement
): boolean {
  const close = (x: Vec3 | null, y: Vec3 | null) =>
    x === y || (!!x && !!y && x.every((v, i) => Math.abs(v - y[i]) < 1e-6));
  return (
    !!a &&
    close(a.position, b.position) &&
    close(a.forward, b.forward) &&
    close(a.up, b.up)
  );
}

/**
 * `place:<assetId>` = `{ p, f, u }` in the location frame: the tap point and
 * the camera's forward and up at tap time. The store holds scene-frame
 * placements, and the scene origin converts between the two.
 */
class StudioPlacementBridge extends StudioStoreBridge<StudioPlacementStore> {
  readonly prefix = "place:";

  protected subscribeTo(
    store: StudioPlacementStore,
    listener: StudioStoreChangeListener
  ) {
    return store.subscribeChanges(listener);
  }

  protected describe(): void {}

  protected localChange(assetId: string): void {
    // Placements from before the shared session are world points, and the
    // scene drops them when it enters the shared frame.
    if (!this.host.origin()) return;
    super.localChange(assetId);
  }

  protected encode(assetId: string): Fields | null {
    const placement = this.store?.getPlacement(assetId);
    const origin = this.host.origin();
    if (!placement || !origin) return null;
    return {
      p: transformPoint(origin, placement.position),
      // Always sent: a set merges fields, so an absent one keeps an old value.
      f: placement.forward ? rotateDirection(origin, placement.forward) : null,
      u: placement.up ? rotateDirection(origin, placement.up) : null,
    };
  }

  protected apply(assetId: string, fields: Fields): void {
    const store = this.store;
    if (!store?.isTracked(assetId) || !isVec3(fields.p)) return;
    const origin = this.host.origin();
    const inverse = origin ? invert(origin) : null;
    if (!inverse) return;
    const next: StudioPlacement = {
      position: transformPoint(inverse, fields.p),
      forward: isVec3(fields.f) ? rotateDirection(inverse, fields.f) : null,
      up: isVec3(fields.u) ? rotateDirection(inverse, fields.u) : null,
    };
    if (samePlacement(store.getPlacement(assetId), next)) return;
    store.place(
      assetId,
      next.position,
      next.forward ?? undefined,
      next.up ?? undefined,
      "remote"
    );
  }

  protected unsharedKeys(): string[] {
    // Only taps in the shared frame: a placement still in the store from
    // before the session is a world point.
    const store = this.store;
    return [...this.unsent].filter((id) => !!store?.isPlaced(id));
  }

  protected defaultFields(): Fields | null {
    return null;
  }

  adopt(): Map<string, Fields> {
    return this.host.origin() ? super.adopt() : new Map();
  }

  reconcile(): void {
    if (!this.store || !this.host.origin()) return;
    super.reconcile();
  }
}

/** `scene:current` = `{ sceneId, n }`, under the one key "". */
class StudioNavigationBridge extends StudioStoreBridge<StudioRoomSceneStore> {
  readonly prefix = STUDIO_COLOCATION_CURRENT_SCENE_ENTITY;

  protected subscribeTo(
    store: StudioRoomSceneStore,
    listener: StudioStoreChangeListener
  ) {
    return store.subscribeChanges(listener);
  }

  protected describe(): void {}

  protected encode(key: string): Fields | null {
    const value = key === "" ? this.store?.get() : undefined;
    return value ? { sceneId: value.sceneId, n: value.n ?? 0 } : null;
  }

  protected apply(key: string, fields: Fields): void {
    const { sceneId, n } = fields;
    if (
      key !== "" ||
      typeof sceneId !== "string" ||
      !sceneId ||
      typeof n !== "number" ||
      !Number.isFinite(n)
    ) {
      return;
    }
    this.store?.set({ sceneId, n }, "remote");
  }

  protected unsharedKeys(): string[] {
    return this.store ? [""] : [];
  }

  protected defaultFields(): Fields | null {
    return null;
  }

  reconcile(): void {
    // The host writes the room's scene again whenever the room has none, as it
    // does the origin.
    if (this.store && this.host.isHost() && !this.host.row(this.prefix)) {
      this.unsent.add("");
    }
    super.reconcile();
  }
}

type Bridge =
  | StudioVariableBridge
  | StudioVisibilityBridge
  | StudioPlacementBridge
  | StudioNavigationBridge;

/**
 * A shared session's scene state over the room's replication client: one
 * bridge per store, one outbox for their writes. Created with the client and
 * disposed with it; the stores it bridges follow the scene on screen. Drags
 * write outside the outbox, in the half of the relay's rate it leaves them.
 */
export class StudioSharedState {
  private readonly outbox: StudioReplicationOutbox;
  private readonly variables: StudioVariableBridge;
  private readonly visibility: StudioVisibilityBridge;
  private readonly placement: StudioPlacementBridge;
  private readonly navigation: StudioNavigationBridge;
  private readonly bridges: Bridge[];
  private readonly drags: StudioDragBridge;
  private readonly events: StudioEventRing;
  private readonly now: () => number;
  private readonly unsubscribe: () => void;

  private synced = false;
  private everSynced = false;
  private disposed = false;
  private peerId = "";
  /** Row versions last handed to a bridge, so an unchanged row is not decoded again. */
  private versions = new Map<string, number>();
  /**
   * When each row deleted with the scene this device left was deleted. Until
   * the delete comes back, the scene entered next, even the same one again,
   * must not take the row.
   */
  private removing = new Map<string, number>();
  private sweepTimer: ReturnType<typeof setTimeout> | null = null;
  private warned = new Set<string>();

  constructor(
    private client: StudioReplicationPort,
    private context: StudioSharedStateContext,
    options: StudioOutboxOptions = {}
  ) {
    this.now = options.now ?? (() => Date.now());
    this.outbox = new StudioReplicationOutbox(
      (id, fields) => this.send(id, fields),
      options
    );
    const host: BridgeHost = {
      isSynced: () => this.synced,
      isHost: () => this.context.role === "host",
      write: (id, fields) => {
        // The write replaces a queued delete, or is ordered after a sent one.
        this.removing.delete(id);
        this.outbox.write(id, fields);
      },
      isQueued: (id) => this.outbox.isQueued(id),
      rows: (prefix) => this.rows(prefix),
      row: (id) => this.client.get(id)?.fields,
      origin: () => this.context.origin(),
      scheduleSweep: () => this.scheduleSweep(),
    };
    this.variables = new StudioVariableBridge(host);
    this.visibility = new StudioVisibilityBridge(host);
    this.placement = new StudioPlacementBridge(host);
    this.navigation = new StudioNavigationBridge(host);
    this.bridges = [
      this.variables,
      this.visibility,
      this.placement,
      this.navigation,
    ];
    this.drags = new StudioDragBridge({
      isSynced: () => this.synced,
      localPeerId: () => this.client.localPeerId,
      claim: (id) => {
        this.removing.delete(id);
        this.client.claim(id);
      },
      release: (id) => this.client.release(id),
      set: (id, fields) => this.client.set(id, fields),
      remove: (id) => this.client.delete(id),
      entity: (id) => this.client.get(id),
      entities: (prefix) =>
        this.client
          .getEntities()
          .filter((e) => e.id.startsWith(prefix) && !this.removing.has(e.id)),
      origin: () => this.context.origin(),
      worldToLocation: () => this.context.worldToLocation?.() ?? null,
      now: this.now,
    });
    this.events = new StudioEventRing({
      isSynced: () => this.synced,
      localPeerId: () => this.client.localPeerId,
      write: (id, fields) => this.outbox.write(id, fields),
      now: this.now,
    });
    this.unsubscribe = client.subscribe(this.handleChange);
    this.handleChange();
  }

  /** The scene on screen, its stores and hooks; null stops sharing them. */
  bindScene(
    sceneData: StudioSceneResponse | null,
    stores: StudioSharedSceneStores | null,
    hooks: StudioSharedSceneHooks | null = null
  ): void {
    this.variables.bind(stores?.variables ?? null, sceneData);
    this.visibility.bind(stores?.visibility ?? null, sceneData);
    this.placement.bind(stores?.placement ?? null, sceneData);
    this.drags.bind(stores?.drags ?? null, sceneData);
    this.events.bind(
      sceneData && stores
        ? {
            sceneId: sceneData.scene.id,
            playAnimation: hooks?.playAnimation,
            sounds: stores.sounds ?? null,
            audioUrls: sceneAudioUrls(sceneData),
          }
        : null
    );
  }

  /** This session's copy of the room's scene, for its whole life. */
  bindNavigation(store: StudioRoomSceneStore | null): void {
    this.navigation.bind(store, null);
  }

  /** A trigger on this device, played by the room's others. */
  emitAnimation(sceneId: string, assetId: string, key: string): void {
    this.events.emit({ kind: "animation", sceneId, assetId, key });
  }

  /**
   * This device took the room from `sceneData` to another scene: its rows go,
   * as the scene's own state does when it is left alone. Paced like writes.
   */
  removeSceneRows(sceneData: StudioSceneResponse): void {
    if (!this.synced) return;
    for (const asset of sceneData.assets ?? []) {
      for (const prefix of SCENE_ROW_PREFIXES) {
        const id = prefix + asset?.id;
        if (!this.client.get(id)) continue;
        this.removing.set(id, this.now());
        this.outbox.remove(id);
      }
    }
    if (this.removing.size > 0) this.scheduleSweep();
  }

  /** The scene origin changed, so every placement and drag row converts differently. */
  refreshFrame(): void {
    if (!this.synced) return;
    this.placement.reconcile();
    this.drags.refresh();
  }

  handleReject(rejection: ViroReplicationRejection): void {
    // A refused origin ends the session before this runs.
    if (this.disposed) return;
    const current = rejection.current;
    if (current) this.removing.delete(current.id);
    if (current?.id.startsWith(STUDIO_DRAG_PREFIX)) {
      this.versions.set(current.id, current.version);
      this.drags.rejected(
        current.id.slice(STUDIO_DRAG_PREFIX.length),
        rejection.reason,
        current
      );
      return;
    }
    if (current) {
      const bridge = this.bridgeFor(current.id);
      if (!bridge) return;
      this.versions.set(current.id, current.version);
      bridge.rejected(current.id.slice(bridge.prefix.length), current.fields);
      return;
    }
    if (
      SIZE_REFUSALS.has(rejection.reason) &&
      !this.warned.has(rejection.reason)
    ) {
      this.warned.add(rejection.reason);
      console.warn(
        `[Studio] The shared session refused a change (${rejection.reason}); this device may show state the others do not.`
      );
    }
  }

  dispose(): void {
    this.disposed = true;
    this.unsubscribe();
    this.outbox.dispose();
    this.cancelSweep();
    this.bridges.forEach((b) => b.dispose());
    this.drags.dispose();
    this.events.dispose();
    this.synced = false;
  }

  private handleChange = (): void => {
    if (this.client.state !== "synced") {
      if (this.synced) this.unsync();
      return;
    }
    const entities = this.client.getEntities();
    const peerId = this.client.localPeerId;
    if (!this.synced || peerId !== this.peerId) {
      if (this.synced) this.unsync();
      const first = !this.everSynced;
      this.everSynced = true;
      this.synced = true;
      this.peerId = peerId;
      this.versions.clear();
      for (const e of entities) {
        if (this.tracked(e.id)) this.versions.set(e.id, e.version);
        // What the room did before this welcome is not replayed.
        if (e.id.startsWith(STUDIO_EVENT_PREFIX)) this.events.seen(e.fields);
      }
      this.bridges.forEach((b) => b.sync(first));
      this.drags.sync();
      return;
    }
    const present = new Set<string>();
    for (const e of entities) {
      if (!this.tracked(e.id)) continue;
      present.add(e.id);
      const seen = this.versions.get(e.id);
      if (seen === e.version) continue;
      this.versions.set(e.id, e.version);
      // Ordered before this device's delete, so it goes with it.
      if (this.removing.has(e.id)) continue;
      this.deliver(e, e.version > (seen ?? 0) + 1);
    }
    for (const id of this.versions.keys()) {
      if (present.has(id)) continue;
      this.versions.delete(id);
      if (id.startsWith(STUDIO_DRAG_PREFIX)) {
        this.drags.removed(id.slice(STUDIO_DRAG_PREFIX.length));
      }
    }
    for (const id of this.removing.keys()) {
      if (!present.has(id)) this.removing.delete(id);
    }
  };

  private deliver(e: ViroReplicatedEntity, skipped: boolean): void {
    if (e.id.startsWith(STUDIO_DRAG_PREFIX)) {
      this.drags.receive(e.id.slice(STUDIO_DRAG_PREFIX.length), e);
    } else if (e.id.startsWith(STUDIO_EVENT_PREFIX)) {
      if (skipped) this.events.seen(e.fields);
      else this.events.receive(e.fields);
    } else {
      const bridge = this.bridgeFor(e.id)!;
      bridge.receive(e.id.slice(bridge.prefix.length), e.fields, skipped);
    }
  }

  /** A delete not seen back by then was refused or lost, so the room's row stands. */
  private expireRemovals(cutoff: number): boolean {
    for (const [id, at] of this.removing) {
      if (at > cutoff) continue;
      this.removing.delete(id);
      const e = this.client.get(id);
      if (e) this.deliver(e, true);
    }
    return this.removing.size > 0;
  }

  private unsync(): void {
    this.synced = false;
    this.removing.clear();
    const queued = this.outbox.clear();
    this.cancelSweep();
    this.bridges.forEach((b) => b.unsynced(queued));
    this.drags.unsynced();
  }

  private send(id: string, fields: Fields | null): void {
    if (fields === null) {
      this.client.delete(id);
      return;
    }
    this.client.set(id, fields);
    const bridge = this.bridgeFor(id);
    bridge?.sent(id.slice(bridge.prefix.length), fields, this.now());
  }

  private rows(prefix: string): Map<string, Fields> {
    const rows = new Map<string, Fields>();
    for (const e of this.client.getEntities()) {
      if (e.id.startsWith(prefix) && !this.removing.has(e.id))
        rows.set(e.id.slice(prefix.length), e.fields);
    }
    return rows;
  }

  private bridgeFor(id: string): Bridge | undefined {
    return this.bridges.find((b) => id.startsWith(b.prefix));
  }

  private tracked(id: string): boolean {
    return (
      !!this.bridgeFor(id) ||
      id.startsWith(STUDIO_DRAG_PREFIX) ||
      id.startsWith(STUDIO_EVENT_PREFIX)
    );
  }

  private scheduleSweep(): void {
    if (this.sweepTimer !== null) return;
    this.sweepTimer = setTimeout(() => {
      this.sweepTimer = null;
      const cutoff = this.now() - STUDIO_SHARED_PENDING_TIMEOUT_MS;
      let remaining = this.expireRemovals(cutoff);
      this.bridges.forEach((b) => {
        if (b.expire(cutoff)) remaining = true;
      });
      if (remaining) this.scheduleSweep();
    }, STUDIO_SHARED_PENDING_TIMEOUT_MS);
  }

  private cancelSweep(): void {
    if (this.sweepTimer !== null) clearTimeout(this.sweepTimer);
    this.sweepTimer = null;
  }
}
