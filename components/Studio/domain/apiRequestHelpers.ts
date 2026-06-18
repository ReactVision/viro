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

export type ApiHeaderTemplate = { key: string; value_template: string };

export const API_REQUEST_TIMEOUT_MIN_MS = 1000;
export const API_REQUEST_TIMEOUT_MAX_MS = 30000;
export const API_REQUEST_TIMEOUT_DEFAULT_MS = 10000;
export const API_REQUEST_MAX_URL_LENGTH = 2048;
export const API_REQUEST_MAX_BODY_LENGTH = 65536;
export const API_REQUEST_MAX_SELECTOR_LENGTH = 256;
export const API_REQUEST_MAX_VARIABLES = 32;
export const API_REQUEST_MAX_VARIABLE_VALUE_LENGTH = 4096;

export const API_REQUEST_METHODS = [
  "GET",
  "POST",
  "PUT",
  "PATCH",
  "DELETE",
] as const;
export type ApiRequestMethod = (typeof API_REQUEST_METHODS)[number];

const PLACEHOLDER_NAME = "[A-Za-z_][A-Za-z0-9_]{0,63}";
const PLACEHOLDER_GLOBAL = new RegExp(`\\{\\{(${PLACEHOLDER_NAME})\\}\\}`, "g");
const WHOLE_PLACEHOLDER = new RegExp(`^\\{\\{(${PLACEHOLDER_NAME})\\}\\}$`);

export type TemplateValidation =
  | { ok: true; names: string[] }
  | { ok: false; error: string };

type Fail = { ok: false; error: string };

const fail = (error: string): Fail => ({ ok: false, error });

/** Names of every well-formed placeholder, in order of appearance. */
export const extractPlaceholders = (template: string): string[] => {
  const names: string[] = [];
  for (const match of template.matchAll(PLACEHOLDER_GLOBAL)) {
    names.push(match[1]);
  }
  return names;
};

/**
 * A template string is valid when every "{{" / "}}" belongs to a well-formed
 * placeholder. Malformed names ({{9x}}, {{a b}}) and stray braces are errors.
 */
export const validateTemplateString = (template: string): TemplateValidation => {
  const names = extractPlaceholders(template);
  const residue = template.replace(PLACEHOLDER_GLOBAL, "");
  if (residue.includes("{{") || residue.includes("}}")) {
    return fail("Malformed placeholder; use {{variableName}}");
  }
  return { ok: true, names };
};

export type ValueLookup = (name: string) => ApiPrimitiveValue | undefined;

type SubstituteResult = { ok: true; value: string } | Fail;

const substitute = (
  template: string,
  get: ValueLookup,
  encode?: (raw: string) => string,
): SubstituteResult => {
  const validation = validateTemplateString(template);
  if (!validation.ok) return validation;

  let missing: string | null = null;
  const value = template.replace(PLACEHOLDER_GLOBAL, (_, name: string) => {
    const resolved = get(name);
    if (resolved === undefined) {
      missing = missing ?? name;
      return "";
    }
    const raw = String(resolved);
    return encode ? encode(raw) : raw;
  });
  if (missing) return fail(`Unknown variable {{${missing}}}`);
  return { ok: true, value };
};

/**
 * Fail-soft interpolation for display strings (alert title / message). Unlike
 * the request templates this never errors: a well-formed {{name}} whose value
 * is missing is left verbatim, so a stale or mistyped reference stays visible
 * rather than blanking the field or suppressing the whole alert. Malformed
 * braces (not a valid placeholder) are left untouched.
 */
export const interpolateDisplayTemplate = (
  template: string,
  get: ValueLookup,
): string =>
  template.replace(PLACEHOLDER_GLOBAL, (whole, name: string) => {
    const resolved = get(name);
    return resolved === undefined ? whole : String(resolved);
  });

// ── URL templates ───────────────────────────────────────────────────────────

// Static origin grammar: https://host[:port] with >= 2 lowercase ASCII labels
// (same grammar as allowlist patterns; IDNs must be pre-punycoded).
const URL_ORIGIN_PATTERN =
  /^https:\/\/(([a-z0-9]([a-z0-9-]*[a-z0-9])?\.)+[a-z0-9]([a-z0-9-]*[a-z0-9])?)(:([0-9]{1,5}))?$/;

export type UrlTemplateValidation =
  | { ok: true; host: string; port: string | null; names: string[] }
  | Fail;

const splitOrigin = (template: string): { origin: string; rest: string } => {
  const afterScheme = "https://".length;
  const pathStart = template.slice(afterScheme).search(/[/?#]/);
  if (pathStart === -1) return { origin: template, rest: "" };
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
export const validateUrlTemplate = (template: string): UrlTemplateValidation => {
  if (template.length > API_REQUEST_MAX_URL_LENGTH) {
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
  const whole = validateTemplateString(template);
  if (!whole.ok) return whole;
  return {
    ok: true,
    host: originMatch[1],
    port: originMatch[6] ?? null,
    names: whole.names,
  };
};

export type UrlInterpolation = { ok: true; url: string } | Fail;

/**
 * Substitutes placeholders percent-encoded into the path/query part. The
 * origin is template-static by validation; the post-substitution recheck is
 * belt-and-braces.
 */
export const interpolateUrlTemplate = (
  template: string,
  get: ValueLookup,
): UrlInterpolation => {
  const validation = validateUrlTemplate(template);
  if (!validation.ok) return validation;

  const { origin, rest } = splitOrigin(template);
  const substituted = substitute(rest, get, encodeURIComponent);
  if (!substituted.ok) return substituted;

  const url = origin + substituted.value;
  const recheck = splitOrigin(url);
  if (recheck.origin !== origin || recheck.origin.includes("@")) {
    return fail("URL host changed after interpolation");
  }
  return { ok: true, url };
};

// ── Header templates ────────────────────────────────────────────────────────

export const HEADER_NAME_PATTERN = /^[A-Za-z0-9-]{1,64}$/;

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

export const isForbiddenHeaderName = (name: string): boolean => {
  const lower = name.toLowerCase();
  if (FORBIDDEN_HEADER_NAMES.has(lower)) return true;
  return FORBIDDEN_HEADER_PREFIXES.some((prefix) => lower.startsWith(prefix));
};

export type HeadersValidation = { ok: true } | Fail;

export const validateHeaderTemplates = (
  headers: ApiHeaderTemplate[],
  options?: { reservedNames?: string[] },
): HeadersValidation => {
  const reserved = new Set(
    (options?.reservedNames ?? []).map((name) => name.toLowerCase()),
  );
  for (const header of headers) {
    if (!HEADER_NAME_PATTERN.test(header.key)) {
      return fail(`Invalid header name "${header.key}"`);
    }
    if (isForbiddenHeaderName(header.key)) {
      return fail(`Header "${header.key}" is not allowed`);
    }
    if (reserved.has(header.key.toLowerCase())) {
      return fail(`Header "${header.key}" is set by the connection`);
    }
    const value = validateTemplateString(header.value_template);
    if (!value.ok) return value;
  }
  return { ok: true };
};

export type HeadersInterpolation =
  | { ok: true; headers: { key: string; value: string }[] }
  | Fail;

export const interpolateHeaders = (
  headers: ApiHeaderTemplate[],
  get: ValueLookup,
  options?: { reservedNames?: string[] },
): HeadersInterpolation => {
  const validation = validateHeaderTemplates(headers, options);
  if (!validation.ok) return validation;

  const result: { key: string; value: string }[] = [];
  for (const header of headers) {
    const substituted = substitute(header.value_template, get);
    if (!substituted.ok) return substituted;
    // eslint-disable-next-line no-control-regex
    if (/[\x00-\x1F\x7F]/.test(substituted.value)) {
      return fail(`Header "${header.key}" value contains control characters`);
    }
    result.push({ key: header.key, value: substituted.value });
  }
  return { ok: true, headers: result };
};

// ── JSON body templates ─────────────────────────────────────────────────────

export type BodyValidation = { ok: true; names: string[] } | Fail;

const collectBodyPlaceholders = (
  node: unknown,
  names: string[],
): Fail | null => {
  if (typeof node === "string") {
    const validation = validateTemplateString(node);
    if (!validation.ok) return validation;
    names.push(...validation.names);
    return null;
  }
  if (Array.isArray(node)) {
    for (const item of node) {
      const error = collectBodyPlaceholders(item, names);
      if (error) return error;
    }
    return null;
  }
  if (node !== null && typeof node === "object") {
    for (const [key, value] of Object.entries(node)) {
      if (key.includes("{{") || key.includes("}}")) {
        return fail("Placeholders are not allowed in JSON keys");
      }
      const error = collectBodyPlaceholders(value, names);
      if (error) return error;
    }
  }
  return null;
};

/**
 * The body template must be JSON; placeholders may only appear inside string
 * values (a bare {{n}} outside a string is invalid JSON by construction).
 */
export const validateBodyTemplate = (template: string): BodyValidation => {
  if (template.length > API_REQUEST_MAX_BODY_LENGTH) {
    return fail("Body is too long");
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(template);
  } catch {
    return fail("Body must be valid JSON (placeholders only inside strings)");
  }
  const names: string[] = [];
  const error = collectBodyPlaceholders(parsed, names);
  if (error) return error;
  return { ok: true, names };
};

export type BodyInterpolation = { ok: true; body: string } | Fail;

const interpolateBodyNode = (
  node: unknown,
  get: ValueLookup,
): { ok: true; value: unknown } | Fail => {
  if (typeof node === "string") {
    const whole = WHOLE_PLACEHOLDER.exec(node);
    if (whole) {
      const resolved = get(whole[1]);
      if (resolved === undefined) return fail(`Unknown variable {{${whole[1]}}}`);
      return { ok: true, value: resolved };
    }
    const substituted = substitute(node, get);
    if (!substituted.ok) return substituted;
    return { ok: true, value: substituted.value };
  }
  if (Array.isArray(node)) {
    const items: unknown[] = [];
    for (const item of node) {
      const result = interpolateBodyNode(item, get);
      if (!result.ok) return result;
      items.push(result.value);
    }
    return { ok: true, value: items };
  }
  if (node !== null && typeof node === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(node)) {
      const result = interpolateBodyNode(value, get);
      if (!result.ok) return result;
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
export const interpolateJsonBody = (
  template: string,
  get: ValueLookup,
): BodyInterpolation => {
  const validation = validateBodyTemplate(template);
  if (!validation.ok) return validation;
  const parsed: unknown = JSON.parse(template);
  const result = interpolateBodyNode(parsed, get);
  if (!result.ok) return result;
  return { ok: true, body: JSON.stringify(result.value) };
};

// ── Allowlist matching ──────────────────────────────────────────────────────

/**
 * Pattern grammar: "host.tld" or "*.host.tld", optional ":port". A pattern
 * without a port matches the default HTTPS port only (no explicit port in the
 * URL); a pattern with a port matches exactly that port. The wildcard matches
 * subdomains at a label boundary, never the apex itself.
 */
export const matchHostPattern = (
  host: string,
  port: string | null,
  pattern: string,
): boolean => {
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

export const isHostAllowlisted = (
  host: string,
  port: string | null,
  patterns: string[],
): boolean => patterns.some((pattern) => matchHostPattern(host, port, pattern));

// ── Response extraction (dot-path subset) ───────────────────────────────────

// Segment: optional key followed by any number of [n] indices. The selector
// field stays a plain string so richer JSONPath can be introduced later.
const SELECTOR_SEGMENT_PATTERN = /^([A-Za-z0-9_$-]+)?((?:\[\d+\])*)$/;

type SelectorToken = { kind: "key"; key: string } | { kind: "index"; index: number };

const parseSelector = (selector: string): SelectorToken[] | null => {
  if (
    selector.length === 0 ||
    selector.length > API_REQUEST_MAX_SELECTOR_LENGTH
  ) {
    return null;
  }
  const tokens: SelectorToken[] = [];
  for (const segment of selector.split(".")) {
    const match = SELECTOR_SEGMENT_PATTERN.exec(segment);
    if (!match || segment.length === 0) return null;
    if (match[1]) tokens.push({ kind: "key", key: match[1] });
    if (match[2]) {
      for (const index of match[2].matchAll(/\[(\d+)\]/g)) {
        tokens.push({ kind: "index", index: Number(index[1]) });
      }
    }
  }
  return tokens.length > 0 ? tokens : null;
};

export const validateSelector = (selector: string): boolean =>
  parseSelector(selector) !== null;

export type ExtractionResult = { found: true; value: unknown } | { found: false };

/** Walks `data.items[0].name`-style selectors. Missing path -> not found. */
export const extractByPath = (
  value: unknown,
  selector: string,
): ExtractionResult => {
  const tokens = parseSelector(selector);
  if (!tokens) return { found: false };

  let current: unknown = value;
  for (const token of tokens) {
    if (token.kind === "key") {
      if (
        current === null ||
        typeof current !== "object" ||
        Array.isArray(current) ||
        !(token.key in (current as Record<string, unknown>))
      ) {
        return { found: false };
      }
      current = (current as Record<string, unknown>)[token.key];
    } else {
      if (!Array.isArray(current) || token.index >= current.length) {
        return { found: false };
      }
      current = current[token.index];
    }
  }
  return { found: true, value: current };
};

// ── Bindings ────────────────────────────────────────────────────────────────

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

export type CoercionResult = { ok: true; value: ApiPrimitiveValue } | { ok: false };

/** Primitive-only, lossless-ish coercion into the variable's declared type. */
export const coerceBindingValue = (
  value: unknown,
  type: ApiVariableType,
): CoercionResult => {
  if (type === "STRING") {
    if (typeof value === "string") return { ok: true, value };
    if (typeof value === "number" && Number.isFinite(value)) {
      return { ok: true, value: String(value) };
    }
    if (typeof value === "boolean") return { ok: true, value: String(value) };
    return { ok: false };
  }
  if (type === "NUMBER") {
    if (typeof value === "number" && Number.isFinite(value)) {
      return { ok: true, value };
    }
    if (typeof value === "string" && value.trim() !== "") {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) return { ok: true, value: parsed };
    }
    return { ok: false };
  }
  if (typeof value === "boolean") return { ok: true, value };
  if (value === "true") return { ok: true, value: true };
  if (value === "false") return { ok: true, value: false };
  return { ok: false };
};

export type ApiRequestBindingWrite = {
  name: string;
  type: ApiVariableType;
  value: ApiPrimitiveValue;
};

export type BindingApplication = {
  writes: ApiRequestBindingWrite[];
  warnings: string[];
};

// Which sources are meaningful per outcome path.
const SUCCESS_SOURCES: ApiRequestBindingSource[] = ["BODY", "STATUS", "OK"];
const FAILURE_SOURCES: ApiRequestBindingSource[] = [
  "STATUS",
  "OK",
  "ERROR_MESSAGE",
];

/**
 * Pure: resolves each applicable binding against the outcome and returns the
 * variable writes plus warnings for skipped bindings (missing path, type
 * mismatch). The caller applies writes to its variable store.
 */
export const applyBindings = (
  bindings: ApiRequestBindingInput[],
  outcome: ApiRequestOutcomeInput,
): BindingApplication => {
  const applicable = outcome.ok ? SUCCESS_SOURCES : FAILURE_SOURCES;
  const writes: ApiRequestBindingWrite[] = [];
  const warnings: string[] = [];

  for (const binding of bindings) {
    if (!applicable.includes(binding.source)) continue;

    let raw: unknown;
    if (binding.source === "BODY") {
      if (!binding.selector) {
        warnings.push(`Binding to ${binding.variable_name}: missing selector`);
        continue;
      }
      const extracted = extractByPath(outcome.body, binding.selector);
      if (!extracted.found) {
        warnings.push(
          `Binding to ${binding.variable_name}: "${binding.selector}" not found in response`,
        );
        continue;
      }
      raw = extracted.value;
    } else if (binding.source === "STATUS") {
      if (outcome.status === null) {
        warnings.push(`Binding to ${binding.variable_name}: no status code`);
        continue;
      }
      raw = outcome.status;
    } else if (binding.source === "OK") {
      raw = outcome.ok;
    } else {
      raw = outcome.error_message ?? "";
    }

    const coerced = coerceBindingValue(raw, binding.variable_type);
    if (!coerced.ok) {
      warnings.push(
        `Binding to ${binding.variable_name}: value is not a ${binding.variable_type}`,
      );
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
