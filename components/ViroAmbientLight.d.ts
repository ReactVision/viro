import * as React from "react";
import { ColorValue, ViewProps } from "react-native";
import { ViroNativeRef } from "./Types/ViroUtils";
declare type Props = ViewProps & {
    color?: ColorValue;
    intensity?: number;
    temperature?: number;
    influenceBitMask?: number;
};
/**
 * Used to render a ViroAmbientLight
 */
export declare class ViroAmbientLight extends React.Component<Props> {
    _component: ViroNativeRef;
    setNativeProps(nativeProps: Props): void;
    render(): JSX.Element;
}
export {};
