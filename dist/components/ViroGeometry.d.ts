/**
 * Copyright (c) 2018-present, Viro Media, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 */
/// <reference types="react" />
import { Viro2DPoint, Viro3DPoint } from "./Types/ViroUtils";
import { ViroBase } from "./ViroBase";
declare type Props = {
    vertices?: Viro3DPoint[];
    normals?: Viro3DPoint[];
    texcoords?: Viro2DPoint[];
    triangleIndices?: Viro3DPoint[];
};
export declare class ViroGeometry extends ViroBase<Props> {
    render(): JSX.Element;
}
export {};
