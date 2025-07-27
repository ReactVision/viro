/**
 * ViroARTrackingTargets
 *
 * A utility for registering AR tracking targets.
 */
export interface ViroARImageTarget {
    source: {
        uri: string;
    } | number;
    orientation: "Up" | "Down" | "Left" | "Right";
    physicalWidth?: number;
    type?: "Image";
}
export interface ViroARObjectTarget {
    source: {
        uri: string;
    } | number;
    scale?: [number, number, number];
    type: "Object";
}
export type ViroARTrackingTarget = ViroARImageTarget | ViroARObjectTarget;
/**
 * Register AR tracking targets with the Viro system.
 * @param targetMap A map of target names to target definitions.
 */
export declare function registerTargets(targetMap: Record<string, ViroARTrackingTarget>): void;
/**
 * Get a tracking target by name.
 * @param name The name of the tracking target.
 * @returns The tracking target definition, or undefined if not found.
 */
export declare function getTarget(name: string): ViroARTrackingTarget | undefined;
/**
 * Get all registered tracking targets.
 * @returns A map of tracking target names to tracking target definitions.
 */
export declare function getAllTargets(): Record<string, ViroARTrackingTarget>;
/**
 * Clear all registered tracking targets.
 */
export declare function clearTargets(): void;
/**
 * Delete a specific tracking target.
 * @param targetName The name of the tracking target to delete.
 */
export declare function deleteTarget(targetName: string): void;
declare const ViroARTrackingTargets: {
    registerTargets: typeof registerTargets;
    getTarget: typeof getTarget;
    getAllTargets: typeof getAllTargets;
    clearTargets: typeof clearTargets;
    deleteTarget: typeof deleteTarget;
    createTargets: typeof registerTargets;
};
export default ViroARTrackingTargets;
