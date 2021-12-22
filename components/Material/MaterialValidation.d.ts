import { MaterialPropTypes } from "./MaterialPropTypes";
export declare type ViroMaterial = any;
export declare class MaterialValidation {
    static validateMaterialProp(prop: keyof typeof MaterialPropTypes, materialName: string, material: ViroMaterial, caller: any): void;
    static validateMaterial(name: string, materials: any): void;
    static addValidMaterialPropTypes(materialPropTypes: any): void;
}
