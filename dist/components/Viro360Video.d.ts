import * as React from "react";
import { NativeSyntheticEvent, ViewProps } from "react-native";
import { ViroVideoBufferEndEvent, ViroVideoBufferStartEvent, ViroVideoErrorEvent, ViroVideoUpdateTimeEvent } from "./Types/ViroEvents";
import { ViroNativeRef, ViroRotation, ViroSource } from "./Types/ViroUtils";
declare type Props = ViewProps & {
    source: ViroSource;
    rotation?: ViroRotation;
    paused?: boolean;
    loop?: boolean;
    muted?: boolean;
    volume?: number;
    /**
     * Callback invoked when the underlying video component begins buffering. Called at
     * least once at the beginning of playback/video creation.
     */
    onBufferStart?: (event: NativeSyntheticEvent<ViroVideoBufferStartEvent>) => void;
    /**
     * Callback invoked when the underlying video component has finished buffering.
     */
    onBufferEnd?: (event: NativeSyntheticEvent<ViroVideoBufferEndEvent>) => void;
    /**
     * Callback that is called when the video is finished playing. This
     * function isn't called at the end of a video if looping is enabled.
     */
    onFinish?: () => void;
    /**
     * Callback that is called when the current playback position has changed.
     * This is called in the form:
     *     onUpdateTime(currentPlaybackTimeInSeconds, totalPlayBackDurationInSeconds);
     */
    onUpdateTime?: (currentTime: number, totalTime: number) => void;
    /**
     * Callback triggered when the video fails to load. Invoked with
     * {nativeEvent: {error}}
     */
    onError?: (event: NativeSyntheticEvent<ViroVideoErrorEvent>) => void;
    stereoMode?: "LeftRight" | "RightLeft" | "TopBottom" | "BottomTop" | "None";
};
/**
 * Used to render a 360 video on the background sphere.
 */
export declare class Viro360Video extends React.Component<Props> {
    _component: ViroNativeRef;
    _onBufferStart: (event: NativeSyntheticEvent<ViroVideoBufferStartEvent>) => void;
    _onBufferEnd: (event: NativeSyntheticEvent<ViroVideoBufferEndEvent>) => void;
    _onFinish: () => void;
    _onError: (event: NativeSyntheticEvent<ViroVideoErrorEvent>) => void;
    _onUpdateTime: (event: NativeSyntheticEvent<ViroVideoUpdateTimeEvent>) => void;
    setNativeProps: (nativeProps: Props) => void;
    render(): JSX.Element;
    seekToTime: (timeInSeconds: number) => void;
}
export {};
