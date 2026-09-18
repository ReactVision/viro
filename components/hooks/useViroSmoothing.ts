/**
 * Copyright © 2026 ReactVision
 *
 * @providesModule useViroSmoothing
 */

"use strict";

import { useEffect, useRef, useState } from "react";
import {
  approachFactor,
  approachQuat,
  approachVec3,
  DEFAULT_SNAP_EPSILON,
  isQuat,
  isVec3,
} from "../AR/ViroSmoothing";
import type { ViroColocationPeer } from "../AR/ViroColocation";
import type { ViroReplicatedEntity } from "../AR/ViroReplication";

export type ViroSmoothingOptions = {
  /**
   * Time to cover half the remaining distance. Lower tracks harder and keeps
   * more of the step; higher glides and trails further behind.
   *
   * The default is deliberately short. Smoothing trades lag for continuity, and
   * a peer marker is a safety cue rather than decoration: at 35 ms the rendered
   * position sits roughly 50 ms behind a continuously moving target, which buys
   * the removal of the 100 ms jumps that make a marker read as unreliable.
   */
  halfLifeMs?: number;
  /** Distance below which the value is set to the target outright. */
  snapEpsilon?: number;
  /** Set false to pass targets straight through, with no frame loop at all. */
  enabled?: boolean;
};

/** Which fields of an entity are worth smoothing, and what they hold. */
export type ViroSmoothedFields = Record<string, "vec3" | "quat">;

export type ViroEntitySmoothingOptions = ViroSmoothingOptions & {
  /**
   * This device's peer id, from `useViroReplicatedState`.
   *
   * Entities it owns are passed straight through. Smoothing exists to hide the
   * gap between one peer's writes and the next, and there is no gap in what
   * this device is holding: the renderer is already moving the node under the
   * finger every frame, and the values arriving are its own writes coming
   * back. Blending them only puts the rendered position behind the hand, which
   * is visible as the object trailing and snapping back on a fast drag.
   */
  localPeerId?: string;
};

const DEFAULT_HALF_LIFE_MS = 35;

/**
 * Drive a blend toward the latest target every frame.
 *
 * Timing comes from the frame callback and nothing else. A pose carries the
 * sender's clock, device clocks are not synchronised, and differencing one
 * against the local clock is what makes the device with the longer uptime
 * flicker while the other never settles.
 *
 * The loop runs whenever this is enabled, because a frame of arithmetic over a
 * handful of entries costs nothing. What is gated is the state update, which is
 * the part that re-renders every consumer, so a still room is free.
 */
function useSmoothedList<T>(
  targets: T[],
  keyOf: (item: T) => string,
  blend: (previous: T, target: T, factor: number, snapEpsilon: number) => T,
  options?: ViroSmoothingOptions
): T[] {
  const {
    halfLifeMs = DEFAULT_HALF_LIFE_MS,
    snapEpsilon = DEFAULT_SNAP_EPSILON,
    enabled = true,
  } = options ?? {};

  const [smoothed, setSmoothed] = useState<T[]>(targets);
  const targetsRef = useRef(targets);
  useEffect(() => {
    targetsRef.current = targets;
  });
  const currentRef = useRef(new Map<string, T>());
  const emittedRef = useRef<T[]>([]);

  useEffect(() => {
    if (!enabled) return;
    let frame = 0;
    let last = 0;
    let cancelled = false;

    const tick = (nowMs: number) => {
      if (cancelled) return;
      const factor = approachFactor(last ? nowMs - last : 16, halfLifeMs);
      last = nowMs;

      const live = targetsRef.current;
      const map = currentRef.current;
      const next = live.map((target) => {
        const key = keyOf(target);
        // Someone who just joined is adopted where they are. Blending them in
        // from nothing would fly their marker across the room on arrival.
        const previous = map.get(key);
        const value =
          previous === undefined
            ? target
            : blend(previous, target, factor, snapEpsilon);
        map.set(key, value);
        return value;
      });

      if (map.size > live.length) {
        const present = new Set(live.map(keyOf));
        for (const key of [...map.keys()])
          if (!present.has(key)) map.delete(key);
      }

      // Reference equality throughout: the approach helpers hand back the
      // target itself once it is reached, so a settled list produces the same
      // references every frame and never reaches setState.
      const previous = emittedRef.current;
      const changed =
        next.length !== previous.length ||
        next.some((v, i) => v !== previous[i]);
      if (changed) {
        emittedRef.current = next;
        setSmoothed(next);
      }
      frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
    };
  }, [enabled, halfLifeMs, snapEpsilon, keyOf, blend]);

  return enabled ? smoothed : targets;
}

function peerKey(peer: ViroColocationPeer): string {
  return peer.peerId;
}

function blendPeer(
  previous: ViroColocationPeer,
  target: ViroColocationPeer,
  factor: number,
  snapEpsilon: number
): ViroColocationPeer {
  const position = approachVec3(
    previous.position,
    target.position,
    factor,
    snapEpsilon
  );
  const rotation = approachQuat(
    previous.rotation,
    target.rotation,
    factor,
    snapEpsilon
  );
  if (position === target.position && rotation === target.rotation)
    return target;
  return { ...target, position, rotation };
}

/**
 * Glide peer markers between poses instead of stepping between them.
 *
 * Poses go out at `poseSendHz`, 20 by default, so an unsmoothed marker moves in
 * 50 ms jumps. That rate was chosen on the assumption that receivers
 * interpolate, which is this.
 *
 * ```tsx
 * const { peers } = useViroColocation({ roomId, apiKey, projectId });
 * const smoothPeers = useViroSmoothedPeers(peers);
 * ```
 *
 * Updates land at frame rate while anyone is moving, so call it in the
 * component that draws the markers rather than one that draws the whole scene.
 */
export function useViroSmoothedPeers(
  peers: ViroColocationPeer[],
  options?: ViroSmoothingOptions
): ViroColocationPeer[] {
  return useSmoothedList(peers, peerKey, blendPeer, options);
}

function entityKey(entity: ViroReplicatedEntity): string {
  return entity.id;
}

/**
 * Glide replicated transforms between writes instead of stepping between them.
 *
 * Only the named fields are touched, because an entity holds whatever the app
 * put in it and a score or a step index must not be averaged on its way to the
 * screen. Anything that is not the shape its entry claims is passed through.
 *
 * ```tsx
 * const { entities } = useViroReplicatedState({ roomId, apiKey, projectId });
 * const smooth = useViroSmoothedEntities(entities, { position: "vec3" });
 * ```
 *
 * Pass `localPeerId` whenever anything here can be dragged: what this device
 * owns is then left alone, which is the half of the contract that keeps a drag
 * tracking the hand.
 */
export function useViroSmoothedEntities(
  entities: ViroReplicatedEntity[],
  fields: ViroSmoothedFields,
  options?: ViroEntitySmoothingOptions
): ViroReplicatedEntity[] {
  const fieldsRef = useRef(fields);
  const localPeerIdRef = useRef(options?.localPeerId);
  useEffect(() => {
    fieldsRef.current = fields;
    localPeerIdRef.current = options?.localPeerId;
  });

  const blend = useRef(
    (
      previous: ViroReplicatedEntity,
      target: ViroReplicatedEntity,
      factor: number,
      snapEpsilon: number
    ): ViroReplicatedEntity => {
      const mine = localPeerIdRef.current;
      if (mine && target.owner === mine) return target;

      let moved: Record<string, unknown> | undefined;
      for (const name of Object.keys(fieldsRef.current)) {
        const kind = fieldsRef.current[name];
        const to = target.fields[name];
        const from = previous.fields[name];
        let value: unknown;
        if (kind === "vec3" && isVec3(from) && isVec3(to)) {
          value = approachVec3(from, to, factor, snapEpsilon);
        } else if (kind === "quat" && isQuat(from) && isQuat(to)) {
          value = approachQuat(from, to, factor, snapEpsilon);
        } else {
          continue;
        }
        if (value === to) continue;
        moved = moved ?? { ...target.fields };
        moved[name] = value;
      }
      return moved ? { ...target, fields: moved } : target;
    }
  ).current;

  return useSmoothedList(entities, entityKey, blend, options);
}
