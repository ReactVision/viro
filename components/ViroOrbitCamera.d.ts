import PropTypes from "prop-types";
import React from "react";
import { ViewProps } from "react-native";
import { ViroAnimation } from "./Animation/ViroAnimations";
import { ViroNativeRef, Viro3DPoint } from "./Types/ViroUtils";
export declare type Props = ViewProps & {
    position?: Viro3DPoint;
    focalPoint?: Viro3DPoint;
    active: boolean;
    animation?: ViroAnimation;
    fieldOfView: number;
};
export declare class ViroOrbitCamera extends React.Component<Props> {
    _component: ViroNativeRef;
    componentDidMount(): void;
    componentWillUnmount(): void;
    componentDidUpdate(prevProps: Props, _prevState: any): void;
    setNativeProps(nativeProps: Props): void;
    render(): JSX.Element;
    static contextTypes: {
        cameraDidMount: PropTypes.Requireable<(...args: any[]) => any>;
        cameraWillUnmount: PropTypes.Requireable<(...args: any[]) => any>;
        cameraDidUpdate: PropTypes.Requireable<(...args: any[]) => any>;
    };
}
