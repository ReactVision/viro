/**
 * Copyright © 2026 ReactVision
 *
 * What every vps-server call shares: the credential headers, the error type,
 * and turning an error response (`{ "error": { "code", "message" } }`, see
 * spatial/vps-server/API.md) into that error.
 */

"use strict";

/** Either credential form API.md accepts; always paired with the project id. */
export type ViroVPSCredentials =
  | { projectId: string; apiKey: string }
  | { projectId: string; accessToken: string };

/**
 * A failed vps-server request, or a local step around one (reading the
 * recording, fetching a signed map URL). `code` and `status` are the
 * server's, when the failure came from a response.
 */
export class ViroVPSError extends Error {
  constructor(
    message: string,
    public readonly code?: string,
    public readonly status?: number
  ) {
    super(message);
    this.name = "ViroVPSError";
  }
}

export function vpsAuthHeaders(creds: ViroVPSCredentials): Record<string, string> {
  const headers: Record<string, string> = { "x-project-id": creds.projectId };
  if ("apiKey" in creds) {
    headers["x-api-key"] = creds.apiKey;
  } else {
    headers["Authorization"] = `Bearer ${creds.accessToken}`;
  }
  return headers;
}

/** Builds the error for a non-2xx response from its status and raw body text. */
export function vpsErrorFromBody(status: number, bodyText: string | undefined): ViroVPSError {
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
  return new ViroVPSError(message, code, status);
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
