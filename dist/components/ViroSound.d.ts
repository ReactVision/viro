import * as React from "react";
import { NativeSyntheticEvent, ViewProps } from "react-native";
import { ViroErrorEvent, ViroSoundFinishEvent } from "./Types/ViroEvents";
import { ViroNativeRef, ViroSoundMap, ViroSoundPreloadResult, ViroSource } from "./Types/ViroUtils";
declare type Props = ViewProps & {
    source: ViroSource;
    paused?: boolean;
    loop?: boolean;
    muted?: boolean;
    volume?: number;
    onFinish?: (event: NativeSyntheticEvent<ViroSoundFinishEvent>) => void;
    onError?: (event: NativeSyntheticEvent<ViroErrorEvent>) => void;
};
/**
 * ViroSound is a component that plays a sound file.
 */
export declare class ViroSound extends React.Component<Props> {
    _component: ViroNativeRef;
    static preloadSounds: (soundMap: ViroSoundMap) => Promise<ViroSoundPreloadResult>;
    static unloadSounds: (soundKeys: ViroSound[]) => void;
    _onFinish: (event: NativeSyntheticEvent<ViroSoundFinishEvent>) => void;
    _onError: (event: NativeSyntheticEvent<ViroErrorEvent>) => void;
    setNativeProps: (nativeProps: Props) => void;
    render(): JSX.Element;
    seekToTime: (timeInSeconds: number) => void;
}
export {};
