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

export const MAX_EXPRESSION_LENGTH = 500;
export const VARIABLE_NAME_PATTERN = /^[A-Za-z_][A-Za-z0-9_]{0,63}$/;

type BinaryOp =
  | "||"
  | "&&"
  | "=="
  | "!="
  | "<"
  | "<="
  | ">"
  | ">="
  | "+"
  | "-"
  | "*"
  | "/";
type UnaryOp = "!" | "-";

export type ExpressionNode =
  | { kind: "literal"; value: StudioVariableValue }
  | { kind: "variable"; name: string }
  | { kind: "unary"; op: UnaryOp; operand: ExpressionNode }
  | { kind: "binary"; op: BinaryOp; left: ExpressionNode; right: ExpressionNode };

export type ParseResult =
  | { ok: true; ast: ExpressionNode; refs: string[] }
  | { ok: false; error: string };

export type TypeCheckResult =
  | { ok: true; type: StudioVariableType }
  | { ok: false; error: string };

export type EvaluateResult =
  | { ok: true; value: StudioVariableValue }
  | { ok: false; error: string };

class ExpressionError extends Error {}

// ─── Tokenizer ────────────────────────────────────────────────────────────────

type Token =
  | { type: "number"; value: number; start: number; end: number }
  | { type: "string"; value: string; start: number; end: number }
  | { type: "boolean"; value: boolean; start: number; end: number }
  | { type: "ident"; name: string; start: number; end: number }
  | { type: "op"; op: string; start: number; end: number }
  | { type: "eof"; start: number; end: number };

const IDENT_START = /[A-Za-z_]/;
const IDENT_PART = /[A-Za-z0-9_]/;
const DIGIT = /[0-9]/;

function tokenize(src: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < src.length) {
    const ch = src[i];
    if (ch === " " || ch === "\t" || ch === "\n" || ch === "\r") {
      i++;
      continue;
    }
    const start = i;
    if (DIGIT.test(ch)) {
      let j = i + 1;
      while (j < src.length && DIGIT.test(src[j])) j++;
      if (src[j] === "." && DIGIT.test(src[j + 1] ?? "")) {
        j++;
        while (j < src.length && DIGIT.test(src[j])) j++;
      }
      tokens.push({ type: "number", value: parseFloat(src.slice(i, j)), start, end: j });
      i = j;
      continue;
    }
    if (ch === '"' || ch === "'") {
      const quote = ch;
      let j = i + 1;
      let text = "";
      let closed = false;
      while (j < src.length) {
        const c = src[j];
        if (c === "\\") {
          const next = src[j + 1];
          if (next === undefined) break;
          text += next === "n" ? "\n" : next === "t" ? "\t" : next;
          j += 2;
          continue;
        }
        if (c === quote) {
          closed = true;
          j++;
          break;
        }
        text += c;
        j++;
      }
      if (!closed) throw new ExpressionError(`Unterminated string at position ${start}`);
      tokens.push({ type: "string", value: text, start, end: j });
      i = j;
      continue;
    }
    if (IDENT_START.test(ch)) {
      let j = i + 1;
      while (j < src.length && IDENT_PART.test(src[j])) j++;
      const word = src.slice(i, j);
      if (word === "true" || word === "false") {
        tokens.push({ type: "boolean", value: word === "true", start, end: j });
      } else {
        tokens.push({ type: "ident", name: word, start, end: j });
      }
      i = j;
      continue;
    }
    const two = src.slice(i, i + 2);
    if (two === "||" || two === "&&" || two === "==" || two === "!=" || two === "<=" || two === ">=") {
      tokens.push({ type: "op", op: two, start, end: i + 2 });
      i += 2;
      continue;
    }
    if ("+-*/<>!()".includes(ch)) {
      tokens.push({ type: "op", op: ch, start, end: i + 1 });
      i++;
      continue;
    }
    throw new ExpressionError(`Unexpected character "${ch}" at position ${i}`);
  }
  tokens.push({ type: "eof", start: src.length, end: src.length });
  return tokens;
}

// ─── Parser ───────────────────────────────────────────────────────────────────

class Parser {
  private pos = 0;

  constructor(private tokens: Token[]) {}

  private peek(): Token {
    return this.tokens[this.pos];
  }

  private matchOp(...ops: string[]): string | null {
    const t = this.peek();
    if (t.type === "op" && ops.includes(t.op)) {
      this.pos++;
      return t.op;
    }
    return null;
  }

  parse(): ExpressionNode {
    const node = this.parseOr();
    const t = this.peek();
    if (t.type !== "eof") {
      throw new ExpressionError(`Unexpected token at position ${t.start}`);
    }
    return node;
  }

  private parseBinaryLevel(ops: BinaryOp[], next: () => ExpressionNode): ExpressionNode {
    let left = next();
    for (;;) {
      const op = this.matchOp(...ops);
      if (op === null) break;
      left = { kind: "binary", op: op as BinaryOp, left, right: next() };
    }
    return left;
  }

  private parseOr(): ExpressionNode {
    return this.parseBinaryLevel(["||"], () => this.parseAnd());
  }

  private parseAnd(): ExpressionNode {
    return this.parseBinaryLevel(["&&"], () => this.parseEquality());
  }

  private parseEquality(): ExpressionNode {
    return this.parseBinaryLevel(["==", "!="], () => this.parseRelational());
  }

  private parseRelational(): ExpressionNode {
    return this.parseBinaryLevel(["<", "<=", ">", ">="], () => this.parseAdditive());
  }

  private parseAdditive(): ExpressionNode {
    return this.parseBinaryLevel(["+", "-"], () => this.parseMultiplicative());
  }

  private parseMultiplicative(): ExpressionNode {
    return this.parseBinaryLevel(["*", "/"], () => this.parseUnary());
  }

  private parseUnary(): ExpressionNode {
    const op = this.matchOp("!", "-");
    if (op !== null) {
      return { kind: "unary", op: op as UnaryOp, operand: this.parseUnary() };
    }
    return this.parsePrimary();
  }

  private parsePrimary(): ExpressionNode {
    const t = this.peek();
    if (t.type === "number" || t.type === "string" || t.type === "boolean") {
      this.pos++;
      return { kind: "literal", value: t.value };
    }
    if (t.type === "ident") {
      this.pos++;
      return { kind: "variable", name: t.name };
    }
    if (t.type === "op" && t.op === "(") {
      this.pos++;
      const node = this.parseOr();
      if (this.matchOp(")") === null) {
        throw new ExpressionError(`Missing ")" at position ${this.peek().start}`);
      }
      return node;
    }
    throw new ExpressionError(`Unexpected token at position ${t.start}`);
  }
}

function collectRefs(node: ExpressionNode, acc: Set<string>): void {
  if (node.kind === "variable") {
    acc.add(node.name);
  } else if (node.kind === "unary") {
    collectRefs(node.operand, acc);
  } else if (node.kind === "binary") {
    collectRefs(node.left, acc);
    collectRefs(node.right, acc);
  }
}

export function parseExpression(src: string): ParseResult {
  if (typeof src !== "string" || src.trim().length === 0) {
    return { ok: false, error: "Expression is empty" };
  }
  if (src.length > MAX_EXPRESSION_LENGTH) {
    return { ok: false, error: `Expression exceeds ${MAX_EXPRESSION_LENGTH} characters` };
  }
  try {
    const ast = new Parser(tokenize(src)).parse();
    const refs = new Set<string>();
    collectRefs(ast, refs);
    const refList: string[] = [];
    refs.forEach((name) => refList.push(name));
    return { ok: true, ast, refs: refList };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

// ─── Type checking (author-time) ─────────────────────────────────────────────

function inferType(
  node: ExpressionNode,
  declared: Record<string, StudioVariableType>,
): StudioVariableType {
  switch (node.kind) {
    case "literal":
      if (typeof node.value === "boolean") return "BOOLEAN";
      if (typeof node.value === "number") return "NUMBER";
      return "STRING";
    case "variable": {
      const t = declared[node.name];
      if (t === undefined) throw new ExpressionError(`Unknown variable "${node.name}"`);
      return t;
    }
    case "unary": {
      const t = inferType(node.operand, declared);
      if (node.op === "!") {
        if (t !== "BOOLEAN") throw new ExpressionError(`"!" needs a Boolean operand`);
        return "BOOLEAN";
      }
      if (t !== "NUMBER") throw new ExpressionError(`"-" needs a Number operand`);
      return "NUMBER";
    }
    case "binary": {
      const l = inferType(node.left, declared);
      const r = inferType(node.right, declared);
      switch (node.op) {
        case "||":
        case "&&":
          if (l !== "BOOLEAN" || r !== "BOOLEAN") {
            throw new ExpressionError(`"${node.op}" needs Boolean operands`);
          }
          return "BOOLEAN";
        case "==":
        case "!=":
          if (l !== r) {
            throw new ExpressionError(`"${node.op}" needs operands of the same type`);
          }
          return "BOOLEAN";
        case "<":
        case "<=":
        case ">":
        case ">=":
          if (l !== "NUMBER" || r !== "NUMBER") {
            throw new ExpressionError(`"${node.op}" needs Number operands`);
          }
          return "BOOLEAN";
        case "+":
          if (l === "STRING" || r === "STRING") return "STRING";
          if (l === "NUMBER" && r === "NUMBER") return "NUMBER";
          throw new ExpressionError(`"+" needs Numbers, or at least one String`);
        case "-":
        case "*":
        case "/":
          if (l !== "NUMBER" || r !== "NUMBER") {
            throw new ExpressionError(`"${node.op}" needs Number operands`);
          }
          return "NUMBER";
      }
    }
  }
}

export function checkTypes(
  node: ExpressionNode,
  declared: Record<string, StudioVariableType>,
): TypeCheckResult {
  try {
    return { ok: true, type: inferType(node, declared) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/** Parse + type-check an expression against a target variable's type in one call. */
export function validateExpressionForTarget(
  src: string,
  targetType: StudioVariableType,
  declared: Record<string, StudioVariableType>,
): { ok: true } | { ok: false; error: string } {
  const parsed = parseExpression(src);
  if (!parsed.ok) return parsed;
  const typed = checkTypes(parsed.ast, declared);
  if (!typed.ok) return typed;
  if (typed.type !== targetType) {
    return {
      ok: false,
      error: `Expression result is ${typed.type}, expected ${targetType}`,
    };
  }
  return { ok: true };
}

// ─── Evaluation (runtime) ─────────────────────────────────────────────────────

export type ComparisonOp = "==" | "!=" | "<" | "<=" | ">" | ">=";

/** Typed comparison shared with Branch conditions. Throws on operand mismatch. */
export function compare(
  op: ComparisonOp,
  left: StudioVariableValue,
  right: StudioVariableValue,
): boolean {
  if (op === "==" || op === "!=") {
    if (typeof left !== typeof right) {
      throw new ExpressionError(`"${op}" needs operands of the same type`);
    }
    return op === "==" ? left === right : left !== right;
  }
  if (typeof left !== "number" || typeof right !== "number") {
    throw new ExpressionError(`"${op}" needs Number operands`);
  }
  switch (op) {
    case "<":
      return left < right;
    case "<=":
      return left <= right;
    case ">":
      return left > right;
    default:
      return left >= right;
  }
}

export type BranchComparison =
  | "EQUALS"
  | "NOT_EQUALS"
  | "GREATER_THAN"
  | "LESS_THAN"
  | "GREATER_OR_EQUAL"
  | "LESS_OR_EQUAL"
  | "LIKE"
  | "ILIKE";

const BRANCH_COMPARISON_OPS: Partial<Record<BranchComparison, ComparisonOp>> = {
  EQUALS: "==",
  NOT_EQUALS: "!=",
  GREATER_THAN: ">",
  LESS_THAN: "<",
  GREATER_OR_EQUAL: ">=",
  LESS_OR_EQUAL: "<=",
};

/** SQL LIKE semantics: % = any sequence, _ = any single char; no escape syntax. */
function likeMatch(text: string, pattern: string, caseInsensitive: boolean): boolean {
  let regex = "";
  for (const ch of pattern) {
    if (ch === "%") regex += "[\\s\\S]*";
    else if (ch === "_") regex += "[\\s\\S]";
    else regex += ch.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }
  return new RegExp(`^${regex}$`, caseInsensitive ? "i" : "").test(text);
}

/** Structural input so this file stays standalone (no scene-type imports). */
export type BranchConditionInput = {
  comparison: BranchComparison;
  variable_name: string;
  compare_literal: StudioVariableValue | null;
  compare_variable_name: string | null;
};

export type BranchConditionResult =
  | { ok: true; value: boolean }
  | { ok: false; error: string };

/**
 * Evaluates a structured Branch condition against the runtime store.
 * Never throws; callers warn + skip both arms on { ok: false }.
 */
export function evaluateBranchCondition(
  cond: BranchConditionInput,
  get: (name: string) => StudioVariableValue | undefined,
): BranchConditionResult {
  const left = get(cond.variable_name);
  if (left === undefined) {
    return { ok: false, error: `Variable "${cond.variable_name}" is not defined` };
  }
  let right: StudioVariableValue | undefined;
  if (cond.compare_variable_name !== null) {
    right = get(cond.compare_variable_name);
    if (right === undefined) {
      return { ok: false, error: `Variable "${cond.compare_variable_name}" is not defined` };
    }
  } else if (cond.compare_literal !== null) {
    right = cond.compare_literal;
  } else {
    return { ok: false, error: "Condition has no operand" };
  }
  if (cond.comparison === "LIKE" || cond.comparison === "ILIKE") {
    if (typeof left !== "string" || typeof right !== "string") {
      return { ok: false, error: `"${cond.comparison}" needs String operands` };
    }
    return { ok: true, value: likeMatch(left, right, cond.comparison === "ILIKE") };
  }
  try {
    return { ok: true, value: compare(BRANCH_COMPARISON_OPS[cond.comparison]!, left, right) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

function guardFinite(n: number): number {
  if (!Number.isFinite(n)) throw new ExpressionError("Result is not a finite number");
  return n;
}

function stringify(v: StudioVariableValue): string {
  return typeof v === "string" ? v : String(v);
}

function evalNode(
  node: ExpressionNode,
  get: (name: string) => StudioVariableValue | undefined,
): StudioVariableValue {
  switch (node.kind) {
    case "literal":
      return node.value;
    case "variable": {
      const v = get(node.name);
      if (v === undefined) throw new ExpressionError(`Variable "${node.name}" is not set`);
      return v;
    }
    case "unary": {
      const v = evalNode(node.operand, get);
      if (node.op === "!") {
        if (typeof v !== "boolean") throw new ExpressionError(`"!" needs a Boolean operand`);
        return !v;
      }
      if (typeof v !== "number") throw new ExpressionError(`"-" needs a Number operand`);
      return guardFinite(-v);
    }
    case "binary": {
      if (node.op === "||" || node.op === "&&") {
        const l = evalNode(node.left, get);
        if (typeof l !== "boolean") throw new ExpressionError(`"${node.op}" needs Boolean operands`);
        if (node.op === "||" && l) return true;
        if (node.op === "&&" && !l) return false;
        const r = evalNode(node.right, get);
        if (typeof r !== "boolean") throw new ExpressionError(`"${node.op}" needs Boolean operands`);
        return r;
      }
      const l = evalNode(node.left, get);
      const r = evalNode(node.right, get);
      switch (node.op) {
        case "==":
        case "!=":
        case "<":
        case "<=":
        case ">":
        case ">=":
          return compare(node.op, l, r);
        case "+":
          if (typeof l === "string" || typeof r === "string") return stringify(l) + stringify(r);
          if (typeof l === "number" && typeof r === "number") return guardFinite(l + r);
          throw new ExpressionError(`"+" needs Numbers, or at least one String`);
        case "-":
        case "*":
        case "/": {
          if (typeof l !== "number" || typeof r !== "number") {
            throw new ExpressionError(`"${node.op}" needs Number operands`);
          }
          const out = node.op === "-" ? l - r : node.op === "*" ? l * r : l / r;
          return guardFinite(out);
        }
      }
    }
  }
}

export function evaluate(
  node: ExpressionNode,
  get: (name: string) => StudioVariableValue | undefined,
): EvaluateResult {
  try {
    return { ok: true, value: evalNode(node, get) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

// ─── Editor helpers ───────────────────────────────────────────────────────────

export function valueMatchesType(
  value: StudioVariableValue,
  type: StudioVariableType,
): boolean {
  return (
    (type === "BOOLEAN" && typeof value === "boolean") ||
    (type === "NUMBER" && typeof value === "number") ||
    (type === "STRING" && typeof value === "string")
  );
}

/** Serialize a literal value into expression syntax (the editor's literal mode). */
export function formatLiteral(value: StudioVariableValue): string {
  if (typeof value === "string") {
    return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
  }
  return String(value);
}

/**
 * Rewrite every reference to oldName in an expression's source, preserving all
 * other formatting (token-span splicing). Returns the source unchanged if it
 * does not tokenize. Powers variable rename in the editor.
 */
export function renameIdentifier(src: string, oldName: string, newName: string): string {
  let tokens: Token[];
  try {
    tokens = tokenize(src);
  } catch {
    return src;
  }
  let out = "";
  let cursor = 0;
  for (const t of tokens) {
    if (t.type === "ident" && t.name === oldName) {
      out += src.slice(cursor, t.start) + newName;
      cursor = t.end;
    }
  }
  return out + src.slice(cursor);
}
