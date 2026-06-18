import {
  applyBindings,
  coerceBindingValue,
  extractByPath,
  extractPlaceholders,
  interpolateDisplayTemplate,
  interpolateHeaders,
  interpolateJsonBody,
  interpolateUrlTemplate,
  isHostAllowlisted,
  matchHostPattern,
  validateBodyTemplate,
  validateHeaderTemplates,
  validateSelector,
  validateTemplateString,
  validateUrlTemplate,
  type ApiPrimitiveValue,
  type ApiRequestBindingInput,
} from "../components/Studio/domain/apiRequestHelpers";

const VALUES: Record<string, ApiPrimitiveValue> = {
  userId: 42,
  name: "Anna Lee",
  active: true,
  token: "abc/123 456",
};

const get = (name: string): ApiPrimitiveValue | undefined => VALUES[name];

describe("validateTemplateString / extractPlaceholders", () => {
  test("accepts plain text and well-formed placeholders", () => {
    expect(validateTemplateString("no placeholders")).toEqual({
      ok: true,
      names: [],
    });
    expect(validateTemplateString("a {{userId}} b {{name}}")).toEqual({
      ok: true,
      names: ["userId", "name"],
    });
  });

  test("rejects malformed names and stray braces", () => {
    expect(validateTemplateString("{{9bad}}").ok).toBe(false);
    expect(validateTemplateString("{{a b}}").ok).toBe(false);
    expect(validateTemplateString("unclosed {{name").ok).toBe(false);
    expect(validateTemplateString("stray }} here").ok).toBe(false);
  });

  test("extracts names in order of appearance", () => {
    expect(extractPlaceholders("{{name}}-{{userId}}-{{name}}")).toEqual([
      "name",
      "userId",
      "name",
    ]);
  });
});

describe("interpolateDisplayTemplate", () => {
  test("substitutes resolved values, stringifying non-strings", () => {
    expect(interpolateDisplayTemplate("Hi {{name}}, you are {{userId}}", get)).toBe(
      "Hi Anna Lee, you are 42",
    );
    expect(interpolateDisplayTemplate("active={{active}}", get)).toBe(
      "active=true",
    );
  });

  test("leaves unresolved placeholders literal (fail-soft)", () => {
    expect(interpolateDisplayTemplate("score is {{missing}}", get)).toBe(
      "score is {{missing}}",
    );
  });

  test("leaves malformed braces untouched", () => {
    expect(interpolateDisplayTemplate("{{9bad}} and {{a b}}", get)).toBe(
      "{{9bad}} and {{a b}}",
    );
  });
});

describe("validateUrlTemplate", () => {
  test("accepts https URL with static origin", () => {
    const result = validateUrlTemplate("https://api.acme.com/v1/users/{{userId}}");
    expect(result).toEqual({
      ok: true,
      host: "api.acme.com",
      port: null,
      names: ["userId"],
    });
  });

  test("extracts an explicit port", () => {
    const result = validateUrlTemplate("https://api.acme.com:8443/path");
    expect(result.ok && result.port).toBe("8443");
  });

  test("lowercases the host", () => {
    const result = validateUrlTemplate("https://API.Acme.COM/x");
    expect(result.ok && result.host).toBe("api.acme.com");
  });

  test("rejects non-https, placeholder hosts, userinfo, single labels", () => {
    expect(validateUrlTemplate("http://api.acme.com/x").ok).toBe(false);
    expect(validateUrlTemplate("https://{{host}}/x").ok).toBe(false);
    expect(validateUrlTemplate("https://user:pw@api.acme.com/x").ok).toBe(false);
    expect(validateUrlTemplate("https://{{x}}@api.acme.com/x").ok).toBe(false);
    expect(validateUrlTemplate("https://localhost/x").ok).toBe(false);
    expect(validateUrlTemplate("https://[::1]/x").ok).toBe(false);
  });
});

describe("interpolateUrlTemplate", () => {
  test("substitutes percent-encoded values", () => {
    const result = interpolateUrlTemplate(
      "https://api.acme.com/users/{{userId}}?q={{token}}",
      get,
    );
    expect(result).toEqual({
      ok: true,
      url: "https://api.acme.com/users/42?q=abc%2F123%20456",
    });
  });

  test("fails closed on unknown variables", () => {
    expect(
      interpolateUrlTemplate("https://api.acme.com/{{missing}}", get).ok,
    ).toBe(false);
  });

  test("passes through templates without placeholders", () => {
    expect(interpolateUrlTemplate("https://api.acme.com/v1", get)).toEqual({
      ok: true,
      url: "https://api.acme.com/v1",
    });
  });
});

describe("header templates", () => {
  test("accepts normal headers", () => {
    expect(
      validateHeaderTemplates([
        { key: "Accept", value_template: "application/json" },
        { key: "X-User", value_template: "{{name}}" },
      ]),
    ).toEqual({ ok: true });
  });

  test("rejects forbidden and reserved names", () => {
    expect(validateHeaderTemplates([{ key: "Host", value_template: "x" }]).ok).toBe(false);
    expect(
      validateHeaderTemplates([{ key: "X-Forwarded-For", value_template: "x" }]).ok,
    ).toBe(false);
    expect(
      validateHeaderTemplates([{ key: "Proxy-Auth", value_template: "x" }]).ok,
    ).toBe(false);
    expect(
      validateHeaderTemplates([{ key: "Sec-Fetch-Site", value_template: "x" }]).ok,
    ).toBe(false);
    expect(
      validateHeaderTemplates([{ key: "Authorization", value_template: "x" }], {
        reservedNames: ["Authorization"],
      }).ok,
    ).toBe(false);
  });

  test("rejects invalid header name characters", () => {
    expect(
      validateHeaderTemplates([{ key: "X User", value_template: "x" }]).ok,
    ).toBe(false);
  });

  test("interpolates values and rejects control characters", () => {
    expect(
      interpolateHeaders([{ key: "X-User", value_template: "{{name}}" }], get),
    ).toEqual({ ok: true, headers: [{ key: "X-User", value: "Anna Lee" }] });

    const injected = interpolateHeaders(
      [{ key: "X-User", value_template: "{{evil}}" }],
      () => "a\r\nX-Injected: 1",
    );
    expect(injected.ok).toBe(false);
  });
});

describe("body templates", () => {
  test("placeholders outside strings are invalid JSON", () => {
    expect(validateBodyTemplate('{"count": {{userId}}}').ok).toBe(false);
  });

  test("placeholders in keys are rejected", () => {
    expect(validateBodyTemplate('{"{{name}}": 1}').ok).toBe(false);
  });

  test("whole-placeholder strings substitute typed values", () => {
    const result = interpolateJsonBody(
      '{"id": "{{userId}}", "active": "{{active}}", "label": "user {{userId}}"}',
      get,
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(JSON.parse(result.body)).toEqual({
        id: 42,
        active: true,
        label: "user 42",
      });
    }
  });

  test("variable values cannot change the JSON structure", () => {
    const result = interpolateJsonBody(
      '{"name": "{{evil}}"}',
      () => '", "admin": true, "x": "',
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      const parsed = JSON.parse(result.body);
      expect(parsed).toEqual({ name: '", "admin": true, "x": "' });
      expect(parsed.admin).toBeUndefined();
    }
  });

  test("nested arrays and objects substitute recursively", () => {
    const result = interpolateJsonBody(
      '{"items": [{"id": "{{userId}}"}, "plain"], "n": 1}',
      get,
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(JSON.parse(result.body)).toEqual({
        items: [{ id: 42 }, "plain"],
        n: 1,
      });
    }
  });

  test("fails closed on unknown variables", () => {
    expect(interpolateJsonBody('{"a": "{{missing}}"}', get).ok).toBe(false);
  });
});

describe("allowlist matching", () => {
  test("exact host, case-insensitive", () => {
    expect(matchHostPattern("api.acme.com", null, "api.acme.com")).toBe(true);
    expect(matchHostPattern("API.ACME.COM", null, "api.acme.com")).toBe(true);
    expect(matchHostPattern("api.other.com", null, "api.acme.com")).toBe(false);
  });

  test("wildcard matches subdomains at a label boundary, never the apex", () => {
    expect(matchHostPattern("api.acme.com", null, "*.acme.com")).toBe(true);
    expect(matchHostPattern("a.b.acme.com", null, "*.acme.com")).toBe(true);
    expect(matchHostPattern("acme.com", null, "*.acme.com")).toBe(false);
    expect(matchHostPattern("evilacme.com", null, "*.acme.com")).toBe(false);
  });

  test("portless patterns match the default port only", () => {
    expect(matchHostPattern("api.acme.com", "8443", "api.acme.com")).toBe(false);
    expect(matchHostPattern("api.acme.com", "8443", "api.acme.com:8443")).toBe(true);
    expect(matchHostPattern("api.acme.com", null, "api.acme.com:8443")).toBe(false);
  });

  test("empty allowlist denies", () => {
    expect(isHostAllowlisted("api.acme.com", null, [])).toBe(false);
  });
});

describe("extractByPath", () => {
  const body = {
    data: {
      items: [{ name: "first" }, { name: "second" }],
      count: 2,
      "kebab-key": true,
    },
    ok: false,
  };

  test("walks keys, indices and mixed segments", () => {
    expect(extractByPath(body, "data.count")).toEqual({ found: true, value: 2 });
    expect(extractByPath(body, "data.items[1].name")).toEqual({
      found: true,
      value: "second",
    });
    expect(extractByPath(body, "data.kebab-key")).toEqual({
      found: true,
      value: true,
    });
    expect(extractByPath([10, 20], "[1]")).toEqual({ found: true, value: 20 });
  });

  test("missing paths are not found", () => {
    expect(extractByPath(body, "data.missing")).toEqual({ found: false });
    expect(extractByPath(body, "data.items[9].name")).toEqual({ found: false });
    expect(extractByPath(body, "data.count.deeper")).toEqual({ found: false });
  });

  test("selector validation", () => {
    expect(validateSelector("data.items[0].name")).toBe(true);
    expect(validateSelector("")).toBe(false);
    expect(validateSelector("a..b")).toBe(false);
    expect(validateSelector("a[x]")).toBe(false);
  });
});

describe("coerceBindingValue", () => {
  test("STRING accepts primitives, rejects structures", () => {
    expect(coerceBindingValue("x", "STRING")).toEqual({ ok: true, value: "x" });
    expect(coerceBindingValue(7, "STRING")).toEqual({ ok: true, value: "7" });
    expect(coerceBindingValue(true, "STRING")).toEqual({ ok: true, value: "true" });
    expect(coerceBindingValue({ a: 1 }, "STRING").ok).toBe(false);
    expect(coerceBindingValue(null, "STRING").ok).toBe(false);
  });

  test("NUMBER accepts numbers and numeric strings", () => {
    expect(coerceBindingValue(7.5, "NUMBER")).toEqual({ ok: true, value: 7.5 });
    expect(coerceBindingValue("12", "NUMBER")).toEqual({ ok: true, value: 12 });
    expect(coerceBindingValue("abc", "NUMBER").ok).toBe(false);
    expect(coerceBindingValue(true, "NUMBER").ok).toBe(false);
    expect(coerceBindingValue(Number.NaN, "NUMBER").ok).toBe(false);
  });

  test("BOOLEAN accepts booleans and 'true'/'false'", () => {
    expect(coerceBindingValue(false, "BOOLEAN")).toEqual({ ok: true, value: false });
    expect(coerceBindingValue("true", "BOOLEAN")).toEqual({ ok: true, value: true });
    expect(coerceBindingValue(1, "BOOLEAN").ok).toBe(false);
  });
});

describe("applyBindings", () => {
  const bindings: ApiRequestBindingInput[] = [
    {
      source: "BODY",
      selector: "data.items[0].name",
      variable_name: "firstName",
      variable_type: "STRING",
    },
    { source: "STATUS", selector: null, variable_name: "status", variable_type: "NUMBER" },
    { source: "OK", selector: null, variable_name: "ok", variable_type: "BOOLEAN" },
    {
      source: "ERROR_MESSAGE",
      selector: null,
      variable_name: "error",
      variable_type: "STRING",
    },
  ];

  test("success outcome applies BODY/STATUS/OK and skips ERROR_MESSAGE", () => {
    const { writes, warnings } = applyBindings(bindings, {
      ok: true,
      status: 200,
      body: { data: { items: [{ name: "first" }] } },
    });
    expect(warnings).toEqual([]);
    expect(writes).toEqual([
      { name: "firstName", type: "STRING", value: "first" },
      { name: "status", type: "NUMBER", value: 200 },
      { name: "ok", type: "BOOLEAN", value: true },
    ]);
  });

  test("failure outcome applies STATUS/OK/ERROR_MESSAGE and skips BODY", () => {
    const { writes } = applyBindings(bindings, {
      ok: false,
      status: 503,
      error_message: "Service unavailable",
    });
    expect(writes).toEqual([
      { name: "status", type: "NUMBER", value: 503 },
      { name: "ok", type: "BOOLEAN", value: false },
      { name: "error", type: "STRING", value: "Service unavailable" },
    ]);
  });

  test("missing paths and type mismatches warn and skip", () => {
    const { writes, warnings } = applyBindings(
      [
        {
          source: "BODY",
          selector: "missing.path",
          variable_name: "a",
          variable_type: "STRING",
        },
        {
          source: "BODY",
          selector: "data",
          variable_name: "b",
          variable_type: "NUMBER",
        },
      ],
      { ok: true, status: 200, body: { data: { nested: true } } },
    );
    expect(writes).toEqual([]);
    expect(warnings).toHaveLength(2);
  });

  test("null status warns and skips the STATUS binding", () => {
    const { writes, warnings } = applyBindings(
      [{ source: "STATUS", selector: null, variable_name: "s", variable_type: "NUMBER" }],
      { ok: false, status: null, error_message: "timeout" },
    );
    expect(writes).toEqual([]);
    expect(warnings).toHaveLength(1);
  });
});
