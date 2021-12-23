/**
 * Copyright (c) 2017-present, Viro Media, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule ViroARPlaneSelector
 */
import { ViroARPlaneSizes, ViroPlaneUpdatedMap } from "../Types/ViroEvents";
import { ViroARPlaneType, ViroNativeRef } from "../Types/ViroUtils";
import * as React from "react";
import { ViroCommonProps, ViroObjectProps } from "./ViroCommonProps";
declare type Props = ViroCommonProps & ViroObjectProps & {
    maxPlanes?: number;
    minHeight?: number;
    minWidth?: number;
    alignment?: "Horizontal" | "HorizontalUpward" | "HorizontalDownward" | "Vertical";
    onPlaneSelected?: (updateMap: ViroPlaneUpdatedMap) => void;
};
declare type State = {
    selectedSurface: number;
    foundARPlanes: ViroARPlaneType[];
    arPlaneSizes: ViroARPlaneSizes;
};
/**
 * This component wraps the logic required to enable user selection
 * of an AR plane. This currently only allows for 1 plane to be selected,
 * but could easily be modified to allow for more planes.
 */
export declare class ViroARPlaneSelector extends React.Component<Props, State> {
    _component: ViroNativeRef;
    state: {
        selectedSurface: number;
        foundARPlanes: any[];
        arPlaneSizes: number[];
    };
    render(): JSX.Element;
    _getARPlanes(): JSX.Element | JSX.Element[];
    _getOnClickSurface: (index: number) => () => void;
    _onARPlaneUpdated: (index: number) => (updateMap: ViroPlaneUpdatedMap) => void;
    _onPlaneSelected: (updateMap: ViroPlaneUpdatedMap) => void;
    reset: () => void;
}
export {};
