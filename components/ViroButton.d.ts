import * as React from "react";
import { ViroCommonProps, ViroObjectProps } from "./AR/ViroCommonProps";
import { ViroForce, Viro3DPoint, ViroSource, ViroTorque, ViroVelocity } from "./Types/ViroUtils";
import { ViroNode } from "./ViroNode";
export declare enum ViroButtonStateTypes {
    BTN_TYPE_HOVER = "hovering",
    BTN_TYPE_NORMAL = "normal",
    BTN_TYPE_CLICKED = "clicked"
}
export declare type ViroButtonState = ViroButtonStateTypes.BTN_TYPE_HOVER | ViroButtonStateTypes.BTN_TYPE_NORMAL | ViroButtonStateTypes.BTN_TYPE_CLICKED;
export declare type Props = ViroCommonProps & ViroObjectProps & {
    /**
     * The button image file, which is required
     */
    source: ViroSource;
    /**
     * The image file, to be displayed when the user is hovering over it
     */
    hoverSource?: ViroSource;
    /**
     * The image file, to be displayed when the user clicks the button
     */
    clickSource?: ViroSource;
    /**
     * ##### DEPRECATION WARNING - this prop may be removed in future releases #####
     * The image file, to be displayed when the user taps the button
     *
     * @deprecated
     */
    tapSource?: ViroSource;
    /**
     * ##### DEPRECATION WARNING - this prop may be removed in future releases #####
     * The image file, to be displayed when the user is gazing over it
     *
     * @deprecated
     */
    gazeSource?: ViroSource;
};
declare type State = {
    buttonType: ViroButtonState;
};
/**
 * Composite controle for 2D button
 */
export declare class ViroButton extends React.Component<Props, State> {
    _component: ViroNode | null;
    state: {
        buttonType: ViroButtonStateTypes;
    };
    applyImpulse: (force: ViroForce, atPosition: Viro3DPoint) => void;
    applyTorqueImpulse: (torque: ViroTorque) => void;
    setVelocity: (velocity: ViroVelocity) => void;
    _onAnimationStart: () => void;
    _onAnimationFinish: () => void;
    getTransformAsync: () => Promise<any>;
    getBoundingBoxAsync: () => Promise<any>;
    render(): JSX.Element;
    _onButtonHover: (isHovering: boolean, position: Viro3DPoint, source: ViroSource) => void;
    _onButtonClicked: (position: Viro3DPoint, source: ViroSource) => void;
    _onAnimationFinished: () => void;
}
export {};
