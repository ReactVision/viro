/**
 * ViroMaterials
 *
 * A utility for creating and managing materials.
 */

import { getNativeViro } from "../ViroGlobal";

// Material types
export interface ViroMaterialDefinition {
  // Basic properties
  diffuseColor?: string;
  diffuseTexture?: { uri: string } | number;

  // PBR properties
  roughness?: number;
  metalness?: number;
  roughnessMap?: { uri: string } | number;
  metalnessMap?: { uri: string } | number;
  normalMap?: { uri: string } | number;

  // Lighting properties
  lightingModel?: "Constant" | "Lambert" | "Blinn" | "Phong" | "Physical";
  shininess?: number;
  fresnelExponent?: number;

  // Transparency properties
  transparency?: number;

  // Texture properties
  wrapS?: "Clamp" | "Repeat" | "Mirror";
  wrapT?: "Clamp" | "Repeat" | "Mirror";

  // Shader properties
  shader?: string;
  shaderParams?: Record<string, any>;
}

// Material registry
const materials: Record<string, ViroMaterialDefinition> = {};

/**
 * Register materials with the Viro system.
 * @param materialMap A map of material names to material definitions.
 */
export function registerMaterials(
  materialMap: Record<string, ViroMaterialDefinition>
): void {
  // Add materials to the registry
  Object.entries(materialMap).forEach(([name, definition]) => {
    materials[name] = definition;

    // Register with native code if available
    const nativeViro = getNativeViro();
    if (nativeViro) {
      nativeViro.createViroMaterial(name, definition);
    }
  });
}

/**
 * Get a material by name.
 * @param name The name of the material.
 * @returns The material definition, or undefined if not found.
 */
export function getMaterial(name: string): ViroMaterialDefinition | undefined {
  return materials[name];
}

/**
 * Get all registered materials.
 * @returns A map of material names to material definitions.
 */
export function getAllMaterials(): Record<string, ViroMaterialDefinition> {
  return { ...materials };
}

/**
 * Update a material.
 * @param name The name of the material to update.
 * @param definition The new material definition.
 */
export function updateMaterial(
  name: string,
  definition: ViroMaterialDefinition
): void {
  // Update the registry
  materials[name] = { ...materials[name], ...definition };

  // Update native code if available
  const nativeViro = getNativeViro();
  if (nativeViro) {
    nativeViro.updateViroMaterial(name, definition);
  }
}

/**
 * Delete materials from the Viro system.
 * @param materialNames An array of material names to delete.
 */
export function deleteMaterials(materialNames: string[]): void {
  // Remove materials from the registry
  materialNames.forEach((name) => {
    delete materials[name];
  });

  // Note: In the Fabric implementation, there's no direct native method to delete materials
  // This implementation just removes them from the JS registry
  // If a native method becomes available in the future, it can be called here
  console.warn(
    "ViroMaterials.deleteMaterials: Material deletion from native code is not supported in the Fabric implementation. " +
      "Materials are only removed from the JavaScript registry."
  );
}

// Export the materials object as the default export
const ViroMaterials = {
  registerMaterials,
  getMaterial,
  getAllMaterials,
  updateMaterial,
  deleteMaterials,
  // Add createMaterials as an alias for registerMaterials for backward compatibility
  createMaterials: registerMaterials,
};

export default ViroMaterials;
