/**
 * Copyright (c) 2017-present, Viro Media, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule ViroARPlane
 */
/// <reference types="react" />
import { ViroARAnchorFoundEvent, ViroARAnchorRemovedEvent, ViroARAnchorUpdatedEvent } from "../Types/ViroEvents";
import { ViroBase } from "../ViroBase";
import { NativeSyntheticEvent } from "react-native";
declare type Props = {
    anchorId?: string;
    minHeight?: number;
    minWidth?: number;
    alignment?: "Horizontal" | "HorizontalUpward" | "HorizontalDownward" | "Vertical";
};
/**
 * Container for Viro Components anchored to a detected plane.
 */
export declare class ViroARPlane extends ViroBase<Props> {
    _onAnchorFound: (event: NativeSyntheticEvent<ViroARAnchorFoundEvent>) => void;
    _onAnchorUpdated: (event: NativeSyntheticEvent<ViroARAnchorUpdatedEvent>) => void;
    _onAnchorRemoved: (_event: NativeSyntheticEvent<ViroARAnchorRemovedEvent>) => void;
    render(): JSX.Element;
}
export {};
