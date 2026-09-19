"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.studioApiError = studioApiError;
exports.isStudioApiError = isStudioApiError;
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
function studioApiError(operation, nativeError) {
    const body = nativeError?.trim() || null;
    let code = null;
    let detail = null;
    let status = null;
    if (body) {
        // Indexed rather than anchored: a body can carry a prefix before the JSON.
        const jsonStart = body.indexOf("{");
        if (jsonStart !== -1) {
            try {
                const parsed = JSON.parse(body.slice(jsonStart));
                if (typeof parsed?.error?.code === "string" && parsed.error.code) {
                    code = parsed.error.code;
                }
                if (typeof parsed?.error?.message === "string") {
                    detail = parsed.error.message;
                }
            }
            catch {
                // Not an envelope. The raw string is still available on `body`.
            }
        }
        const statusOnly = STATUS_ONLY.exec(body);
        if (statusOnly)
            status = Number(statusOnly[1]);
    }
    const error = new Error(code ? `${operation} failed: ${code}` : `${operation} failed`);
    return Object.assign(error, { code, detail, status, body });
}
/**
 * Structural check, so it holds across module and bundler boundaries where
 * `instanceof` on an Error subclass does not.
 */
function isStudioApiError(error) {
    if (!(error instanceof Error))
        return false;
    return ("code" in error && "detail" in error && "status" in error && "body" in error);
}
