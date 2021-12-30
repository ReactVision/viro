/**
 * Copyright (c) 2015-present, Viro Media, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 */
/// <reference types="react" />
import { Viro3DPoint } from "./Types/ViroUtils";
import { ViroBase } from "./ViroBase";
declare type Props = {
    /**
     * Array of 2D points in world space in the xy plane specified as [x,y].
     */
    points?: Viro3DPoint[];
    /**
     * The thickness of the line specified in meters.
     */
    thickness?: number;
};
export declare class ViroPolyline extends ViroBase<Props> {
    render(): JSX.Element;
}
export {};
