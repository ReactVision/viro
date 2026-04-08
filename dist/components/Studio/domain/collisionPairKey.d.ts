/**
 * Canonical collision pair — matches DB constraint where asset_x_id < asset_y_id lexicographically.
 */
export declare function canonicalizeCollisionAssetIds(a: string, b: string): {
    asset_x_id: string;
    asset_y_id: string;
};
export declare function collisionPairKey(assetX: string, assetY: string): string;
