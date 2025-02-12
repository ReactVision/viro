/**
 * Copyright (c) 2015-present, Viro Media, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 */
import * as React from "react";
import { NativeSyntheticEvent } from "react-native";
import { ViroVideoBufferEndEvent, ViroVideoBufferStartEvent, ViroVideoErrorEvent, ViroVideoUpdateTimeEvent } from "./Types/ViroEvents";
import { ViroSource } from "./Types/ViroUtils";
import { ViroBase } from "./ViroBase";
type Props = {
    stereoMode?: "LeftRight" | "RightLeft" | "TopBottom" | "BottomTop" | "None";
    width?: number;
    height?: number;
    paused?: boolean;
    loop?: boolean;
    muted?: boolean;
    volume?: number;
    source: ViroSource;
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
};
export declare class ViroVideo extends ViroBase<Props> {
    _onBufferStart: (event: NativeSyntheticEvent<ViroVideoBufferStartEvent>) => void;
    _onBufferEnd: (event: NativeSyntheticEvent<ViroVideoBufferEndEvent>) => void;
    _onFinish: () => void;
    _onUpdateTime: (event: NativeSyntheticEvent<ViroVideoUpdateTimeEvent>) => void;
    render(): React.JSX.Element;
    seekToTime: (timeInSeconds: number) => void;
}
export {};
