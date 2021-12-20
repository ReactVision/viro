import React, { Component } from "react";
import { ViewProps, ImageSourcePropType, NativeMethods } from "react-native";
declare type Force = {
    value: Array<number>;
    position: Array<number>;
};
declare type DragPlane = {
    planePoint: Array<number>;
    planeNormal: Array<number>;
    maxDistance?: number;
};
declare type NativeRef = (React.Component<unknown, {}, any> & Readonly<NativeMethods>) | null;
declare type Props = ViewProps & {
    position?: Array<number>;
    scale?: Array<number>;
    rotation?: Array<number>;
    scalePivot?: Array<number>;
    rotationPivot?: Array<number>;
    materials?: string | Array<string>;
    transformBehaviors?: string | Array<string>;
    type: "OBJ" | "VRX" | "GLTF" | "GLB";
    opacity?: number;
    ignoreEventHandling?: boolean;
    dragType?: "FixedDistance" | "FixedDistanceOrigin" | "FixedToWorld" | "FixedToPlane";
    dragPlane?: DragPlane;
    lightReceivingBitMask?: number;
    shadowCastingBitMask?: number;
    onTransformUpdate?: (...args: any) => any;
    source: ImageSourcePropType;
    resources?: Array<ImageSourcePropType>;
    animation?: {
        name?: string;
        delay?: number;
        duration?: number;
        loop?: boolean;
        onStart?: (...args: any) => any;
        onFinish?: (...args: any) => any;
        run?: boolean;
        interruptible?: boolean;
    };
    renderingOrder?: number;
    visible?: boolean;
    onHover?: (...args: any) => any;
    onClick?: (...args: any) => any;
    onClickState?: (...args: any) => any;
    onTouch?: (...args: any) => any;
    onScroll?: (...args: any) => any;
    onSwipe?: (...args: any) => any;
    onLoadStart?: (...args: any) => any;
    onLoadEnd?: (...args: any) => any;
    onError?: (...args: any) => any;
    onDrag?: (...args: any) => any;
    onPinch?: (...args: any) => any;
    onRotate?: (...args: any) => any;
    onFuse?: ((...args: any) => any) | {
        callback: (...args: any) => any;
        timeToFuse?: number;
    };
    /**
     * Enables high accuracy event collision checks for this object.
     * This can be useful for complex 3D objects where the default
     * checking method of bounding boxes do not provide adequate
     * collision detection coverage.
     *
     * NOTE: Enabling high accuracy event collision checks has a high
     * performance cost and should be used sparingly / only when
     * necessary.
     *
     * Flag is set to false by default.
     */
    highAccuracyEvents?: boolean;
    highAccuracyGaze?: boolean;
    physicsBody?: {
        type: "Dynamic" | "Kinematic" | "Static";
        mass?: number;
        restitution?: number;
        shape?: {
            type: "Box" | "Sphere" | "Compound";
            params?: Array<number>;
        };
        friction?: number;
        useGravity?: boolean;
        enabled?: boolean;
        velocity?: Array<number>;
        force?: Force | Array<Force>;
        torque?: Array<number>;
    };
    morphTargets?: Array<{
        target?: string;
        weight?: number;
    }>;
    viroTag?: string;
    onCollision?: (...args: any) => any;
};
declare class Viro3DObject extends Component<Props> {
    render(): any;
    _viro3dobj?: NativeRef;
    setNativeProps: (nativeProps: any) => void;
    _onHover: (event: any) => void;
    _onClick: (event: any) => void;
    _onClickState: (event: any) => void;
    _onTouch: (event: any) => void;
    _onScroll: (event: any) => void;
    _onSwipe: (event: any) => void;
    _onLoadStart: (event: any) => void;
    _onLoadEnd: (event: any) => void;
    _onError: (event: any) => void;
    _onPinch: (event: any) => void;
    _onRotate: (event: any) => void;
    _onDrag: (event: any) => void;
    _onFuse: (event: any) => void;
    _onAnimationStart: () => void;
    _onAnimationFinish: () => void;
    applyImpulse: (force: any, position: any) => void;
    applyTorqueImpulse: (torque: any) => void;
    setVelocity: (velocity: any) => void;
    _onCollision: (event: any) => void;
    _onNativeTransformUpdate: (event: any) => void;
    getTransformAsync: () => Promise<any>;
    getBoundingBoxAsync: () => Promise<any>;
    getMorphTargets: () => Promise<any>;
}
export default Viro3DObject;
