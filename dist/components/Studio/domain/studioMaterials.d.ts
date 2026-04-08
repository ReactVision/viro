import { StudioAsset } from "../types";
/**
 * Registers Viro materials for scene assets that have a valid `material_config`.
 * Call synchronously after fetching assets and before rendering AR nodes.
 */
export declare function registerStudioMaterialsForAssets(assets: StudioAsset[]): void;
