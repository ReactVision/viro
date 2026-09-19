/**
 * Every view manager the visionOS renderer leaves out needs a guard in the component that mounts
 * it. Without one React has no view config for the native component and the app dies on
 * "View config not found for component VRT…" — which is how this was found, one component at a
 * time, on device.
 *
 * The list is derived from the podspec rather than written down here, so excluding one more view
 * from the visionOS build fails this test instead of shipping a crash.
 */
import * as fs from "fs";
import * as path from "path";

const repoRoot = path.resolve(__dirname, "..");

function visionOSExcludedManagers(): string[] {
  const podspec = fs.readFileSync(
    path.join(repoRoot, "ios", "ViroReact.podspec"),
    "utf-8"
  );
  const block = podspec
    .split("s.visionos.exclude_files = [")[1]
    .split("\n  ]")[0];
  // Line by line, not a regex over the whole block: the comments in between contain
  // apostrophes, and a global /'([^']+)'/ pairs one of those with the next entry's quote and
  // swallows everything between — which silently shortened this list to two entries.
  const patterns = block
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("'"))
    .map((line) => line.slice(1, line.indexOf("'", 1)));

  const named = patterns
    .filter((p) => /Manager\.mm$/.test(p))
    .map((p) => path.basename(p, ".mm"));

  // `ViroReact/AR/**/*` takes the AR managers as a directory rather than by name.
  const arDir = path.join(repoRoot, "ios", "ViroReact", "AR", "Managers");
  const ar = patterns.some((p) => p.startsWith("ViroReact/AR/")) && fs.existsSync(arDir)
    ? fs.readdirSync(arDir).filter((f) => f.endsWith("Manager.mm")).map((f) => path.basename(f, ".mm"))
    : [];

  return [...new Set([...named, ...ar])];
}

/** The name the manager registers, which is the manager's own minus the suffix. */
function nativeComponentName(manager: string): string {
  return manager.replace(/Manager$/, "");
}

function componentFileFor(nativeName: string): string | null {
  const roots = [
    path.join(repoRoot, "components"),
    path.join(repoRoot, "components", "AR"),
  ];
  for (const dir of roots) {
    if (!fs.existsSync(dir)) continue;
    for (const file of fs.readdirSync(dir)) {
      if (!file.endsWith(".tsx") || file.endsWith(".web.tsx")) continue;
      const full = path.join(dir, file);
      const source = fs.readFileSync(full, "utf-8");
      if (source.includes(`"${nativeName}"`) && source.includes("requireNativeComponent")) {
        return full;
      }
    }
  }
  return null;
}

describe("components whose view manager visionOS leaves out", () => {
  const managers = visionOSExcludedManagers();

  it("reads the exclusions out of the podspec, so the list cannot go stale", () => {
    expect(managers.length).toBeGreaterThan(0);
    expect(managers).toContain("VRT3DSceneNavigatorManager");
    expect(managers).toContain("VRTARSceneManager");
  });

  it.each(managers)("%s: its component refuses to mount on visionOS", (manager) => {
    const nativeName = nativeComponentName(manager);
    const file = componentFileFor(nativeName);

    // Some managers construct a view no JS component mounts directly (VROHUDManager,
    // VROTextManager). Nothing to guard there.
    if (!file) return;

    const source = fs.readFileSync(file, "utf-8");
    expect(source).toContain("isVisionOS");
  });
});
