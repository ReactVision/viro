/**
 * Copyright (c) 2016-present, Viro, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule ViroSphere
 */
import * as React from "react";
import { ViroBase } from "./ViroBase";
type Props = {
    widthSegmentCount?: number;
    heightSegmentCount?: number;
    radius?: number;
    facesOutward?: boolean;
};
/**
 * Used to render a ViroSphere
 */
export declare class ViroSphere extends ViroBase<Props> {
    render(): React.JSX.Element;
}
export {};
