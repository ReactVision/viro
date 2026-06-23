/**
 * API Request helpers: template validation + interpolation (URL / headers /
 * JSON body), allowlist host matching, dot-path response extraction, and
 * response->variable binding application. Pure logic, no platform APIs (no
 * URL constructor — Hermes-safe), shared by the Studio editor, the
 * scene-api-request egress proxy, and the scene runtime.
 *
 * Dual-maintained: this file exists in the Viro repo
 * (components/Studio/domain/) and the ReactVisionStudio monorepo
 * (packages/common/scene-assets/). Keep the two copies identical.
 *
 * Interpolation rules (fail closed — unknown or malformed placeholders are
 * errors, never substituted with empty strings):
 *   - Placeholders are written {{name}} where name matches the
 *     scene_variables name constraint.
 *   - URL: the origin (scheme://host[:port]) must be static; placeholders are
 *     only legal after it and substitute percent-encoded.
 *   - Headers: values substitute as strings; control characters are rejected.
 *   - Body: the template must parse as JSON. A string value that is EXACTLY
 *     one placeholder substitutes as the typed value (number stays number);
 *     embedded placeholders substitute stringified; placeholders outside
 *     string values are invalid JSON and rejected. Re-serialisation makes
 *     structural injection impossible.
 */
export type ApiVariableType = "BOOLEAN" | "NUMBER" | "STRING";
export type ApiPrimitiveValue = boolean | number | string;
export type ApiRequestBindingSource = "BODY" | "STATUS" | "OK" | "ERROR_MESSAGE";
export type ApiHeaderTemplate = {
    key: string;
    value_template: string;
};
export declare const API_REQUEST_TIMEOUT_MIN_MS = 1000;
export declare const API_REQUEST_TIMEOUT_MAX_MS = 30000;
export declare const API_REQUEST_TIMEOUT_DEFAULT_MS = 10000;
export declare const API_REQUEST_MAX_URL_LENGTH = 2048;
export declare const API_REQUEST_MAX_BODY_LENGTH = 65536;
export declare const API_REQUEST_MAX_SELECTOR_LENGTH = 256;
export declare const API_REQUEST_MAX_VARIABLES = 32;
export declare const API_REQUEST_MAX_VARIABLE_VALUE_LENGTH = 4096;
export declare const API_REQUEST_METHODS: readonly ["GET", "POST", "PUT", "PATCH", "DELETE"];
export type ApiRequestMethod = (typeof API_REQUEST_METHODS)[number];
export type TemplateValidation = {
    ok: true;
    names: string[];
} | {
    ok: false;
    error: string;
};
type Fail = {
    ok: false;
    error: string;
};
/** Names of every well-formed placeholder, in order of appearance. */
export declare const extractPlaceholders: (template: string) => string[];
/**
 * A template string is valid when every "{{" / "}}" belongs to a well-formed
 * placeholder. Malformed names ({{9x}}, {{a b}}) and stray braces are errors.
 */
export declare const validateTemplateString: (template: string) => TemplateValidation;
export type ValueLookup = (name: string) => ApiPrimitiveValue | undefined;
/**
 * Fail-soft interpolation for display strings (alert title / message). Unlike
 * the request templates this never errors: a well-formed {{name}} whose value
 * is missing is left verbatim, so a stale or mistyped reference stays visible
 * rather than blanking the field or suppressing the whole alert. Malformed
 * braces (not a valid placeholder) are left untouched.
 */
export declare const interpolateDisplayTemplate: (template: string, get: ValueLookup) => string;
export type UrlTemplateValidation = {
    ok: true;
    host: string;
    port: string | null;
    names: string[];
} | Fail;
/**
 * Validates scheme + static origin (no placeholders, no userinfo, no IPv6
 * literal) and the placeholder syntax of the whole template. Returns the
 * pinned host (lowercase, no port) and explicit port if present.
 */
export declare const validateUrlTemplate: (template: string) => UrlTemplateValidation;
export type UrlInterpolation = {
    ok: true;
    url: string;
} | Fail;
/**
 * Substitutes placeholders percent-encoded into the path/query part. The
 * origin is template-static by validation; the post-substitution recheck is
 * belt-and-braces.
 */
export declare const interpolateUrlTemplate: (template: string, get: ValueLookup) => UrlInterpolation;
export declare const HEADER_NAME_PATTERN: RegExp;
export declare const isForbiddenHeaderName: (name: string) => boolean;
export type HeadersValidation = {
    ok: true;
} | Fail;
export declare const validateHeaderTemplates: (headers: ApiHeaderTemplate[], options?: {
    reservedNames?: string[];
}) => HeadersValidation;
export type HeadersInterpolation = {
    ok: true;
    headers: {
        key: string;
        value: string;
    }[];
} | Fail;
export declare const interpolateHeaders: (headers: ApiHeaderTemplate[], get: ValueLookup, options?: {
    reservedNames?: string[];
}) => HeadersInterpolation;
export type BodyValidation = {
    ok: true;
    names: string[];
} | Fail;
/**
 * The body template must be JSON; placeholders may only appear inside string
 * values (a bare {{n}} outside a string is invalid JSON by construction).
 */
export declare const validateBodyTemplate: (template: string) => BodyValidation;
export type BodyInterpolation = {
    ok: true;
    body: string;
} | Fail;
/**
 * Parse -> walk -> substitute (typed for whole-placeholder strings) ->
 * re-stringify. The serialiser guarantees escaping, so variable values can
 * never change the JSON structure.
 */
export declare const interpolateJsonBody: (template: string, get: ValueLookup) => BodyInterpolation;
/**
 * Pattern grammar: "host.tld" or "*.host.tld", optional ":port". A pattern
 * without a port matches the default HTTPS port only (no explicit port in the
 * URL); a pattern with a port matches exactly that port. The wildcard matches
 * subdomains at a label boundary, never the apex itself.
 */
export declare const matchHostPattern: (host: string, port: string | null, pattern: string) => boolean;
export declare const isHostAllowlisted: (host: string, port: string | null, patterns: string[]) => boolean;
export declare const validateSelector: (selector: string) => boolean;
export type ExtractionResult = {
    found: true;
    value: unknown;
} | {
    found: false;
};
/** Walks `data.items[0].name`-style selectors. Missing path -> not found. */
export declare const extractByPath: (value: unknown, selector: string) => ExtractionResult;
export type ApiRequestBindingInput = {
    source: ApiRequestBindingSource;
    selector: string | null;
    variable_name: string;
    variable_type: ApiVariableType;
};
export type ApiRequestOutcomeInput = {
    ok: boolean;
    status: number | null;
    body?: unknown;
    error_message?: string | null;
};
export type CoercionResult = {
    ok: true;
    value: ApiPrimitiveValue;
} | {
    ok: false;
};
/** Primitive-only, lossless-ish coercion into the variable's declared type. */
export declare const coerceBindingValue: (value: unknown, type: ApiVariableType) => CoercionResult;
export type ApiRequestBindingWrite = {
    name: string;
    type: ApiVariableType;
    value: ApiPrimitiveValue;
};
export type BindingApplication = {
    writes: ApiRequestBindingWrite[];
    warnings: string[];
};
/**
 * Pure: resolves each applicable binding against the outcome and returns the
 * variable writes plus warnings for skipped bindings (missing path, type
 * mismatch). The caller applies writes to its variable store.
 */
export declare const applyBindings: (bindings: ApiRequestBindingInput[], outcome: ApiRequestOutcomeInput) => BindingApplication;
export {};
