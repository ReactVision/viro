const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

/** [generated column, source index, source line, source column], all from 0. */
type Segment = [number, number, number, number];

function vlq(text: string): number[] {
  const out: number[] = [];
  let value = 0;
  let shift = 0;
  for (const ch of text) {
    const digit = B64.indexOf(ch);
    value += (digit & 31) << shift;
    if (digit & 32) shift += 5;
    else {
      out.push(value & 1 ? -(value >>> 1) : value >>> 1);
      value = 0;
      shift = 0;
    }
  }
  return out;
}

function decode(mappings: string): Segment[][] {
  let src = 0;
  let srcLine = 0;
  let srcCol = 0;
  return mappings.split(";").map((line) => {
    let col = 0;
    const segments: Segment[] = [];
    for (const text of line.split(",")) {
      if (!text) continue;
      const v = vlq(text);
      col += v[0] ?? 0;
      if (v.length < 4) continue;
      src += v[1]!;
      srcLine += v[2]!;
      srcCol += v[3]!;
      segments.push([col, src, srcLine, srcCol]);
    }
    return segments;
  });
}

/**
 * Rewrites each `name:line:column` in a stack to the source file, line and column that the inline
 * source map at the end of `code` gives, or returns null when `code` has none.
 */
export function stackMapper(code: string, name: string): ((stack: string) => string) | null {
  const found = /\/\/# sourceMappingURL=data:application\/json;(?:charset=utf-8;)?base64,([A-Za-z0-9+/=]+)\s*$/.exec(code);
  if (!found) return null;
  let map: { sources: string[]; mappings: string };
  try {
    map = JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(found[1]!), (c) => c.charCodeAt(0))));
  } catch {
    return null;
  }
  let lines: Segment[][] | null = null;
  const frame = new RegExp(`${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}:(\\d+):(\\d+)`, "g");
  return (stack) =>
    stack.replace(frame, (whole, line: string, column: string) => {
      lines ??= decode(map.mappings);
      const col = Number(column) - 1;
      let hit: Segment | undefined;
      for (const s of lines[Number(line) - 1] ?? []) {
        if (s[0] > col) break;
        hit = s;
      }
      const file = hit && map.sources[hit[1]];
      return file ? `${file}:${hit![2] + 1}:${hit![3] + 1}` : whole;
    });
}
