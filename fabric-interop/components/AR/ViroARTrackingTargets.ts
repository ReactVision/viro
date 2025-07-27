/**
 * ViroARTrackingTargets
 *
 * A utility for registering AR tracking targets.
 */

import { getNativeViro } from "../ViroGlobal";

// Tracking target types
export interface ViroARImageTarget {
  source: { uri: string } | number;
  orientation: "Up" | "Down" | "Left" | "Right";
  physicalWidth?: number;
  type?: "Image";
}

export interface ViroARObjectTarget {
  source: { uri: string } | number;
  scale?: [number, number, number];
  type: "Object";
}

export type ViroARTrackingTarget = ViroARImageTarget | ViroARObjectTarget;

// Tracking target registry
const targets: Record<string, ViroARTrackingTarget> = {};

/**
 * Register AR tracking targets with the Viro system.
 * @param targetMap A map of target names to target definitions.
 */
export function registerTargets(
  targetMap: Record<string, ViroARTrackingTarget>
): void {
  // Add targets to the registry
  Object.entries(targetMap).forEach(([name, definition]) => {
    targets[name] = definition;
  });

  // Register with native code if available
  const nativeViro = getNativeViro();
  if (nativeViro) {
    nativeViro.setViroARImageTargets(targets);
  }
}

/**
 * Get a tracking target by name.
 * @param name The name of the tracking target.
 * @returns The tracking target definition, or undefined if not found.
 */
export function getTarget(name: string): ViroARTrackingTarget | undefined {
  return targets[name];
}

/**
 * Get all registered tracking targets.
 * @returns A map of tracking target names to tracking target definitions.
 */
export function getAllTargets(): Record<string, ViroARTrackingTarget> {
  return { ...targets };
}

/**
 * Clear all registered tracking targets.
 */
export function clearTargets(): void {
  // Clear the registry
  Object.keys(targets).forEach((key) => {
    delete targets[key];
  });

  // Clear native code if available
  const nativeViro = getNativeViro();
  if (nativeViro) {
    nativeViro.setViroARImageTargets({});
  }
}

/**
 * Delete a specific tracking target.
 * @param targetName The name of the tracking target to delete.
 */
export function deleteTarget(targetName: string): void {
  // Remove the target from the registry
  delete targets[targetName];

  // Update native code if available
  const nativeViro = getNativeViro();
  if (nativeViro) {
    // Since there's no direct method to delete a single target,
    // we re-register all remaining targets
    nativeViro.setViroARImageTargets(targets);
  }
}

// Export the tracking targets object as the default export
const ViroARTrackingTargets = {
  registerTargets,
  getTarget,
  getAllTargets,
  clearTargets,
  deleteTarget,
  // Add createTargets as an alias for registerTargets for backward compatibility
  createTargets: registerTargets,
};

export default ViroARTrackingTargets;
