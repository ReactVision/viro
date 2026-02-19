"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReactVisionClient = void 0;
// ============================================================================
// Client
// ============================================================================
class ReactVisionClient {
    apiKey;
    baseUrl;
    /**
     * @param apiKey  ReactVision API key from platform.reactvision.xyz dashboard.
     * @param baseUrl Optional override (defaults to https://platform.reactvision.xyz).
     */
    constructor(apiKey, baseUrl = "https://platform.reactvision.xyz") {
        this.apiKey = apiKey;
        this.baseUrl = baseUrl.replace(/\/$/, "");
    }
    // --------------------------------------------------------------------------
    // Geospatial Anchors
    // --------------------------------------------------------------------------
    /** Create a geospatial (GPS-based) anchor. */
    async createGeospatialAnchor(params) {
        return this._post("/functions/v1/geospatial-anchors", params);
    }
    /** Fetch a single geospatial anchor by ID. */
    async getGeospatialAnchor(id) {
        return this._get(`/functions/v1/geospatial-anchors/${id}`);
    }
    /** List geospatial anchors (optionally filtered by project). */
    async listGeospatialAnchors(params = {}) {
        const qs = new URLSearchParams();
        if (params.project_id)
            qs.set("project_id", params.project_id);
        if (params.limit != null)
            qs.set("limit", String(params.limit));
        if (params.offset != null)
            qs.set("offset", String(params.offset));
        const query = qs.toString() ? `?${qs}` : "";
        return this._get(`/functions/v1/geospatial-anchors${query}`);
    }
    /** Find geospatial anchors within a radius (metres) of a GPS coordinate. */
    async findNearbyGeospatialAnchors(params) {
        return this._post("/functions/v1/geospatial-anchors/nearby", params);
    }
    /** Update a geospatial anchor's fields. */
    async updateGeospatialAnchor(id, params) {
        return this._patch(`/functions/v1/geospatial-anchors/${id}`, params);
    }
    /** Delete a geospatial anchor. */
    async deleteGeospatialAnchor(id) {
        return this._delete(`/functions/v1/geospatial-anchors/${id}`);
    }
    // --------------------------------------------------------------------------
    // Cloud Anchor metadata (read-only from JS; host/resolve go through native)
    // --------------------------------------------------------------------------
    /** Fetch metadata for a cloud anchor by ID. */
    async getCloudAnchor(id) {
        return this._get(`/cloud-anchors/${id}`);
    }
    /** List cloud anchors for a project. */
    async listCloudAnchors(projectId, limit = 50, offset = 0) {
        return this._get(`/cloud-anchors?project_id=${projectId}&limit=${limit}&offset=${offset}`);
    }
    /** Delete a cloud anchor. */
    async deleteCloudAnchor(id) {
        return this._delete(`/cloud-anchors/${id}`);
    }
    // --------------------------------------------------------------------------
    // Internal fetch helpers
    // --------------------------------------------------------------------------
    async _get(path) {
        return this._request("GET", path, undefined);
    }
    async _post(path, body) {
        return this._request("POST", path, body);
    }
    async _patch(path, body) {
        return this._request("PATCH", path, body);
    }
    async _delete(path) {
        return this._request("DELETE", path, undefined);
    }
    async _request(method, path, body) {
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
            let json = {};
            try {
                json = JSON.parse(text);
            }
            catch {
                if (!response.ok) {
                    return { success: false, error: `HTTP ${response.status}` };
                }
                return { success: true };
            }
            if (!response.ok) {
                const msg = json.error ||
                    json.message ||
                    `HTTP ${response.status}`;
                return { success: false, error: msg };
            }
            // Geospatial API wraps data in { success, data }; Cloud Anchor API
            // returns the object directly or in { anchor }.
            const data = json.data ??
                json.anchor ??
                json;
            return { success: true, data };
        }
        catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            return { success: false, error: msg };
        }
    }
}
exports.ReactVisionClient = ReactVisionClient;
