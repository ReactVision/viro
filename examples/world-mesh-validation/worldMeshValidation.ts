/**
 * On-device validation for the world mesh.
 *
 * The world-mesh fixes in virocore #413 and #414 are verified by a host test that runs in CI, but
 * that test feeds synthetic frames: no real depth sensor, no sensor noise, no tracking, no frame
 * budget. This runs the same acceptance criteria against a real device, so the last step is a
 * command and a readout rather than a checklist someone works through by hand.
 *
 * Usage, from a component holding a `ViroARSceneNavigator` ref:
 *
 * ```tsx
 * const report = await validateWorldMesh(navigatorRef.current, {
 *   onProgress: (line) => console.log(line),
 * });
 * console.log(formatReport(report));
 * ```
 *
 * Walk the room while it runs. It asks you to, and waits.
 */

export type ViroWorldMeshSource =
  | "lidar"
  | "depth"
  | "monocular"
  | "plane"
  | "unknown";

type Stats = {
  available: boolean;
  reason?: string;
  enabled?: boolean;
  vertexCount?: number;
  triangleCount?: number;
  source?: ViroWorldMeshSource;
  accumulated?: boolean;
  isStale?: boolean;
};

type Navigator = {
  getWorldMeshStats: () => Promise<Stats>;
  snapshotWorldMeshToFile: (locationTransform: string) => Promise<any>;
  resetWorldMesh?: () => Promise<boolean>;
};

export type Check = {
  name: string;
  /** null when the run could not reach a verdict — say so rather than guess. */
  passed: boolean | null;
  detail: string;
};

export type Report = {
  source: ViroWorldMeshSource | "unknown";
  accumulated: boolean;
  checks: Check[];
  samples: { t: number; vertices: number; triangles: number }[];
};

export type Options = {
  /** How long to walk the room for. The acceptance criterion is 60 s. */
  walkSeconds?: number;
  /** How often to poll. */
  pollMs?: number;
  /** Minimum vertices expected after the walk, per the acceptance criteria. */
  minVertices?: number;
  onProgress?: (line: string) => void;
};

const IDENTITY = "1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function validateWorldMesh(
  navigator: Navigator,
  options: Options = {}
): Promise<Report> {
  const walkSeconds = options.walkSeconds ?? 60;
  const pollMs = options.pollMs ?? 1000;
  const minVertices = options.minVertices ?? 20000;
  const log = options.onProgress ?? (() => {});

  const checks: Check[] = [];
  const samples: Report["samples"] = [];
  const add = (name: string, passed: boolean | null, detail: string) => {
    checks.push({ name, passed, detail });
    log(`${passed === null ? "?" : passed ? "PASS" : "FAIL"}  ${name} — ${detail}`);
  };

  // ── The mesh has to be on before anything else means something ────────────
  const first = await navigator.getWorldMeshStats();
  if (!first.available) {
    add("world mesh available", false, first.reason ?? "no reason given");
    return { source: "unknown", accumulated: false, checks, samples };
  }
  if (!first.enabled) {
    add("world mesh enabled", false, "set worldMeshEnabled on the navigator");
    return { source: "unknown", accumulated: false, checks, samples };
  }

  const source = first.source ?? "unknown";
  add(
    "source is a depth source, not the plane fallback",
    source === "lidar" || source === "depth" || source === "monocular",
    `source="${source}"` +
      (source === "plane"
        ? " — falling back to AR plane anchors, so nothing below measures a scanned surface"
        : source === "unknown"
        ? " — renderer predates source reporting; rebuild it"
        : "")
  );

  // On Android this is the one that used to read "lidar" on a phone with no LiDAR.
  if (source === "depth") {
    add("Android reports depth rather than lidar", true, 'source="depth"');
  }

  // ── Walk the room ─────────────────────────────────────────────────────────
  log(`\nWalk the room for ${walkSeconds}s — floor and every wall. Starting.\n`);
  const started = Date.now();
  let accumulated = false;
  while ((Date.now() - started) / 1000 < walkSeconds) {
    const s = await navigator.getWorldMeshStats();
    accumulated = accumulated || Boolean(s.accumulated);
    samples.push({
      t: (Date.now() - started) / 1000,
      vertices: s.vertexCount ?? 0,
      triangles: s.triangleCount ?? 0,
    });
    await sleep(pollMs);
  }

  const counts = samples.map((s) => s.vertices);
  const peak = Math.max(...counts, 0);
  const final = counts[counts.length - 1] ?? 0;

  add(
    "the mesh accumulates rather than tracking the view",
    accumulated,
    accumulated
      ? "stats report accumulated=true"
      : "accumulated=false — set worldMeshConfig.accumulate, or the renderer predates fusion"
  );

  // "Roughly monotonic": a fused volume may shed a little to eviction, but it must not rise and
  // fall with where the camera points, which is what the single-frame path did.
  const drops = counts.filter((v, i) => i > 0 && v < counts[i - 1] * 0.8).length;
  add(
    "vertex count climbs instead of rising and falling with the view",
    drops === 0,
    `${drops} drop(s) over 20% across ${counts.length} samples, peak ${peak}, final ${final}`
  );

  add(
    `the walk builds at least ${minVertices} vertices`,
    final >= minVertices,
    `final ${final}`
  );

  // ── Revisiting must not double ────────────────────────────────────────────
  log("\nPoint at a wall you already scanned, and hold for 10s.\n");
  const beforeRevisit = final;
  await sleep(10000);
  const afterRevisit = (await navigator.getWorldMeshStats()).vertexCount ?? 0;
  add(
    "revisiting a scanned wall does not duplicate it",
    afterRevisit < beforeRevisit * 1.3,
    `${beforeRevisit} -> ${afterRevisit}`
  );

  // ── The snapshot VPS Lite uploads ─────────────────────────────────────────
  try {
    const snap = await navigator.snapshotWorldMeshToFile(IDENTITY);
    const ok = Boolean(snap && (snap.filePath || snap.path || snap.success));
    add(
      "snapshotWorldMeshToFile writes the accumulated mesh",
      ok,
      ok ? JSON.stringify(snap) : `no file: ${JSON.stringify(snap)}`
    );
  } catch (e) {
    add("snapshotWorldMeshToFile writes the accumulated mesh", false, String(e));
  }

  // ── Reset ─────────────────────────────────────────────────────────────────
  if (typeof navigator.resetWorldMesh === "function") {
    await navigator.resetWorldMesh();
    await sleep(2000);
    const afterReset = (await navigator.getWorldMeshStats()).vertexCount ?? 0;
    add(
      "resetWorldMesh clears the room",
      afterReset < beforeRevisit * 0.5,
      `${beforeRevisit} -> ${afterReset}`
    );
  } else {
    add("resetWorldMesh clears the room", null, "method absent — JS half not installed");
  }

  return { source, accumulated, checks, samples };
}

export function formatReport(report: Report): string {
  const lines: string[] = [];
  lines.push("World mesh on-device validation");
  lines.push(`  source: ${report.source}   accumulated: ${report.accumulated}`);
  lines.push("");
  for (const c of report.checks) {
    const mark = c.passed === null ? "?   " : c.passed ? "PASS" : "FAIL";
    lines.push(`  ${mark}  ${c.name}`);
    lines.push(`        ${c.detail}`);
  }
  const failed = report.checks.filter((c) => c.passed === false).length;
  const unknown = report.checks.filter((c) => c.passed === null).length;
  lines.push("");
  lines.push(
    failed === 0
      ? `ALL GREEN${unknown ? ` (${unknown} inconclusive)` : ""}`
      : `${failed} FAILED${unknown ? `, ${unknown} inconclusive` : ""}`
  );
  lines.push("");
  lines.push("Vertex count over the walk (seconds: vertices)");
  lines.push(
    "  " + report.samples.map((s) => `${s.t.toFixed(0)}:${s.vertices}`).join("  ")
  );
  return lines.join("\n");
}
