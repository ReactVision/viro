/**
 * Copyright (c) 2018-present, Viro Media, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule ViroARObjectMarker
 */
/// <reference types="react" />
import { ViroBase } from "../ViroBase";
import { NativeSyntheticEvent } from "react-native";
import { ViroARAnchorFoundEvent, ViroARAnchorRemovedEvent, ViroARAnchorUpdatedEvent } from "../Types/ViroEvents";
declare type Props = {};
/**
 * Container for Viro Components anchored to a detected object.
 */
export declare class ViroARObjectMarker extends ViroBase<Props> {
    _onAnchorFound(event: NativeSyntheticEvent<ViroARAnchorFoundEvent>): void;
    _onAnchorUpdated(event: NativeSyntheticEvent<ViroARAnchorUpdatedEvent>): void;
    _onAnchorRemoved(_event: NativeSyntheticEvent<ViroARAnchorRemovedEvent>): void;
    render(): JSX.Element;
}
export {};
