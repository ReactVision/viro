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
