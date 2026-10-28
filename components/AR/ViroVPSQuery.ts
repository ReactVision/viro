/**
 * Copyright © 2026 ReactVision
 *
 * Finding a VPS location from a camera image, for places without GPS
 * (the VPS server's POST /vps/locations/query). The server ranks
 * the project's maps by a global image descriptor and checks the best ones by
 * localising the image against them, the way the device itself would.
 *
 * The image comes from the navigator's captureVPSQueryFrame(): a JPEG of the
 * AR camera's luma plane, in the sensor's native orientation, with the
 * intrinsics of that image. It is sent as multipart form data built here as
 * bytes, since React Native's FormData only takes files by URI.
 */

"use strict";

import type { ViroVPSQueryFrame } from "../Types/ViroEvents";
import { ViroVPSConnection, resolveVPSServer, vpsJson, vpsServerFetch } from "./ViroVPSClient";
import { base64ToBytes } from "../Utilities/ViroBase64";

export { base64ToBytes };

/** One location the server matched the image to, best first. */
export type ViroVPSQueryCandidate = {
  location_id: string;
  scan_id: string;
  /** Global descriptor similarity, 0-1; only for ranking. */
  score: number;
  /** True when the image localised against this location's map. */
  localised: boolean;
  inliers: number;
};

export type ViroVPSQueryOptions = {
  /** A rough position, when there is one, narrows the search to locations nearby (and those without coordinates). */
  lat?: number;
  lon?: number;
  radiusM?: number;
};

/** A multipart/form-data body from text fields and one JPEG file part. */
export function buildQueryMultipart(
  fields: Record<string, string>,
  jpeg: Uint8Array,
  boundary: string
): Uint8Array {
  let head = "";
  for (const [name, value] of Object.entries(fields)) {
    head += `--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`;
  }
  head +=
    `--${boundary}\r\nContent-Disposition: form-data; name="image"; filename="query.jpg"\r\n` +
    "Content-Type: image/jpeg\r\n\r\n";
  const tail = `\r\n--${boundary}--\r\n`;
  const headBytes = asciiBytes(head);
  const tailBytes = asciiBytes(tail);
  const body = new Uint8Array(headBytes.length + jpeg.length + tailBytes.length);
  body.set(headBytes, 0);
  body.set(jpeg, headBytes.length);
  body.set(tailBytes, headBytes.length + jpeg.length);
  return body;
}

// The fields are numbers and ids, so ASCII is enough.
function asciiBytes(s: string): Uint8Array {
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i) & 0x7f;
  return out;
}

/**
 * `POST /vps/locations/query`: the project's locations whose map matches the
 * image, best first. An empty list means none matched this view; try again
 * from another one.
 */
export async function queryLocationsByImage(
  frame: ViroVPSQueryFrame,
  options: ViroVPSQueryOptions = {},
  connection?: ViroVPSConnection
): Promise<ViroVPSQueryCandidate[]> {
  const fields: Record<string, string> = {
    intrinsics: [frame.fx, frame.fy, frame.cx, frame.cy].join(","),
  };
  if (options.lat != null && options.lon != null) {
    fields.lat = String(options.lat);
    fields.lon = String(options.lon);
    if (options.radiusM != null) fields.radius_m = String(options.radiusM);
  }
  const boundary = `viro-vps-${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;
  const body = buildQueryMultipart(fields, base64ToBytes(frame.image), boundary);
  const server = await resolveVPSServer(connection);
  const parsed = (await vpsServerFetch(
    server,
    "/vps/locations/query",
    {
      method: "POST",
      headers: {
        "Content-Type": `multipart/form-data; boundary=${boundary}`,
      },
      body: body as unknown as BodyInit,
    },
    vpsJson
  )) as { candidates?: ViroVPSQueryCandidate[] };
  return Array.isArray(parsed.candidates) ? parsed.candidates : [];
}

/**
 * The candidate to track: the best one the image actually localised against.
 * A high descriptor score alone is not enough: loading the wrong map would
 * leave tracking searching forever.
 */
export function pickVisualCandidate(
  candidates: ViroVPSQueryCandidate[]
): ViroVPSQueryCandidate | null {
  let best: ViroVPSQueryCandidate | null = null;
  for (const c of candidates) {
    if (!c || !c.localised || typeof c.location_id !== "string") continue;
    if (!best || c.inliers > best.inliers) best = c;
  }
  return best;
}

/** The backend's answer to a server-mode frame (`POST /vps/locations/{id}/localise`). */
export type ViroVPSServerFix = {
  location_id: string;
  scan_id: string;
  localised: boolean;
  inliers: number;
  /** The camera in the map, 16 numbers row-major, OpenCV camera axes; null when not localised. */
  T_map_cam: number[] | null;
};

/**
 * `POST /vps/locations/{id}/localise`: where the frame was taken in the
 * location's map, solved on the server (DISK + LightGlue) instead of on the
 * device. `near` is the T_map_cam the caller expects (row-major), so the
 * server matches the keyframes around it first. `device` is an id the caller
 * keeps while it sends one frame at a time: the server does not notice a
 * caller that hung up while its frame waits in line, and gives that frame's
 * place to the next one with the same id. Throws a ViroVPSError with code
 * `NO_SERVER_MAP` when the location's map was built without server mode.
 */
export async function localiseFrameOnServer(
  locationId: string,
  frame: ViroVPSQueryFrame,
  near?: number[],
  device?: string,
  connection?: ViroVPSConnection
): Promise<ViroVPSServerFix> {
  const fields: Record<string, string> = {
    intrinsics: [frame.fx, frame.fy, frame.cx, frame.cy].join(","),
  };
  if (near && near.length === 16) fields.near = near.join(",");
  const boundary = `viro-vps-${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;
  const body = buildQueryMultipart(fields, base64ToBytes(frame.image), boundary);
  const server = await resolveVPSServer(connection);
  return (await vpsServerFetch(
    server,
    `/vps/locations/${encodeURIComponent(locationId)}/localise`,
    {
      method: "POST",
      headers: {
        "Content-Type": `multipart/form-data; boundary=${boundary}`,
        ...(device ? { "x-rv-device": device } : {}),
      },
      body: body as unknown as BodyInit,
    },
    vpsJson
  )) as ViroVPSServerFix;
}

/**
 * The `near` hint for localiseFrameOnServer() from the last localised pose:
 * `renderPose` (getVPSLocalization(), 16 floats column-major, GL camera axes)
 * as T_map_cam in OpenCV camera axes, row-major. Undefined without a pose.
 */
export function nearFromRenderPose(renderPose: string | undefined): number[] | undefined {
  if (!renderPose) return undefined;
  const m = renderPose.split(",").map(Number);
  if (m.length !== 16 || !m.every(Number.isFinite)) return undefined;
  const out: number[] = [];
  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 4; col++) {
      // column-major m[col * 4 + row]; GL to OpenCV camera axes flips y and z (columns 1 and 2)
      const v = m[col * 4 + row];
      out.push(col === 1 || col === 2 ? -v : v);
    }
  }
  return out;
}
