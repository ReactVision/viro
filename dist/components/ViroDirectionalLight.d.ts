import * as React from "react";
import { ColorValue, ViewProps } from "react-native";
import { ViroNativeRef, Viro3DPoint } from "./Types/ViroUtils";
declare type Props = ViewProps & {
    color?: ColorValue;
    intensity?: number;
    temperature?: number;
    direction: Viro3DPoint;
    influenceBitMask?: number;
    castsShadow?: boolean;
    shadowOpacity?: number;
    shadowOrthographicSize?: number;
    shadowOrthographicPosition?: Viro3DPoint;
    shadowMapSize?: number;
    shadowBias?: number;
    shadowNearZ?: number;
    shadowFarZ?: number;
};
/**
 * Used to render a ViroDirectionalLight
 */
export declare class ViroDirectionalLight extends React.Component<Props> {
    _component: ViroNativeRef;
    setNativeProps(nativeProps: Props): void;
    render(): JSX.Element;
}
export {};
