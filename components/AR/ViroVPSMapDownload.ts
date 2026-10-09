/**
 * Copyright © 2026 ReactVision
 *
 * The "GPS nearby -> download the active .rvmap" half of the VPS map flow
 * (spatial/vps-server/API.md: GET /vps/locations, then
 * GET /vps/locations/{id}/map). Pure TS/fetch: these are small JSON
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
  ViroVPSCredentials,
  ViroVPSError,
  throwIfVPSError,
  vpsAuthHeaders,
  vpsBaseUrl,
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

/** `GET /vps/locations?lat=&lon=&radius_m=&limit=` — nearest first. */
export async function findNearbyLocations(
  endpoint: string,
  credentials: ViroVPSCredentials,
  lat: number,
  lon: number,
  radiusMeters = 200,
  limit = 20
): Promise<ViroVPSNearbyLocation[]> {
  const url = `${vpsBaseUrl(endpoint)}/vps/locations?lat=${lat}&lon=${lon}&radius_m=${radiusMeters}&limit=${limit}`;
  const response = await fetch(url, { headers: vpsAuthHeaders(credentials) });
  await throwIfVPSError(response);
  return (await response.json()) as ViroVPSNearbyLocation[];
}

/**
 * `GET /vps/locations/{id}/map` — a signed, credential-free link to the
 * location's active map, valid for `VPS_URL_TTL_SEC` (15 minutes default).
 * Returns 404 (as a thrown ViroVPSError with code "NO_ASSET") if the
 * location has no active scan with a map.
 */
export async function getLocationMapDownload(
  endpoint: string,
  credentials: ViroVPSCredentials,
  locationId: string
): Promise<ViroVPSMapDownload> {
  const response = await fetch(
    `${vpsBaseUrl(endpoint)}/vps/locations/${encodeURIComponent(locationId)}/map`,
    { headers: vpsAuthHeaders(credentials) }
  );
  await throwIfVPSError(response);
  return (await response.json()) as ViroVPSMapDownload;
}

/**
 * Fetches the signed URL's bytes right away — API.md: "Fetch the URL right
 * away rather than storing it." No credentials on this request; the token
 * in the URL is the grant.
 */
export async function fetchMapBytes(mapDownload: ViroVPSMapDownload): Promise<Uint8Array> {
  const response = await fetch(mapDownload.url);
  if (!response.ok) {
    throw new ViroVPSError(`Could not fetch map: HTTP ${response.status}`, undefined, response.status);
  }
  const buffer = await response.arrayBuffer();
  return new Uint8Array(buffer);
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
  endpoint: string,
  credentials: ViroVPSCredentials,
  lat: number,
  lon: number,
  radiusMeters = 200
): Promise<{ location: ViroVPSNearbyLocation; map: ViroVPSMapDownload } | null> {
  const nearby = await findNearbyLocations(endpoint, credentials, lat, lon, radiusMeters);
  for (const location of candidateLocationsForTracking(nearby)) {
    try {
      const map = await getLocationMapDownload(endpoint, credentials, location.id);
      return { location, map };
    } catch (e) {
      if (e instanceof ViroVPSError && e.status === 404) continue;
      throw e;
    }
  }
  return null;
}
