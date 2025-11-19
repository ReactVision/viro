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
import { ViroClickStateEvent, ViroPlaneUpdatedMap } from "../Types/ViroEvents";
import { ViroARPlaneType, ViroNativeRef } from "../Types/ViroUtils";
import * as React from "react";
type Props = {
    minHeight?: number;
    minWidth?: number;
    alignment?: "Horizontal" | "HorizontalUpward" | "HorizontalDownward" | "Vertical" | "Both";
    onPlaneSelected?: (updateMap: ViroPlaneUpdatedMap) => void;
    onPlaneDetected?: (updateMap: ViroPlaneUpdatedMap) => boolean;
    disableClickSelection?: boolean;
    useActualShape?: boolean;
    children?: React.ReactNode;
};
type State = {
    selectedPlaneId: string | null;
    foundARPlanes: Map<string, ViroARPlaneType>;
};
/**
 * This component wraps the logic required to enable user selection
 * of an AR plane. This currently only allows for 1 plane to be selected,
 * but could easily be modified to allow for more planes.
 */
export declare class ViroARPlaneSelector extends React.Component<Props, State> {
    _component: ViroNativeRef;
    state: State;
    render(): React.JSX.Element;
    _getARPlanes(): React.JSX.Element[];
    _getOnClickSurface: (anchorId: string, event: ViroClickStateEvent) => void;
    _onARPlaneUpdated: (anchor: any) => void;
    _onPlaneSelected: (updateMap: ViroPlaneUpdatedMap) => void;
    /**
     * This function allows the user to reset the surface and select a new plane.
     */
    reset: () => void;
}
export {};
