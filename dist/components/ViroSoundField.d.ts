import * as React from "react";
import { NativeSyntheticEvent, ViewProps } from "react-native";
import { ViroErrorEvent, ViroSoundFinishEvent } from "./Types/ViroEvents";
import { ViroNativeRef, ViroRotation, ViroSource } from "./Types/ViroUtils";
declare type Props = ViewProps & {
    source: ViroSource;
    paused?: boolean;
    loop?: boolean;
    muted?: boolean;
    volume?: number;
    rotation: ViroRotation;
    onFinish?: (event: NativeSyntheticEvent<ViroSoundFinishEvent>) => void;
    onError?: (event: NativeSyntheticEvent<ViroErrorEvent>) => void;
};
export declare class ViroSoundField extends React.Component<Props> {
    _component: ViroNativeRef;
    _onFinish: (event: NativeSyntheticEvent<ViroSoundFinishEvent>) => void;
    _onError: (event: NativeSyntheticEvent<ViroErrorEvent>) => void;
    setNativeProps: (nativeProps: Props) => void;
    render(): JSX.Element;
    seekToTime: (timeInSeconds: number) => void;
}
export {};
