import * as React from "react";
import { ViewProps } from "react-native";
import { ViroAnimation } from "./Animation/ViroAnimations";
import { Viro3DPoint, ViroNativeRef } from "./Types/ViroUtils";
import { ViroSceneContext } from "./ViroSceneContext";
export type Props = ViewProps & {
    position?: Viro3DPoint;
    focalPoint?: Viro3DPoint;
    active: boolean;
    animation?: ViroAnimation;
    fieldOfView?: number;
    /**
     * "perspective" (the default) or "orthographic".
     *
     * Orthographic keeps parallel lines parallel, which is what a floor plan, blueprint, isometric
     * or CAD-style view needs. A perspective camera makes parallel aisles converge, and on a map
     * that reads as a mistake rather than as depth.
     *
     * AR and VR scenes ignore this: there the projection comes from the device.
     */
    projection?: "perspective" | "orthographic";
    /**
     * Height of the orthographic view in world units — the full height, not the half-height. The
     * width follows from the viewport's aspect ratio, so proportions hold when the view resizes.
     *
     * Only meaningful when `projection` is "orthographic".
     */
    orthographicScale?: number;
};
export declare class ViroOrbitCamera extends React.Component<Props> {
    _component: ViroNativeRef;
    static contextType?: React.Context<any> | undefined;
    context: React.ContextType<typeof ViroSceneContext>;
    componentDidMount(): void;
    componentWillUnmount(): void;
    componentDidUpdate(prevProps: Props, _prevState: any): void;
    setNativeProps: (nativeProps: Props) => void;
    render(): React.JSX.Element;
}
