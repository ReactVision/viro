import * as React from "react";
import { NativeSyntheticEvent, ViewProps } from "react-native";
import { ViroErrorEvent, ViroSoundFinishEvent } from "./Types/ViroEvents";
import { Viro3DPoint, ViroNativeRef, ViroSource } from "./Types/ViroUtils";
declare type Props = ViewProps & {
    source: ViroSource;
    paused?: boolean;
    loop?: boolean;
    muted?: boolean;
    volume?: number;
    position: Viro3DPoint;
    rolloffModel?: string;
    minDistance?: number;
    maxDistance?: number;
    onFinish?: (event: NativeSyntheticEvent<ViroSoundFinishEvent>) => void;
    onError?: (event: NativeSyntheticEvent<ViroErrorEvent>) => void;
};
export declare class ViroSpatialSound extends React.Component<Props> {
    _component: ViroNativeRef;
    _onFinish: (event: NativeSyntheticEvent<ViroSoundFinishEvent>) => void;
    _onError: (event: NativeSyntheticEvent<ViroErrorEvent>) => void;
    setNativeProps: (nativeProps: Props) => void;
    render(): JSX.Element;
    getTransformAsync: () => Promise<any>;
    getBoundingBoxAsync: () => Promise<any>;
    seekToTime: (timeInSeconds: number) => void;
}
export {};
