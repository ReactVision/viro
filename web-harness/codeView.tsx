import React, { useEffect, useMemo, useRef, useState } from "react";

type Source = { version: number; entry: string; scenes: string[]; files: Record<string, string> };

const LINE = 18;

// Kept for the page's life, so files an update changed are marked the next time the panel opens too.
let last: Source | null = null;
let changed = new Set<string>();
// The lines the last update added or changed, by file.
let changedLines = new Map<string, Set<number>>();
const MAX_RESULTS = 200;
const MAX_TOLD_LINES = 40;

/** The 1-based lines of `now` that a line diff from `was` adds or changes. */
function changedLinesOf(was: string, now: string): Set<number> {
  const a = was.split("\n");
  const b = now.split("\n");
  let head = 0;
  while (head < a.length && head < b.length && a[head] === b[head]) head++;
  let tail = 0;
  while (tail < a.length - head && tail < b.length - head && a[a.length - 1 - tail] === b[b.length - 1 - tail]) tail++;
  const n = a.length - head - tail;
  const m = b.length - head - tail;
  const out = new Set<number>();
  // Too large to compare line by line: everything between the unchanged ends is marked.
  if (!n || n * m > 4e6) {
    for (let j = 0; j < m; j++) out.add(head + j + 1);
    return out;
  }
  // The longest common run of lines from each pair of positions to the end.
  const w = m + 1;
  const run = new Uint16Array((n + 1) * w);
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      run[i * w + j] = a[head + i] === b[head + j] ? run[(i + 1) * w + j + 1]! + 1 : Math.max(run[(i + 1) * w + j]!, run[i * w + j + 1]!);
    }
  }
  for (let i = 0, j = 0; j < m; ) {
    if (i < n && a[head + i] === b[head + j]) i++, j++;
    else if (i < n && run[(i + 1) * w + j]! >= run[i * w + j + 1]!) i++;
    else out.add(head + j++ + 1);
  }
  return out;
}
// Loaded when the panel first opens, so the page that never shows code does not fetch it.
let highlighter: typeof import("./codeHighlight") | null = null;

const folderOf = (p: string) => p.slice(0, p.lastIndexOf("/") + 1);

/** By folder, then by name, as a file tree lists them. */
function ordered(s: Source): string[] {
  return Object.keys(s.files).sort((a, b) => folderOf(a).localeCompare(folderOf(b)) || a.localeCompare(b));
}

/** The key of `files` that `file` names, which may carry a longer path than the key. */
function fileFor(file: string, files: Record<string, string>): string | null {
  const f = file.replace(/\\/g, "/").replace(/^\.\//, "");
  if (f in files) return f;
  return Object.keys(files).filter((k) => f.endsWith(`/${k}`)).sort((a, b) => b.length - a.length)[0] ?? null;
}

/** The first `file:line` in `error` that names one of `files`. */
function errorLocation(error: string | null, files: Record<string, string>): { path: string; line: number } | null {
  if (!error) return null;
  for (const m of error.matchAll(/([\w@./-]+\.[cm]?[jt]sx?):(\d+)/g)) {
    const path = fileFor(m[1]!, files);
    if (path) return { path, line: Number(m[2]) };
  }
  return null;
}

export function CodePanel({
  url,
  version,
  focus,
  error,
  goto,
  top,
  load,
  copy,
  styles,
  onSelection,
}: {
  url: string;
  version?: number;
  /** The scene shown in the preview, opened first. */
  focus?: string;
  error: string | null;
  /** A file and line to open, from Inspect; `n` tells two requests for the same line apart. */
  goto?: { file: string; line: number; n: number } | null;
  top: number;
  load: typeof fetch;
  copy(text: string): Promise<boolean>;
  styles: { chip: React.CSSProperties; button: React.CSSProperties };
  /** The selected lines, as text for the assistant, or null; undefined where no assistant is listening. */
  onSelection?: (text: string | null) => void;
}) {
  const [source, setSource] = useState<Source | null>(last && last.version === version ? last : null);
  const [failed, setFailed] = useState<string | null>(null);
  const [path, setPath] = useState<string | null>(null);
  const [mark, setMark] = useState<{ line: number; tone: "error" | "find" } | null>(null);
  const [copied, setCopied] = useState<boolean | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const codeEl = useRef<HTMLPreElement>(null);
  const [query, setQuery] = useState("");
  // The text selected in the open file, and the lines chosen by their numbers in any file: both are told together.
  const [sel, setSel] = useState<{ from: number; to: number } | null>(null);
  const [picked, setPicked] = useState<Record<string, number[]>>({});
  const lastPicked = useRef<{ path: string; line: number } | null>(null);
  // A press on the line numbers, until it is released: the line it began on, and the lines kept from before it.
  const numberDrag = useRef<{ anchor: number; base: Record<string, number[]>; takeOut: boolean } | null>(null);

  useEffect(() => {
    if (last && last.version === version) return setSource(last);
    const stop = new AbortController();
    load(url, { signal: stop.signal, cache: "no-store" })
      .then(async (res) => {
        const body = (await res.json().catch(() => ({}))) as Partial<Source> & { error?: string };
        if (!res.ok || !body.files) throw new Error(body.error ?? `Failed to load the code (HTTP ${res.status}).`);
        const next = body as Source;
        if (last && last.version < next.version) {
          const was = last.files;
          changed = new Set(Object.keys(next.files).filter((p) => was[p] !== next.files[p]));
          changedLines = new Map([...changed].filter((p) => was[p] !== undefined).map((p) => [p, changedLinesOf(was[p]!, next.files[p]!)]));
        }
        last = next;
        setFailed(null);
        setSource(next);
      })
      .catch((e: unknown) => {
        if (!stop.signal.aborted) setFailed(e instanceof Error ? e.message : String(e));
      });
    return () => stop.abort();
  }, [url, version]);

  const paths = useMemo(() => (source ? ordered(source) : []), [source]);
  const focused = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (!source) return;
    // An update keeps the file being read; only choosing another scene moves to that scene's file.
    const moved = focus !== focused.current;
    focused.current = focus;
    const has = (p: string | null | undefined): p is string => !!p && p in source.files;
    setPath((p) => (moved && has(focus) ? focus : has(p) ? p : has(focus) ? focus : has(source.entry) ? source.entry : paths[0] ?? null));
  }, [source, focus]);
  const handled = useRef(0);
  useEffect(() => {
    if (!source || !goto || goto.n === handled.current) return;
    handled.current = goto.n;
    const found = fileFor(goto.file, source.files);
    if (found) goTo({ path: found, line: goto.line }, "find");
  }, [source, goto]);

  const [, loaded] = useState(!!highlighter);
  useEffect(() => {
    if (highlighter) return;
    let live = true;
    import("./codeHighlight").then(
      (m) => {
        highlighter = m;
        if (live) loaded(true);
      },
      () => {},
    );
    return () => {
      live = false;
    };
  }, []);

  const text = source && path ? source.files[path] ?? "" : "";
  const colored = useMemo(() => (highlighter && path ? highlighter.highlight(text, path) : null), [text, path, highlighter]);
  const lines = useMemo(() => text.split("\n").length, [text]);
  const at = source ? errorLocation(error, source.files) : null;
  // A mark or a selection made in the text an update replaced no longer names the same lines.
  const read = useRef({ path, text });
  useEffect(() => {
    if (read.current.path === path && read.current.text !== text) {
      setMark(null);
      setSel(null);
    }
    read.current = { path, text };
  }, [path, text]);
  useEffect(() => {
    if (source) setPicked((was) => Object.fromEntries(Object.entries(was).filter(([p]) => p in source.files && !changed.has(p))));
  }, [source]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!source || q.length < 2) return null;
    const found: { path: string; line: number; text: string }[] = [];
    for (const p of paths) {
      const fileLines = source.files[p]!.split("\n");
      for (let i = 0; i < fileLines.length && found.length <= MAX_RESULTS; i++) {
        if (fileLines[i]!.toLowerCase().includes(q)) found.push({ path: p, line: i + 1, text: fileLines[i]!.trim().slice(0, 200) });
      }
    }
    return found;
  }, [query, source]);
  const resultAt = useRef(-1);
  useEffect(() => void (resultAt.current = -1), [results]);

  useEffect(() => {
    const onChange = () => {
      const pre = codeEl.current;
      const s = document.getSelection();
      const range = s && s.rangeCount ? s.getRangeAt(0) : null;
      if (!pre || !range || range.collapsed || !pre.contains(range.startContainer) || !pre.contains(range.endContainer)) {
        setSel(null);
        return;
      }
      const before = document.createRange();
      before.setStart(pre, 0);
      before.setEnd(range.startContainer, range.startOffset);
      const start = before.toString().length;
      const shownText = pre.textContent ?? "";
      const end = start + range.toString().length;
      const lineAt = (offset: number) => shownText.slice(0, offset).split("\n").length;
      // A selection that ends at the start of a line does not include that line.
      setSel({ from: lineAt(start), to: lineAt(shownText[end - 1] === "\n" ? end - 1 : end) });
    };
    document.addEventListener("selectionchange", onChange);
    return () => document.removeEventListener("selectionchange", onChange);
  }, []);
  const chosen = useMemo(() => {
    const byFile: Record<string, number[]> = { ...picked };
    if (sel && path) byFile[path] = [...(byFile[path] ?? []), ...Array.from({ length: sel.to - sel.from + 1 }, (_, i) => sel.from + i)];
    const runs: { path: string; from: number; to: number }[] = [];
    for (const p of Object.keys(byFile).sort()) {
      for (const line of [...new Set(byFile[p])].sort((x, y) => x - y)) {
        const run = runs[runs.length - 1];
        if (run && run.path === p && run.to === line - 1) run.to = line;
        else runs.push({ path: p, from: line, to: line });
      }
    }
    return runs;
  }, [picked, sel, path]);
  const chosenLines = chosen.reduce((n, r) => n + r.to - r.from + 1, 0);
  const told = useMemo(() => {
    if (!source || !chosen.length) return null;
    let left = MAX_TOLD_LINES;
    const parts: string[] = [];
    for (const r of chosen) {
      if (left <= 0) break;
      const to = Math.min(r.to, r.from + left - 1);
      left -= to - r.from + 1;
      parts.push(`${r.path}, ${r.from === r.to ? `line ${r.from}` : `lines ${r.from} to ${r.to}`}:\n${(source.files[r.path] ?? "").split("\n").slice(r.from - 1, to).join("\n")}`);
    }
    return parts.join("\n\n");
  }, [chosen, source]);
  useEffect(() => {
    if (!onSelection) return;
    const timer = setTimeout(() => onSelection(told), 400);
    return () => clearTimeout(timer);
  }, [told]);
  useEffect(() => () => onSelection?.(null), []);

  /** Selects from where the press on the line numbers began to `line`, on top of the lines it kept. */
  function pickTo(line: number) {
    const drag = numberDrag.current;
    if (!drag || !path) return;
    const span = Array.from({ length: Math.abs(line - drag.anchor) + 1 }, (_, i) => Math.min(line, drag.anchor) + i);
    const mine = drag.base[path] ?? [];
    // Alt-click on a selected line takes it out.
    const next = drag.takeOut && span.length === 1 ? mine.filter((l) => l !== line) : [...new Set([...mine, ...span])];
    const { [path]: _, ...rest } = drag.base;
    setPicked(next.length ? { ...rest, [path]: next } : rest);
  }
  function goTo(to: { path: string; line: number }, tone: "error" | "find") {
    setSel(null);
    setPath(to.path);
    setMark({ line: to.line, tone });
    requestAnimationFrame(() => {
      const el = scroller.current;
      if (el) el.scrollTop = Math.max(0, (to.line - 1) * LINE - el.clientHeight / 3);
    });
  }
  const { chip, button } = styles;
  const mono: React.CSSProperties = { margin: 0, fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: 12, lineHeight: `${LINE}px`, tabSize: 2 };

  return (
    <div
      style={{
        ...chip,
        position: "absolute",
        left: 10,
        right: 10,
        top,
        bottom: 10,
        zIndex: 2,
        padding: 0,
        background: "rgba(16,16,22,0.97)",
        pointerEvents: "auto",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      {error ? (
        <div style={{ ...mono, color: "#ff9b9b", padding: "8px 12px", borderBottom: "1px solid rgba(255,255,255,0.12)", maxHeight: "25%", overflow: "auto", whiteSpace: "pre-wrap", userSelect: "text" }}>
          {error}
          {at ? (
            <div>
              <button type="button" style={{ ...button, marginTop: 6, fontSize: 12 }} onClick={() => goTo(at, "error")}>
                Go to {at.path}:{at.line}
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
      {!source ? (
        <div style={{ padding: 14, opacity: 0.8, color: failed ? "#ff9b9b" : undefined }}>{failed ?? "Loading the code..."}</div>
      ) : !paths.length ? (
        <div style={{ padding: 14, opacity: 0.8 }}>The project's files have not arrived yet.</div>
      ) : (
        <div style={{ display: "flex", flex: "1 1 auto", minHeight: 0 }}>
          {paths.length > 1 ? (
            <nav aria-label="Files" style={{ width: "clamp(120px, 28%, 240px)", flex: "none", overflow: "auto", borderRight: "1px solid rgba(255,255,255,0.12)", padding: "6px 0" }}>
              {paths.map((p, i) => {
                const folder = folderOf(p);
                const heading = folder && folder !== folderOf(paths[i - 1] ?? "") ? (
                  <div title={folder} style={{ padding: "6px 12px 2px", fontSize: 12, opacity: 0.55, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {folder}
                  </div>
                ) : null;
                return (
                  <React.Fragment key={p}>
                  {heading}
                  <button
                    type="button"
                    aria-current={p === path}
                    title={changed.has(p) ? `${p} (changed in the last update)` : p}
                    onClick={() => {
                      setPath(p);
                      setMark(null);
                      setSel(null);
                      if (scroller.current) scroller.current.scrollTop = 0;
                    }}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      width: "100%",
                      padding: folder ? "4px 12px 4px 22px" : "4px 12px",
                      border: "none",
                      background: p === path ? "rgba(255,255,255,0.12)" : "transparent",
                      color: "inherit",
                      font: "inherit",
                      fontSize: 13,
                      textAlign: "left",
                      cursor: "pointer",
                    }}
                  >
                    <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", minWidth: 0 }}>{p.slice(folder.length)}</span>
                    {picked[p]?.length ? <span style={{ flex: "none", fontSize: 11, opacity: 0.7 }}>{picked[p]!.length} selected</span> : null}
                    {changed.has(p) ? <span aria-label="Changed" style={{ flex: "none", width: 6, height: 6, borderRadius: "50%", background: "#4cc2ff" }} /> : null}
                  </button>
                  </React.Fragment>
                );
              })}
            </nav>
          ) : null}
          <div style={{ flex: "1 1 auto", minWidth: 0, display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, padding: "6px 8px 6px 12px", borderBottom: "1px solid rgba(255,255,255,0.12)" }}>
              <span title={path ?? undefined} style={{ fontSize: 13, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", minWidth: 0, flex: "1 1 auto" }}>
                <span style={{ fontWeight: 600 }}>{path?.slice(folderOf(path).length)}</span>
                {path && changed.has(path) ? <span style={{ opacity: 0.7 }}>, changed in the last update</span> : null}
                {path && folderOf(path) ? <span style={{ opacity: 0.55 }}>  {folderOf(path)}</span> : null}
              </span>
              <input
                type="search"
                aria-label="Search the files"
                placeholder={paths.length > 1 ? "Search all files" : "Search"}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") setQuery("");
                  if (e.key !== "Enter" || !results?.length) return;
                  resultAt.current = (resultAt.current + (e.shiftKey ? results.length - 1 : 1)) % results.length;
                  goTo(results[Math.max(0, resultAt.current)]!, "find");
                }}
                style={{ flex: "0 1 180px", minWidth: 80, padding: "4px 8px", borderRadius: 6, border: "1px solid rgba(255,255,255,0.2)", background: "rgba(255,255,255,0.06)", color: "inherit", font: "inherit", fontSize: 12 }}
              />
              <button
                type="button"
                style={{ ...button, fontSize: 12, padding: "4px 8px" }}
                onClick={async () => {
                  setCopied(await copy(text));
                  setTimeout(() => setCopied(null), 1500);
                }}
              >
                {copied === null ? "Copy" : copied ? "Copied" : "Failed to copy"}
              </button>
            </div>
            {results ? (
              <div role="listbox" aria-label="Search results" style={{ flex: "none", maxHeight: "35%", overflow: "auto", borderBottom: "1px solid rgba(255,255,255,0.12)", padding: "4px 0", fontSize: 12 }}>
                <div style={{ padding: "2px 12px", opacity: 0.6 }}>
                  {results.length > MAX_RESULTS ? `The first ${MAX_RESULTS} lines found` : results.length === 1 ? "1 line found" : `${results.length} lines found`}
                </div>
                {results.slice(0, MAX_RESULTS).map((r, i) => (
                  <button
                    key={`${r.path}:${r.line}`}
                    type="button"
                    role="option"
                    aria-selected={false}
                    onClick={() => {
                      resultAt.current = i;
                      goTo(r, "find");
                    }}
                    style={{ display: "flex", gap: 10, width: "100%", padding: "2px 12px", border: "none", background: "transparent", color: "inherit", font: "inherit", textAlign: "left", cursor: "pointer" }}
                  >
                    <span style={{ flex: "none", opacity: 0.7 }}>
                      {r.path.slice(folderOf(r.path).length)}:{r.line}
                    </span>
                    <span style={{ ...mono, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", minWidth: 0 }}>{r.text}</span>
                  </button>
                ))}
              </div>
            ) : null}
            <div ref={scroller} style={{ flex: "1 1 auto", overflow: "auto", display: "flex", alignItems: "flex-start" }}>
              <pre
                title="Click a line number to select the line, drag or Shift-click for more, Alt-click to add another"
                onPointerDown={(e) => {
                  const line = Math.floor((e.clientY - e.currentTarget.getBoundingClientRect().top - 8) / LINE) + 1;
                  if (!path || e.button !== 0 || line < 1 || line > lines) return;
                  const add = e.altKey || e.metaKey || e.ctrlKey;
                  const anchor = e.shiftKey && lastPicked.current?.path === path ? lastPicked.current.line : line;
                  if (!e.shiftKey) lastPicked.current = { path, line };
                  if (!add) document.getSelection()?.removeAllRanges();
                  numberDrag.current = { anchor, base: add || e.shiftKey ? picked : {}, takeOut: add && (picked[path] ?? []).includes(line) };
                  e.currentTarget.setPointerCapture(e.pointerId);
                  pickTo(line);
                }}
                onPointerMove={(e) => {
                  if (!numberDrag.current) return;
                  pickTo(Math.min(lines, Math.max(1, Math.floor((e.clientY - e.currentTarget.getBoundingClientRect().top - 8) / LINE) + 1)));
                }}
                onPointerUp={() => void (numberDrag.current = null)}
                onPointerCancel={() => void (numberDrag.current = null)}
                style={{ ...mono, position: "sticky", left: 0, zIndex: 1, flex: "none", padding: "8px 10px 8px 12px", textAlign: "right", color: "rgba(232,232,238,0.4)", background: "rgb(16,16,22)", userSelect: "none", minHeight: "100%", boxSizing: "border-box", cursor: "pointer" }}
              >
                {Array.from({ length: lines }, (_, i) => i + 1).join("\n")}
              </pre>
              {/* As in an editor, a plain press in the code starts over; with Alt, Cmd or Ctrl it adds to what is selected. */}
              <div style={{ position: "relative", flex: "1 0 auto" }} onMouseDown={(e) => !e.altKey && !e.metaKey && !e.ctrlKey && setPicked({})}>
                {(path ? picked[path] ?? [] : []).filter((l) => l <= lines).map((l) => (
                  <div key={`s${l}`} style={{ position: "absolute", left: 0, right: 0, top: 8 + (l - 1) * LINE, height: LINE, background: "rgba(58,110,190,0.45)" }} />
                ))}
                {[...(path ? changedLines.get(path) ?? [] : [])].filter((l) => l <= lines).map((l) => (
                  <div key={l} title="Changed in the last update" style={{ position: "absolute", left: 0, width: 3, top: 8 + (l - 1) * LINE, height: LINE, background: "#4cc2ff" }} />
                ))}
                {mark && mark.line <= lines ? (
                  <div style={{ position: "absolute", left: 0, right: 0, top: 8 + (mark.line - 1) * LINE, height: LINE, background: mark.tone === "error" ? "rgba(255,155,155,0.15)" : "rgba(76,194,255,0.18)" }} />
                ) : null}
                <pre ref={codeEl} style={{ ...mono, position: "relative", padding: "8px 12px", userSelect: "text", color: colored ? "#d4d4d4" : undefined }}>{colored ?? text}</pre>
              </div>
            </div>
            {/* Under the code, so a selection being dragged does not move as its chip appears. */}
            {chosen.length ? (
              <div style={{ flex: "none", display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", padding: "6px 12px", borderTop: "1px solid rgba(255,255,255,0.12)", fontSize: 12 }}>
                {chosen.map((r) => (
                  <span key={`${r.path}:${r.from}`} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "2px 4px 2px 8px", borderRadius: 6, background: "rgba(255,255,255,0.1)" }}>
                    <span>
                      /{r.path} <span style={{ opacity: 0.65 }}>#{r.from}{r.to > r.from ? `-${r.to}` : ""}</span>
                    </span>
                    <button
                      type="button"
                      aria-label={`Remove ${r.path} lines ${r.from} to ${r.to}`}
                      onClick={() => {
                        setPicked((was) => {
                          const mine = (was[r.path] ?? []).filter((l) => l < r.from || l > r.to);
                          const { [r.path]: _, ...rest } = was;
                          return mine.length ? { ...rest, [r.path]: mine } : rest;
                        });
                        if (r.path === path && sel && sel.from <= r.to && sel.to >= r.from) document.getSelection()?.removeAllRanges();
                      }}
                      style={{ all: "unset", cursor: "pointer", padding: "0 4px", opacity: 0.7, fontSize: 14, lineHeight: 1 }}
                    >
                      ×
                    </button>
                  </span>
                ))}
                {onSelection ? (
                  <span style={{ opacity: 0.65 }}>
                    Your assistant sees {chosenLines > MAX_TOLD_LINES ? `the first ${MAX_TOLD_LINES} of these lines` : chosen.length === 1 ? "this" : "these"}.
                  </span>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
