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
export interface RVSceneAsset {
    id: string;
    name: string;
    description?: string | null;
    file_url?: string | null;
    file_size?: number | null;
    asset_type_name?: "3D-MODEL" | "TEXT" | "IMAGE" | "VIDEO" | null;
    position_x?: number | null;
    position_y?: number | null;
    position_z?: number | null;
    rotation_x?: number | null;
    rotation_y?: number | null;
    rotation_z?: number | null;
    scale?: number | null;
    latitude: number;
    longitude: number;
    is_draggable: boolean;
    trigger_image_url?: string | null;
    trigger_image_orientation?: "Up" | "Down" | "Left" | "Right" | null;
    trigger_image_physical_width_m?: number | null;
    created_at: string;
    updated_at: string;
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
export declare class ReactVisionClient {
    private readonly apiKey;
    private readonly baseUrl;
    /**
     * @param apiKey  ReactVision API key from platform.reactvision.xyz dashboard.
     * @param baseUrl Optional override (defaults to https://platform.reactvision.xyz).
     */
    constructor(apiKey: string, baseUrl?: string);
    /** Create a geospatial (GPS-based) anchor. */
    createGeospatialAnchor(params: RVCreateGeospatialAnchorParams): Promise<RVApiResult<RVGeospatialAnchor>>;
    /** Fetch a single geospatial anchor by ID. */
    getGeospatialAnchor(id: string): Promise<RVApiResult<RVGeospatialAnchor>>;
    /** List geospatial anchors (optionally filtered by project). */
    listGeospatialAnchors(params?: RVListGeospatialParams): Promise<RVApiResult<RVGeospatialListResult>>;
    /** Find geospatial anchors within a radius (metres) of a GPS coordinate. */
    findNearbyGeospatialAnchors(params: RVNearbySearchParams): Promise<RVApiResult<RVGeospatialListResult>>;
    /** Update a geospatial anchor's fields. */
    updateGeospatialAnchor(id: string, params: RVUpdateGeospatialAnchorParams): Promise<RVApiResult<RVGeospatialAnchor>>;
    /** Delete a geospatial anchor. */
    deleteGeospatialAnchor(id: string): Promise<RVApiResult<null>>;
    /** Fetch metadata for a cloud anchor by ID. */
    getCloudAnchor(id: string): Promise<RVApiResult<RVCloudAnchor>>;
    /** List cloud anchors for a project. */
    listCloudAnchors(projectId: string, limit?: number, offset?: number): Promise<RVApiResult<RVCloudAnchor[]>>;
    /** Delete a cloud anchor. */
    deleteCloudAnchor(id: string): Promise<RVApiResult<null>>;
    /** Fetch all assets for a scene by scene ID. */
    getSceneAssets(sceneId: string): Promise<RVApiResult<RVSceneAsset[]>>;
    private _get;
    private _post;
    private _patch;
    private _delete;
    private _request;
}
