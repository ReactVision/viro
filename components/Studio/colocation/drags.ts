import type {
  ViroReplicatedEntity,
  ViroReplicationRejectReason,
} from "../../AR/ViroReplication";
import { VIRO_REPLICATION_WRITE_INTERVAL_MS } from "../../hooks/useViroThrottledWrite";
import type { StudioDragStore } from "../domain/dragStore";
import type { StudioSceneResponse } from "../types";
import {
  invert,
  isVec3,
  type Mat4,
  transformPoint,
  type Vec3,
} from "./frameMath";

export const STUDIO_DRAG_PREFIX = "drag:";

/**
 * The renderer reports a drag's moves and never its end, so this long without
 * a move ends it. Longer than a pause mid-drag, since the end gives up the claim.
 */
export const STUDIO_DRAG_IDLE_MS = 500;

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

type LocalDrag = {
  /** Location frame, not sent yet. */
  pending: Vec3 | null;
  lastSentAt: number;
  writeTimer: ReturnType<typeof setTimeout> | null;
  idleTimer: ReturnType<typeof setTimeout> | null;
  /** Another device held it first; this drag writes nothing. */
  refused: boolean;
};

function sameVec(a: Vec3, b: Vec3 | undefined): boolean {
  return !!b && a.every((v, i) => v === b[i]);
}

/**
 * `drag:<assetId>` = `{ p }` in the location frame. A drag here claims the row
 * at its first move, writes the position at most once per write interval and
 * releases the row when it ends; while another device holds a row this device
 * cannot drag that asset. The relay releases a departed peer's rows itself.
 *
 * Rows are applied to the scene's drag store, never to scene state, so a drag
 * elsewhere repaints only the node it moves.
 */
export class StudioDragBridge {
  private store: StudioDragStore | null = null;
  private unsubscribe: (() => void) | null = null;
  private shareable = new Set<string>();
  private drags = new Map<string, LocalDrag>();
  /** This device's last write per asset: its echo is where the node already is. */
  private written = new Map<string, Vec3>();

  constructor(
    private host: StudioDragHost,
    private intervalMs = VIRO_REPLICATION_WRITE_INTERVAL_MS,
    private idleMs = STUDIO_DRAG_IDLE_MS
  ) {}

  /** Draggable assets outside image markers, whose content stays per device. */
  bind(
    store: StudioDragStore | null,
    sceneData: StudioSceneResponse | null
  ): void {
    if (store !== this.store) {
      // The scene these drags were in is gone, and its rows with it.
      [...this.drags.keys()].forEach((assetId) => this.end(assetId, true));
      this.unsubscribe?.();
      this.unsubscribe = store ? store.subscribeMoves(this.onMove) : null;
      this.store = store;
    }
    this.shareable = new Set(
      (sceneData?.assets ?? [])
        .filter((a) => a?.is_draggable && !a.trigger_image_url)
        .map((a) => a.id)
    );
    if (this.host.isSynced()) this.adoptAll();
  }

  receive(assetId: string, entity: ViroReplicatedEntity): void {
    const drag = this.drags.get(assetId);
    // This device's own drag: the node is under the finger already.
    if (drag && !drag.refused) return;
    this.applyRow(assetId, entity, false);
  }

  removed(assetId: string): void {
    this.written.delete(assetId);
    if (this.shareable.has(assetId)) {
      this.store?.applyRemote(assetId, undefined, false);
    }
  }

  rejected(
    assetId: string,
    reason: ViroReplicationRejectReason,
    current: ViroReplicatedEntity | undefined
  ): void {
    if (reason !== "already-owned" && reason !== "not-owner") return;
    const drag = this.drags.get(assetId);
    if (drag) {
      drag.refused = true;
      drag.pending = null;
      if (drag.writeTimer) clearTimeout(drag.writeTimer);
      drag.writeTimer = null;
      this.applyRow(assetId, current, false);
      return;
    }
    // A drag too short to hear its refusal moved the node here alone.
    this.applyRow(assetId, current, true);
  }

  sync(): void {
    this.adoptAll();
  }

  /** The scene origin changed, so every row converts differently. */
  refresh(): void {
    if (this.host.isSynced()) this.adoptAll();
  }

  /** The relay released this device's rows with its socket. */
  unsynced(): void {
    this.drags.forEach((drag) => this.stopTimers(drag));
    this.drags.clear();
  }

  dispose(): void {
    this.unsynced();
    this.unsubscribe?.();
    this.unsubscribe = null;
    this.store = null;
    this.written.clear();
  }

  private onMove = (assetId: string, world: Vec3): void => {
    if (!this.host.isSynced() || !this.shareable.has(assetId)) return;
    const toLocation = this.host.worldToLocation();
    if (!toLocation || !this.host.origin()) return;
    let drag = this.drags.get(assetId);
    if (!drag) {
      // Held elsewhere, so a move that raced the lock: the renderer moved the
      // node anyway, and it goes back when the drag ends, as a refused one does.
      const refused = !!this.store?.isLocked(assetId);
      drag = {
        pending: null,
        lastSentAt: -Infinity,
        writeTimer: null,
        idleTimer: null,
        refused,
      };
      this.drags.set(assetId, drag);
      if (!refused) this.host.claim(STUDIO_DRAG_PREFIX + assetId);
    }
    if (drag.idleTimer) clearTimeout(drag.idleTimer);
    drag.idleTimer = setTimeout(() => this.end(assetId, false), this.idleMs);
    if (drag.refused) return;
    drag.pending = transformPoint(toLocation, world);
    this.schedule(assetId, drag);
  };

  private schedule(assetId: string, drag: LocalDrag): void {
    if (drag.writeTimer || !drag.pending) return;
    const wait = drag.lastSentAt + this.intervalMs - this.host.now();
    if (wait <= 0) {
      this.send(assetId, drag);
      return;
    }
    drag.writeTimer = setTimeout(() => {
      drag.writeTimer = null;
      this.send(assetId, drag);
    }, wait);
  }

  private send(assetId: string, drag: LocalDrag): void {
    const p = drag.pending;
    if (!p || drag.refused || !this.host.isSynced()) return;
    drag.pending = null;
    drag.lastSentAt = this.host.now();
    this.written.set(assetId, p);
    this.host.set(STUDIO_DRAG_PREFIX + assetId, { p });
  }

  /** The last position goes out before the release, which the relay orders after it. */
  private end(assetId: string, sceneGone: boolean): void {
    const drag = this.drags.get(assetId);
    if (!drag) return;
    this.drags.delete(assetId);
    this.stopTimers(drag);
    if (!this.host.isSynced()) return;
    const id = STUDIO_DRAG_PREFIX + assetId;
    if (drag.refused) {
      if (!sceneGone) this.applyRow(assetId, this.host.entity(id), true);
      return;
    }
    if (sceneGone) {
      this.written.delete(assetId);
      this.host.remove(id);
      return;
    }
    this.send(assetId, drag);
    this.host.release(id);
  }

  private stopTimers(drag: LocalDrag): void {
    if (drag.writeTimer) clearTimeout(drag.writeTimer);
    if (drag.idleTimer) clearTimeout(drag.idleTimer);
    drag.writeTimer = null;
    drag.idleTimer = null;
  }

  private adoptAll(): void {
    const present = new Set<string>();
    for (const entity of this.host.entities(STUDIO_DRAG_PREFIX)) {
      const assetId = entity.id.slice(STUDIO_DRAG_PREFIX.length);
      present.add(assetId);
      this.receive(assetId, entity);
    }
    this.shareable.forEach((assetId) => {
      if (!present.has(assetId) && !this.drags.has(assetId)) {
        this.removed(assetId);
      }
    });
  }

  /**
   * `force` repaints the room's position even where it has not changed: the
   * node was moved natively by a drag the room refused.
   */
  private applyRow(
    assetId: string,
    entity: ViroReplicatedEntity | undefined,
    force: boolean
  ): void {
    const store = this.store;
    if (!store || !this.shareable.has(assetId)) return;
    const owner = entity?.owner ?? null;
    const locked = owner !== null && owner !== this.host.localPeerId();
    const raw = entity?.fields.p;
    const p = isVec3(raw) ? raw : null;
    let position = store.getPosition(assetId);
    if (p && (force || !sameVec(p, this.written.get(assetId)))) {
      const origin = this.host.origin();
      const inverse = origin ? invert(origin) : null;
      if (!inverse) return;
      position = transformPoint(inverse, p);
    }
    store.applyRemote(assetId, position, locked, force);
  }
}
