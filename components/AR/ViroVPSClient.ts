/**
 * Copyright © 2026 ReactVision
 *
 * What every vps-server call shares: the credential headers, the error type,
 * and turning an error response (`{ "error": { "code", "message" } }`, see
 * spatial/vps-server/API.md) into that error.
 */

"use strict";

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

/**
 * Called before every vps-server request, so a short-lived token the host
 * refreshes reaches the next request. A function that throws or rejects fails
 * that request with `CREDENTIALS_UNAVAILABLE`.
 */
export type ViroVPSCredentialsProvider = () => Promise<ViroVPSCredentials> | ViroVPSCredentials;

export type ViroVPSCredentialsSource = ViroVPSCredentials | ViroVPSCredentialsProvider;

// vps-server's rule. A header carries bytes, so only printable ASCII reaches
// the server as the same id on every transport; "." and ".." would vanish
// from the path of DELETE /vps/app-users/{id}.
const APP_USER_ID = /^[\x21-\x7e]{1,255}$/;

/**
 * A failed vps-server request, or a local step around one (reading the
 * recording, fetching a signed map URL). `code` and `status` are the
 * server's, when the failure came from a response. Codes this package sets,
 * with no status: `CREDENTIALS_UNAVAILABLE`, `INVALID_APP_USER_ID` and
 * `BAD_REQUEST` (uploadScanRecording()'s options). vps-server answers the
 * same mistakes with the same two codes and status 400.
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

/** The credentials `source` gives now, with `appUserId` in place of their own when it is given. */
export async function resolveVPSCredentials(
  source: ViroVPSCredentialsSource,
  appUserId?: string
): Promise<ViroVPSCredentials> {
  let creds: ViroVPSCredentials | undefined;
  try {
    creds = typeof source === "function" ? await source() : source;
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
  source: ViroVPSCredentialsSource,
  appUserId?: string
): Promise<Record<string, string>> {
  const creds = await resolveVPSCredentials(source, appUserId);
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
      code = body?.error?.code;
      message = body?.error?.message ?? message;
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
