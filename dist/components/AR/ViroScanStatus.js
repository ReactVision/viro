"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseScanStatus = parseScanStatus;
exports.parseScanDiagnostics = parseScanDiagnostics;
exports.withScanDiagnostics = withScanDiagnostics;
/**
 * @param json what the native module resolved with
 * @returns the status, or an unavailable one carrying the reason — never a throw. A status poll
 *          runs on a timer while someone walks a room, and an exception there would take down the
 *          screen over a reading that is allowed to be missing.
 */
function parseScanStatus(json) {
    if (typeof json !== "string" || json.length === 0) {
        return { available: false, error: "No response from the renderer" };
    }
    try {
        const parsed = JSON.parse(json);
        if (parsed == null || typeof parsed !== "object") {
            return { available: false, error: "Malformed scan status" };
        }
        return parsed;
    }
    catch {
        return { available: false, error: "Malformed scan status" };
    }
}
/** Same contract as {@link parseScanStatus}: never throws, absence is `valid: false`. */
function parseScanDiagnostics(json) {
    if (typeof json !== "string" || json.length === 0) {
        return { valid: false };
    }
    try {
        const parsed = JSON.parse(json);
        if (parsed == null || typeof parsed !== "object") {
            return { valid: false };
        }
        return parsed;
    }
    catch {
        return { valid: false };
    }
}
/**
 * Attaches the gate's measurements to a failed scan.
 *
 * Only to a failure, and only when the diagnostics are real: a success already says everything
 * the caller needs, and `valid: false` means no scan has been through the gate yet, so attaching
 * it would dress up an absence as a measurement.
 */
function withScanDiagnostics(result, diagnostics) {
    if (result?.success)
        return result;
    if (!diagnostics?.valid)
        return result;
    return { ...result, diagnostics };
}
