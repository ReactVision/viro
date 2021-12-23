/**
 * Copyright (c) 2018-present, Viro Media, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 */
import * as React from "react";
import { NativeSyntheticEvent, ViewProps } from "react-native";
import { ViroErrorEvent, ViroVideoBufferEndEvent, ViroVideoBufferStartEvent, ViroVideoUpdateTimeEvent } from "./Types/ViroEvents";
import { ViroNativeRef } from "./Types/ViroUtils";
declare type Props = ViewProps & {
    material?: string;
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
    onError?: (event: NativeSyntheticEvent<ViroErrorEvent>) => void;
};
export declare class ViroMaterialVideo extends React.Component<Props> {
    _component: ViroNativeRef;
    componentWillUnmount(): void;
    _onBufferStart: (event: NativeSyntheticEvent<ViroVideoBufferStartEvent>) => void;
    _onBufferEnd: (event: NativeSyntheticEvent<ViroVideoBufferEndEvent>) => void;
    _onFinish: () => void;
    _onError: (event: NativeSyntheticEvent<ViroErrorEvent>) => void;
    _onUpdateTime: (event: NativeSyntheticEvent<ViroVideoUpdateTimeEvent>) => void;
    setNativeProps: (nativeProps: Props) => void;
    render(): JSX.Element;
    seekToTime: (timeInSeconds: number) => void;
}
export {};
