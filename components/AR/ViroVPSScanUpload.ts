/**
 * Copyright © 2026 ReactVision
 *
 * Packages a ViroReact AR recording (session.jsonl + video.mp4, written by
 * startRecording()/stopRecording(); see VROARSessionRecorderIOS /
 * ARSessionRecorder) and uploads it to the VPS backend described in
 * spatial/vps-server/API.md: POST /vps/scans, then PUT the zip to the
 * returned `upload_path` (/vps/scans/{id}/recording).
 *
 * This is the ViroReact AR recorder's format only, not SensorRecorder's.
 *
 * Zipping and the upload both run natively (rvUploadScanRecording on
 * VRTARSceneNavigatorModule, iOS and Android): a recording can be several
 * hundred MB, so the files are streamed into a zip in a temp file and the
 * PUT body is streamed from that file. Nothing of the recording passes
 * through JS or the bridge.
 */

"use strict";

import { NativeModules } from "react-native";
import {
  ViroVPSCredentials,
  ViroVPSError,
  throwIfVPSError,
  vpsAuthHeaders,
  vpsBaseUrl,
  vpsErrorFromBody,
} from "./ViroVPSClient";

export type ViroVPSScanTarget =
  | { locationId: string }
  | { location: { name: string; lat?: number; lon?: number } };

export type ViroVPSScan = {
  id: string;
  location_id: string;
  status: "awaiting_upload" | "queued" | "processing" | "succeeded" | "failed";
  stage: string | null;
  error: string | null;
  recording_bytes: number | null;
  assets: string[];
  quality: Record<string, number> | null;
  map_accepted: boolean | null;
  map_rejected_reason: string | null;
  created_at: number;
  updated_at: number;
};

/**
 * What the native rvUploadScanRecording resolves with (as a JSON string).
 *
 * - `stage: "zip"`: the recording could not be read or zipped. No request
 *   was sent, so no scan exists on the server.
 * - `stage: "create"`: POST /vps/scans failed or answered non-2xx.
 * - `stage: "upload"`: PUT of the zip failed or answered non-2xx. The scan
 *   exists and stays in `awaiting_upload`.
 *
 * `status`/`body` are the HTTP status and raw response body of the failing
 * (or, on success, the final PUT) response, when there was one.
 */
type NativeScanUploadResult = {
  success: boolean;
  stage?: "zip" | "create" | "upload";
  status?: number;
  body?: string;
  error?: string;
};

function parseNativeResult(raw: unknown): NativeScanUploadResult {
  if (typeof raw !== "string" || raw.length === 0) {
    return { success: false, error: "No response from the native scan upload" };
  }
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") return parsed as NativeScanUploadResult;
  } catch {
    // fall through
  }
  return { success: false, error: "Malformed result from the native scan upload" };
}

/**
 * Zips and uploads a ViroReact AR recording from `outputDir` (the directory
 * passed to startRecording()) to the VPS backend, per API.md's two-call
 * POST-then-PUT contract.
 *
 * Order: both files are checked and zipped first, then the scan is created,
 * then the zip is uploaded, so a recording that cannot be read never leaves
 * an empty scan behind on the server. The temp zip is deleted afterwards
 * whether or not the upload succeeded.
 *
 * @param endpoint  vps-server's base URL, e.g. "https://vps.example.com". No
 *        default is assumed; a wrong guess at a production hostname is worse
 *        than requiring the caller to supply it explicitly.
 * @param outputDir the directory startRecording() wrote session.jsonl and
 *        video.mp4 into. Call this after stopRecording() has resolved.
 * @returns the created scan, in `queued` status; poll getScan() for progress.
 * @throws ViroVPSError when the recording can't be read, a request fails, or
 *         the server answers with an error (its `code` and `status` are set).
 */
export async function uploadScanRecording(
  endpoint: string,
  credentials: ViroVPSCredentials,
  target: ViroVPSScanTarget,
  outputDir: string
): Promise<ViroVPSScan> {
  const nativeModule = NativeModules.VRTARSceneNavigatorModule;
  if (!nativeModule || typeof nativeModule.rvUploadScanRecording !== "function") {
    throw new ViroVPSError("Scan upload is not available on this platform");
  }

  const createBody =
    "locationId" in target
      ? { location_id: target.locationId }
      : { location: target.location };

  const dir = outputDir.startsWith("file://") ? outputDir.slice("file://".length) : outputDir;

  const result = parseNativeResult(
    await nativeModule.rvUploadScanRecording(
      vpsBaseUrl(endpoint),
      JSON.stringify(vpsAuthHeaders(credentials)),
      JSON.stringify(createBody),
      dir.endsWith("/") ? dir.slice(0, -1) : dir
    )
  );

  if (!result.success) {
    if (typeof result.status === "number" && result.status > 0) {
      throw vpsErrorFromBody(result.status, result.body);
    }
    throw new ViroVPSError(result.error ?? "Scan upload failed");
  }
  try {
    return JSON.parse(result.body ?? "") as ViroVPSScan;
  } catch {
    throw new ViroVPSError("The server accepted the recording but its response was not JSON");
  }
}

/** `GET /vps/scans/{id}`: poll while `status` is `queued` or `processing`. */
export async function getScan(
  endpoint: string,
  credentials: ViroVPSCredentials,
  scanId: string
): Promise<ViroVPSScan> {
  const response = await fetch(`${vpsBaseUrl(endpoint)}/vps/scans/${encodeURIComponent(scanId)}`, {
    headers: vpsAuthHeaders(credentials),
  });
  await throwIfVPSError(response);
  return (await response.json()) as ViroVPSScan;
}
