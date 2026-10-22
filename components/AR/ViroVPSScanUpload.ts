/**
 * Copyright © 2026 ReactVision
 *
 * Packages a ViroReact AR recording (session.jsonl + video.mp4, written by
 * startRecording()/stopRecording(); see VROARSessionRecorderIOS /
 * ARSessionRecorder) and uploads it for processing: Studio creates the scan
 * (POST /vps/scans) and admits the upload (POST /vps/scans/{id}/upload), which
 * answers with a signed Storage URL; the device PUTs the zip there and tells
 * Studio it arrived (POST /vps/scans/{id}/upload/complete).
 *
 * This is the ViroReact AR recorder's format only, not SensorRecorder's.
 *
 * Zipping and the transfer run natively (rvPrepareScanRecording and
 * rvTransferScanRecording on VRTARSceneNavigatorModule, iOS and Android): a
 * recording can be several hundred MB, so it is streamed into a zip file and
 * the PUT body is streamed from that file. Nothing of the recording passes
 * through JS or the bridge. The transfer keeps going while the app is in the
 * background (an iOS background URLSession, an Android WorkManager job), and
 * finishes with the complete call even when the app is gone by then.
 */

"use strict";

import { NativeModules } from "react-native";
import {
  ViroVPSConnection,
  ViroVPSError,
  resolveVPSStudio,
  vpsErrorFromBody,
  vpsJson,
  vpsStudioFetch,
} from "./ViroVPSClient";

export type ViroVPSScanTarget =
  | { locationId: string }
  | { location: { name: string; lat?: number; lon?: number } };

/** What a scan can build besides its map, which is always built. */
export type ViroVPSScanOutput = "mesh" | "splat" | "semantic";

/**
 * Where the upload goes and as whom (see `ViroVPSConnection`; `appUserId`
 * makes the scan, and a location it creates, that user's), plus how the scan
 * is built.
 */
export type ViroVPSScanUploadOptions = ViroVPSConnection & {
  /**
   * What to build besides the map. `semantic` needs `mesh`. Left out, the
   * scan builds its default, the map and the mesh.
   */
  outputs?: ViroVPSScanOutput[];
  /**
   * Whether Studio keeps the recording once the scan is processed. Default
   * true. With false it is stored only while it is processed, and deleted
   * when that ends. The recording's folder stays on the device either way:
   * only the zip made for the upload is deleted.
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
   * The map's numbers; see Studio's docs/vps-api.md. Includes `points`, `localised`,
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

type NativePrepared = { success: boolean; path?: string; bytes?: number; error?: string };

/**
 * What the native rvTransferScanRecording resolves with (as a JSON string).
 * `stage: "upload"`: the PUT to Storage failed, and the scan stays in
 * `awaiting_upload`. `stage: "complete"`: the recording is stored but the
 * complete call failed. `status`/`body` are that response's, when there was
 * one; on success they are the complete call's.
 */
type NativeTransfer = {
  success: boolean;
  stage?: "upload" | "complete";
  status?: number;
  body?: string;
  error?: string;
  code?: string;
};

type NativeScanUpload = {
  rvPrepareScanRecording(outputDir: string): Promise<string>;
  rvTransferScanRecording(requestJson: string): Promise<string>;
  rvDiscardScanRecording?(path: string): Promise<void>;
};

/** Null when this native build cannot zip and upload scans. */
function scanUploadModule(): NativeScanUpload | null {
  const module = NativeModules.VRTARSceneNavigatorModule as Partial<NativeScanUpload> | undefined;
  return typeof module?.rvPrepareScanRecording === "function" &&
    typeof module.rvTransferScanRecording === "function"
    ? (module as NativeScanUpload)
    : null;
}

const SCAN_OUTPUTS: readonly ViroVPSScanOutput[] = ["mesh", "splat", "semantic"];

/** Studio's answers to the complete call that mean the stored recording will not be processed. */
const RECORDING_REFUSALS = new Set(["RECORDING_NOT_UPLOADED", "RECORDING_SIZE_MISMATCH"]);

/** Studio's checks on the same fields, and scanId's type, so a mistake costs no zip. */
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

function parseNative<T extends { success: boolean; error?: string }>(raw: unknown): T {
  if (typeof raw !== "string" || raw.length === 0) {
    return { success: false, error: "No response from the native scan upload" } as T;
  }
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") return parsed as T;
  } catch {
    // fall through
  }
  return { success: false, error: "Malformed result from the native scan upload" } as T;
}

/** The same error, naming the scan to resume into. */
function withScanId(e: unknown, scanId: string): unknown {
  return e instanceof ViroVPSError && !e.scanId
    ? new ViroVPSError(e.message, e.code, e.status, scanId)
    : e;
}

/**
 * Zips and uploads a ViroReact AR recording from `outputDir` (the directory
 * passed to startRecording()). Call this after stopRecording() has resolved.
 *
 * Order: the recording is checked and zipped first, then the scan is created
 * and the upload admitted, then the zip is sent, so a recording that cannot
 * be read never leaves an empty scan behind. The zip is deleted afterwards
 * whether or not the upload succeeded.
 *
 * The transfer keeps going in the background. If the app is suspended, this
 * resolves once it is back; if it was ended meanwhile, the scan still
 * arrives: read it with getScan().
 *
 * @param target the location to scan, or a new one to create with the scan.
 * @param outputDir the directory startRecording() wrote session.jsonl and
 *        video.mp4 into.
 * @param options where and as whom, what to build, whether Studio keeps the
 *        recording, and a scan to resume; see ViroVPSScanUploadOptions. With
 *        none, the scan goes to the app's own Studio project.
 * @returns the scan: `queued` once Studio has the recording, or still
 *          `awaiting_upload` when the recording is stored but Studio could
 *          not be told, which it notices by itself within a minute. Poll
 *          getScan() for progress.
 * @throws ViroVPSError when the recording can't be read, a request fails, or
 *         a server answers with an error (its `code` and `status` are set).
 *         When the scan exists but its recording did not arrive, `scanId` is
 *         set, also on a failure with no HTTP status. Options or credentials
 *         Studio would refuse throw `BAD_REQUEST`, `INVALID_APP_USER_ID` or
 *         `CREDENTIALS_UNAVAILABLE` before anything is zipped.
 */
export async function uploadScanRecording(
  target: ViroVPSScanTarget,
  outputDir: string,
  options: ViroVPSScanUploadOptions = {}
): Promise<ViroVPSScan> {
  checkUploadOptions(options);
  const native = scanUploadModule();
  if (!native) {
    throw new ViroVPSError("Scan upload is not available on this platform", "UNSUPPORTED");
  }
  const studio = await resolveVPSStudio(options);

  const dir = outputDir.startsWith("file://") ? outputDir.slice("file://".length) : outputDir;
  const prepared = parseNative<NativePrepared>(
    await native.rvPrepareScanRecording(dir.endsWith("/") ? dir.slice(0, -1) : dir)
  );
  if (!prepared.success || typeof prepared.path !== "string" || typeof prepared.bytes !== "number") {
    throw new ViroVPSError(
      prepared.error ?? "The recording could not be packaged",
      undefined,
      undefined,
      options.scanId
    );
  }
  const zipPath = prepared.path;

  let scanId = options.scanId;
  let sending = false;
  try {
    if (!scanId) {
      const body: Record<string, unknown> =
        "locationId" in target ? { location_id: target.locationId } : { location: target.location };
      if (options.outputs !== undefined) body.outputs = options.outputs;
      if (options.keepRecording !== undefined) body.keep_recording = options.keepRecording;
      const created = (await vpsStudioFetch(
        studio,
        "/vps/scans",
        { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) },
        vpsJson
      )) as ViroVPSScan;
      scanId = created.id;
    }
    const path = `/vps/scans/${encodeURIComponent(scanId)}/upload`;
    let granted: { scan: ViroVPSScan; upload: { url: string; headers?: Record<string, string> } | null };
    try {
      granted = (await vpsStudioFetch(
        studio,
        path,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ recording_bytes: prepared.bytes }),
        },
        vpsJson
      )) as typeof granted;
    } catch (e) {
      throw withScanId(e, scanId);
    }

    sending = true;
    const completeUrl = `${studio.base}/functions/v1${path}/complete${
      studio.region ? `?forceFunctionRegion=${studio.region}` : ""
    }`;
    const result = parseNative<NativeTransfer>(
      await native.rvTransferScanRecording(
        JSON.stringify({
          scan_id: scanId,
          zip_path: zipPath,
          bytes: prepared.bytes,
          put_url: granted.upload?.url ?? null,
          put_headers: granted.upload?.headers ?? { "content-type": "application/zip" },
          complete_url: completeUrl,
          complete_headers: { ...studio.headers, "content-type": "application/json" },
        })
      )
    );
    if (result.success) {
      try {
        return (JSON.parse(result.body ?? "") as { scan: ViroVPSScan }).scan;
      } catch {
        throw new ViroVPSError("Studio took the recording but its answer was not JSON", undefined, undefined, scanId);
      }
    }
    const status = typeof result.status === "number" && result.status > 0 ? result.status : undefined;
    const error =
      status !== undefined
        ? vpsErrorFromBody(status, result.body, scanId)
        : new ViroVPSError(result.error ?? "Scan upload failed", result.code, undefined, scanId);
    // The recording is stored, and Studio queues a stored upload by itself, so
    // a complete call that failed for any other reason (an expired session
    // among them) still leaves a scan on its way.
    if (
      result.stage === "complete" &&
      status !== 404 &&
      !RECORDING_REFUSALS.has(error.code ?? "")
    ) {
      return granted.scan;
    }
    throw error;
  } finally {
    if (!sending) native.rvDiscardScanRecording?.(zipPath).catch(() => {});
  }
}

/** `GET /vps/scans/{id}`: poll while `status` is `queued` or `processing`. */
export async function getScan(scanId: string, connection?: ViroVPSConnection): Promise<ViroVPSScan> {
  return (await vpsStudioFetch(
    await resolveVPSStudio(connection),
    `/vps/scans/${encodeURIComponent(scanId)}`,
    {},
    vpsJson
  )) as ViroVPSScan;
}
