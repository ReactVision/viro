import * as React from "react";
import { ColorValue, ViewProps } from "react-native";
import { Viro3DPoint, ViroNativeRef } from "./Types/ViroUtils";
declare type Props = ViewProps & {
    position?: Viro3DPoint;
    color?: ColorValue;
    intensity?: number;
    temperature?: number;
    direction?: Viro3DPoint;
    attenuationStartDistance?: number;
    attenuationEndDistance?: number;
    innerAngle?: number;
    outerAngle?: number;
    influenceBitMask?: number;
    castsShadow?: boolean;
    shadowOpacity?: number;
    shadowMapSize?: number;
    shadowBias?: number;
    shadowNearZ?: number;
    shadowFarZ?: number;
};
/**
 * Used to render a ViroSpotLight
 */
export declare class ViroSpotLight extends React.Component<Props> {
    _component: ViroNativeRef;
    setNativeProps(nativeProps: Props): void;
    render(): JSX.Element;
}
export {};
