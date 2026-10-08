/**
 * Copyright © 2026 ReactVision
 *
 * Packages a ViroReact AR recording (session.jsonl + video.mp4, written by
 * startRecording()/stopRecording() — see VROARSessionRecorderIOS /
 * ARSessionRecorder) and uploads it to the VPS backend described in
 * spatial/vps-server/API.md: POST /vps/scans, then PUT the zip to
 * /vps/scans/{id}/recording.
 *
 * This is the ViroReact AR recorder's format only — not SensorRecorder's.
 *
 * ## What this does and does not do
 *
 * Building the zip and reading the two recording files both happen here, in
 * JS, deliberately: there is no existing native HTTP client for vps-server
 * (unlike the ReactVisionCCA/spatial backend, which every other REST call in
 * this file routes through natively), so the upload is wired from the TS
 * layer instead.
 *
 * That has a real cost the API doc calls out directly: "a recording of
 * several hundred MB streams to disk instead of travelling inside a form" —
 * the two-call POST-then-PUT shape exists precisely so a large recording
 * never has to sit fully in memory. buildStoredZip()/readLocalFile() below
 * do exactly that anyway: they read session.jsonl and video.mp4 fully into
 * JS ArrayBuffers and hold the whole zip in memory before the PUT. For a
 * short scan this is fine; for a long one it is not, and is an interim
 * stand-in — the real fix is a native zip+stream upload (the same shape
 * rvUploadAsset already uses for CCA asset uploads).
 *
 * Reading a local file via `fetch("file://…")` → `.blob()` → `.arrayBuffer()`
 * is React Native's own supported path for local files (no extra native
 * dependency), not something added here — but it has not been exercised
 * against a real recording on a device, so that path still needs on-device
 * verification.
 */

"use strict";

// ---------------------------------------------------------------------------
// Minimal ZIP (stored, i.e. uncompressed) writer.
//
// No compression: every byte of session.jsonl/video.mp4 is written verbatim,
// each prefixed with a standard local file header and followed by a central
// directory + end-of-central-directory record. This is a fully valid, if
// larger-than-necessary, .zip — `Content-Type: application/zip` readers
// (Python's zipfile among them, which vps-server's upload handler almost
// certainly uses) accept stored entries exactly like deflated ones. Keeping
// it to "stored" avoids needing a DEFLATE implementation for two files whose
// main payload (video.mp4) is already compressed and would not shrink
// further anyway.
// ---------------------------------------------------------------------------

/** One file to place in the zip, already read into memory. */
export type ZipEntryInput = {
  name: string;
  data: Uint8Array;
};

const CRC32_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

/** Standard CRC-32 (the zip/gzip polynomial). Verified against the textbook check value "123456789" -> 0xCBF43926 in __test__/vpsScanUpload.test.ts. */
export function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i++) {
    crc = CRC32_TABLE[(crc ^ data[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function dosDateTime(date: Date): { time: number; date: number } {
  const time =
    ((date.getHours() & 0x1f) << 11) |
    ((date.getMinutes() & 0x3f) << 5) |
    ((date.getSeconds() >> 1) & 0x1f);
  const dosYear = Math.max(0, date.getFullYear() - 1980) & 0x7f;
  const dosDate = (dosYear << 9) | (((date.getMonth() + 1) & 0xf) << 5) | (date.getDate() & 0x1f);
  return { time, date: dosDate };
}

function utf8Bytes(s: string): Uint8Array {
  if (typeof TextEncoder !== "undefined") {
    return new TextEncoder().encode(s);
  }
  // Fallback for environments without TextEncoder (ASCII-only file names are
  // all this is ever used with — "session.jsonl"/"video.mp4" — so this path
  // is never exercised with anything outside that range).
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i) & 0xff;
  return out;
}

function writeUint32LE(out: number[], value: number) {
  out.push(value & 0xff, (value >>> 8) & 0xff, (value >>> 16) & 0xff, (value >>> 24) & 0xff);
}

function writeUint16LE(out: number[], value: number) {
  out.push(value & 0xff, (value >>> 8) & 0xff);
}

/**
 * Builds a stored (uncompressed) zip from in-memory entries. Pure function —
 * no file I/O — so it is unit-testable without a device; see
 * __test__/vpsScanUpload.test.ts.
 */
export function buildStoredZip(entries: ZipEntryInput[], now: Date = new Date()): Uint8Array {
  const { time, date } = dosDateTime(now);
  const bytes: number[] = [];
  const centralDirectory: number[] = [];
  let entryCount = 0;

  for (const entry of entries) {
    const nameBytes = utf8Bytes(entry.name);
    const crc = crc32(entry.data);
    const size = entry.data.length;
    const localHeaderOffset = bytes.length;

    // Local file header.
    writeUint32LE(bytes, 0x04034b50);
    writeUint16LE(bytes, 20); // version needed to extract
    writeUint16LE(bytes, 0); // general purpose flag
    writeUint16LE(bytes, 0); // compression method: stored
    writeUint16LE(bytes, time);
    writeUint16LE(bytes, date);
    writeUint32LE(bytes, crc);
    writeUint32LE(bytes, size); // compressed size == uncompressed size (stored)
    writeUint32LE(bytes, size);
    writeUint16LE(bytes, nameBytes.length);
    writeUint16LE(bytes, 0); // extra field length
    for (let i = 0; i < nameBytes.length; i++) bytes.push(nameBytes[i]);
    for (let i = 0; i < entry.data.length; i++) bytes.push(entry.data[i]);

    // Central directory record for this entry.
    writeUint32LE(centralDirectory, 0x02014b50);
    writeUint16LE(centralDirectory, 20); // version made by
    writeUint16LE(centralDirectory, 20); // version needed
    writeUint16LE(centralDirectory, 0); // flags
    writeUint16LE(centralDirectory, 0); // compression: stored
    writeUint16LE(centralDirectory, time);
    writeUint16LE(centralDirectory, date);
    writeUint32LE(centralDirectory, crc);
    writeUint32LE(centralDirectory, size);
    writeUint32LE(centralDirectory, size);
    writeUint16LE(centralDirectory, nameBytes.length);
    writeUint16LE(centralDirectory, 0); // extra field length
    writeUint16LE(centralDirectory, 0); // comment length
    writeUint16LE(centralDirectory, 0); // disk number start
    writeUint16LE(centralDirectory, 0); // internal file attributes
    writeUint32LE(centralDirectory, 0); // external file attributes
    writeUint32LE(centralDirectory, localHeaderOffset);
    for (let i = 0; i < nameBytes.length; i++) centralDirectory.push(nameBytes[i]);

    entryCount++;
  }

  const centralDirectoryOffset = bytes.length;
  const all = bytes.concat(centralDirectory);

  // End of central directory record.
  writeUint32LE(all, 0x06054b50);
  writeUint16LE(all, 0); // disk number
  writeUint16LE(all, 0); // disk with start of central directory
  writeUint16LE(all, entryCount); // entries on this disk
  writeUint16LE(all, entryCount); // total entries
  writeUint32LE(all, centralDirectory.length); // size of central directory
  writeUint32LE(all, centralDirectoryOffset); // offset of start of central directory
  writeUint16LE(all, 0); // comment length

  return new Uint8Array(all);
}

// ---------------------------------------------------------------------------
// Upload orchestration (spatial/vps-server/API.md).
// ---------------------------------------------------------------------------

/** Either credential form API.md accepts; always paired with the project id. */
export type ViroVPSCredentials =
  | { projectId: string; apiKey: string }
  | { projectId: string; accessToken: string };

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

export class ViroVPSUploadError extends Error {
  constructor(
    message: string,
    public readonly code?: string,
    public readonly status?: number
  ) {
    super(message);
    this.name = "ViroVPSUploadError";
  }
}

function authHeaders(creds: ViroVPSCredentials): Record<string, string> {
  const headers: Record<string, string> = { "x-project-id": creds.projectId };
  if ("apiKey" in creds) {
    headers["x-api-key"] = creds.apiKey;
  } else {
    headers["Authorization"] = `Bearer ${creds.accessToken}`;
  }
  return headers;
}

async function throwIfError(response: Response): Promise<void> {
  if (response.ok) return;
  let code: string | undefined;
  let message = `HTTP ${response.status}`;
  try {
    const body = await response.json();
    code = body?.error?.code;
    message = body?.error?.message ?? message;
  } catch {
    // Non-JSON error body — keep the generic HTTP message.
  }
  throw new ViroVPSUploadError(message, code, response.status);
}

/** Reads a file written by the native recorder into memory. See the module doc for the memory caveat. */
async function readLocalFile(path: string): Promise<Uint8Array> {
  // `path` is a plain filesystem path (what startRecording()'s outputDir and
  // the files inside it are) — the file:// scheme is fetch's, not ours.
  const uri = path.startsWith("file://") ? path : `file://${path}`;
  const response = await fetch(uri);
  if (!response.ok) {
    throw new ViroVPSUploadError(`Could not read ${path}: HTTP ${response.status}`);
  }
  const buffer = await response.arrayBuffer();
  return new Uint8Array(buffer);
}

/**
 * Zips and uploads a ViroReact AR recording from `outputDir` (the directory
 * passed to startRecording()) to the VPS backend, per API.md's two-call
 * POST-then-PUT contract.
 *
 * @param endpoint  vps-server's base URL, e.g. "https://vps.example.com" — no
 *        default is assumed here; a wrong guess at a production hostname is
 *        worse than requiring the caller to supply it explicitly.
 * @param outputDir the directory startRecording() wrote session.jsonl and
 *        video.mp4 into. Call this after stopRecording() has resolved.
 * @returns the created scan, in `queued` status — poll getScan() for progress.
 */
export async function uploadScanRecording(
  endpoint: string,
  credentials: ViroVPSCredentials,
  target: ViroVPSScanTarget,
  outputDir: string
): Promise<ViroVPSScan> {
  const createBody =
    "locationId" in target
      ? { location_id: target.locationId }
      : { location: target.location };

  const createResponse = await fetch(`${endpoint}/vps/scans`, {
    method: "POST",
    headers: { ...authHeaders(credentials), "Content-Type": "application/json" },
    body: JSON.stringify(createBody),
  });
  await throwIfError(createResponse);
  const scan = (await createResponse.json()) as ViroVPSScan;

  const dir = outputDir.endsWith("/") ? outputDir.slice(0, -1) : outputDir;
  const [sessionBytes, videoBytes] = await Promise.all([
    readLocalFile(`${dir}/session.jsonl`),
    readLocalFile(`${dir}/video.mp4`),
  ]);
  const zip = buildStoredZip([
    { name: "session.jsonl", data: sessionBytes },
    { name: "video.mp4", data: videoBytes },
  ]);

  const uploadResponse = await fetch(`${endpoint}/vps/scans/${scan.id}/recording`, {
    method: "PUT",
    headers: { ...authHeaders(credentials), "Content-Type": "application/zip" },
    body: zip,
  });
  await throwIfError(uploadResponse);
  return (await uploadResponse.json()) as ViroVPSScan;
}

/** `GET /vps/scans/{id}` — poll while `status` is `queued` or `processing`. */
export async function getScan(
  endpoint: string,
  credentials: ViroVPSCredentials,
  scanId: string
): Promise<ViroVPSScan> {
  const response = await fetch(`${endpoint}/vps/scans/${scanId}`, {
    headers: authHeaders(credentials),
  });
  await throwIfError(response);
  return (await response.json()) as ViroVPSScan;
}
