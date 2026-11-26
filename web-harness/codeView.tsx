import React, { useEffect, useMemo, useRef, useState } from "react";

type Source = { version: number; entry: string; scenes: string[]; files: Record<string, string> };

const LINE = 18;

// Kept for the page's life, so files an update changed are marked the next time the panel opens too.
let last: Source | null = null;
let changed = new Set<string>();

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
}) {
  const [source, setSource] = useState<Source | null>(last && last.version === version ? last : null);
  const [failed, setFailed] = useState<string | null>(null);
  const [path, setPath] = useState<string | null>(null);
  const [mark, setMark] = useState<{ line: number; tone: "error" | "find" } | null>(null);
  const [copied, setCopied] = useState<boolean | null>(null);
  const scroller = useRef<HTMLDivElement>(null);

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
  useEffect(() => {
    if (!source) return;
    setPath((p) => (focus && focus in source.files ? focus : p && p in source.files ? p : source.entry in source.files ? source.entry : paths[0] ?? null));
  }, [source, focus]);
  const handled = useRef(0);
  useEffect(() => {
    if (!source || !goto || goto.n === handled.current) return;
    handled.current = goto.n;
    const found = fileFor(goto.file, source.files);
    if (found) goTo({ path: found, line: goto.line }, "find");
  }, [source, goto]);

  const text = source && path ? source.files[path] ?? "" : "";
  const lines = useMemo(() => text.split("\n").length, [text]);
  const at = source ? errorLocation(error, source.files) : null;

  function goTo(to: { path: string; line: number }, tone: "error" | "find") {
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
                    {changed.has(p) ? <span aria-label="Changed" style={{ flex: "none", width: 6, height: 6, borderRadius: "50%", background: "#4cc2ff" }} /> : null}
                  </button>
                  </React.Fragment>
                );
              })}
            </nav>
          ) : null}
          <div style={{ flex: "1 1 auto", minWidth: 0, display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, padding: "6px 8px 6px 12px", borderBottom: "1px solid rgba(255,255,255,0.12)" }}>
              <span title={path ?? undefined} style={{ fontSize: 13, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", minWidth: 0 }}>
                <span style={{ fontWeight: 600 }}>{path?.slice(folderOf(path).length)}</span>
                {path && changed.has(path) ? <span style={{ opacity: 0.7 }}>, changed in the last update</span> : null}
                {path && folderOf(path) ? <span style={{ opacity: 0.55 }}>  {folderOf(path)}</span> : null}
              </span>
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
            <div ref={scroller} style={{ flex: "1 1 auto", overflow: "auto", display: "flex", alignItems: "flex-start" }}>
              <pre aria-hidden="true" style={{ ...mono, position: "sticky", left: 0, zIndex: 1, flex: "none", padding: "8px 10px 8px 12px", textAlign: "right", color: "rgba(232,232,238,0.4)", background: "rgb(16,16,22)", userSelect: "none", minHeight: "100%", boxSizing: "border-box" }}>
                {Array.from({ length: lines }, (_, i) => i + 1).join("\n")}
              </pre>
              <div style={{ position: "relative", flex: "1 0 auto" }}>
                {mark && mark.line <= lines ? (
                  <div style={{ position: "absolute", left: 0, right: 0, top: 8 + (mark.line - 1) * LINE, height: LINE, background: mark.tone === "error" ? "rgba(255,155,155,0.15)" : "rgba(76,194,255,0.18)" }} />
                ) : null}
                <pre style={{ ...mono, position: "relative", padding: "8px 12px", userSelect: "text" }}>{text}</pre>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
