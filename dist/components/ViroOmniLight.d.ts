import * as React from "react";
import { ColorValue, ViewProps } from "react-native";
import { ViroNativeRef, Viro3DPoint } from "./Types/ViroUtils";
declare type Props = ViewProps & {
    position?: Viro3DPoint;
    color?: ColorValue;
    intensity?: number;
    temperature?: number;
    influenceBitMask?: number;
    attenuationStartDistance?: number;
    attenuationEndDistance?: number;
};
/**
 * Used to render a ViroOmniLight
 */
export declare class ViroOmniLight extends React.Component<Props> {
    _component: ViroNativeRef;
    setNativeProps: (nativeProps: Props) => void;
    render(): JSX.Element;
}
export {};
