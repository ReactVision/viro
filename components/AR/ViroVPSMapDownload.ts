/**
 * Copyright © 2026 ReactVision
 *
 * The "GPS nearby -> download the active .rvmap" half of the VPS map flow
 * (Studio's GET /vps/locations, then GET /vps/locations/{id}/map). Pure
 * TS/fetch: these are small JSON
 * requests plus one map download of a few MB, so unlike the scan upload
 * (ViroVPSScanUpload.ts) they do not need a native streaming path.
 *
 * ## What this does and does not cover
 *
 * This module gets map bytes into memory, in JS, and encodes them for the
 * bridge ({@link bytesToBase64}). Handing those bytes to the native
 * per-frame matching runtime —
 * ReactVisionCCA::RVCCACloudAnchorProvider::loadVPSMap()/updateVPSMapFrame()
 * (spatial/include/ReactVisionCCA/RVCCACloudAnchorProvider.h) and the
 * VROVPSLocalizer fuser (spatial/include/ReactVisionCCA/VROVPSLocalizer.h) —
 * is ViroARSceneNavigator's loadVPSMap()/unloadVPSMap()/getVPSLocalization(),
 * which call this base64 encoder and the native rvLoadVPSMap/rvUnloadVPSMap/
 * rvGetVPSLocalization bridge methods (see VROARSessioniOS.h/.cpp,
 * VROARSessionARCore.h/.cpp and VRTARSceneNavigator on iOS,
 * ARScene.java/VRTARSceneNavigator.java on Android).
 */

"use strict";

import {
  ViroVPSConnection,
  ViroVPSError,
  resolveVPSStudio,
  vpsDownloadTimeoutMs,
  vpsFetch,
  vpsJson,
  vpsStudioFetch,
} from "./ViroVPSClient";

export type ViroVPSNearbyLocation = {
  id: string;
  name: string;
  lat: number;
  lon: number;
  active_scan_id: string | null;
  distance_m: number;
  created_at: number;
};

export type ViroVPSMapDownload = {
  kind: "map";
  scan_id: string;
  url: string;
  expires_at: number;
  bytes: number;
  quality: Record<string, number> | null;
};

/** `GET /vps/locations?lat=&lon=&radius_m=&limit=`: nearest first. */
export async function findNearbyLocations(
  lat: number,
  lon: number,
  radiusMeters = 200,
  limit = 20,
  connection?: ViroVPSConnection
): Promise<ViroVPSNearbyLocation[]> {
  const body = (await vpsStudioFetch(
    await resolveVPSStudio(connection),
    `/vps/locations?lat=${lat}&lon=${lon}&radius_m=${radiusMeters}&limit=${limit}`,
    {},
    vpsJson
  )) as { locations?: ViroVPSNearbyLocation[] };
  return body.locations ?? [];
}

/** `GET /vps/locations/{id}/{kind}`: a signed link to a file of the location's active scan. */
async function locationFile<T>(
  locationId: string,
  kind: string,
  connection: ViroVPSConnection | undefined
): Promise<T> {
  return (await vpsStudioFetch(
    await resolveVPSStudio(connection),
    `/vps/locations/${encodeURIComponent(locationId)}/${kind}`,
    {},
    vpsJson
  )) as T;
}

/**
 * `GET /vps/locations/{id}/map` — a signed, credential-free link to the
 * location's active map, valid for `VPS_URL_TTL_SEC` (15 minutes default).
 * Returns 404 (as a thrown ViroVPSError with code "NO_ASSET") if the
 * location has no active scan with a map.
 */
export function getLocationMapDownload(
  locationId: string,
  connection?: ViroVPSConnection
): Promise<ViroVPSMapDownload> {
  return locationFile(locationId, "map", connection);
}

/** The files a location (or scan) can have; see Studio's docs/vps-api.md. */
export type ViroVPSAssetKind = "map" | "mesh" | "world_mesh" | "splat" | "poses" | "semantic";

/** A signed link to one of a location's files, as `GET /vps/locations/{id}/{kind}` answers. */
export type ViroVPSAssetDownload = {
  kind: ViroVPSAssetKind | string;
  scan_id: string;
  url: string;
  expires_at: number;
  bytes: number | null;
};

/**
 * `GET /vps/locations/{id}/world_mesh`: a signed link to the active scan's
 * mesh as RVWM, the format `loadVPSMapMesh()` reads. In the same frame as
 * the location's map. Throws a ViroVPSError with status 404 when the
 * location's active scan has none (a map-only scan).
 */
export function getLocationWorldMeshDownload(
  locationId: string,
  connection?: ViroVPSConnection
): Promise<ViroVPSAssetDownload> {
  return locationFile(locationId, "world_mesh", connection);
}

/**
 * An object found in the location's scan (`semantic.json`), in the map's
 * frame: the same coordinates as children of `<ViroVPSAnchor>`. Metres, Y up.
 */
export type ViroVPSSemanticObject = {
  id: number;
  /** A COCO class name, such as "chair" or "tv". */
  label: string;
  /** 0-1, from the detector's scores across the frames that saw it. */
  confidence: number;
  position: [number, number, number];
  bounds: { min: [number, number, number]; max: [number, number, number] };
  /** How many frames saw it. */
  observations: number;
};

/**
 * `GET /vps/locations/{id}/semantic`: a signed link to the active scan's
 * `semantic.json`. Throws a ViroVPSError with status 404 when the scan has
 * none.
 */
export function getLocationSemanticDownload(
  locationId: string,
  connection?: ViroVPSConnection
): Promise<ViroVPSAssetDownload> {
  return locationFile(locationId, "semantic", connection);
}

function isVec3(v: unknown): v is [number, number, number] {
  return Array.isArray(v) && v.length === 3 && v.every((x) => typeof x === "number" && Number.isFinite(x));
}

/** The objects of a `semantic.json`, dropping any entry that is not well formed. */
export function parseSemanticObjects(json: unknown): ViroVPSSemanticObject[] {
  const objects = (json as { objects?: unknown })?.objects;
  if (!Array.isArray(objects)) return [];
  const out: ViroVPSSemanticObject[] = [];
  for (const o of objects as any[]) {
    if (
      o &&
      typeof o.label === "string" &&
      isVec3(o.position) &&
      o.bounds &&
      isVec3(o.bounds.min) &&
      isVec3(o.bounds.max)
    ) {
      out.push({
        id: typeof o.id === "number" ? o.id : out.length,
        label: o.label,
        confidence: typeof o.confidence === "number" ? o.confidence : 0,
        position: o.position,
        bounds: { min: o.bounds.min, max: o.bounds.max },
        observations: typeof o.observations === "number" ? o.observations : 0,
      });
    }
  }
  return out;
}

/**
 * The objects found in the location's active scan, in its map's frame.
 * `[]` when the scan has none (404 `NO_ASSET`).
 */
export async function fetchLocationSemanticObjects(
  locationId: string,
  connection?: ViroVPSConnection
): Promise<ViroVPSSemanticObject[]> {
  let download: ViroVPSAssetDownload;
  try {
    download = await getLocationSemanticDownload(locationId, connection);
  } catch (e) {
    if (e instanceof ViroVPSError && e.status === 404) return [];
    throw e;
  }
  return vpsFetch(
    download.url,
    undefined,
    async (response) => {
      if (!response.ok) {
        throw new ViroVPSError(`Could not fetch semantic.json: HTTP ${response.status}`, undefined, response.status);
      }
      return parseSemanticObjects(await response.json());
    },
    vpsDownloadTimeoutMs(download.bytes)
  );
}

/** Fetches a signed link's bytes right away, like fetchMapBytes(). */
export async function fetchAssetBytes(download: {
  url: string;
  bytes?: number | null;
}): Promise<Uint8Array> {
  return vpsFetch(
    download.url,
    undefined,
    async (response) => {
      if (!response.ok) {
        throw new ViroVPSError(`Could not fetch file: HTTP ${response.status}`, undefined, response.status);
      }
      return new Uint8Array(await response.arrayBuffer());
    },
    vpsDownloadTimeoutMs(download.bytes)
  );
}

/**
 * Fetches the signed URL's bytes right away — API.md: "Fetch the URL right
 * away rather than storing it." No credentials on this request; the token
 * in the URL is the grant.
 */
export async function fetchMapBytes(mapDownload: ViroVPSMapDownload): Promise<Uint8Array> {
  return vpsFetch(
    mapDownload.url,
    undefined,
    async (response) => {
      if (!response.ok) {
        throw new ViroVPSError(`Could not fetch map: HTTP ${response.status}`, undefined, response.status);
      }
      return new Uint8Array(await response.arrayBuffer());
    },
    vpsDownloadTimeoutMs(mapDownload.bytes)
  );
}

const BASE64_CHARS =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

// Every 12-bit value as its two base64 characters, so each 3-byte group is
// two lookups rather than four.
let base64PairTable: string[] | undefined;
function base64Pairs(): string[] {
  if (!base64PairTable) {
    base64PairTable = new Array(4096);
    for (let i = 0; i < 4096; i++) {
      base64PairTable[i] = BASE64_CHARS[i >> 6] + BASE64_CHARS[i & 0x3f];
    }
  }
  return base64PairTable;
}

// Bytes per chunk; a multiple of 3 so only the last chunk can need padding.
const BASE64_CHUNK_BYTES = 3 * 16384;

/**
 * Encodes bytes as base64, for crossing the RN bridge as a plain string:
 * the same transport StreamingAudioManager.pushSamples() and
 * ViroVisionOSModule's shared-space alignment data already use for binary
 * payloads (see components/Utilities/StreamingAudioManager.ts). Self
 * contained rather than relying on a global `btoa`, which React Native's JS
 * runtime doesn't reliably provide.
 *
 * Builds each chunk as an array of pieces joined once, then joins the
 * chunks, instead of growing one string by `+=` per byte group: a map is
 * several MB, and repeated concatenation at that size is slow and
 * allocation-heavy on Hermes. Internal to the package (not exported from
 * the root); checked against the RFC 4648 vectors in
 * __test__/vpsMapDownload.test.ts.
 */
export function bytesToBase64(bytes: Uint8Array): string {
  const pairs = base64Pairs();
  const len = bytes.length;
  const fullEnd = len - (len % 3);
  const chunks: string[] = [];

  for (let start = 0; start < fullEnd; start += BASE64_CHUNK_BYTES) {
    const end = Math.min(start + BASE64_CHUNK_BYTES, fullEnd);
    const pieces: string[] = new Array((end - start) / 3);
    let p = 0;
    for (let i = start; i < end; i += 3) {
      const n = (bytes[i] << 16) | (bytes[i + 1] << 8) | bytes[i + 2];
      pieces[p++] = pairs[n >> 12] + pairs[n & 0xfff];
    }
    chunks.push(pieces.join(""));
  }

  const rest = len - fullEnd;
  if (rest === 1) {
    const b0 = bytes[fullEnd];
    chunks.push(BASE64_CHARS[b0 >> 2] + BASE64_CHARS[(b0 & 0x03) << 4] + "==");
  } else if (rest === 2) {
    const b0 = bytes[fullEnd];
    const b1 = bytes[fullEnd + 1];
    chunks.push(
      BASE64_CHARS[b0 >> 2] +
        BASE64_CHARS[((b0 & 0x03) << 4) | (b1 >> 4)] +
        BASE64_CHARS[(b1 & 0x0f) << 2] +
        "="
    );
  }
  return chunks.join("");
}

/**
 * Nearby locations actually worth trying for a map, nearest first.
 *
 * Pure and native-free: a location with no active scan has no map to
 * download at all, so it is never worth the round trip, and filtering that
 * out is the one piece of "auto" mode's nearest-pick that doesn't need a
 * network call to test. `findNearbyLocations()` already returns nearest
 * first, so the order coming in is the order going out.
 */
export function candidateLocationsForTracking(
  nearby: ViroVPSNearbyLocation[]
): ViroVPSNearbyLocation[] {
  return nearby.filter((location) => location.active_scan_id != null);
}

/**
 * Convenience: nearest location with an active map within range, or null.
 * Does not itself decide "GPS nearby enough to start localising" (how
 * close, how fresh a fix): callers pass whatever lat/lon/radius makes sense
 * for them.
 */
export async function findNearestMap(
  lat: number,
  lon: number,
  radiusMeters = 200,
  connection?: ViroVPSConnection
): Promise<{ location: ViroVPSNearbyLocation; map: ViroVPSMapDownload } | null> {
  const nearby = await findNearbyLocations(lat, lon, radiusMeters, undefined, connection);
  for (const location of candidateLocationsForTracking(nearby)) {
    try {
      const map = await getLocationMapDownload(location.id, connection);
      return { location, map };
    } catch (e) {
      if (e instanceof ViroVPSError && e.status === 404) continue;
      throw e;
    }
  }
  return null;
}
