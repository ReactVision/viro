/**
 * Copyright © 2026 ReactVision
 *
 * @providesModule useCredentialsKey
 */

"use strict";

import { useEffect, useState } from "react";
import { isUserTokenCredentials, onUserTokenCleared } from "../AR/ViroUserTokens";

/**
 * @internal What the co-location hooks key their effects on in place of
 * `credentials`, which they read through a ref. Besides `credentials` first
 * arriving or going, only credentials from createUserTokenCredentials(), one
 * per user, change it: when another such object is passed, and at its clear(),
 * so a signed-out user's token never stays in the room. Any other object or
 * function may be new every render, and would leave and rejoin the room every
 * render.
 */
export function useCredentialsKey(
  credentials: unknown
): readonly [key: unknown, cleared: number] {
  const userToken = isUserTokenCredentials(credentials) ? credentials : null;
  const [cleared, setCleared] = useState(0);
  useEffect(
    () => onUserTokenCleared(userToken, () => setCleared((n) => n + 1)),
    [userToken]
  );
  return [userToken ?? credentials !== undefined, cleared] as const;
}
