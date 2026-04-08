import { StudioAsset } from "../types";
/**
 * Registers trigger image targets with ViroReact for image recognition.
 * One target per asset with trigger_image_url.
 * Must be called before rendering ViroARImageMarker components.
 *
 * @returns Map from trigger_image_url → target name for lookup in ViroARImageMarker
 */
export declare function registerTriggerImageTargets(assets: StudioAsset[]): Map<string, string>;
/**
 * Cleans up trigger image targets when the scene unmounts.
 */
export declare function cleanupTriggerImageTargets(targetNames: string[]): void;
