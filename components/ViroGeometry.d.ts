/**
 * Copyright (c) 2018-present, Viro Media, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 */
/// <reference types="react" />
import { ViroBase } from "./ViroBase";
declare type Props = {
    vertices: number[];
    normals: number[];
    texcoords: number[];
    triangleIndices: number[][];
};
export declare class ViroGeometry extends ViroBase<Props> {
    render(): JSX.Element;
}
export {};
