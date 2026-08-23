"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.applyBindings = exports.coerceBindingValue = exports.extractByPath = exports.validateSelector = exports.isHostAllowlisted = exports.matchHostPattern = exports.interpolateJsonBody = exports.validateBodyTemplate = exports.interpolateHeaders = exports.validateHeaderTemplates = exports.isForbiddenHeaderName = exports.HEADER_NAME_PATTERN = exports.interpolateUrlTemplate = exports.validateUrlTemplate = exports.interpolateDisplayTemplate = exports.validateTemplateString = exports.extractPlaceholders = exports.API_REQUEST_METHODS = exports.API_REQUEST_MAX_VARIABLE_VALUE_LENGTH = exports.API_REQUEST_MAX_VARIABLES = exports.API_REQUEST_MAX_SELECTOR_LENGTH = exports.API_REQUEST_MAX_BODY_LENGTH = exports.API_REQUEST_MAX_URL_LENGTH = exports.API_REQUEST_TIMEOUT_DEFAULT_MS = exports.API_REQUEST_TIMEOUT_MAX_MS = exports.API_REQUEST_TIMEOUT_MIN_MS = void 0;
exports.API_REQUEST_TIMEOUT_MIN_MS = 1000;
exports.API_REQUEST_TIMEOUT_MAX_MS = 30000;
exports.API_REQUEST_TIMEOUT_DEFAULT_MS = 10000;
exports.API_REQUEST_MAX_URL_LENGTH = 2048;
exports.API_REQUEST_MAX_BODY_LENGTH = 65536;
exports.API_REQUEST_MAX_SELECTOR_LENGTH = 256;
exports.API_REQUEST_MAX_VARIABLES = 32;
exports.API_REQUEST_MAX_VARIABLE_VALUE_LENGTH = 4096;
exports.API_REQUEST_METHODS = [
    "GET",
    "POST",
    "PUT",
    "PATCH",
    "DELETE",
];
const PLACEHOLDER_NAME = "[A-Za-z_][A-Za-z0-9_]{0,63}";
const PLACEHOLDER_GLOBAL = new RegExp(`\\{\\{(${PLACEHOLDER_NAME})\\}\\}`, "g");
const WHOLE_PLACEHOLDER = new RegExp(`^\\{\\{(${PLACEHOLDER_NAME})\\}\\}$`);
const fail = (error) => ({ ok: false, error });
/** Names of every well-formed placeholder, in order of appearance. */
const extractPlaceholders = (template) => {
    const names = [];
    for (const match of template.matchAll(PLACEHOLDER_GLOBAL)) {
        names.push(match[1]);
    }
    return names;
};
exports.extractPlaceholders = extractPlaceholders;
/**
 * A template string is valid when every "{{" / "}}" belongs to a well-formed
 * placeholder. Malformed names ({{9x}}, {{a b}}) and stray braces are errors.
 */
const validateTemplateString = (template) => {
    const names = (0, exports.extractPlaceholders)(template);
    const residue = template.replace(PLACEHOLDER_GLOBAL, "");
    if (residue.includes("{{") || residue.includes("}}")) {
        return fail("Malformed placeholder; use {{variableName}}");
    }
    return { ok: true, names };
};
exports.validateTemplateString = validateTemplateString;
const substitute = (template, get, encode) => {
    const validation = (0, exports.validateTemplateString)(template);
    if (!validation.ok)
        return validation;
    let missing = null;
    const value = template.replace(PLACEHOLDER_GLOBAL, (_, name) => {
        const resolved = get(name);
        if (resolved === undefined) {
            missing = missing ?? name;
            return "";
        }
        const raw = String(resolved);
        return encode ? encode(raw) : raw;
    });
    if (missing)
        return fail(`Unknown variable {{${missing}}}`);
    return { ok: true, value };
};
/**
 * Fail-soft interpolation for display strings (alert title / message). Unlike
 * the request templates this never errors: a well-formed {{name}} whose value
 * is missing is left verbatim, so a stale or mistyped reference stays visible
 * rather than blanking the field or suppressing the whole alert. Malformed
 * braces (not a valid placeholder) are left untouched.
 */
const interpolateDisplayTemplate = (template, get) => template.replace(PLACEHOLDER_GLOBAL, (whole, name) => {
    const resolved = get(name);
    return resolved === undefined ? whole : String(resolved);
});
exports.interpolateDisplayTemplate = interpolateDisplayTemplate;
// ── URL templates ───────────────────────────────────────────────────────────
// Static origin grammar: https://host[:port] with >= 2 lowercase ASCII labels
// (same grammar as allowlist patterns; IDNs must be pre-punycoded).
const URL_ORIGIN_PATTERN = /^https:\/\/(([a-z0-9]([a-z0-9-]*[a-z0-9])?\.)+[a-z0-9]([a-z0-9-]*[a-z0-9])?)(:([0-9]{1,5}))?$/;
const splitOrigin = (template) => {
    const afterScheme = "https://".length;
    const pathStart = template.slice(afterScheme).search(/[/?#]/);
    if (pathStart === -1)
        return { origin: template, rest: "" };
    return {
        origin: template.slice(0, afterScheme + pathStart),
        rest: template.slice(afterScheme + pathStart),
    };
};
/**
 * Validates scheme + static origin (no placeholders, no userinfo, no IPv6
 * literal) and the placeholder syntax of the whole template. Returns the
 * pinned host (lowercase, no port) and explicit port if present.
 */
const validateUrlTemplate = (template) => {
    if (template.length > exports.API_REQUEST_MAX_URL_LENGTH) {
        return fail("URL is too long");
    }
    if (!/^https:\/\//i.test(template)) {
        return fail("URL must start with https://");
    }
    const { origin } = splitOrigin(template);
    if (origin.includes("{") || origin.includes("}")) {
        return fail("Placeholders are not allowed in the URL host");
    }
    if (origin.includes("@")) {
        return fail("Credentials are not allowed in the URL");
    }
    const originMatch = URL_ORIGIN_PATTERN.exec(origin.toLowerCase());
    if (!originMatch) {
        return fail("Invalid URL host");
    }
    const whole = (0, exports.validateTemplateString)(template);
    if (!whole.ok)
        return whole;
    return {
        ok: true,
        host: originMatch[1],
        port: originMatch[6] ?? null,
        names: whole.names,
    };
};
exports.validateUrlTemplate = validateUrlTemplate;
/**
 * Substitutes placeholders percent-encoded into the path/query part. The
 * origin is template-static by validation; the post-substitution recheck is
 * belt-and-braces.
 */
const interpolateUrlTemplate = (template, get) => {
    const validation = (0, exports.validateUrlTemplate)(template);
    if (!validation.ok)
        return validation;
    const { origin, rest } = splitOrigin(template);
    const substituted = substitute(rest, get, encodeURIComponent);
    if (!substituted.ok)
        return substituted;
    const url = origin + substituted.value;
    const recheck = splitOrigin(url);
    if (recheck.origin !== origin || recheck.origin.includes("@")) {
        return fail("URL host changed after interpolation");
    }
    return { ok: true, url };
};
exports.interpolateUrlTemplate = interpolateUrlTemplate;
// ── Header templates ────────────────────────────────────────────────────────
exports.HEADER_NAME_PATTERN = /^[A-Za-z0-9-]{1,64}$/;
// Never author-controllable: request framing, proxy semantics, and anything
// the platform itself sets. The connection auth header is appended per call.
const FORBIDDEN_HEADER_NAMES = new Set([
    "host",
    "content-length",
    "transfer-encoding",
    "connection",
    "upgrade",
    "te",
    "trailer",
    "expect",
    "forwarded",
]);
const FORBIDDEN_HEADER_PREFIXES = ["proxy-", "sec-", "x-forwarded-"];
const isForbiddenHeaderName = (name) => {
    const lower = name.toLowerCase();
    if (FORBIDDEN_HEADER_NAMES.has(lower))
        return true;
    return FORBIDDEN_HEADER_PREFIXES.some((prefix) => lower.startsWith(prefix));
};
exports.isForbiddenHeaderName = isForbiddenHeaderName;
const validateHeaderTemplates = (headers, options) => {
    const reserved = new Set((options?.reservedNames ?? []).map((name) => name.toLowerCase()));
    for (const header of headers) {
        if (!exports.HEADER_NAME_PATTERN.test(header.key)) {
            return fail(`Invalid header name "${header.key}"`);
        }
        if ((0, exports.isForbiddenHeaderName)(header.key)) {
            return fail(`Header "${header.key}" is not allowed`);
        }
        if (reserved.has(header.key.toLowerCase())) {
            return fail(`Header "${header.key}" is set by the connection`);
        }
        const value = (0, exports.validateTemplateString)(header.value_template);
        if (!value.ok)
            return value;
    }
    return { ok: true };
};
exports.validateHeaderTemplates = validateHeaderTemplates;
const interpolateHeaders = (headers, get, options) => {
    const validation = (0, exports.validateHeaderTemplates)(headers, options);
    if (!validation.ok)
        return validation;
    const result = [];
    for (const header of headers) {
        const substituted = substitute(header.value_template, get);
        if (!substituted.ok)
            return substituted;
        // eslint-disable-next-line no-control-regex
        if (/[\x00-\x1F\x7F]/.test(substituted.value)) {
            return fail(`Header "${header.key}" value contains control characters`);
        }
        result.push({ key: header.key, value: substituted.value });
    }
    return { ok: true, headers: result };
};
exports.interpolateHeaders = interpolateHeaders;
const collectBodyPlaceholders = (node, names) => {
    if (typeof node === "string") {
        const validation = (0, exports.validateTemplateString)(node);
        if (!validation.ok)
            return validation;
        names.push(...validation.names);
        return null;
    }
    if (Array.isArray(node)) {
        for (const item of node) {
            const error = collectBodyPlaceholders(item, names);
            if (error)
                return error;
        }
        return null;
    }
    if (node !== null && typeof node === "object") {
        for (const [key, value] of Object.entries(node)) {
            if (key.includes("{{") || key.includes("}}")) {
                return fail("Placeholders are not allowed in JSON keys");
            }
            const error = collectBodyPlaceholders(value, names);
            if (error)
                return error;
        }
    }
    return null;
};
/**
 * The body template must be JSON; placeholders may only appear inside string
 * values (a bare {{n}} outside a string is invalid JSON by construction).
 */
const validateBodyTemplate = (template) => {
    if (template.length > exports.API_REQUEST_MAX_BODY_LENGTH) {
        return fail("Body is too long");
    }
    let parsed;
    try {
        parsed = JSON.parse(template);
    }
    catch {
        return fail("Body must be valid JSON (placeholders only inside strings)");
    }
    const names = [];
    const error = collectBodyPlaceholders(parsed, names);
    if (error)
        return error;
    return { ok: true, names };
};
exports.validateBodyTemplate = validateBodyTemplate;
const interpolateBodyNode = (node, get) => {
    if (typeof node === "string") {
        const whole = WHOLE_PLACEHOLDER.exec(node);
        if (whole) {
            const resolved = get(whole[1]);
            if (resolved === undefined)
                return fail(`Unknown variable {{${whole[1]}}}`);
            return { ok: true, value: resolved };
        }
        const substituted = substitute(node, get);
        if (!substituted.ok)
            return substituted;
        return { ok: true, value: substituted.value };
    }
    if (Array.isArray(node)) {
        const items = [];
        for (const item of node) {
            const result = interpolateBodyNode(item, get);
            if (!result.ok)
                return result;
            items.push(result.value);
        }
        return { ok: true, value: items };
    }
    if (node !== null && typeof node === "object") {
        const out = {};
        for (const [key, value] of Object.entries(node)) {
            const result = interpolateBodyNode(value, get);
            if (!result.ok)
                return result;
            out[key] = result.value;
        }
        return { ok: true, value: out };
    }
    return { ok: true, value: node };
};
/**
 * Parse -> walk -> substitute (typed for whole-placeholder strings) ->
 * re-stringify. The serialiser guarantees escaping, so variable values can
 * never change the JSON structure.
 */
const interpolateJsonBody = (template, get) => {
    const validation = (0, exports.validateBodyTemplate)(template);
    if (!validation.ok)
        return validation;
    const parsed = JSON.parse(template);
    const result = interpolateBodyNode(parsed, get);
    if (!result.ok)
        return result;
    return { ok: true, body: JSON.stringify(result.value) };
};
exports.interpolateJsonBody = interpolateJsonBody;
// ── Allowlist matching ──────────────────────────────────────────────────────
/**
 * Pattern grammar: "host.tld" or "*.host.tld", optional ":port". A pattern
 * without a port matches the default HTTPS port only (no explicit port in the
 * URL); a pattern with a port matches exactly that port. The wildcard matches
 * subdomains at a label boundary, never the apex itself.
 */
const matchHostPattern = (host, port, pattern) => {
    const colon = pattern.indexOf(":");
    const patternHost = colon === -1 ? pattern : pattern.slice(0, colon);
    const patternPort = colon === -1 ? null : pattern.slice(colon + 1);
    if (patternPort === null ? port !== null : port !== patternPort) {
        return false;
    }
    const lowerHost = host.toLowerCase();
    if (patternHost.startsWith("*.")) {
        const suffix = patternHost.slice(2);
        return lowerHost.endsWith(`.${suffix}`) && lowerHost.length > suffix.length + 1;
    }
    return lowerHost === patternHost;
};
exports.matchHostPattern = matchHostPattern;
const isHostAllowlisted = (host, port, patterns) => patterns.some((pattern) => (0, exports.matchHostPattern)(host, port, pattern));
exports.isHostAllowlisted = isHostAllowlisted;
// ── Response extraction (dot-path subset) ───────────────────────────────────
// Segment: optional key followed by any number of [n] indices. The selector
// field stays a plain string so richer JSONPath can be introduced later.
const SELECTOR_SEGMENT_PATTERN = /^([A-Za-z0-9_$-]+)?((?:\[\d+\])*)$/;
const parseSelector = (selector) => {
    if (selector.length === 0 ||
        selector.length > exports.API_REQUEST_MAX_SELECTOR_LENGTH) {
        return null;
    }
    const tokens = [];
    for (const segment of selector.split(".")) {
        const match = SELECTOR_SEGMENT_PATTERN.exec(segment);
        if (!match || segment.length === 0)
            return null;
        if (match[1])
            tokens.push({ kind: "key", key: match[1] });
        if (match[2]) {
            for (const index of match[2].matchAll(/\[(\d+)\]/g)) {
                tokens.push({ kind: "index", index: Number(index[1]) });
            }
        }
    }
    return tokens.length > 0 ? tokens : null;
};
const validateSelector = (selector) => parseSelector(selector) !== null;
exports.validateSelector = validateSelector;
/** Walks `data.items[0].name`-style selectors. Missing path -> not found. */
const extractByPath = (value, selector) => {
    const tokens = parseSelector(selector);
    if (!tokens)
        return { found: false };
    let current = value;
    for (const token of tokens) {
        if (token.kind === "key") {
            if (current === null ||
                typeof current !== "object" ||
                Array.isArray(current) ||
                !(token.key in current)) {
                return { found: false };
            }
            current = current[token.key];
        }
        else {
            if (!Array.isArray(current) || token.index >= current.length) {
                return { found: false };
            }
            current = current[token.index];
        }
    }
    return { found: true, value: current };
};
exports.extractByPath = extractByPath;
/** Primitive-only, lossless-ish coercion into the variable's declared type. */
const coerceBindingValue = (value, type) => {
    if (type === "STRING") {
        if (typeof value === "string")
            return { ok: true, value };
        if (typeof value === "number" && Number.isFinite(value)) {
            return { ok: true, value: String(value) };
        }
        if (typeof value === "boolean")
            return { ok: true, value: String(value) };
        return { ok: false };
    }
    if (type === "NUMBER") {
        if (typeof value === "number" && Number.isFinite(value)) {
            return { ok: true, value };
        }
        if (typeof value === "string" && value.trim() !== "") {
            const parsed = Number(value);
            if (Number.isFinite(parsed))
                return { ok: true, value: parsed };
        }
        return { ok: false };
    }
    if (typeof value === "boolean")
        return { ok: true, value };
    if (value === "true")
        return { ok: true, value: true };
    if (value === "false")
        return { ok: true, value: false };
    return { ok: false };
};
exports.coerceBindingValue = coerceBindingValue;
// Which sources are meaningful per outcome path.
const SUCCESS_SOURCES = ["BODY", "STATUS", "OK"];
const FAILURE_SOURCES = [
    "STATUS",
    "OK",
    "ERROR_MESSAGE",
];
/**
 * Pure: resolves each applicable binding against the outcome and returns the
 * variable writes plus warnings for skipped bindings (missing path, type
 * mismatch). The caller applies writes to its variable store.
 */
const applyBindings = (bindings, outcome) => {
    const applicable = outcome.ok ? SUCCESS_SOURCES : FAILURE_SOURCES;
    const writes = [];
    const warnings = [];
    for (const binding of bindings) {
        if (!applicable.includes(binding.source))
            continue;
        let raw;
        if (binding.source === "BODY") {
            if (!binding.selector) {
                warnings.push(`Binding to ${binding.variable_name}: missing selector`);
                continue;
            }
            const extracted = (0, exports.extractByPath)(outcome.body, binding.selector);
            if (!extracted.found) {
                warnings.push(`Binding to ${binding.variable_name}: "${binding.selector}" not found in response`);
                continue;
            }
            raw = extracted.value;
        }
        else if (binding.source === "STATUS") {
            if (outcome.status === null) {
                warnings.push(`Binding to ${binding.variable_name}: no status code`);
                continue;
            }
            raw = outcome.status;
        }
        else if (binding.source === "OK") {
            raw = outcome.ok;
        }
        else {
            raw = outcome.error_message ?? "";
        }
        const coerced = (0, exports.coerceBindingValue)(raw, binding.variable_type);
        if (!coerced.ok) {
            warnings.push(`Binding to ${binding.variable_name}: value is not a ${binding.variable_type}`);
            continue;
        }
        writes.push({
            name: binding.variable_name,
            type: binding.variable_type,
            value: coerced.value,
        });
    }
    return { writes, warnings };
};
exports.applyBindings = applyBindings;
