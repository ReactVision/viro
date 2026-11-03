/**
 * Copyright © 2026 ReactVision
 */

"use strict";

import { ViroVPSConnection, resolveVPSStudio, vpsJson, vpsStudioFetch } from "./ViroVPSClient";
import type { ViroVPSScan } from "./ViroVPSScanUpload";

/** A place that can be scanned and localised in. Times are epoch milliseconds. */
export type ViroVPSLocation = {
  id: string;
  name: string;
  /** Null for a location created without them, until an accepted, geo-registered map gives it its own. */
  lat: number | null;
  lon: number | null;
  /** The scan whose map the location serves, null until one is accepted. */
  active_scan_id: string | null;
  /** The app user it belongs to (`appUserId`), null when it is shared. */
  app_user_id: string | null;
  created_at: number;
};

/** What listLocations() tells of a location's active scan. */
export type ViroVPSActiveScanSummary = Pick<
  ViroVPSScan,
  "id" | "kind" | "assets" | "quality" | "geo" | "map_accepted" | "created_at"
>;

export type ViroVPSLocationPage = {
  locations: (ViroVPSLocation & { active_scan: ViroVPSActiveScanSummary | null })[];
  /** Pass as `cursor` for the next page; null on the last. */
  next_cursor: string | null;
};

export type ViroVPSScanPage = {
  scans: ViroVPSScan[];
  /** Pass as `cursor` for the next page; null on the last. */
  next_cursor: string | null;
};

export type ViroVPSPageOptions = {
  limit?: number;
  /** The `next_cursor` of the page before. */
  cursor?: string | null;
};

function pageQuery({ limit, cursor }: ViroVPSPageOptions): string {
  const params: string[] = [];
  if (limit !== undefined) params.push(`limit=${encodeURIComponent(String(limit))}`);
  if (cursor) params.push(`cursor=${encodeURIComponent(cursor)}`);
  return params.length ? `?${params.join("&")}` : "";
}

function locationPath(locationId: string): string {
  return `/vps/locations/${encodeURIComponent(locationId)}`;
}

/**
 * `GET /vps/locations?limit=&cursor=`: the project's locations, newest
 * first, a page at a time (`limit` 1 to 100, default 50). For the ones near
 * a point, use findNearbyLocations().
 */
export async function listLocations(
  options: ViroVPSPageOptions = {},
  connection?: ViroVPSConnection
): Promise<ViroVPSLocationPage> {
  const body = (await vpsStudioFetch(
    await resolveVPSStudio(connection),
    `/vps/locations${pageQuery(options)}`,
    {},
    vpsJson
  )) as Partial<ViroVPSLocationPage>;
  return { locations: body.locations ?? [], next_cursor: body.next_cursor ?? null };
}

/** `GET /vps/locations/{id}`: the location, with its active scan or null. */
export async function getLocation(
  locationId: string,
  connection?: ViroVPSConnection
): Promise<ViroVPSLocation & { active_scan: ViroVPSScan | null }> {
  return (await vpsStudioFetch(
    await resolveVPSStudio(connection),
    locationPath(locationId),
    {},
    vpsJson
  )) as ViroVPSLocation & { active_scan: ViroVPSScan | null };
}

/**
 * `POST /vps/locations`. `lat` and `lon` go together or not at all. Creating
 * the location with its first scan, through uploadScanRecording()'s `target`,
 * is usually simpler. With `appUserId`, the location is that user's.
 */
export async function createLocation(
  location: { name: string; lat?: number; lon?: number },
  connection?: ViroVPSConnection
): Promise<ViroVPSLocation> {
  const body: Record<string, unknown> = { name: location.name };
  if (location.lat !== undefined) body.lat = location.lat;
  if (location.lon !== undefined) body.lon = location.lon;
  return (await vpsStudioFetch(
    await resolveVPSStudio(connection),
    "/vps/locations",
    { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) },
    vpsJson
  )) as ViroVPSLocation;
}

/** `PATCH /vps/locations/{id}`: up to 150 characters. */
export async function renameLocation(
  locationId: string,
  name: string,
  connection?: ViroVPSConnection
): Promise<ViroVPSLocation> {
  return (await vpsStudioFetch(
    await resolveVPSStudio(connection),
    locationPath(locationId),
    { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }) },
    vpsJson
  )) as ViroVPSLocation;
}

/** `DELETE /vps/locations/{id}`: deletes the location with every scan in it and their files. */
export async function deleteLocation(
  locationId: string,
  connection?: ViroVPSConnection
): Promise<{ locations: number; scans: number }> {
  const body = (await vpsStudioFetch(
    await resolveVPSStudio(connection),
    locationPath(locationId),
    { method: "DELETE" },
    vpsJson
  )) as { deleted?: { locations?: number; scans?: number } };
  return { locations: body.deleted?.locations ?? 0, scans: body.deleted?.scans ?? 0 };
}

/**
 * `GET /vps/locations/{id}/scans?limit=&cursor=`: every scan of the location,
 * newest first, accepted or not, a page at a time (`limit` 1 to 200, default
 * 50).
 */
export async function listScans(
  locationId: string,
  options: ViroVPSPageOptions = {},
  connection?: ViroVPSConnection
): Promise<ViroVPSScanPage> {
  const body = (await vpsStudioFetch(
    await resolveVPSStudio(connection),
    `${locationPath(locationId)}/scans${pageQuery(options)}`,
    {},
    vpsJson
  )) as Partial<ViroVPSScanPage>;
  return { scans: body.scans ?? [], next_cursor: body.next_cursor ?? null };
}
