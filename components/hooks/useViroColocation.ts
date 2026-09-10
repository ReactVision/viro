/**
 * Copyright © 2026 ReactVision
 *
 * @providesModule useViroColocation
 */

"use strict";

import { useEffect, useRef, useState } from "react";
import {
  getColocationPeers,
  getColocationState,
  isColocationAvailable,
  joinColocation,
  leaveColocation,
  setColocationLocalPose,
  type ViroColocationConfig,
  type ViroColocationPeer,
  type ViroColocationState,
} from "../AR/ViroColocation";

export type UseViroColocationResult = {
  /** False when the channel is unavailable on this build or platform. */
  available: boolean;
  state: ViroColocationState;
  /** This device's server-assigned id. Empty until joined. */
  localPeerId: string;
  peers: ViroColocationPeer[];
  error?: string;
  /** Publish the local pose, in the location frame, as a column-major CSV. */
  publishPose: (locationFramePoseCsv: string) => void;
};

export type UseViroColocationOptions = ViroColocationConfig & {
  /**
   * Set false to stay out of the room — useful while the frame is still being
   * established, since there is nothing meaningful to publish before then.
   */
  enabled?: boolean;
  /**
   * How often peers are read back, in ms. Peers arrive on a socket thread and
   * are polled rather than pushed: this codebase has no live event path from a
   * native module to JS, and 10 Hz of a small array is cheaper than building
   * one. Swappable for events later without changing this hook's API.
   */
  pollMs?: number;
};

/**
 * Join a co-location room and track its peers.
 *
 * ```tsx
 * const { peers, publishPose } = useViroColocation({
 *   roomId: cloudAnchorId, apiKey, projectId,
 *   enabled: frameReady,
 * });
 * ```
 *
 * Poses on this channel are **location-frame** coordinates. Convert before
 * publishing and after receiving — see `ViroLocationFrame`.
 */
export function useViroColocation(
  options: UseViroColocationOptions
): UseViroColocationResult {
  const { roomId, apiKey, projectId, endpoint, enabled = true, pollMs = 100 } = options;

  const [available, setAvailable] = useState(false);
  const [state, setState] = useState<ViroColocationState>("idle");
  const [localPeerId, setLocalPeerId] = useState("");
  const [peers, setPeers] = useState<ViroColocationPeer[]>([]);
  const [error, setError] = useState<string | undefined>();

  // Guards every async continuation: joining and polling both outlive an
  // unmount, and a room switch has to invalidate the previous join's result.
  const activeRoom = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | undefined;

    const run = async () => {
      const ok = await isColocationAvailable();
      if (cancelled) return;
      setAvailable(ok);
      if (!ok || !enabled || !roomId) return;

      activeRoom.current = roomId;
      const result = await joinColocation({ roomId, apiKey, projectId, endpoint });
      if (cancelled || activeRoom.current !== roomId) return;

      if (!result.success) {
        setError(result.error ?? "Join failed");
        setState("failed");
        return;
      }
      setError(undefined);

      timer = setInterval(async () => {
        const [s, p] = await Promise.all([getColocationState(), getColocationPeers()]);
        if (cancelled || activeRoom.current !== roomId) return;
        setState(s.state);
        setLocalPeerId(s.localPeerId);
        setPeers(p);
      }, pollMs);
    };

    run();

    return () => {
      cancelled = true;
      activeRoom.current = null;
      if (timer) clearInterval(timer);
      // Leaving on unmount is right even mid-join: the native session is
      // process-wide, so a stale membership would outlive the component.
      leaveColocation();
      setPeers([]);
      setLocalPeerId("");
      setState("idle");
    };
  }, [roomId, apiKey, projectId, endpoint, enabled, pollMs]);

  return {
    available,
    state,
    localPeerId,
    peers,
    error,
    publishPose: setColocationLocalPose,
  };
}
