/// <reference types="react" />
import { ImageSourcePropType, NativeSyntheticEvent } from "react-native";
import { ViroErrorEvent, ViroLoadEndEvent, ViroLoadStartEvent } from "./Types/ViroEvents";
import { ViroBase } from "./ViroBase";
declare type Props = {
    type: "OBJ" | "VRX" | "GLTF" | "GLB";
    /**
     * The model file, which is required
     */
    source: ImageSourcePropType;
    /**
     * Additional resource files for various model formats
     */
    resources?: ImageSourcePropType[];
    /**
     * TODO: what does this do?
     */
    morphTargets?: Array<{
        target?: string;
        weight?: number;
    }>;
    onLoadStart?: (event: NativeSyntheticEvent<ViroLoadStartEvent>) => void;
    onLoadEnd?: (event: NativeSyntheticEvent<ViroLoadEndEvent>) => void;
    onError?: (event: NativeSyntheticEvent<ViroErrorEvent>) => void;
};
/**
 * Viro3DObject is a component that is used to render 3D models in the scene.
 */
export declare class Viro3DObject extends ViroBase<Props> {
    render(): JSX.Element;
    _onLoadStart: (event: NativeSyntheticEvent<ViroLoadStartEvent>) => void;
    _onLoadEnd: (event: NativeSyntheticEvent<ViroLoadEndEvent>) => void;
    getBoundingBoxAsync: () => Promise<any>;
    getMorphTargets: () => Promise<any>;
}
export {};
