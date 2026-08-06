export type { ViroMaterial, ViroMaterialDict, ViroCubeMap, ViroResolvedCubeMap, ViroShaderModifier, ViroShaderModifiers, ViroShaderUniform, ViroSemanticLabel, ViroSemanticMaskConfig, ViroSemanticMaskMode, } from "./ViroMaterials";
export declare class ViroMaterials {
    static createMaterials(materials: Record<string, any>): void;
    static deleteMaterials(_materials: any): void;
    static updateShaderUniform(_material: any, _uniform: any, _value: any): void;
}
