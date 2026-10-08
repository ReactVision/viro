/**
 * Copyright © 2026 ReactVision
 *
 * The "GPS nearby -> download the active .rvmap" half of the VPS map flow
 * (spatial/vps-server/API.md: GET /vps/locations, then
 * GET /vps/locations/{id}/map). Pure TS/fetch, same reasoning as
 * ViroVPSScanUpload.ts: there is no existing native HTTP client for
 * vps-server to route through.
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

import { ViroVPSCredentials, ViroVPSUploadError } from "./ViroVPSScanUpload";

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

/** `GET /vps/locations?lat=&lon=&radius_m=&limit=` — nearest first. */
export async function findNearbyLocations(
  endpoint: string,
  credentials: ViroVPSCredentials,
  lat: number,
  lon: number,
  radiusMeters = 200,
  limit = 20
): Promise<ViroVPSNearbyLocation[]> {
  const url = `${endpoint}/vps/locations?lat=${lat}&lon=${lon}&radius_m=${radiusMeters}&limit=${limit}`;
  const response = await fetch(url, { headers: authHeaders(credentials) });
  await throwIfError(response);
  return (await response.json()) as ViroVPSNearbyLocation[];
}

/**
 * `GET /vps/locations/{id}/map` — a signed, credential-free link to the
 * location's active map, valid for `VPS_URL_TTL_SEC` (15 minutes default).
 * Returns 404 (as a thrown ViroVPSUploadError with code "NO_ASSET") if the
 * location has no active scan with a map.
 */
export async function getLocationMapDownload(
  endpoint: string,
  credentials: ViroVPSCredentials,
  locationId: string
): Promise<ViroVPSMapDownload> {
  const response = await fetch(`${endpoint}/vps/locations/${locationId}/map`, {
    headers: authHeaders(credentials),
  });
  await throwIfError(response);
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
    throw new ViroVPSUploadError(`Could not fetch map: HTTP ${response.status}`);
  }
  const buffer = await response.arrayBuffer();
  return new Uint8Array(buffer);
}

const BASE64_CHARS =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

/**
 * Encodes bytes as base64, for crossing the RN bridge as a plain string —
 * the same transport StreamingAudioManager.pushSamples() and
 * ViroVisionOSModule's shared-space alignment data already use for binary
 * payloads (see components/Utilities/StreamingAudioManager.ts). Self
 * contained rather than relying on a global `btoa`, which React Native's JS
 * runtime doesn't reliably provide. Verified against the RFC 4648 test
 * vectors in __test__/vpsMapDownload.test.ts.
 */
export function bytesToBase64(bytes: Uint8Array): string {
  let result = "";
  const len = bytes.length;
  for (let i = 0; i < len; i += 3) {
    const b0 = bytes[i];
    const b1 = i + 1 < len ? bytes[i + 1] : undefined;
    const b2 = i + 2 < len ? bytes[i + 2] : undefined;

    result += BASE64_CHARS[b0 >> 2];
    result += BASE64_CHARS[((b0 & 0x03) << 4) | (b1 === undefined ? 0 : b1 >> 4)];
    result +=
      b1 === undefined
        ? "="
        : BASE64_CHARS[((b1 & 0x0f) << 2) | (b2 === undefined ? 0 : b2 >> 6)];
    result += b2 === undefined ? "=" : BASE64_CHARS[b2 & 0x3f];
  }
  return result;
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
 * Does not itself decide "GPS nearby enough to start localising" — that
 * threshold (how close, how fresh a fix) is a product decision this task
 * does not settle; callers pass whatever lat/lon/radius makes sense for them.
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
      if (e instanceof ViroVPSUploadError && e.status === 404) continue;
      throw e;
    }
  }
  return null;
}
