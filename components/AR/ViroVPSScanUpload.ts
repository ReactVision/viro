/**
 * Copyright © 2026 ReactVision
 *
 * Packages a ViroReact AR recording (session.jsonl + video.mp4, written by
 * startRecording()/stopRecording(); see VROARSessionRecorderIOS /
 * ARSessionRecorder) and uploads it to the VPS backend described in
 * spatial/vps-server/API.md: POST /vps/scans, then PUT the zip to the
 * returned `upload_path` (/vps/scans/{id}/recording). A failed upload can be
 * resumed into the scan it created, with only the PUT.
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
  ViroVPSCredentialsSource,
  ViroVPSError,
  throwIfVPSError,
  vpsAuthHeaders,
  vpsBaseUrl,
  vpsErrorFromBody,
  vpsFetch,
} from "./ViroVPSClient";

export type ViroVPSScanTarget =
  | { locationId: string }
  | { location: { name: string; lat?: number; lon?: number } };

/** What a scan can build besides its map, which is always built. */
export type ViroVPSScanOutput = "mesh" | "splat" | "semantic";

export type ViroVPSScanUploadOptions = {
  /**
   * The app's own id for its signed-in user, sent as `x-app-user-id`: the
   * scan, and a location it creates, belong to that user. See
   * `ViroVPSCredentials.appUserId` for what an id may contain.
   */
  appUserId?: string;
  /**
   * What to build besides the map. `semantic` needs `mesh`. Left out, the
   * server builds its default, the map and the mesh.
   */
  outputs?: ViroVPSScanOutput[];
  /**
   * Whether vps-server keeps the recording once the scan is processed.
   * Default true. With false the server never stores it. The recording's
   * folder stays on the device either way: only the temporary zip made for
   * the upload is deleted.
   */
  keepRecording?: boolean;
  /**
   * Upload into this scan, which must still be in `awaiting_upload`, instead
   * of creating one: the `scanId` of the ViroVPSError an earlier attempt
   * threw. The scan keeps the location, `outputs` and `keepRecording` it was
   * created with, so `target`, `outputs` and `keepRecording` are not used.
   */
  scanId?: string;
};

export type ViroVPSScan = {
  id: string;
  location_id: string;
  status: "awaiting_upload" | "queued" | "processing" | "succeeded" | "failed";
  stage: string | null;
  error: string | null;
  recording_bytes: number | null;
  assets: string[];
  /**
   * The map's numbers; see vps-server/API.md. Includes `points`, `localised`,
   * `check_frames`, `position_error_median_m`, ..., and for a merge
   * `merged_scans` and `cross_scan_residual_px`.
   */
  quality: Record<string, number | null> | null;
  /** Where the map sits on Earth (map origin, and the map -> East-North-Up rotation's rows); null without usable GPS. */
  geo: { lat: number; lon: number; alt: number; r_enu_map: number[][] } | null;
  /** The location's active scan when this one was submitted; this scan was built in that map's frame. */
  aligned_to_scan_id: string | null;
  /** How that alignment went: `aligned`, and `yaw_deg`/`translation_m`, or the `reason` it failed. */
  alignment: Record<string, unknown> | null;
  /**
   * `"scan"` for an uploaded recording; `"merge"` for a map the backend built
   * from several accepted scans of the location (a global bundle adjustment).
   * Absent from servers older than merging, which means `"scan"`.
   */
  kind?: "scan" | "merge";
  /** For a merge, the scans whose recordings went into it; null for a scan. */
  merged_scan_ids?: string[] | null;
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
 * (or, on success, the final PUT) response, when there was one. `scan_id` is
 * set whenever the scan exists: at stage `upload`, on success, and on every
 * result of a resumed upload.
 */
type NativeScanUploadResult = {
  success: boolean;
  stage?: "zip" | "create" | "upload";
  status?: number;
  body?: string;
  error?: string;
  scan_id?: string;
};

const SCAN_OUTPUTS: readonly ViroVPSScanOutput[] = ["mesh", "splat", "semantic"];

/** vps-server's checks on the same fields, and scanId's type, so a mistake costs no zip. */
function checkUploadOptions({ outputs, keepRecording, scanId }: ViroVPSScanUploadOptions) {
  if (scanId !== undefined && typeof scanId !== "string") {
    throw new ViroVPSError("scanId is a string", "BAD_REQUEST");
  }
  if (outputs !== undefined) {
    if (!Array.isArray(outputs) || !outputs.every((o) => SCAN_OUTPUTS.includes(o))) {
      throw new ViroVPSError(`outputs is a list of ${SCAN_OUTPUTS.join(", ")}`, "BAD_REQUEST");
    }
    if (outputs.includes("semantic") && !outputs.includes("mesh")) {
      throw new ViroVPSError("semantic needs mesh", "BAD_REQUEST");
    }
  }
  if (keepRecording !== undefined && typeof keepRecording !== "boolean") {
    throw new ViroVPSError("keepRecording is a boolean", "BAD_REQUEST");
  }
}

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
 * @param credentials or a function returning them, called once per upload:
 *        both requests carry what it answered.
 * @param outputDir the directory startRecording() wrote session.jsonl and
 *        video.mp4 into. Call this after stopRecording() has resolved.
 * @param options the app user, what to build, whether the server keeps
 *        the recording, and a scan to resume; see ViroVPSScanUploadOptions.
 * @returns the created scan, still in `awaiting_upload` status while the
 *          server stores and queues the recording; poll getScan() for progress.
 * @throws ViroVPSError when the recording can't be read, a request fails, or
 *         the server answers with an error (its `code` and `status` are set).
 *         When the scan exists but its recording did not arrive, `scanId` is
 *         set, also on a failure with no HTTP status. Options or an
 *         `appUserId` the server would refuse throw `BAD_REQUEST` or
 *         `INVALID_APP_USER_ID` before anything is zipped.
 */
export async function uploadScanRecording(
  endpoint: string,
  credentials: ViroVPSCredentialsSource,
  target: ViroVPSScanTarget,
  outputDir: string,
  options: ViroVPSScanUploadOptions = {}
): Promise<ViroVPSScan> {
  checkUploadOptions(options);
  const nativeModule = NativeModules.VRTARSceneNavigatorModule;
  if (!nativeModule || typeof nativeModule.rvUploadScanRecording !== "function") {
    throw new ViroVPSError("Scan upload is not available on this platform", "UNSUPPORTED");
  }

  const resumeScanId = options.scanId ?? "";
  let createBody = "";
  if (!resumeScanId) {
    const body: Record<string, unknown> =
      "locationId" in target
        ? { location_id: target.locationId }
        : { location: target.location };
    if (options.outputs !== undefined) body.outputs = options.outputs;
    if (options.keepRecording !== undefined) body.keep_recording = options.keepRecording;
    createBody = JSON.stringify(body);
  }
  const headers = await vpsAuthHeaders(credentials, options.appUserId);

  const dir = outputDir.startsWith("file://") ? outputDir.slice("file://".length) : outputDir;

  const result = parseNativeResult(
    await nativeModule.rvUploadScanRecording(
      vpsBaseUrl(endpoint),
      JSON.stringify(headers),
      createBody,
      dir.endsWith("/") ? dir.slice(0, -1) : dir,
      resumeScanId
    )
  );

  if (!result.success) {
    const scanId =
      (typeof result.scan_id === "string" && result.scan_id) || resumeScanId || undefined;
    if (typeof result.status === "number" && result.status > 0) {
      throw vpsErrorFromBody(result.status, result.body, scanId);
    }
    throw new ViroVPSError(result.error ?? "Scan upload failed", undefined, undefined, scanId);
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
  credentials: ViroVPSCredentialsSource,
  scanId: string
): Promise<ViroVPSScan> {
  const response = await vpsFetch(
    `${vpsBaseUrl(endpoint)}/vps/scans/${encodeURIComponent(scanId)}`,
    { headers: await vpsAuthHeaders(credentials) }
  );
  await throwIfVPSError(response);
  return (await response.json()) as ViroVPSScan;
}
