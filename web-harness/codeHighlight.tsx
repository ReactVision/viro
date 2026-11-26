import React from "react";
import "./prismManual";
import Prism from "prismjs";
// Each grammar extends the one before it through the global Prism, so the order matters.
import "prismjs/components/prism-jsx";
import "prismjs/components/prism-typescript";
import "prismjs/components/prism-tsx";
import "prismjs/components/prism-json";

// Above this the file is shown plain: tokenizing it would hold up the page.
const MAX_CHARS = 300_000;

const COLORS: Record<string, string> = {
  comment: "#6a9955",
  prolog: "#6a9955",
  string: "#ce9178",
  "template-string": "#ce9178",
  "attr-value": "#ce9178",
  char: "#ce9178",
  regex: "#d16969",
  number: "#b5cea8",
  boolean: "#569cd6",
  null: "#569cd6",
  keyword: "#569cd6",
  builtin: "#4ec9b0",
  "class-name": "#4ec9b0",
  tag: "#4ec9b0",
  function: "#dcdcaa",
  "attr-name": "#9cdcfe",
  property: "#9cdcfe",
  constant: "#4fc1ff",
  punctuation: "#d4d4d4",
  operator: "#d4d4d4",
  interpolation: "#d4d4d4",
  "interpolation-punctuation": "#569cd6",
  "script-punctuation": "#d4d4d4",
};

function grammarFor(path: string): Prism.Grammar | null {
  if (/\.json$/.test(path)) return Prism.languages.json ?? null;
  if (/\.[cm]?ts$/.test(path)) return Prism.languages.typescript ?? null;
  if (/\.[cm]?[jt]sx?$/.test(path)) return Prism.languages.tsx ?? null;
  return null;
}

function colorOf(t: Prism.Token): string | undefined {
  const aliases = Array.isArray(t.alias) ? t.alias : t.alias ? [t.alias] : [];
  for (const name of [t.type, ...aliases]) if (COLORS[name]) return COLORS[name];
  return undefined;
}

function render(stream: Prism.TokenStream): React.ReactNode {
  if (typeof stream === "string") return stream;
  if (Array.isArray(stream)) return stream.map((s, i) => <React.Fragment key={i}>{render(s)}</React.Fragment>);
  const color = colorOf(stream);
  const inner = render(stream.content);
  return color ? <span style={{ color, ...(stream.type === "comment" ? { fontStyle: "italic" } : {}) }}>{inner}</span> : inner;
}

/** The file as coloured spans, or null where it is shown plain. */
export function highlight(text: string, path: string): React.ReactNode | null {
  const grammar = grammarFor(path);
  if (!grammar || text.length > MAX_CHARS) return null;
  return render(Prism.tokenize(text, grammar));
}
