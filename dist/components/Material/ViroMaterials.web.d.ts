export type { ViroMaterial, ViroMaterialDict, ViroCubeMap, ViroResolvedCubeMap, ViroShaderModifier, ViroShaderModifiers, ViroShaderUniform, ViroSemanticLabel, ViroSemanticMaskConfig, ViroSemanticMaskMode, } from "./ViroMaterials";
export declare class ViroMaterials {
    static createMaterials(materials: Record<string, any>): void;
    static deleteMaterials(materials: string[]): void;
    static updateShaderUniform(materialName: string, uniformName: string, uniformType: "float" | "vec2" | "vec3" | "vec4" | "mat4" | "sampler2D", value: number | number[] | any): void;
}
