/**
 * Copyright © 2026 ReactVision
 *
 * The "GPS nearby -> download the active .rvmap" half of Phase 1 task 1
 * (spatial/vps-server/API.md: GET /vps/locations, then
 * GET /vps/locations/{id}/map). Pure TS/fetch, same reasoning as
 * ViroVPSScanUpload.ts: there is no existing native HTTP client for
 * vps-server to route through.
 *
 * ## What this does not cover
 *
 * This module stops at "map bytes in memory, in JS". Handing those bytes to
 * the native per-frame matching runtime —
 * ReactVisionCCA::RVCCACloudAnchorProvider::loadVPSMap()/updateVPSMapFrame()
 * (spatial/include/ReactVisionCCA/RVCCACloudAnchorProvider.h) and the
 * VROVPSLocalizer fuser (spatial/include/ReactVisionCCA/VROVPSLocalizer.h) —
 * needs a bridge method (Obj-C++ on iOS, JNI on Android) that was not built
 * in this session, and a decision about which per-frame hook on
 * VROARSessioniOS/VROARSessionARCore drives updateVPSMapFrame(). Both are
 * flagged in this task's report as the remaining integration gap, not
 * guessed at here.
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
  for (const location of nearby) {
    if (!location.active_scan_id) continue;
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
