/**
 * Copyright © 2026 ReactVision
 *
 * @providesModule useViroReplicatedState
 */

"use strict";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ViroReplicationClient,
  type ViroReplicatedEntity,
  type ViroReplicationConfig,
  type ViroReplicationRejection,
  type ViroReplicationState,
  type ViroWriteOptions,
} from "../AR/ViroReplication";
import type { ViroVPSCredentialsRequest } from "../AR/ViroVPSClient";
import { useCredentialsKey } from "./useCredentialsKey";

export type UseViroReplicatedStateOptions = ViroReplicationConfig & {
  /** Set false to stay disconnected — typically until the frame is established. */
  enabled?: boolean;
  /** Called for every refused operation, with the server's current value. */
  onReject?: (rejection: ViroReplicationRejection) => void;
};

export type UseViroReplicatedStateResult = {
  state: ViroReplicationState;
  /** This device's server-assigned id. Empty until connected. */
  localPeerId: string;
  entities: ViroReplicatedEntity[];
  byId: (id: string) => ViroReplicatedEntity | undefined;
  error?: string;

  /** Take authority over an entity, creating it if needed. */
  claim: (id: string, opts?: ViroWriteOptions) => void;
  release: (id: string) => void;
  /** Merge fields. Only the owner may write to an owned entity. */
  set: (
    id: string,
    fields: Record<string, unknown>,
    opts?: ViroWriteOptions
  ) => void;
  remove: (id: string, opts?: ViroWriteOptions) => void;
  /**
   * Empty the room for everyone, whatever anyone is holding. Deleting entity by
   * entity cannot do this: an owned one refuses `not-owner`.
   */
  clear: () => void;
  /** True when this device holds authority over `id`. */
  isMine: (id: string) => boolean;
};

/**
 * Replicated room state, ordered and conflict-resolved by the server.
 *
 * ```tsx
 * const { entities, claim, set, isMine } = useViroReplicatedState({
 *   roomId: cloudAnchorId, apiKey, projectId,
 *   enabled: frameReady,
 * });
 *
 * // Grab it, then move it — while held, nobody else can.
 * claim('cube');
 * if (isMine('cube')) set('cube', { position: [0, 0, -1] }, { optimistic: true });
 *
 * // An app with its own sign-in: a user token in place of the key.
 * const credentials = useMemo(
 *   () => createUserTokenCredentials({ projectId, fetchToken }), [userId]);
 * useViroReplicatedState({ roomId: cloudAnchorId, credentials, enabled: frameReady });
 * ```
 *
 * The socket is closed and opened again when `credentials` is another
 * createUserTokenCredentials() object, or at its clear(). The handshake reads
 * the credentials again, so it fails when nobody is signed in by then.
 *
 * Positions stored here are **location-frame** coordinates, same as the
 * channel: world coordinates are per-session and mean nothing to a peer.
 */
export function useViroReplicatedState(
  options: UseViroReplicatedStateOptions
): UseViroReplicatedStateResult {
  const {
    roomId,
    apiKey,
    projectId,
    endpoint,
    headers,
    credentials,
    enabled = true,
    onReject,
  } = options;

  const client = useMemo(() => new ViroReplicationClient(), []);
  const [, force] = useState(0);

  // Kept in a ref so changing the handler does not tear down the connection.
  const rejectRef = useRef(onReject);
  rejectRef.current = onReject;
  // Same for the header provider, which the client calls again on every
  // reconnect anyway.
  const headersRef = useRef(headers);
  headersRef.current = headers;
  const hasHeaders = headers !== undefined;
  // Same for credentials, read through the ref so a reconnect uses the latest;
  // useCredentialsKey says when to connect again.
  const credentialsRef = useRef(credentials);
  credentialsRef.current = credentials;
  const [credentialsKey, credentialsCleared] = useCredentialsKey(credentials);

  useEffect(() => {
    client.onReject = (r) => rejectRef.current?.(r);
    const unsubscribe = client.subscribe(() => force((n) => n + 1));

    if (enabled && roomId) {
      client.connect({
        roomId,
        apiKey,
        projectId,
        endpoint,
        headers: hasHeaders ? () => headersRef.current?.() ?? {} : undefined,
        credentials: credentialsRef.current !== undefined
          ? (request?: ViroVPSCredentialsRequest) => {
              const current = credentialsRef.current!;
              return typeof current === "function" ? current(request) : current;
            }
          : undefined,
      } as ViroReplicationConfig);
    }

    return () => {
      unsubscribe();
      client.onReject = undefined;
      client.disconnect();
    };
  }, [client, roomId, apiKey, projectId, endpoint, hasHeaders, credentialsKey, credentialsCleared, enabled]);

  return {
    state: client.state,
    localPeerId: client.localPeerId,
    entities: client.getEntities(),
    byId: (id) => client.get(id),
    error: client.error,

    claim: (id, opts) => client.claim(id, opts),
    release: (id) => client.release(id),
    set: (id, fields, opts) => client.set(id, fields, opts),
    remove: (id, opts) => client.delete(id, opts),
    clear: () => client.clear(),
    isMine: (id) => {
      const e = client.get(id);
      return !!e && e.owner !== null && e.owner === client.localPeerId;
    },
  };
}
