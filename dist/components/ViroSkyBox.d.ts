import * as React from "react";
import { ColorValue, NativeSyntheticEvent, ViewProps } from "react-native";
import { ViroCubeMap } from "./Material/ViroMaterials";
import { ViroLoadEndEvent, ViroLoadStartEvent } from "./Types/ViroEvents";
import { ViroNativeRef } from "./Types/ViroUtils";
declare type Props = ViewProps & {
    source?: ViroCubeMap;
    color?: ColorValue;
    format?: "RGBA8" | "RGB565";
    onLoadStart?: (event: NativeSyntheticEvent<ViroLoadStartEvent>) => void;
    onLoadEnd?: (event: NativeSyntheticEvent<ViroLoadEndEvent>) => void;
};
/**
 * Used to render a skybox as a scene background.
 */
export declare class ViroSkyBox extends React.Component<Props> {
    _component: ViroNativeRef;
    _onLoadStart: (event: NativeSyntheticEvent<ViroLoadStartEvent>) => void;
    _onLoadEnd: (event: NativeSyntheticEvent<ViroLoadEndEvent>) => void;
    setNativeProps: (nativeProps: Props) => void;
    render(): JSX.Element;
}
export {};
