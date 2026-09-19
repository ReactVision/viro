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
/**
 * Build the error for a failed native Studio API call.
 *
 * `message` is deliberately stable, at most the operation plus the envelope
 * code, so error reporters group by failure class instead of opening a new
 * group per response body or per resource id. Branch on `code`, never on
 * `message`: on iOS a transport description is localised to the device
 * language, so matching its text breaks outside English.
 */
export declare function studioApiError(operation: string, nativeError?: string | null): StudioApiError;
/**
 * Structural check, so it holds across module and bundler boundaries where
 * `instanceof` on an Error subclass does not.
 */
export declare function isStudioApiError(error: unknown): error is StudioApiError;
