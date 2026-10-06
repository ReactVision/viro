/**
 * iOS links the prebuilt ios/dist/lib/libViroReact.a and the podspec keeps every bridge .mm out of
 * the compile while that archive exists, so a source that is not in the Xcode target that builds
 * the archive is in the package but in no iOS build. 3.0.2 shipped VRTObjectDetectorView that way
 * and <ViroObjectDetector /> failed to mount on every iPhone. The script this runs is the check
 * the release makes; running it here fails the suite on the commit that adds the file.
 */
import { execFileSync } from "child_process";
import * as path from "path";

describe("scripts/check-ios-bridge.sh", () => {
  it("finds every bridge source in the Xcode target, and every view manager in the archive or the podspec's fallback list", () => {
    const script = path.resolve(__dirname, "..", "scripts", "check-ios-bridge.sh");
    let output = "";
    try {
      output = execFileSync("bash", [script], { encoding: "utf-8", stdio: "pipe" });
    } catch (error) {
      const failed = error as { stdout?: string; stderr?: string };
      throw new Error(`check-ios-bridge.sh failed:\n${failed.stdout ?? ""}${failed.stderr ?? ""}`);
    }
    expect(output.trim().endsWith("ok")).toBe(true);
  });
});
