/**
 * Copyright © 2026 ReactVision
 *
 * What every VPS call shares: where it goes, the credential headers, the
 * error type, and turning an error response
 * (`{ "error": { "code", "message" } }`) into that error. Studio serves every
 * call but image search and server-mode frames, which go to the VPS server
 * whose address Studio gives out.
 */

"use strict";

import { VRTStudioModule, type StudioAuthContext } from "../Studio/VRTStudioModule";
import {
  PLATFORM_ENDPOINT,
  PLATFORM_FUNCTION_REGION,
  platformRegionAnswers,
  platformUndelivered,
} from "./ViroPlatformRegion";
import { USER_TOKEN_REFUSALS } from "./ViroUserTokens";

/** Either credential form API.md accepts; always paired with the project id. */
export type ViroVPSCredentials = (
  | { projectId: string; apiKey: string }
  | { projectId: string; accessToken: string }
) & {
  /**
   * The app's own id for its signed-in user, sent as `x-app-user-id`:
   * locations and scans are then that user's. 1 to 255 printable ASCII
   * characters (`!` to `~`, so no spaces or accented letters), and not `.` or
   * `..`; anything else is refused with `INVALID_APP_USER_ID` before any
   * request. `<ViroVPS appUserId>` and uploadScanRecording()'s `appUserId`
   * set it.
   */
  appUserId?: string;
};

/** What viro tells a credentials function when it calls it. */
export type ViroVPSCredentialsRequest = {
  /**
   * Set when Studio or the VPS server has just refused this user token (401
   * `APP_USER_TOKEN_EXPIRED` or `INVALID_APP_USER_TOKEN`). Give another, and
   * viro sends the request once more with it; give the same one, and the
   * request fails with that refusal.
   */
  refusedToken?: string;
};

/**
 * Called before every VPS request, so a short-lived token the host refreshes
 * reaches the next request. A function that throws or rejects fails that
 * request with `CREDENTIALS_UNAVAILABLE`. For a user token from the app's
 * backend, createUserTokenCredentials() makes this function and keeps the
 * token between requests.
 */
export type ViroVPSCredentialsProvider = (
  request?: ViroVPSCredentialsRequest
) => Promise<ViroVPSCredentials> | ViroVPSCredentials;

export type ViroVPSCredentialsSource = ViroVPSCredentials | ViroVPSCredentialsProvider;

/** Where VPS calls go and as whom. Every field has a default. */
export type ViroVPSConnection = {
  /**
   * Studio's address, which serves every VPS call but image search and
   * server-mode frames. Default: the Studio session's, else
   * `https://platform.reactvision.xyz`.
   */
  endpoint?: string;
  /**
   * The VPS server's address, for image search and server-mode frames.
   * Default: the one Studio gives out, asked at most once an hour.
   */
  serverEndpoint?: string;
  /**
   * Default: the Studio session, or the `rvApiKey` and `rvProjectId` set in
   * viro's Expo plugin.
   */
  credentials?: ViroVPSCredentialsSource;
  /**
   * The app's own id for its signed-in user, sent as `x-app-user-id`; see
   * `ViroVPSCredentials.appUserId`. Replaces one given in `credentials`.
   */
  appUserId?: string;
};

// Studio's rule. A header carries bytes, so only printable ASCII reaches
// the server as the same id on every transport; "." and ".." would vanish
// from the path of DELETE /vps/app-users/{id}.
const APP_USER_ID = /^[\x21-\x7e]{1,255}$/;

/**
 * A failed VPS request, or a local step around one (reading the recording,
 * fetching a signed map URL). `code` and `status` are the server's, when the
 * failure came from a response. Codes this package sets, with no status:
 * `NETWORK_ERROR` (no response), `CREDENTIALS_UNAVAILABLE`,
 * `INVALID_APP_USER_ID`, `BAD_REQUEST` (uploadScanRecording()'s options),
 * `VPS_SERVER_NOT_CONFIGURED` (Studio gave out no VPS server address) and
 * `UNSUPPORTED`. Studio answers the same mistakes with the same two codes and
 * status 400.
 *
 * `scanId` is set by uploadScanRecording() when its scan exists on the
 * server but the recording did not arrive: pass it back as
 * `options.scanId` to upload into that scan instead of creating another.
 */
export class ViroVPSError extends Error {
  constructor(
    message: string,
    public readonly code?: string,
    public readonly status?: number,
    public readonly scanId?: string
  ) {
    super(message);
    this.name = "ViroVPSError";
  }
}

function headerValue(headers: Record<string, string>, name: string): string | undefined {
  const key = Object.keys(headers).find((k) => k.toLowerCase() === name);
  return key === undefined ? undefined : headers[key];
}

function bearerToken(headers: Record<string, string>): string | undefined {
  return headerValue(headers, "authorization")?.replace(/^Bearer\s+/i, "");
}

/**
 * The credential viro's native layer holds (a Studio session, or the
 * manifest's RVApiKey), for `projectId`: the manifest's RVProjectId unless
 * given.
 */
export function credentialsFromAuthContext(
  context: StudioAuthContext,
  projectId: string | null = context.projectId
): ViroVPSCredentials {
  const accessToken = bearerToken(context.headers);
  const apiKey = headerValue(context.headers, "x-api-key");
  if (projectId && accessToken) return { projectId, accessToken };
  if (projectId && apiKey) return { projectId, apiKey };
  throw new ViroVPSError(
    "No VPS credentials: pass credentials, or set rvApiKey and rvProjectId in viro's Expo plugin",
    "CREDENTIALS_UNAVAILABLE"
  );
}

const nativeCredentials: ViroVPSCredentialsProvider = async () =>
  credentialsFromAuthContext(await VRTStudioModule.rvGetAuthHeaders());

/**
 * The credentials `source` gives now (the native ones when there is no
 * source), with `appUserId` in place of their own when it is given.
 */
export async function resolveVPSCredentials(
  source: ViroVPSCredentialsSource = nativeCredentials,
  appUserId?: string,
  request?: ViroVPSCredentialsRequest
): Promise<ViroVPSCredentials> {
  let creds: ViroVPSCredentials | undefined;
  try {
    creds = typeof source === "function" ? await source(request) : source;
  } catch (e) {
    if (e instanceof ViroVPSError) throw e;
    throw new ViroVPSError(
      `Could not get VPS credentials: ${e instanceof Error ? e.message : String(e)}`,
      "CREDENTIALS_UNAVAILABLE"
    );
  }
  if (!creds || typeof creds.projectId !== "string") {
    throw new ViroVPSError("No VPS credentials", "CREDENTIALS_UNAVAILABLE");
  }
  return appUserId === undefined ? creds : { ...creds, appUserId };
}

export async function vpsAuthHeaders(
  source?: ViroVPSCredentialsSource,
  appUserId?: string,
  request?: ViroVPSCredentialsRequest
): Promise<Record<string, string>> {
  const creds = await resolveVPSCredentials(source, appUserId, request);
  const headers: Record<string, string> = { "x-project-id": creds.projectId };
  if ("apiKey" in creds) {
    headers["x-api-key"] = creds.apiKey;
  } else {
    headers["Authorization"] = `Bearer ${creds.accessToken}`;
  }
  // An empty id is no id. An invalid one is refused rather than altered: an
  // altered id is a different user.
  if (creds.appUserId) {
    const id = creds.appUserId;
    if (!APP_USER_ID.test(id) || id === "." || id === "..") {
      throw new ViroVPSError(
        'appUserId must be 1 to 255 printable ASCII characters, without spaces, and not "." or ".."',
        "INVALID_APP_USER_ID"
      );
    }
    headers["x-app-user-id"] = id;
  }
  return headers;
}

/** How long a VPS call may take before it is a `NETWORK_ERROR`. */
export const VPS_REQUEST_TIMEOUT_MS = 30000;

type Send = (url: string, init: RequestInit) => Promise<Response>;

/**
 * fetch(), then `read` of its response, together within `timeoutMs`: a request
 * that got no response, or did not finish in time, is thrown as a
 * `NETWORK_ERROR`. Expo's fetch resolves as soon as the headers arrive, so the
 * body is read inside the limit for the limit to cover the download.
 */
export async function vpsFetch<T>(
  url: string,
  init: RequestInit | undefined,
  read: (response: Response) => Promise<T>,
  timeoutMs = VPS_REQUEST_TIMEOUT_MS,
  send: Send = (u, i) => fetch(u, i)
): Promise<T> {
  const controller = new AbortController();
  // A race, not a wait for the abort to surface: on iOS, Expo's arrayBuffer()
  // never settles once its request is aborted.
  let timer: ReturnType<typeof setTimeout> | undefined;
  const expired = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new ViroVPSError(`No answer within ${Math.round(timeoutMs / 1000)} s`, "NETWORK_ERROR"));
    }, timeoutMs);
  });
  const exchange = (async () => {
    let response: Response;
    try {
      response = await send(url, { ...init, signal: controller.signal });
    } catch (e) {
      throw new ViroVPSError(e instanceof Error ? e.message : String(e), "NETWORK_ERROR");
    }
    return read(response);
  })();
  // Once the limit has passed, nobody is waiting for its outcome.
  exchange.catch(() => {});
  try {
    return await Promise.race([exchange, expired]);
  } finally {
    clearTimeout(timer);
  }
}

/** A `read` for vpsFetch(): the JSON body, or the server's error as a ViroVPSError. */
export async function vpsJson(response: Response): Promise<unknown> {
  await throwIfVPSError(response);
  return response.json();
}

/**
 * How long a signed link's file may take: 30 s and a second for every 100 KB,
 * so a 20 MB map has about four minutes. Five minutes when the size is unknown.
 */
export function vpsDownloadTimeoutMs(bytes: number | null | undefined): number {
  if (bytes == null || !(bytes >= 0)) return 300000;
  return 30000 + Math.ceil(bytes / 100000) * 1000;
}

/** Builds the error for a non-2xx response from its status and raw body text. */
export function vpsErrorFromBody(
  status: number,
  bodyText: string | undefined,
  scanId?: string
): ViroVPSError {
  let code: string | undefined;
  let message = `HTTP ${status}`;
  if (bodyText) {
    try {
      const body = JSON.parse(bodyText);
      // The platform's gateway answers some requests itself with a top-level
      // {code, message}, such as NOT_FOUND for a function that is not deployed.
      // Its JWT refusal carries a numeric code, which is not one of ours.
      code = body?.error?.code ?? (typeof body?.code === "string" ? body.code : undefined);
      message =
        body?.error?.message ?? (typeof body?.message === "string" ? body.message : message);
    } catch {
      // Non-JSON error body: keep the generic HTTP message.
    }
  }
  return new ViroVPSError(message, code, status, scanId);
}

export async function throwIfVPSError(response: Response): Promise<void> {
  if (response.ok) return;
  let text: string | undefined;
  try {
    text = await response.text();
  } catch {
    text = undefined;
  }
  throw vpsErrorFromBody(response.status, text);
}

/** `endpoint` without trailing slashes, so `${base}/vps/...` never doubles one. */
export function vpsBaseUrl(endpoint: string): string {
  return endpoint.replace(/\/+$/, "");
}

/**
 * Headers carrying a new user token in place of the refused one in `refused`,
 * or null when the credentials give no other.
 */
export type RenewToken = (refused: Record<string, string>) => Promise<Record<string, string> | null>;

function tokenRenewal(
  source: ViroVPSCredentialsSource | undefined,
  appUserId: string | undefined
): RenewToken {
  return async (refused) => {
    const token = bearerToken(refused);
    if (!token || typeof source !== "function") return null;
    const headers = await vpsAuthHeaders(source, appUserId, { refusedToken: token });
    return bearerToken(headers) === token ? null : headers;
  };
}

/**
 * `send(target.headers)`, and once more when the user token in them was
 * refused and the credentials give another, which then replaces it in
 * `target.headers` for the calls that follow.
 */
async function withTokenRenewal<T>(
  target: { headers: Record<string, string>; renewToken: RenewToken },
  send: (headers: Record<string, string>) => Promise<T>
): Promise<T> {
  const headers = target.headers;
  try {
    return await send(headers);
  } catch (e) {
    if (!(e instanceof ViroVPSError) || e.status !== 401 || !USER_TOKEN_REFUSALS.has(e.code ?? "")) {
      throw e;
    }
    // Credentials that fail to give another token leave the refusal standing,
    // as the room helpers do, so server mode ends on it instead of retrying.
    const renewed = await target.renewToken(headers).catch(() => null);
    if (!renewed) throw e;
    target.headers = renewed;
    return send(renewed);
  }
}

/** A resolved connection to Studio: its base URL, the region to pin, and the headers. */
export type VPSStudio = {
  base: string;
  region: string | null;
  headers: Record<string, string>;
  renewToken: RenewToken;
};

/** A resolved connection to the VPS server. */
export type VPSServer = {
  base: string;
  headers: Record<string, string>;
  renewToken: RenewToken;
};

/** Where Studio is and as whom to call it, from `connection` and, for what it leaves out, the native layer. */
export async function resolveVPSStudio(connection: ViroVPSConnection = {}): Promise<VPSStudio> {
  const context =
    connection.endpoint !== undefined && connection.credentials !== undefined
      ? null
      : await VRTStudioModule.rvGetAuthHeaders();
  const base = vpsBaseUrl(connection.endpoint ?? context?.baseUrl ?? PLATFORM_ENDPOINT);
  const region =
    base === PLATFORM_ENDPOINT
      ? PLATFORM_FUNCTION_REGION
      : connection.endpoint === undefined && context
        ? (headerValue(context.headers, "x-region") ?? null)
        : null;
  const source =
    connection.credentials ?? (context ? () => credentialsFromAuthContext(context) : undefined);
  return {
    base,
    region,
    headers: await vpsAuthHeaders(source, connection.appUserId),
    renewToken: tokenRenewal(source, connection.appUserId),
  };
}

/**
 * The platform does not fail a pinned region over, so a call the region could
 * not take is sent once more unpinned: an undelivered answer, or a network
 * error while the region also fails a probe. ViroColocationRooms applies the
 * same rule.
 */
function sendPinned(base: string, region: string | null): Send {
  return async (url, init) => {
    if (!region) return fetch(url, init);
    try {
      const response = await fetch(
        `${url}${url.includes("?") ? "&" : "?"}forceFunctionRegion=${region}`,
        init
      );
      if (!platformUndelivered(response)) return response;
    } catch (e) {
      if (!(e instanceof TypeError) || (await platformRegionAnswers(base, region))) throw e;
    }
    return fetch(url, init);
  };
}

/**
 * A call to Studio's `vps` function: `path` starts with `/vps/`. A refused
 * user token is renewed and the call sent once more (see withTokenRenewal()).
 */
export function vpsStudioFetch<T>(
  studio: VPSStudio,
  path: string,
  init: RequestInit,
  read: (response: Response) => Promise<T>,
  timeoutMs = VPS_REQUEST_TIMEOUT_MS
): Promise<T> {
  return withTokenRenewal(studio, (headers) =>
    vpsFetch(
      `${studio.base}/functions/v1${path}`,
      { ...init, headers: { ...headers, ...(init.headers as Record<string, string>) } },
      read,
      timeoutMs,
      sendPinned(studio.base, studio.region)
    )
  );
}

/** A call to the VPS server, `path` from `/vps/`, renewing a refused user token as vpsStudioFetch() does. */
export function vpsServerFetch<T>(
  server: VPSServer,
  path: string,
  init: RequestInit,
  read: (response: Response) => Promise<T>,
  timeoutMs = VPS_REQUEST_TIMEOUT_MS
): Promise<T> {
  return withTokenRenewal(server, (headers) =>
    vpsFetch(
      `${server.base}${path}`,
      { ...init, headers: { ...headers, ...(init.headers as Record<string, string>) } },
      read,
      timeoutMs
    )
  );
}

const SERVER_ADDRESS_TTL_MS = 60 * 60 * 1000;
const serverAddresses = new Map<string, { at: number; url: Promise<string> }>();

/** For tests: forget the VPS server addresses Studio gave out. */
export function clearVPSServerAddresses(): void {
  serverAddresses.clear();
}

/**
 * The VPS server's base URL and the headers to call it with: the connection's
 * `serverEndpoint`, else the address Studio gives out, kept an hour.
 */
export async function resolveVPSServer(connection: ViroVPSConnection = {}): Promise<VPSServer> {
  const studio = await resolveVPSStudio(connection);
  if (connection.serverEndpoint) {
    return {
      base: vpsBaseUrl(connection.serverEndpoint),
      headers: studio.headers,
      renewToken: studio.renewToken,
    };
  }
  const now = Date.now();
  let known = serverAddresses.get(studio.base);
  if (!known || now - known.at > SERVER_ADDRESS_TTL_MS) {
    const url = vpsStudioFetch(studio, "/vps/server", {}, vpsJson).then((body) => {
      const address = (body as { url?: unknown })?.url;
      if (typeof address !== "string" || !address) {
        throw new ViroVPSError(
          "Studio has no VPS server for image search and server-mode localisation",
          "VPS_SERVER_NOT_CONFIGURED"
        );
      }
      return vpsBaseUrl(address);
    });
    known = { at: now, url };
    serverAddresses.set(studio.base, known);
    // a failed answer is asked again next time
    url.catch(() => {
      if (serverAddresses.get(studio.base) === known) serverAddresses.delete(studio.base);
    });
  }
  return { base: await known.url, headers: studio.headers, renewToken: studio.renewToken };
}
