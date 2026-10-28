/**
 * Copyright © 2026 ReactVision
 *
 * What the calls that take `<ViroVPS credentials>`-style credentials share:
 * reading them, the refusals that call for a new user token, and keeping a
 * native channel's token renewed. No React Native dependency, so the room
 * helpers stay usable without one.
 */

"use strict";

import { base64ToBytes } from "../Utilities/ViroBase64";
import type {
  ViroVPSCredentials,
  ViroVPSCredentialsProvider,
  ViroVPSCredentialsRequest,
  ViroVPSCredentialsSource,
} from "./ViroVPSClient";

/** @internal What viro reads from the credentials createUserTokenCredentials() makes. */
export type UserTokenSource = {
  /** The token held and when it is due for renewal, or null. */
  held(): { token: string; refreshAt: number } | null;
  /** Called with each token fetched, and with null on clear(). Returns the unsubscribe. */
  subscribe(listener: (token: string | null) => void): () => void;
};

const sources = new WeakMap<object, UserTokenSource>();

/** @internal */
export function registerUserTokenSource(credentials: object, source: UserTokenSource): void {
  sources.set(credentials, source);
}

/** @internal Whether createUserTokenCredentials() made `credentials`, one per signed-in user. */
export function isUserTokenCredentials(credentials: unknown): boolean {
  return typeof credentials === "function" && sources.has(credentials);
}

/** @internal Calls `listener` at each clear() of credentials createUserTokenCredentials() made. Returns the unsubscribe. */
export function onUserTokenCleared(credentials: unknown, listener: () => void): () => void {
  const source = typeof credentials === "function" ? sources.get(credentials) : undefined;
  return (
    source?.subscribe((token) => {
      if (token === null) listener();
    }) ?? (() => {})
  );
}

/**
 * How Studio and the VPS server refuse a user token before the call does
 * anything, so a new token and one resend is safe.
 */
export const USER_TOKEN_REFUSALS: ReadonlySet<string> = new Set([
  "APP_USER_TOKEN_EXPIRED",
  "INVALID_APP_USER_TOKEN",
]);

/** @internal `source` now. Throws what a credentials function throws. */
export async function readCredentials(
  source: ViroVPSCredentialsSource,
  request?: ViroVPSCredentialsRequest
): Promise<ViroVPSCredentials> {
  const credentials = typeof source === "function" ? await source(request) : source;
  if (!credentials || typeof credentials.projectId !== "string") {
    throw new Error("The credentials gave no projectId");
  }
  return credentials;
}

/** @internal How a co-location request sends `credentials`, for `projectId` in place of theirs. */
export function credentialHeaders(
  credentials: ViroVPSCredentials,
  projectId: string = credentials.projectId
): Record<string, string> {
  return "accessToken" in credentials
    ? { Authorization: `Bearer ${credentials.accessToken}`, "x-project-id": projectId }
    : { "x-api-key": credentials.apiKey, "x-project-id": projectId };
}

/** @internal A token in place of the refused one, or undefined when `source` gives no other. */
export async function renewedToken(
  source: ViroVPSCredentialsSource,
  refused: string
): Promise<string | undefined> {
  if (typeof source !== "function") return undefined;
  try {
    const credentials = await readCredentials(source, { refusedToken: refused });
    return "accessToken" in credentials && credentials.accessToken !== refused
      ? credentials.accessToken
      : undefined;
  } catch {
    return undefined;
  }
}

const REFRESH_BEFORE_MS = 2 * 60 * 1000;
const RETRY_FIRST_MS = 1000;
const RETRY_MAX_MS = 60 * 1000;
// setTimeout holds a signed 32-bit delay and fires at once past it.
const MAX_DELAY_MS = 2 ** 31 - 1;

/** @internal How long before expiry a token `lifeMs` long is renewed. */
export function renewBeforeMs(lifeMs: number): number {
  return Math.min(REFRESH_BEFORE_MS, lifeMs / 4);
}

/** @internal The claims in a user token's payload, or null when there are none to read. */
export function tokenClaims(token: string): { exp?: unknown; iat?: unknown } | null {
  const payload = token.split(".")[1];
  if (!payload) return null;
  try {
    const bytes = base64ToBytes(payload.replace(/-/g, "+").replace(/_/g, "/"));
    let json = "";
    for (let i = 0; i < bytes.length; i++) json += String.fromCharCode(bytes[i]);
    const claims = JSON.parse(json);
    return claims && typeof claims === "object" ? claims : null;
  } catch {
    return null;
  }
}

/**
 * When `token` is due for renewal: what createUserTokenCredentials() keeps, else
 * two minutes (or a quarter of its life) before its own `exp` by this device's
 * clock. Null when that is unknown.
 */
function refreshAtOf(source: ViroVPSCredentialsProvider, token: string): number | null {
  const held = sources.get(source)?.held();
  if (held && held.token === token) {
    return Number.isFinite(held.refreshAt) ? held.refreshAt : null;
  }
  const { exp, iat } = tokenClaims(token) ?? {};
  if (typeof exp !== "number") return null;
  const life = typeof iat === "number" && exp > iat ? (exp - iat) * 1000 : Infinity;
  return exp * 1000 - renewBeforeMs(life);
}

/**
 * @internal Hands `push` each new user token `source` gives after `token`:
 * one fetched elsewhere at once, and one asked for when `token` is due for
 * renewal, with backoff while that fails. Returns the stop.
 */
export function keepUserTokenFresh(
  source: ViroVPSCredentialsProvider,
  token: string,
  push: (token: string) => unknown
): () => void {
  let current = token;
  let stopped = false;
  let failures = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const send = (next: string) => {
    if (stopped || next === current) return;
    current = next;
    Promise.resolve()
      .then(() => push(next))
      .catch(() => {});
  };
  const schedule = () => {
    clearTimeout(timer);
    if (stopped) return;
    const at = refreshAtOf(source, current);
    if (at === null) return;
    const now = Date.now();
    let delay: number;
    if (at > now) {
      failures = 0;
      delay = at - now;
    } else {
      delay = Math.min(RETRY_MAX_MS, RETRY_FIRST_MS * 2 ** failures++);
    }
    timer = setTimeout(refresh, Math.min(delay, MAX_DELAY_MS));
  };
  const refresh = async () => {
    try {
      const credentials = await readCredentials(source);
      if ("accessToken" in credentials) send(credentials.accessToken);
    } catch {
      // schedule() tries again with backoff.
    }
    schedule();
  };

  const unsubscribe =
    sources.get(source)?.subscribe((next) => {
      // clear(): the user signed out, so their channel gets no further token.
      if (next === null) return stop();
      send(next);
      schedule();
    }) ?? (() => {});
  const stop = () => {
    stopped = true;
    clearTimeout(timer);
    unsubscribe();
  };
  schedule();
  return stop;
}
