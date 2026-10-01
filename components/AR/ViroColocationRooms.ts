/**
 * Copyright © 2026 ReactVision
 *
 * Co-location rooms — the short code people actually type.
 *
 * A room is what several devices join to share one AR space, and until this
 * existed the only way to name one was the uuid of the frame it was built on.
 * That is fine for two devices in one app and impossible to read out loud, so a
 * room now has a six-character code and a row of its own on the platform.
 *
 * The room also carries *how* its devices establish the frame, which is what
 * lets a joining device pick the right frame source without being told: the
 * host creates a room for the frame it has (a hosted cloud anchor on phones, a
 * Meta group on Quest, nothing at all on visionOS), and the joiner reads it
 * back off the code.
 *
 * These calls go to the platform, not to the relay. The relay carries poses and
 * replicated state; rooms are ordinary REST, one request before a session
 * starts.
 *
 * @providesModule ViroColocationRooms
 */

"use strict";

export type ViroFrameKind = "cloud_anchor" | "meta_group" | "visionos_space";

export type ViroColocationRoom = {
  /** Room row id, and the room key the relay namespaces by. */
  id: string;
  /** What the relay sees. The same as `id` for rooms created through this API. */
  roomId: string;
  joinCode: string | null;
  /** Null for a room the relay created by saving state for an app-chosen id. */
  frameKind: ViroFrameKind | null;
  cloudAnchorId: string | null;
  frameRef: string | null;
  name: string | null;
  projectId: string | null;
  /** The scene the room was created for, if it was created for one. */
  sceneId: string | null;
};

/** How this room's devices establish their shared frame. */
export type ViroRoomFrame =
  | { frameKind: "cloud_anchor"; cloudAnchorId: string }
  | { frameKind: "meta_group"; frameRef: string }
  | { frameKind: "visionos_space" };

export type ViroColocationRoomsConfig = {
  /** Required unless `headers` is given. */
  apiKey?: string;
  /**
   * Sent as `x-project-id`. Required with `apiKey`. With `headers` it may be
   * left out of a lookup by code, which then finds the room from the code alone.
   */
  projectId?: string;
  /**
   * Platform base URL, not the relay's. Rooms are a REST call to Studio, while
   * poses and replicated state go to the co-location relay.
   */
  endpoint?: string;
  /** Credentials sent verbatim in place of `apiKey`. */
  headers?: Record<string, string>;
};

export type ViroColocationRoomResult =
  | { success: true; room: ViroColocationRoom }
  | {
      success: false;
      error: string;
      code?: string;
      /** HTTP status, absent when no response arrived. */
      status?: number;
    };

const DEFAULT_ENDPOINT = "https://platform.reactvision.xyz";
/**
 * DEFAULT_ENDPOINT's database region, so its edge function runs beside the
 * database. The query parameter rather than an `x-region` header, which a
 * browser would have to clear through a CORS preflight the platform does not
 * allow it in.
 */
const DEFAULT_FUNCTION_REGION = "eu-west-2";

/**
 * The 30 characters a code can hold. O and 0, I and 1 and L, and U against V
 * are all left out so a code read off a screen at arm's length is unambiguous.
 * The platform mints them; this copy exists so a typo costs no request.
 */
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTVWXYZ23456789";
const CODE_PATTERN = /^[ABCDEFGHJKMNPQRSTVWXYZ23456789]{6,8}$/;

/** What someone typed, as the platform stores it, or null if it cannot be a code. */
export function normaliseJoinCode(input: string): string | null {
  const stripped = input.replace(/[\s-]+/g, "").toUpperCase();
  return CODE_PATTERN.test(stripped) ? stripped : null;
}

/** `K7M2QX` as `K7M 2QX`, which is how it is shown and read out. */
export function formatJoinCode(code: string): string {
  const half = Math.ceil(code.length / 2);
  return `${code.slice(0, half)} ${code.slice(half)}`;
}

export { CODE_ALPHABET };

/**
 * Create a room for a frame this device has already established, and get back
 * the code for the others to type.
 */
export async function createColocationRoom(
  config: ViroColocationRoomsConfig,
  frame: ViroRoomFrame & { name?: string; sceneId?: string }
): Promise<ViroColocationRoomResult> {
  const body: Record<string, unknown> = {
    frame_kind: frame.frameKind,
    name: frame.name,
    scene_id: frame.sceneId,
  };
  if (frame.frameKind === "cloud_anchor")
    body.cloud_anchor_id = frame.cloudAnchorId;
  if (frame.frameKind === "meta_group") body.frame_ref = frame.frameRef;

  return await request(config, "POST", "/rooms", body);
}

/** Look a room up by the code someone typed. */
export async function lookupColocationRoom(
  config: ViroColocationRoomsConfig,
  code: string
): Promise<ViroColocationRoomResult> {
  const normalised = normaliseJoinCode(code);
  if (!normalised) {
    return {
      success: false,
      error: "That is not a join code. Codes are six characters.",
      code: "INVALID_JOIN_CODE",
    };
  }
  return await request(config, "GET", `/rooms/${normalised}`);
}

async function request(
  config: ViroColocationRoomsConfig,
  method: "GET" | "POST",
  path: string,
  body?: Record<string, unknown>
): Promise<ViroColocationRoomResult> {
  const base = (config.endpoint ?? DEFAULT_ENDPOINT).replace(/\/+$/, "");
  const url = `${base}/functions/v1/colocation${path}`;

  let headers: Record<string, string>;
  if (config.headers) {
    headers = { "content-type": "application/json", ...config.headers };
    if (config.projectId) headers["x-project-id"] = config.projectId;
  } else if (!config.apiKey) {
    // The platform's own codes for the same refusal, so a caller handles one
    // set whether or not the request was spent.
    return {
      success: false,
      error: "Pass an apiKey or headers.",
      code: "MISSING_API_KEY",
    };
  } else if (!config.projectId) {
    return {
      success: false,
      error: "A projectId is required with an apiKey.",
      code: "MISSING_PROJECT_ID",
    };
  } else {
    headers = {
      "content-type": "application/json",
      "x-api-key": config.apiKey,
      "x-project-id": config.projectId,
    };
  }

  let response: Response;
  try {
    response = await fetchInRegion(base, url, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch (e: any) {
    return { success: false, error: e?.message ?? "Network request failed" };
  }

  let parsed: any = null;
  try {
    parsed = await response.json();
  } catch {
    // Falls through to the status-only message below.
  }

  if (!response.ok || !parsed?.room) {
    return {
      success: false,
      error: parsed?.error?.message ?? `Request failed (${response.status})`,
      code: parsed?.error?.code,
      status: response.status,
    };
  }

  return { success: true, room: toRoom(parsed.room) };
}

// What the gateway answers when it never reached a function. With a non-JSON
// body (every platform function answers JSON) nothing ran, so a resend cannot
// run a request twice. 500, 504, 520, 524 and 546 are left out: a function may
// have run before any of them.
const UNDELIVERED_STATUSES = new Set([502, 503, 521, 522, 523, 525, 526, 530]);

function undelivered(response: Response): boolean {
  return (
    UNDELIVERED_STATUSES.has(response.status) &&
    !/json/i.test(response.headers.get("content-type") ?? "")
  );
}

/**
 * Pins by the query parameter on the default platform and by any `x-region`
 * the caller's headers carry. The platform does not fail a pinned region over,
 * so a call the region could not take is sent once more unpinned: an
 * undelivered answer, or a network error (how a browser sees a gateway page
 * without CORS headers) while the region also fails a probe.
 */
async function fetchInRegion(
  base: string,
  url: string,
  init: { method: string; headers: Record<string, string>; body?: string }
): Promise<Response> {
  const regionHeader = Object.keys(init.headers).find(
    (name) => name.toLowerCase() === "x-region"
  );
  const region = regionHeader
    ? init.headers[regionHeader]
    : base === DEFAULT_ENDPOINT
      ? DEFAULT_FUNCTION_REGION
      : undefined;
  if (!region) return fetch(url, init);

  const pinned =
    base === DEFAULT_ENDPOINT
      ? `${url}?forceFunctionRegion=${DEFAULT_FUNCTION_REGION}`
      : url;
  try {
    const response = await fetch(pinned, init);
    if (!undelivered(response)) return response;
  } catch (e) {
    if (!(e instanceof TypeError) || (await regionAnswers(base, region)))
      throw e;
  }
  const headers = { ...init.headers };
  if (regionHeader) delete headers[regionHeader];
  return fetch(url, { ...init, headers });
}

// The region's runtime answers the bare path itself, with CORS headers and
// without starting a function.
async function regionAnswers(base: string, region: string): Promise<boolean> {
  try {
    return !undelivered(
      await fetch(`${base}/functions/v1/?forceFunctionRegion=${region}`)
    );
  } catch {
    return false;
  }
}

function toRoom(raw: any): ViroColocationRoom {
  return {
    id: String(raw.id),
    roomId: String(raw.room_id ?? raw.id),
    joinCode: raw.join_code ?? null,
    frameKind: raw.frame_kind ?? null,
    cloudAnchorId: raw.cloud_anchor_id ?? null,
    frameRef: raw.frame_ref ?? null,
    name: raw.name ?? null,
    projectId: raw.project_id ?? null,
    sceneId: raw.scene_id ?? null,
  };
}
