/**
 * Copyright © 2026 ReactVision
 *
 * Credentials from a user token the app's backend mints with its secret key
 * (POST /functions/v1/app-user-tokens), kept between requests. viro asks for
 * credentials before every VPS request, a frame a second in server mode, and
 * the mint gives each app user at most 60 tokens an hour, so minting a token
 * per request fails within the first minute.
 */

"use strict";

import type { ViroVPSCredentialsRequest } from "./ViroVPSClient";
import { registerUserTokenSource, renewBeforeMs, tokenClaims } from "./ViroUserTokens";

/**
 * What `fetchToken` gives: the mint's answer as the backend passes it on, or
 * the token alone.
 */
export type ViroUserToken = string | { token: string; expires_in?: number };

export type ViroUserTokenCredentialsOptions = {
  /** The project the backend mints the tokens for. */
  projectId: string;
  /**
   * Asks the app's backend for a new token. Called when there is none, when
   * the one held is close to expiring, and when Studio has refused it.
   */
  fetchToken: () => Promise<ViroUserToken>;
};

/**
 * Pass as `credentials` to `<ViroVPS>`, uploadScanRecording() and the other
 * VPS calls, and to the co-location calls (joinColocation(), the room helpers
 * and ViroReplicationClient).
 */
export type ViroUserTokenCredentials = ((
  request?: ViroVPSCredentialsRequest
) => Promise<{ projectId: string; accessToken: string }>) & {
  /** Forgets the token, as at sign-out: the next request fetches a new one. */
  clear(): void;
};

type Held = { token: string; refreshAt: number; expiresAt: number };

/**
 * The token's lifetime in milliseconds: `expires_in`, else its own `exp`
 * minus `iat`. Both are spans on the server's clock, so a phone whose clock
 * is wrong still keeps the token the right length of time. Null when neither
 * is there.
 */
function lifetimeMs(answer: ViroUserToken, token: string): number | null {
  if (typeof answer === "object" && typeof answer.expires_in === "number" && answer.expires_in > 0) {
    return answer.expires_in * 1000;
  }
  const { exp, iat } = tokenClaims(token) ?? {};
  return typeof exp === "number" && typeof iat === "number" && exp > iat ? (exp - iat) * 1000 : null;
}

/**
 * Credentials that ask the app's backend for a user token only when they need
 * one: the first time, when less than two minutes (or a quarter of a shorter
 * token's life) is left, and when Studio or the VPS server refuses the token,
 * in which case viro sends the refused request once more with the new one.
 * Requests that need a token at the same time share one fetch. When a refresh
 * fails, the token held is used until it expires. A token with no lifetime in
 * the answer or in its claims is kept until it is refused.
 *
 * Make one per signed-in user, and call clear() at sign-out, or make a new
 * one for each user (`useMemo(..., [userId])`). `fetchToken` should read the
 * app's own session when it is called, not when this is made.
 *
 * ```tsx
 * const credentials = useMemo(
 *   () =>
 *     createUserTokenCredentials({
 *       projectId: PROJECT_ID,
 *       fetchToken: async () => {
 *         const r = await fetch("https://api.example.com/rv-token", {
 *           headers: { Authorization: `Bearer ${await getSessionToken()}` },
 *         });
 *         return r.json(); // { token, expires_in, ... } from app-user-tokens
 *       },
 *     }),
 *   [userId]
 * );
 * <ViroVPS arSceneNavigator={nav} credentials={credentials} />
 * ```
 */
export function createUserTokenCredentials(
  options: ViroUserTokenCredentialsOptions
): ViroUserTokenCredentials {
  let held: Held | null = null;
  let pending: Promise<Held> | null = null;
  // A fetch that began before clear() belongs to the user who signed out.
  let generation = 0;
  const listeners = new Set<(token: string | null) => void>();
  const notify = (token: string | null) =>
    listeners.forEach((listener) => {
      try {
        listener(token);
      } catch {
        // One listener's failure is not the fetch's.
      }
    });

  function fetchNew(): Promise<Held> {
    if (pending) return pending;
    const started = generation;
    const request: Promise<Held> = Promise.resolve()
      .then(() => options.fetchToken())
      .then((answer) => {
        const token = typeof answer === "string" ? answer : answer?.token;
        if (typeof token !== "string" || !token) {
          throw new Error("fetchToken gave no token");
        }
        const life = lifetimeMs(answer, token);
        const now = Date.now();
        const next: Held =
          life === null
            ? { token, refreshAt: Infinity, expiresAt: Infinity }
            : {
                token,
                refreshAt: now + life - renewBeforeMs(life),
                expiresAt: now + life,
              };
        if (generation === started) {
          held = next;
          notify(token);
        }
        return next;
      })
      .finally(() => {
        if (pending === request) pending = null;
      });
    pending = request;
    return request;
  }

  const credentials = async (request?: ViroVPSCredentialsRequest) => {
    if (held && request?.refusedToken === held.token) held = null;
    let current = held;
    if (!current || Date.now() >= current.refreshAt) {
      try {
        current = await fetchNew();
      } catch (e) {
        if (!current || Date.now() >= current.expiresAt) throw e;
      }
    }
    return { projectId: options.projectId, accessToken: current.token };
  };
  const made = Object.assign(credentials, {
    clear() {
      held = null;
      pending = null;
      generation++;
      notify(null);
    },
  });
  registerUserTokenSource(made, {
    held: () => held && { token: held.token, refreshAt: held.refreshAt },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  });
  return made;
}
