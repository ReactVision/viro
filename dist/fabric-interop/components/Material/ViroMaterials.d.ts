/**
 * ViroMaterials
 *
 * A utility for creating and managing materials.
 */
export interface ViroMaterialDefinition {
    diffuseColor?: string;
    diffuseTexture?: {
        uri: string;
    } | number;
    roughness?: number;
    metalness?: number;
    roughnessMap?: {
        uri: string;
    } | number;
    metalnessMap?: {
        uri: string;
    } | number;
    normalMap?: {
        uri: string;
    } | number;
    lightingModel?: "Constant" | "Lambert" | "Blinn" | "Phong" | "Physical";
    shininess?: number;
    fresnelExponent?: number;
    transparency?: number;
    wrapS?: "Clamp" | "Repeat" | "Mirror";
    wrapT?: "Clamp" | "Repeat" | "Mirror";
    shader?: string;
    shaderParams?: Record<string, any>;
}
/**
 * Register materials with the Viro system.
 * @param materialMap A map of material names to material definitions.
 */
export declare function registerMaterials(materialMap: Record<string, ViroMaterialDefinition>): void;
/**
 * Get a material by name.
 * @param name The name of the material.
 * @returns The material definition, or undefined if not found.
 */
export declare function getMaterial(name: string): ViroMaterialDefinition | undefined;
/**
 * Get all registered materials.
 * @returns A map of material names to material definitions.
 */
export declare function getAllMaterials(): Record<string, ViroMaterialDefinition>;
/**
 * Update a material.
 * @param name The name of the material to update.
 * @param definition The new material definition.
 */
export declare function updateMaterial(name: string, definition: ViroMaterialDefinition): void;
/**
 * Delete materials from the Viro system.
 * @param materialNames An array of material names to delete.
 */
export declare function deleteMaterials(materialNames: string[]): void;
declare const ViroMaterials: {
    registerMaterials: typeof registerMaterials;
    getMaterial: typeof getMaterial;
    getAllMaterials: typeof getAllMaterials;
    updateMaterial: typeof updateMaterial;
    deleteMaterials: typeof deleteMaterials;
    createMaterials: typeof registerMaterials;
};
export default ViroMaterials;
