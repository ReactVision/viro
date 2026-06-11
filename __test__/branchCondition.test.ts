import {
  evaluateBranchCondition,
  type BranchConditionInput,
  type StudioVariableValue,
} from "../components/Studio/domain/expressionEvaluator";

const STORE: Record<string, StudioVariableValue> = {
  score: 7,
  limit: 10,
  name: "Anna",
  done: false,
};

const get = (name: string): StudioVariableValue | undefined => STORE[name];

const cond = (overrides: Partial<BranchConditionInput>): BranchConditionInput => ({
  comparison: "EQUALS",
  variable_name: "score",
  compare_literal: null,
  compare_variable_name: null,
  ...overrides,
});

describe("evaluateBranchCondition", () => {
  test("EQUALS literal", () => {
    expect(evaluateBranchCondition(cond({ compare_literal: 7 }), get)).toEqual({
      ok: true,
      value: true,
    });
    expect(evaluateBranchCondition(cond({ compare_literal: 8 }), get)).toEqual({
      ok: true,
      value: false,
    });
  });

  test("NOT_EQUALS literal", () => {
    expect(
      evaluateBranchCondition(cond({ comparison: "NOT_EQUALS", compare_literal: 8 }), get),
    ).toEqual({ ok: true, value: true });
  });

  test("GREATER_THAN and LESS_THAN", () => {
    expect(
      evaluateBranchCondition(cond({ comparison: "GREATER_THAN", compare_literal: 5 }), get),
    ).toEqual({ ok: true, value: true });
    expect(
      evaluateBranchCondition(cond({ comparison: "LESS_THAN", compare_literal: 5 }), get),
    ).toEqual({ ok: true, value: false });
  });

  test("GREATER_OR_EQUAL and LESS_OR_EQUAL", () => {
    expect(
      evaluateBranchCondition(cond({ comparison: "GREATER_OR_EQUAL", compare_literal: 7 }), get),
    ).toEqual({ ok: true, value: true });
    expect(
      evaluateBranchCondition(cond({ comparison: "LESS_OR_EQUAL", compare_literal: 7 }), get),
    ).toEqual({ ok: true, value: true });
    expect(
      evaluateBranchCondition(cond({ comparison: "LESS_OR_EQUAL", compare_literal: 6 }), get),
    ).toEqual({ ok: true, value: false });
  });

  test("LIKE patterns", () => {
    const nameCond = (pattern: string) =>
      cond({ comparison: "LIKE" as const, variable_name: "name", compare_literal: pattern });
    expect(evaluateBranchCondition(nameCond("Anna"), get)).toEqual({ ok: true, value: true });
    expect(evaluateBranchCondition(nameCond("An%"), get)).toEqual({ ok: true, value: true });
    expect(evaluateBranchCondition(nameCond("%nn%"), get)).toEqual({ ok: true, value: true });
    expect(evaluateBranchCondition(nameCond("A_na"), get)).toEqual({ ok: true, value: true });
    expect(evaluateBranchCondition(nameCond("anna"), get)).toEqual({ ok: true, value: false });
    expect(evaluateBranchCondition(nameCond("An_"), get)).toEqual({ ok: true, value: false });
    // Regex metacharacters in the pattern stay literal.
    expect(evaluateBranchCondition(nameCond("An.a"), get)).toEqual({ ok: true, value: false });
  });

  test("ILIKE is case-insensitive", () => {
    expect(
      evaluateBranchCondition(
        cond({ comparison: "ILIKE", variable_name: "name", compare_literal: "anna" }),
        get,
      ),
    ).toEqual({ ok: true, value: true });
    expect(
      evaluateBranchCondition(
        cond({ comparison: "ILIKE", variable_name: "name", compare_literal: "%NN%" }),
        get,
      ),
    ).toEqual({ ok: true, value: true });
  });

  test("LIKE on non-strings fails", () => {
    expect(
      evaluateBranchCondition(cond({ comparison: "LIKE", compare_literal: 7 }), get).ok,
    ).toBe(false);
    expect(
      evaluateBranchCondition(
        cond({ comparison: "ILIKE", variable_name: "done", compare_literal: "tru%" }),
        get,
      ).ok,
    ).toBe(false);
  });

  test("GREATER_OR_EQUAL on strings fails", () => {
    expect(
      evaluateBranchCondition(
        cond({ comparison: "GREATER_OR_EQUAL", variable_name: "name", compare_literal: "A" }),
        get,
      ).ok,
    ).toBe(false);
  });

  test("variable operand", () => {
    expect(
      evaluateBranchCondition(
        cond({ comparison: "LESS_THAN", compare_variable_name: "limit" }),
        get,
      ),
    ).toEqual({ ok: true, value: true });
  });

  test("boolean and string equality", () => {
    expect(
      evaluateBranchCondition(
        cond({ variable_name: "done", compare_literal: false }),
        get,
      ),
    ).toEqual({ ok: true, value: true });
    expect(
      evaluateBranchCondition(
        cond({ variable_name: "name", compare_literal: "Anna" }),
        get,
      ),
    ).toEqual({ ok: true, value: true });
  });

  test("cross-type EQUALS fails", () => {
    const result = evaluateBranchCondition(
      cond({ variable_name: "name", compare_literal: 7 }),
      get,
    );
    expect(result.ok).toBe(false);
  });

  test("GREATER_THAN on strings fails", () => {
    const result = evaluateBranchCondition(
      cond({ comparison: "GREATER_THAN", variable_name: "name", compare_literal: "Zoe" }),
      get,
    );
    expect(result.ok).toBe(false);
  });

  test("missing variable fails", () => {
    expect(evaluateBranchCondition(cond({ variable_name: "ghost", compare_literal: 1 }), get).ok).toBe(false);
    expect(
      evaluateBranchCondition(cond({ compare_variable_name: "ghost" }), get).ok,
    ).toBe(false);
  });

  test("no operand fails", () => {
    expect(evaluateBranchCondition(cond({}), get).ok).toBe(false);
  });
});
