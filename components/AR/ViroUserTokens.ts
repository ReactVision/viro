/**
 * Copyright © 2026 ReactVision
 *
 * What the calls that take `<ViroVPS credentials>`-style credentials share:
 * the refusals that call for a new user token, and when a token is due for
 * renewal. No React Native dependency.
 */

"use strict";

import { base64ToBytes } from "../Utilities/ViroBase64";

/**
 * How Studio and the VPS server refuse a user token before the call does
 * anything, so a new token and one resend is safe.
 */
export const USER_TOKEN_REFUSALS: ReadonlySet<string> = new Set([
  "APP_USER_TOKEN_EXPIRED",
  "INVALID_APP_USER_TOKEN",
]);

const REFRESH_BEFORE_MS = 2 * 60 * 1000;

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
