/**
 * Copyright (c) 2017-present, Viro Media, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule ViroPortalScene
 */
/// <reference types="react" />
import { NativeSyntheticEvent } from "react-native";
import { ViroCommonProps } from "./AR/ViroCommonProps";
import { ViroPortalEnterEvent, ViroPortalExitEvent } from "./Types/ViroEvents";
import { ViroBase } from "./ViroBase";
declare type Props = ViroCommonProps & {
    onPortalEnter?: (event: NativeSyntheticEvent<ViroPortalEnterEvent>) => void;
    onPortalExit?: (event: NativeSyntheticEvent<ViroPortalExitEvent>) => void;
    passable?: boolean;
};
/**
 * Portal container for revealing different sections of the scene graph.
 */
export declare class ViroPortalScene extends ViroBase<Props> {
    _onPortalEnter: (event: NativeSyntheticEvent<ViroPortalEnterEvent>) => void;
    _onPortalExit: (event: NativeSyntheticEvent<ViroPortalExitEvent>) => void;
    render(): JSX.Element;
}
export {};
