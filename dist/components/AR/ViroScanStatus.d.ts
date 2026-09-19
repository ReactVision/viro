/**
 * Copyright © 2026 ReactVision. All rights reserved.
 *
 * Parsing and shaping for the VPS-Lite scan observability calls.
 *
 * The renderer answers with a JSON string rather than a structured object: the same shape crosses
 * Objective-C, JNI and the React Native bridge, and defining it once in `VROARSession` is what
 * keeps the three from drifting. The cost is that the JS side is handed text from native code,
 * which can be malformed in ways a typed bridge could not be — so it is parsed here, in one
 * place, where the failure modes can be tested.
 */
import type { ViroFinishScanResult, ViroScanDiagnostics, ViroScanStatus } from "../Types/ViroEvents";
import type { ViroWorldMeshStatsResult } from "../Types/ViroWorldMesh";
/**
 * @param json what the native module resolved with
 * @returns the status, or an unavailable one carrying the reason — never a throw. A status poll
 *          runs on a timer while someone walks a room, and an exception there would take down the
 *          screen over a reading that is allowed to be missing.
 */
export declare function parseScanStatus(json: string | null | undefined): ViroScanStatus;
/** Same contract as {@link parseScanStatus}: never throws, absence is `valid: false`. */
export declare function parseScanDiagnostics(json: string | null | undefined): ViroScanDiagnostics;
/**
 * Attaches the gate's measurements to a failed scan.
 *
 * Only to a failure, and only when the diagnostics are real: a success already says everything
 * the caller needs, and `valid: false` means no scan has been through the gate yet, so attaching
 * it would dress up an absence as a measurement.
 */
export declare function withScanDiagnostics(result: ViroFinishScanResult, diagnostics: ViroScanDiagnostics): ViroFinishScanResult;
/**
 * Whether a string is a location transform this API produced, rather than an empty placeholder.
 *
 * `snapshotWorldMeshToFile` and `loadWorldMeshFromFile` both take one, and both are meaningless
 * without it: the mesh has to be written in the same frame the scan was hosted in, or it lands
 * somewhere arbitrary on the device that loads it. Calling them before `finishScan()` has
 * returned one used to reach native with an empty string and fail there, or worse, not fail.
 *
 * The check is deliberately shallow — 16 comma-separated finite numbers, the shape
 * `VROMatrix4f::getArray()` produces. It is not a validity test for the matrix itself; it exists
 * to catch "nothing", "undefined" and a truncated value, which is what actually happens.
 */
export declare function isLocationTransform(value: unknown): value is string;
/**
 * Mesh stats, from either bridge.
 *
 * The two platforms disagree on the wire: Android answers with a JSON string, because the value
 * crosses JNI as one, while iOS resolves a dictionary straight from the C++ struct. Neither is
 * worth a native round trip to align, so the difference is absorbed here — the one place that
 * already exists for turning what native says into what the app sees.
 *
 * Never throws, on the same reasoning as {@link parseScanStatus}: this is polled on a timer.
 */
export declare function parseWorldMeshStats(raw: string | Record<string, unknown> | null | undefined): ViroWorldMeshStatsResult;
