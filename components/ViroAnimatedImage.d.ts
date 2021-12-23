/// <reference types="react" />
import { NativeSyntheticEvent } from "react-native";
import { ViroAnimation } from "./Animation/ViroAnimations";
import { ViroCommonProps } from "./AR/ViroCommonProps";
import { ViroStyle } from "./Styles/ViroStyle";
import { ViroErrorEvent, ViroLoadEndEvent, ViroLoadStartEvent } from "./Types/ViroEvents";
import { Viro3DPoint, ViroNativeRef, ViroPhysicsBody, ViroRotation, ViroScale, ViroSource } from "./Types/ViroUtils";
import { ViroBase } from "./ViroBase";
declare type Props = ViroCommonProps & {
    source: ViroSource;
    placeholderSource?: ViroSource;
    position?: Viro3DPoint;
    rotation?: ViroRotation;
    scale?: ViroScale;
    scalePivot?: Viro3DPoint;
    rotationPivot?: Viro3DPoint;
    opacity?: number;
    width?: number;
    height?: number;
    resizeMode?: "ScaleToFill" | "ScaleToFit" | "StretchToFill";
    imageClipMode?: "None" | "ClipToBounds";
    stereoMode?: "LeftRight" | "RightLeft" | "TopBottom" | "BottomTop" | "None";
    materials?: ViroSource[];
    animation?: ViroAnimation;
    transformBehaviors?: string | string[];
    highAccuracyEvents?: boolean;
    lightReceivingBitMask?: number;
    shadowCastingBitMask?: number;
    onTransformUpdate?: (position: Viro3DPoint) => void;
    visible?: boolean;
    style?: ViroStyle;
    paused?: boolean;
    loop?: boolean;
    /**
     * Callback triggered when we are processing the assets to be
     * displayed in this ViroImage (either downloading / reading from file).
     */
    onLoadStart?: (event: NativeSyntheticEvent<ViroLoadStartEvent>) => void;
    /**
     * Callback triggered when we have finished processing assets to be
     * displayed. Wether or not assets were processed successfully and
     * thus displayed will be indicated by the parameter "success".
     * For example:
     *
     *   _onLoadEnd(event:Event){
     *      // Indication of asset loading success
     *      event.nativeEvent.success
     *   }
     *
     */
    onLoadEnd?: (event: NativeSyntheticEvent<ViroLoadEndEvent>) => void;
    /**
     * Callback triggered when the image fails to load. Invoked with
     * {nativeEvent: {error}}
     */
    onError?: (event: NativeSyntheticEvent<ViroErrorEvent>) => void;
    physicsBody?: ViroPhysicsBody;
    renderingOrder?: number;
    viroTag?: string;
    onCollision?: () => void;
};
export declare class ViroAnimatedImage extends ViroBase<Props> {
    _component: ViroNativeRef;
    _onLoadStart: (event: NativeSyntheticEvent<ViroLoadStartEvent>) => void;
    _onLoadEnd: (event: NativeSyntheticEvent<ViroLoadEndEvent>) => void;
    render(): JSX.Element;
}
export {};
