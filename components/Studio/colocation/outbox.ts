import { VIRO_REPLICATION_WRITE_INTERVAL_MS } from "../../hooks/useViroThrottledWrite";

/**
 * Half the relay's 120 messages a second per peer, which closes the socket at
 * 1008 above it and refuses the credential for 30 s. The other half is for
 * drags, claims, releases and the scene origin.
 */
export const STUDIO_SHARED_WRITES_PER_SECOND = 60;
/** A host's first sync writes every changed row at once; this many go out unpaced. */
export const STUDIO_SHARED_WRITE_BURST = 30;

export type StudioOutboxOptions = {
  now?: () => number;
  intervalMs?: number;
  perSecond?: number;
  burst?: number;
};

/** Null fields delete the entity. */
export type StudioOutboxSend = (
  id: string,
  fields: Record<string, unknown> | null
) => void;

/**
 * Replicated writes, coalesced per entity: one goes out at once, and any made
 * within the next interval collapse into one trailing write of the latest value.
 * Across entities the rate is capped, so a burst queues rather than tripping
 * the relay's limit.
 */
export class StudioReplicationOutbox {
  private queue = new Map<string, Record<string, unknown> | null>();
  private lastSentAt = new Map<string, number>();
  private tokens: number;
  private refilledAt: number;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private flushing = false;
  private readonly now: () => number;
  private readonly intervalMs: number;
  private readonly perSecond: number;
  private readonly burst: number;

  constructor(
    private send: StudioOutboxSend,
    options: StudioOutboxOptions = {}
  ) {
    this.now = options.now ?? (() => Date.now());
    this.intervalMs = options.intervalMs ?? VIRO_REPLICATION_WRITE_INTERVAL_MS;
    this.perSecond = options.perSecond ?? STUDIO_SHARED_WRITES_PER_SECOND;
    this.burst = options.burst ?? STUDIO_SHARED_WRITE_BURST;
    this.tokens = this.burst;
    this.refilledAt = this.now();
  }

  /** A value already queued for `id` is replaced and keeps its place in line. */
  write(id: string, fields: Record<string, unknown>): void {
    this.enqueue(id, fields);
  }

  /** Paced like a write, and replaced by a later write to the same id. */
  remove(id: string): void {
    this.enqueue(id, null);
  }

  private enqueue(id: string, fields: Record<string, unknown> | null): void {
    this.queue.set(id, fields);
    // A send that writes again lands in the loop already running.
    if (this.flushing) return;
    this.cancelTimer();
    this.flush();
  }

  isQueued(id: string): boolean {
    return this.queue.has(id);
  }

  /** Returns the ids whose writes it dropped. */
  clear(): string[] {
    const dropped = [...this.queue.keys()];
    this.queue.clear();
    this.cancelTimer();
    return dropped;
  }

  dispose(): void {
    this.clear();
    this.lastSentAt.clear();
  }

  private flush = (): void => {
    this.timer = null;
    this.flushing = true;
    try {
      this.drain();
    } finally {
      this.flushing = false;
    }
  };

  private drain(): void {
    const now = this.now();
    this.tokens = Math.min(
      this.burst,
      this.tokens + ((now - this.refilledAt) * this.perSecond) / 1000
    );
    this.refilledAt = now;
    let waitMs = Infinity;
    for (const [id, fields] of this.queue) {
      const dueAt = (this.lastSentAt.get(id) ?? -Infinity) + this.intervalMs;
      if (dueAt > now) {
        waitMs = Math.min(waitMs, dueAt - now);
        continue;
      }
      if (this.tokens < 1) {
        waitMs = Math.min(waitMs, ((1 - this.tokens) * 1000) / this.perSecond);
        break;
      }
      this.tokens -= 1;
      this.queue.delete(id);
      this.lastSentAt.set(id, now);
      this.send(id, fields);
    }
    if (this.queue.size > 0 && waitMs < Infinity) {
      this.timer = setTimeout(this.flush, Math.max(1, Math.ceil(waitMs)));
    }
  }

  private cancelTimer(): void {
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null;
  }
}
