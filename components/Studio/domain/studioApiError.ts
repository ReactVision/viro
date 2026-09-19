/**
 * Fields lifted off a failed native Studio API call.
 *
 * The native module reports every failure through a single `error` string, so a
 * non-2xx response arrives as the raw response body while a transport failure
 * arrives as a platform description. Parsing that string is what this avoids.
 */
export interface StudioApiErrorFields {
  /** `error.code` from the response envelope, or null when there was none. */
  code: string | null;
  /** `error.message` from the envelope: human readable, safe to display. */
  detail: string | null;
  /**
   * HTTP status, populated only when the response had a status but no body to
   * report. A parsed envelope carries no status of its own, so this stays null
   * for most server-side failures.
   */
  status: number | null;
  /** The native error string verbatim, for diagnostics. */
  body: string | null;
}

export type StudioApiError = Error & StudioApiErrorFields;

/** iOS reports a non-2xx with an empty body as a bare status line. */
const STATUS_ONLY = /^HTTP (\d{3})$/;

/**
 * Build the error for a failed native Studio API call.
 *
 * `message` is deliberately stable, at most the operation plus the envelope
 * code, so error reporters group by failure class instead of opening a new
 * group per response body or per resource id. Branch on `code`, never on
 * `message`: on iOS a transport description is localised to the device
 * language, so matching its text breaks outside English.
 */
export function studioApiError(
  operation: string,
  nativeError?: string | null
): StudioApiError {
  const body = nativeError?.trim() || null;
  let code: string | null = null;
  let detail: string | null = null;
  let status: number | null = null;

  if (body) {
    // Indexed rather than anchored: a body can carry a prefix before the JSON.
    const jsonStart = body.indexOf("{");
    if (jsonStart !== -1) {
      try {
        const parsed = JSON.parse(body.slice(jsonStart)) as {
          error?: { code?: unknown; message?: unknown };
        };
        if (typeof parsed?.error?.code === "string" && parsed.error.code) {
          code = parsed.error.code;
        }
        if (typeof parsed?.error?.message === "string") {
          detail = parsed.error.message;
        }
      } catch {
        // Not an envelope. The raw string is still available on `body`.
      }
    }
    const statusOnly = STATUS_ONLY.exec(body);
    if (statusOnly) status = Number(statusOnly[1]);
  }

  const error = new Error(
    code ? `${operation} failed: ${code}` : `${operation} failed`
  );
  return Object.assign(error, { code, detail, status, body });
}

/**
 * Structural check, so it holds across module and bundler boundaries where
 * `instanceof` on an Error subclass does not.
 */
export function isStudioApiError(error: unknown): error is StudioApiError {
  if (!(error instanceof Error)) return false;
  return (
    "code" in error && "detail" in error && "status" in error && "body" in error
  );
}
