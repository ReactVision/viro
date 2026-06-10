import {
  checkTypes,
  compare,
  evaluate,
  formatLiteral,
  parseExpression,
  renameIdentifier,
  validateExpressionForTarget,
  valueMatchesType,
  type StudioVariableType,
  type StudioVariableValue,
} from "../components/Studio/domain/expressionEvaluator";

const DECLARED: Record<string, StudioVariableType> = {
  score: "NUMBER",
  count: "NUMBER",
  name: "STRING",
  done: "BOOLEAN",
};

const STORE: Record<string, StudioVariableValue> = {
  score: 7,
  count: 2,
  name: "Anna",
  done: false,
};

const get = (key: string) => STORE[key];

function evalSrc(src: string): StudioVariableValue {
  const parsed = parseExpression(src);
  if (!parsed.ok) throw new Error(parsed.error);
  const result = evaluate(parsed.ast, get);
  if (!result.ok) throw new Error(result.error);
  return result.value;
}

describe("parseExpression", () => {
  it("parses literals", () => {
    expect(evalSrc("5")).toBe(5);
    expect(evalSrc("2.5")).toBe(2.5);
    expect(evalSrc("true")).toBe(true);
    expect(evalSrc("false")).toBe(false);
    expect(evalSrc('"hi"')).toBe("hi");
    expect(evalSrc("'hi'")).toBe("hi");
  });

  it("parses string escapes", () => {
    expect(evalSrc('"a\\"b"')).toBe('a"b');
    expect(evalSrc("'a\\'b'")).toBe("a'b");
    expect(evalSrc('"a\\\\b"')).toBe("a\\b");
    expect(evalSrc('"a\\nb"')).toBe("a\nb");
    expect(evalSrc('"a\\tb"')).toBe("a\tb");
  });

  it("collects referenced identifiers", () => {
    const parsed = parseExpression("score + count * score");
    expect(parsed.ok).toBe(true);
    if (parsed.ok) expect(parsed.refs.sort()).toEqual(["count", "score"]);
  });

  it("rejects malformed input", () => {
    expect(parseExpression("").ok).toBe(false);
    expect(parseExpression("   ").ok).toBe(false);
    expect(parseExpression("1 +").ok).toBe(false);
    expect(parseExpression("(1 + 2").ok).toBe(false);
    expect(parseExpression('"unterminated').ok).toBe(false);
    expect(parseExpression("a # b").ok).toBe(false);
    expect(parseExpression("a = 1").ok).toBe(false);
    expect(parseExpression("1 2").ok).toBe(false);
  });

  it("rejects expressions over the length cap", () => {
    expect(parseExpression(`1 + ${"1 + ".repeat(200)}1`).ok).toBe(false);
  });
});

describe("evaluate", () => {
  it("applies arithmetic precedence", () => {
    expect(evalSrc("1 + 2 * 3")).toBe(7);
    expect(evalSrc("(1 + 2) * 3")).toBe(9);
    expect(evalSrc("10 - 4 / 2")).toBe(8);
    expect(evalSrc("-score + 1")).toBe(-6);
    expect(evalSrc("2 * -3")).toBe(-6);
  });

  it("reads variables from the store", () => {
    expect(evalSrc("score + 1")).toBe(8);
    expect(evalSrc("score * count")).toBe(14);
  });

  it("concatenates when either + side is a String", () => {
    expect(evalSrc('name + " done"')).toBe("Anna done");
    expect(evalSrc('"score: " + score')).toBe("score: 7");
    expect(evalSrc('"done: " + done')).toBe("done: false");
  });

  it("evaluates comparisons and logic with short-circuit", () => {
    expect(evalSrc("score > 5")).toBe(true);
    expect(evalSrc("score <= 7")).toBe(true);
    expect(evalSrc("score == 7 && !done")).toBe(true);
    expect(evalSrc('name == "Anna" || done')).toBe(true);
    expect(evalSrc("score != 7")).toBe(false);
    // short-circuit: right side would error (boolean && number) but is never reached
    expect(evalSrc("done && score > 100")).toBe(false);
  });

  it("fails on missing variables", () => {
    const parsed = parseExpression("ghost + 1");
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      const result = evaluate(parsed.ast, get);
      expect(result.ok).toBe(false);
    }
  });

  it("fails on non-finite results", () => {
    expect(() => evalSrc("1 / 0")).toThrow();
    expect(() => evalSrc("0 / 0")).toThrow();
  });

  it("fails on runtime type mismatches", () => {
    const parsed = parseExpression("name - 1");
    expect(parsed.ok).toBe(true);
    if (parsed.ok) expect(evaluate(parsed.ast, get).ok).toBe(false);
  });
});

describe("checkTypes", () => {
  function typeOf(src: string) {
    const parsed = parseExpression(src);
    if (!parsed.ok) throw new Error(parsed.error);
    return checkTypes(parsed.ast, DECLARED);
  }

  it("infers result types", () => {
    expect(typeOf("score + 1")).toEqual({ ok: true, type: "NUMBER" });
    expect(typeOf('name + "!"')).toEqual({ ok: true, type: "STRING" });
    expect(typeOf('"n: " + score')).toEqual({ ok: true, type: "STRING" });
    expect(typeOf("score > 1 && done")).toEqual({ ok: true, type: "BOOLEAN" });
    expect(typeOf("!done")).toEqual({ ok: true, type: "BOOLEAN" });
  });

  it("rejects type errors", () => {
    expect(typeOf("name - 1").ok).toBe(false);
    expect(typeOf("done + 1").ok).toBe(false);
    expect(typeOf('name > "a"').ok).toBe(false);
    expect(typeOf("score == done").ok).toBe(false);
    expect(typeOf("score && done").ok).toBe(false);
    expect(typeOf("!score").ok).toBe(false);
    expect(typeOf("-name").ok).toBe(false);
    expect(typeOf("unknown_var + 1").ok).toBe(false);
  });

  it("validates against a target type", () => {
    expect(validateExpressionForTarget("score + 1", "NUMBER", DECLARED).ok).toBe(true);
    expect(validateExpressionForTarget('"5"', "NUMBER", DECLARED).ok).toBe(false);
    expect(validateExpressionForTarget("score > 3", "BOOLEAN", DECLARED).ok).toBe(true);
    expect(validateExpressionForTarget("nope + 1", "NUMBER", DECLARED).ok).toBe(false);
    expect(validateExpressionForTarget("1 +", "NUMBER", DECLARED).ok).toBe(false);
  });
});

describe("compare", () => {
  it("compares same-type values", () => {
    expect(compare("==", "a", "a")).toBe(true);
    expect(compare("!=", true, false)).toBe(true);
    expect(compare("<", 1, 2)).toBe(true);
    expect(compare(">=", 2, 2)).toBe(true);
  });

  it("throws on operand mismatches", () => {
    expect(() => compare("==", "1", 1)).toThrow();
    expect(() => compare("<", "a", "b")).toThrow();
  });
});

describe("editor helpers", () => {
  it("valueMatchesType", () => {
    expect(valueMatchesType(1, "NUMBER")).toBe(true);
    expect(valueMatchesType("1", "NUMBER")).toBe(false);
    expect(valueMatchesType(true, "BOOLEAN")).toBe(true);
    expect(valueMatchesType("x", "STRING")).toBe(true);
  });

  it("formatLiteral round-trips through the parser", () => {
    for (const value of [5, 2.5, true, false, "plain", 'quo"te', "back\\slash"] as const) {
      expect(evalSrc(formatLiteral(value))).toBe(value);
    }
  });

  it("renameIdentifier rewrites only matching identifiers", () => {
    expect(renameIdentifier("score + 1", "score", "points")).toBe("points + 1");
    expect(renameIdentifier("score + scoreTotal", "score", "points")).toBe(
      "points + scoreTotal",
    );
    // occurrences inside strings are untouched
    expect(renameIdentifier('"score: " + score', "score", "points")).toBe(
      '"score: " + points',
    );
    // formatting is preserved
    expect(renameIdentifier("score  +  ( score*2 )", "score", "p")).toBe(
      "p  +  ( p*2 )",
    );
    // unparseable input is returned unchanged
    expect(renameIdentifier('"broken', "score", "points")).toBe('"broken');
  });
});
