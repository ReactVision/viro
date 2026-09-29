import type {
  StudioSoundCommand,
  StudioSoundManager,
} from "../domain/soundManager";
import type {
  StudioSceneFunction,
  StudioSceneResponse,
  StudioSequence,
} from "../types";
import { isVec3 } from "./frameMath";

export const STUDIO_EVENT_PREFIX = "evt:";
export const STUDIO_EVENT_SLOTS = 16;
/** How long an event for a scene this device is still loading waits for it. */
export const STUDIO_EVENT_WAIT_MS = 10000;

/** An effect every device repeats; the function that caused it runs on one. */
export type StudioSharedEvent =
  | { kind: "animation"; sceneId: string; assetId: string; key: string }
  | ({ kind: "sound"; sceneId: string } & StudioSoundCommand);

export type StudioEventTarget = {
  sceneId: string;
  /** Plays without the animation's on_start or on_finish. */
  playAnimation?: (assetId: string, key: string) => void;
  sounds?: StudioSoundManager | null;
  /** The clips the scene's functions play. */
  audioUrls: ReadonlySet<string>;
};

export type StudioEventHost = {
  isSynced(): boolean;
  localPeerId(): string;
  write(id: string, fields: Record<string, unknown>): void;
  now(): number;
};

type Fields = Record<string, unknown>;

const MAX_DEPTH = 16;

/** Every clip a scene's functions can play, however deeply nested. */
export function sceneAudioUrls(
  sceneData: StudioSceneResponse | null
): Set<string> {
  const urls = new Set<string>();
  const visitSequence = (
    sequence: StudioSequence | null | undefined,
    depth: number
  ) => {
    for (const step of sequence?.steps ?? []) visit(step.function, depth + 1);
  };
  const visit = (
    fn: StudioSceneFunction | null | undefined,
    depth: number
  ): void => {
    if (!fn || depth > MAX_DEPTH) return;
    if (fn.scene_sound?.audio_url) urls.add(fn.scene_sound.audio_url);
    visitSequence(fn.scene_sequence, depth);
    for (const condition of fn.scene_branch?.conditions ?? []) {
      visitSequence(condition.sequence, depth);
    }
    visitSequence(fn.scene_branch?.no_match_sequence, depth);
    for (const lane of fn.scene_group?.lanes ?? []) {
      visitSequence(lane.sequence, depth);
    }
    visitSequence(fn.scene_api_request?.success_sequence, depth);
    visitSequence(fn.scene_api_request?.failure_sequence, depth);
  };
  for (const fn of sceneData?.functions ?? []) visit(fn, 0);
  for (const asset of sceneData?.assets ?? []) visit(asset?.scene_function, 0);
  for (const binding of [
    ...(sceneData?.collision_bindings ?? []),
    ...(sceneData?.proximity_bindings ?? []),
    ...(sceneData?.gaze_bindings ?? []),
  ]) {
    visit(binding?.scene_function, 0);
  }
  return urls;
}

/**
 * Every key the event's kind has, nulls included: a set merges into whatever
 * the slot held before, and a key left out would keep an older event's value.
 */
function encode(event: StudioSharedEvent): Fields {
  switch (event.kind) {
    case "animation":
      return {
        kind: "animation",
        sceneId: event.sceneId,
        assetId: event.assetId,
        key: event.key,
      };
    case "sound":
      return event.action === "play"
        ? {
            kind: "sound",
            sceneId: event.sceneId,
            action: "play",
            audioAssetId: event.audioAssetId,
            url: event.url,
            position: event.position ?? null,
            volume: event.volume,
            loop: event.loop,
            stopOthers: event.stopOthers,
          }
        : {
            kind: "sound",
            sceneId: event.sceneId,
            action: "stop",
            audioAssetId: event.audioAssetId,
          };
    default: {
      const unknown: never = event;
      throw new Error(`Unknown shared event ${JSON.stringify(unknown)}`);
    }
  }
}

function decode(fields: Fields): StudioSharedEvent | null {
  const { kind, sceneId } = fields;
  if (typeof sceneId !== "string") return null;
  if (kind === "animation") {
    const { assetId, key } = fields;
    if (typeof assetId !== "string" || typeof key !== "string") return null;
    return { kind, sceneId, assetId, key };
  }
  if (kind !== "sound") return null;
  if (fields.action === "stop") {
    const { audioAssetId } = fields;
    if (audioAssetId !== null && typeof audioAssetId !== "string") return null;
    return { kind, sceneId, action: "stop", audioAssetId };
  }
  const { audioAssetId, url, position, volume, loop, stopOthers } = fields;
  if (
    fields.action !== "play" ||
    typeof audioAssetId !== "string" ||
    typeof url !== "string" ||
    typeof volume !== "number" ||
    !Number.isFinite(volume) ||
    typeof loop !== "boolean" ||
    typeof stopOthers !== "boolean" ||
    (position !== null && !isVec3(position))
  ) {
    return null;
  }
  return {
    kind,
    sceneId,
    action: "play",
    audioAssetId,
    url,
    ...(position ? { position } : {}),
    volume,
    loop,
    stopOthers,
  };
}

function eventNumber(fields: Fields): number | null {
  const { n } = fields;
  return typeof n === "number" && Number.isFinite(n) ? n : null;
}

/**
 * `evt:<slot>`: a ring of 16 rows holding the room's latest animation triggers
 * and sound commands. An event goes into slot `n % 16`, `n` one past the
 * newest this device has seen, and each accepted write to a slot fires once on
 * every other device. A welcome or snapshot only marks the slots seen, so a
 * device that joins or reconnects replays nothing and gets the resulting state
 * from the other rows.
 */
export class StudioEventRing {
  private target: StudioEventTarget | null = null;
  private unsubscribeSounds: (() => void) | null = null;
  private newest = 0;
  /** Events for a scene this device is on its way to, until it attaches. */
  private waiting: Array<{ event: StudioSharedEvent; n: number; at: number }> =
    [];

  constructor(private host: StudioEventHost) {}

  bind(target: StudioEventTarget | null): void {
    const sounds = target?.sounds ?? null;
    if (sounds !== (this.target?.sounds ?? null)) {
      this.unsubscribeSounds?.();
      this.unsubscribeSounds = sounds
        ? sounds.subscribeCommands((command, origin) => {
            const sceneId = this.target?.sceneId;
            if (origin === "local" && sceneId) {
              this.emit({ kind: "sound", sceneId, ...command });
            }
          })
        : null;
    }
    this.target = target;
    if (!target) return;
    const cutoff = this.host.now() - STUDIO_EVENT_WAIT_MS;
    const due = this.waiting
      .filter((w) => w.event.sceneId === target.sceneId && w.at >= cutoff)
      .sort((a, b) => a.n - b.n);
    this.waiting = [];
    due.forEach((w) => this.fire(target, w.event));
  }

  emit(event: StudioSharedEvent): void {
    if (!this.host.isSynced()) return;
    const n = ++this.newest;
    this.host.write(`${STUDIO_EVENT_PREFIX}${n % STUDIO_EVENT_SLOTS}`, {
      ...encode(event),
      n,
      from: this.host.localPeerId(),
    });
  }

  /** An accepted write to a slot, in the room's order. */
  receive(fields: Fields): void {
    const n = eventNumber(fields);
    if (n === null) return;
    this.newest = Math.max(this.newest, n);
    if (fields.from === this.host.localPeerId()) return;
    const event = decode(fields);
    if (!event) return;
    const target = this.target;
    if (target && event.sceneId === target.sceneId) {
      this.fire(target, event);
      return;
    }
    const cutoff = this.host.now() - STUDIO_EVENT_WAIT_MS;
    this.waiting = this.waiting
      .filter((w) => w.at >= cutoff)
      .concat({ event, n, at: this.host.now() })
      .slice(-STUDIO_EVENT_SLOTS);
  }

  /** A slot whose writes in between went unseen: counted, not fired. */
  seen(fields: Fields): void {
    const n = eventNumber(fields);
    if (n !== null) this.newest = Math.max(this.newest, n);
  }

  dispose(): void {
    this.unsubscribeSounds?.();
    this.unsubscribeSounds = null;
    this.target = null;
    this.waiting = [];
  }

  private fire(target: StudioEventTarget, event: StudioSharedEvent): void {
    switch (event.kind) {
      case "animation":
        target.playAnimation?.(event.assetId, event.key);
        return;
      case "sound": {
        const sounds = target.sounds;
        if (!sounds) return;
        if (event.action === "stop") {
          sounds.stop(event.audioAssetId, "remote");
          return;
        }
        // Any peer can write a slot, and a PLAY has every device fetch its
        // URL, so only a clip the scene itself plays is played.
        if (!target.audioUrls.has(event.url)) return;
        sounds.play(
          {
            audioAssetId: event.audioAssetId,
            url: event.url,
            position: event.position,
            volume: event.volume,
            loop: event.loop,
            stopOthers: event.stopOthers,
          },
          undefined,
          "remote"
        );
        return;
      }
      default: {
        const unknown: never = event;
        console.warn(
          `[Studio] Unknown shared event ${JSON.stringify(unknown)}`
        );
      }
    }
  }
}
