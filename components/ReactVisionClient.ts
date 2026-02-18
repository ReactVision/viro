/**
 * ReactVisionClient.ts
 *
 * Pure TypeScript / fetch() client for the ReactVision platform APIs.
 *
 * Use this for:
 *  - Geospatial Anchors  (GPS-based, no AR frame data required)
 *  - Cloud Anchor metadata queries (list, search, delete)
 *
 * For hosting/resolving Cloud Anchors with visual feature data, use the
 * native ViroARSceneNavigator.hostCloudAnchor() / resolveCloudAnchor() APIs
 * which route through the ReactVisionCCA C++ library inside ViroCore.
 *
 * Copyright © 2026 ReactVision. All rights reserved.
 * Proprietary and Confidential
 */

// ============================================================================
// Types
// ============================================================================

export interface RVGeospatialAnchor {
  id: string;
  project_id: string;
  name?: string;
  latitude: number;
  longitude: number;
  altitude?: number;
  radius_m?: number;
  heading?: number;
  metadata?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface RVCreateGeospatialAnchorParams {
  project_id: string;
  name?: string;
  latitude: number;
  longitude: number;
  altitude?: number;
  radius_m?: number;
  heading?: number;
  metadata?: Record<string, unknown>;
}

export interface RVUpdateGeospatialAnchorParams {
  name?: string;
  latitude?: number;
  longitude?: number;
  altitude?: number;
  radius_m?: number;
  heading?: number;
  metadata?: Record<string, unknown>;
}

export interface RVNearbySearchParams {
  latitude: number;
  longitude: number;
  radius_m: number;
  project_id?: string;
  limit?: number;
}

export interface RVListGeospatialParams {
  project_id?: string;
  limit?: number;
  offset?: number;
}

export interface RVGeospatialListResult {
  success: boolean;
  data: RVGeospatialAnchor[];
  total?: number;
}

export interface RVCloudAnchor {
  id: string;
  project_id: string;
  status: string;
  descriptors_url?: string;
  created_at: string;
  expires_at?: string;
}

export interface RVApiResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

// ============================================================================
// Client
// ============================================================================

export class ReactVisionClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;

  /**
   * @param apiKey  ReactVision API key from platform.reactvision.xyz dashboard.
   * @param baseUrl Optional override (defaults to https://platform.reactvision.xyz).
   */
  constructor(apiKey: string, baseUrl = "https://platform.reactvision.xyz") {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl.replace(/\/$/, "");
  }

  // --------------------------------------------------------------------------
  // Geospatial Anchors
  // --------------------------------------------------------------------------

  /** Create a geospatial (GPS-based) anchor. */
  async createGeospatialAnchor(
    params: RVCreateGeospatialAnchorParams
  ): Promise<RVApiResult<RVGeospatialAnchor>> {
    return this._post("/functions/v1/geospatial-anchors", params);
  }

  /** Fetch a single geospatial anchor by ID. */
  async getGeospatialAnchor(
    id: string
  ): Promise<RVApiResult<RVGeospatialAnchor>> {
    return this._get(`/functions/v1/geospatial-anchors/${id}`);
  }

  /** List geospatial anchors (optionally filtered by project). */
  async listGeospatialAnchors(
    params: RVListGeospatialParams = {}
  ): Promise<RVApiResult<RVGeospatialListResult>> {
    const qs = new URLSearchParams();
    if (params.project_id) qs.set("project_id", params.project_id);
    if (params.limit != null) qs.set("limit", String(params.limit));
    if (params.offset != null) qs.set("offset", String(params.offset));
    const query = qs.toString() ? `?${qs}` : "";
    return this._get(`/functions/v1/geospatial-anchors${query}`);
  }

  /** Find geospatial anchors within a radius (metres) of a GPS coordinate. */
  async findNearbyGeospatialAnchors(
    params: RVNearbySearchParams
  ): Promise<RVApiResult<RVGeospatialListResult>> {
    return this._post("/functions/v1/geospatial-anchors/nearby", params);
  }

  /** Update a geospatial anchor's fields. */
  async updateGeospatialAnchor(
    id: string,
    params: RVUpdateGeospatialAnchorParams
  ): Promise<RVApiResult<RVGeospatialAnchor>> {
    return this._patch(`/functions/v1/geospatial-anchors/${id}`, params);
  }

  /** Delete a geospatial anchor. */
  async deleteGeospatialAnchor(id: string): Promise<RVApiResult<null>> {
    return this._delete(`/functions/v1/geospatial-anchors/${id}`);
  }

  // --------------------------------------------------------------------------
  // Cloud Anchor metadata (read-only from JS; host/resolve go through native)
  // --------------------------------------------------------------------------

  /** Fetch metadata for a cloud anchor by ID. */
  async getCloudAnchor(id: string): Promise<RVApiResult<RVCloudAnchor>> {
    return this._get(`/cloud-anchors/${id}`);
  }

  /** List cloud anchors for a project. */
  async listCloudAnchors(
    projectId: string,
    limit = 50,
    offset = 0
  ): Promise<RVApiResult<RVCloudAnchor[]>> {
    return this._get(
      `/cloud-anchors?project_id=${projectId}&limit=${limit}&offset=${offset}`
    );
  }

  /** Delete a cloud anchor. */
  async deleteCloudAnchor(id: string): Promise<RVApiResult<null>> {
    return this._delete(`/cloud-anchors/${id}`);
  }

  // --------------------------------------------------------------------------
  // Internal fetch helpers
  // --------------------------------------------------------------------------

  private async _get<T>(path: string): Promise<RVApiResult<T>> {
    return this._request("GET", path, undefined);
  }

  private async _post<T>(path: string, body: unknown): Promise<RVApiResult<T>> {
    return this._request("POST", path, body);
  }

  private async _patch<T>(
    path: string,
    body: unknown
  ): Promise<RVApiResult<T>> {
    return this._request("PATCH", path, body);
  }

  private async _delete<T>(path: string): Promise<RVApiResult<T>> {
    return this._request("DELETE", path, undefined);
  }

  private async _request<T>(
    method: string,
    path: string,
    body: unknown
  ): Promise<RVApiResult<T>> {
    try {
      const response = await fetch(`${this.baseUrl}${path}`, {
        method,
        headers: {
          "x-api-key": this.apiKey,
          "Content-Type": "application/json",
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });

      const text = await response.text();
      let json: Record<string, unknown> = {};
      try {
        json = JSON.parse(text);
      } catch {
        if (!response.ok) {
          return { success: false, error: `HTTP ${response.status}` };
        }
        return { success: true };
      }

      if (!response.ok) {
        const msg =
          (json.error as string) ||
          (json.message as string) ||
          `HTTP ${response.status}`;
        return { success: false, error: msg };
      }

      // Geospatial API wraps data in { success, data }; Cloud Anchor API
      // returns the object directly or in { anchor }.
      const data =
        (json.data as T) ??
        (json.anchor as T) ??
        (json as unknown as T);

      return { success: true, data };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return { success: false, error: msg };
    }
  }
}
