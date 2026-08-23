/**
 * Studio expression evaluator: parses and evaluates the literal-or-expression
 * values written by SET_VARIABLE steps (and, later, reused by Branch
 * conditions via compare()). Hand-rolled tokenizer + recursive descent over a
 * fixed grammar — never eval()/Function().
 *
 * Dual-maintained: this file exists in the Viro repo
 * (components/Studio/domain/) and the ReactVisionStudio monorepo
 * (packages/common/scene-assets/). Keep the two copies identical.
 *
 * Grammar (precedence low → high):
 *   or         := and ( "||" and )*                          Boolean operands
 *   and        := equality ( "&&" equality )*                Boolean operands
 *   equality   := relational ( ("=="|"!=") relational )*     same-type operands
 *   relational := additive ( ("<"|"<="|">"|">=") additive )* Number only
 *   additive   := multiplicative ( ("+"|"-") multiplicative )*
 *                 "+" adds Numbers, or concatenates if either side is a String
 *   multiplicative := unary ( ("*"|"/") unary )*             Number only
 *   unary      := ("!"|"-") unary | primary
 *   primary    := NUMBER | STRING | "true" | "false" | IDENT | "(" or ")"
 */
export type StudioVariableType = "BOOLEAN" | "NUMBER" | "STRING";
export type StudioVariableValue = boolean | number | string;
export declare const MAX_EXPRESSION_LENGTH = 500;
export declare const VARIABLE_NAME_PATTERN: RegExp;
type BinaryOp = "||" | "&&" | "==" | "!=" | "<" | "<=" | ">" | ">=" | "+" | "-" | "*" | "/";
type UnaryOp = "!" | "-";
export type ExpressionNode = {
    kind: "literal";
    value: StudioVariableValue;
} | {
    kind: "variable";
    name: string;
} | {
    kind: "unary";
    op: UnaryOp;
    operand: ExpressionNode;
} | {
    kind: "binary";
    op: BinaryOp;
    left: ExpressionNode;
    right: ExpressionNode;
};
export type ParseResult = {
    ok: true;
    ast: ExpressionNode;
    refs: string[];
} | {
    ok: false;
    error: string;
};
export type TypeCheckResult = {
    ok: true;
    type: StudioVariableType;
} | {
    ok: false;
    error: string;
};
export type EvaluateResult = {
    ok: true;
    value: StudioVariableValue;
} | {
    ok: false;
    error: string;
};
export declare function parseExpression(src: string): ParseResult;
export declare function checkTypes(node: ExpressionNode, declared: Record<string, StudioVariableType>): TypeCheckResult;
/** Parse + type-check an expression against a target variable's type in one call. */
export declare function validateExpressionForTarget(src: string, targetType: StudioVariableType, declared: Record<string, StudioVariableType>): {
    ok: true;
} | {
    ok: false;
    error: string;
};
export type ComparisonOp = "==" | "!=" | "<" | "<=" | ">" | ">=";
/** Typed comparison shared with Branch conditions. Throws on operand mismatch. */
export declare function compare(op: ComparisonOp, left: StudioVariableValue, right: StudioVariableValue): boolean;
export type BranchComparison = "EQUALS" | "NOT_EQUALS" | "GREATER_THAN" | "LESS_THAN" | "GREATER_OR_EQUAL" | "LESS_OR_EQUAL" | "LIKE" | "ILIKE";
/** Structural input so this file stays standalone (no scene-type imports). */
export type BranchConditionInput = {
    comparison: BranchComparison;
    variable_name: string;
    compare_literal: StudioVariableValue | null;
    compare_variable_name: string | null;
};
export type BranchConditionResult = {
    ok: true;
    value: boolean;
} | {
    ok: false;
    error: string;
};
/**
 * Evaluates a structured Branch condition against the runtime store.
 * Never throws; callers warn + skip both arms on { ok: false }.
 */
export declare function evaluateBranchCondition(cond: BranchConditionInput, get: (name: string) => StudioVariableValue | undefined): BranchConditionResult;
export declare function evaluate(node: ExpressionNode, get: (name: string) => StudioVariableValue | undefined): EvaluateResult;
export declare function valueMatchesType(value: StudioVariableValue, type: StudioVariableType): boolean;
/** Serialize a literal value into expression syntax (the editor's literal mode). */
export declare function formatLiteral(value: StudioVariableValue): string;
/**
 * Rewrite every reference to oldName in an expression's source, preserving all
 * other formatting (token-span splicing). Returns the source unchanged if it
 * does not tokenize. Powers variable rename in the editor.
 */
export declare function renameIdentifier(src: string, oldName: string, newName: string): string;
export {};
