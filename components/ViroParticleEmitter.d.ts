import * as React from "react";
import { ColorValue, NativeSyntheticEvent } from "react-native";
import { ViroObjectProps } from "./AR/ViroCommonProps";
import { ViroNativeTransformUpdateEvent } from "./Types/ViroEvents";
import { ViroNativeRef, ViroSource } from "./Types/ViroUtils";
declare type ViroInterpolation = {
    interval: number[];
    endValue: number;
}[];
declare type Props = ViroObjectProps & {
    duration: number;
    delay: number;
    loop: boolean;
    run: boolean;
    fixedToEmitter: boolean;
    image: {
        source: ViroSource;
        height: number;
        width: number;
        bloomThreshold: number;
    };
    height?: number;
    width?: number;
    bloomThreshold?: number;
    blendMode?: string;
    spawnBehavior: {
        emissionRatePerSecond?: number[];
        emissionRatePerMeter?: number[];
        particleLifetime?: number[];
        maxParticles?: number;
        emissionBurst?: {
            time: number;
            min: number;
            max: number;
            cycles: number;
            cooldownPeriod: number;
        } | {
            distance: number;
            min: number;
            max: number;
            cycles: number;
            cooldownDistance: number;
        };
        spawnVolume: {
            shape: string;
            params: number[];
            spawnOnSurface: boolean;
        };
    };
    particleAppearance?: {
        opacity: {
            initialRange: number[];
            factor: "Time" | "Distance";
            interpolation: ViroInterpolation;
        };
        scale: {
            initialRange: number[][];
            factor: "Time" | "Distance";
            interpolation: ViroInterpolation;
        };
        rotation: {
            initialRange: number[];
            factor: "Time" | "Distance";
            interpolation: ViroInterpolation;
        };
        color: {
            initialRange: ColorValue[];
            factor: "Time" | "Distance";
            interpolation: ViroInterpolation;
        };
    };
    particlePhysics?: {
        velocity: {
            initialRange: number[][];
        };
        acceleration: {
            initialRange: number[][];
        };
        explosiveImpulse: {
            impulse: number;
            position: number[];
            decelerationPeriod: number;
        };
    };
};
declare type State = {
    nativePositionState: any;
    propsPositionState: any;
};
export declare class ViroParticleEmitter extends React.Component<Props, State> {
    state: {
        propsPositionState: import("./Types/ViroUtils").Viro3DPoint | undefined;
        nativePositionState: undefined;
    };
    _component: ViroNativeRef;
    getTransformAsync(): Promise<any>;
    getBoundingBoxAsync(): Promise<any>;
    _onNativeTransformUpdate(event: NativeSyntheticEvent<ViroNativeTransformUpdateEvent>): void;
    shouldComponentUpdate(_nextProps: Props, nextState: State): boolean;
    setNativeProps(nativeProps: Props): void;
    render(): JSX.Element | undefined;
    static getDerivedStateFromProps(nextProps: Props, prevState: State): {
        propsPositionState: number[];
    } | {
        propsPositionState?: undefined;
    };
}
export {};
