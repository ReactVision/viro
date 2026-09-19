/**
 * The renderer answers the scan-observability calls with a JSON string, because the same shape
 * crosses Objective-C, JNI and the bridge and is defined once in VROARSession. That leaves JS
 * parsing text from native code, and a poll that runs every second while someone walks a room
 * must not be able to take the screen down over a malformed reading.
 */
import {
  isLocationTransform,
  parseScanDiagnostics,
  parseScanStatus,
  withScanDiagnostics,
} from "../components/AR/ViroScanStatus";

describe("parseScanStatus", () => {
  it("reads a status the renderer sent", () => {
    const status = parseScanStatus(
      '{"available":true,"scanning":true,"keyframes":12,"viewpointPairs":7,' +
        '"cameraSpreadMeters":1.4,"minKeyframes":2,"minViewpointPairs":5,' +
        '"minSpreadMeters":1,"meetsKeyframes":true,"meetsViewpointPairs":true,"meetsSpread":true}'
    );
    expect(status.available).toBe(true);
    expect(status.scanning).toBe(true);
    expect(status.keyframes).toBe(12);
    expect(status.viewpointPairs).toBe(7);
    expect(status.meetsSpread).toBe(true);
  });

  it("reports unavailable when no provider is configured", () => {
    expect(parseScanStatus('{"available":false}')).toEqual({ available: false });
  });

  it.each([
    ["nothing at all", undefined],
    ["null", null],
    ["an empty string", ""],
    ["truncated JSON", '{"available":true,'],
    ["a bare number", "42"],
  ])("survives %s rather than throwing", (_label, input) => {
    const status = parseScanStatus(input as string | null | undefined);
    expect(status.available).toBe(false);
    expect(typeof status.error).toBe("string");
  });
});

describe("parseScanDiagnostics", () => {
  it("reads the gate's measurements", () => {
    const d = parseScanDiagnostics(
      '{"valid":true,"keyframes":30,"triangulatedPoints":18,"viewpointPairs":3,' +
        '"spreadMeters":0.4,"minPoints":40,"minViewpointPairs":5,"minSpreadMeters":1}'
    );
    expect(d.valid).toBe(true);
    expect(d.triangulatedPoints).toBe(18);
    expect(d.minPoints).toBe(40);
  });

  it("is invalid, not thrown, when the renderer says nothing useful", () => {
    expect(parseScanDiagnostics("not json")).toEqual({ valid: false });
    expect(parseScanDiagnostics(undefined)).toEqual({ valid: false });
  });
});

describe("withScanDiagnostics", () => {
  const measured = {
    valid: true,
    keyframes: 30,
    triangulatedPoints: 18,
    viewpointPairs: 3,
    spreadMeters: 0.4,
    minPoints: 40,
    minViewpointPairs: 5,
    minSpreadMeters: 1,
  };

  it("attaches the numbers to a failure, which is the case that needs them", () => {
    const result = withScanDiagnostics(
      { success: false, error: "Insufficient scan quality" },
      measured
    );
    expect(result.diagnostics).toEqual(measured);
    expect(result.error).toBe("Insufficient scan quality");
  });

  it("leaves a success alone", () => {
    const ok = { success: true, cloudAnchorId: "abc", locationTransform: "1,0,0,0" };
    expect(withScanDiagnostics(ok, measured)).toEqual(ok);
  });

  it("does not dress up an absence as a measurement", () => {
    // `valid: false` means no scan has been through the gate yet in this session.
    const failed = { success: false, error: "Provider not available" };
    expect(withScanDiagnostics(failed, { valid: false })).toEqual(failed);
  });
});

/**
 * The mesh calls take the frame the scan was hosted in. Without it they used to reach native with
 * an empty string, which is a confusing way to learn that the caller ran ahead of finishScan().
 */
describe("isLocationTransform", () => {
  const real =
    "0.220052,0,0.975486,0,0,1,0,0,-0.975486,0,0.220052,0,0.0378218,0.0133011,0.135534,1";

  it("accepts what finishScan actually returned on device", () => {
    expect(isLocationTransform(real)).toBe(true);
  });

  it("accepts an identity matrix", () => {
    expect(isLocationTransform("1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1")).toBe(true);
  });

  it.each([
    ["nothing", undefined],
    ["null", null],
    ["an empty string", ""],
    ["whitespace", "   "],
    ["a number", 16],
    ["too few values", "1,0,0,0,0,1,0,0"],
    ["too many values", "1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1,1"],
    ["a gap", "1,0,0,0,0,1,0,0,0,0,1,0,0,0,,1"],
    ["a word", "1,0,0,0,0,1,0,0,0,0,1,0,0,0,nan,1"],
  ])("rejects %s", (_label, input) => {
    expect(isLocationTransform(input)).toBe(false);
  });
});
