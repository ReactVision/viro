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
import { ViroAnchor, ViroPlaneUpdatedMap } from "../Types/ViroEvents";
import * as React from "react";
type Props = {
    minHeight?: number;
    minWidth?: number;
    alignment?: "Horizontal" | "HorizontalUpward" | "HorizontalDownward" | "Vertical" | "Both";
    onPlaneSelected?: (plane: ViroPlaneUpdatedMap) => void;
    /** Return false to reject the plane and prevent it from being shown. */
    onPlaneDetected?: (plane: ViroPlaneUpdatedMap) => boolean;
    /** Called when a tracked plane is removed by ARKit/ARCore. */
    onPlaneRemoved?: (anchorId: string) => void;
    disableClickSelection?: boolean;
    useActualShape?: boolean;
    /** Custom material name. Defaults to built-in translucent blue material. */
    material?: string;
    children?: React.ReactNode;
};
type State = {
    selectedPlaneId: string | null;
    planes: Map<string, ViroAnchor>;
};
/**
 * Displays detected AR planes and lets the user tap to select one.
 *
 * Wire up via scene-level anchor events:
 *
 *   const selectorRef = useRef<ViroARPlaneSelector>(null);
 *
 *   <ViroARScene
 *     anchorDetectionTypes={["planesHorizontal", "planesVertical"]}
 *     onAnchorFound={(a) => selectorRef.current?.handleAnchorFound(a)}
 *     onAnchorUpdated={(a) => selectorRef.current?.handleAnchorUpdated(a)}
 *     onAnchorRemoved={(a) => a && selectorRef.current?.handleAnchorRemoved(a)}
 *   >
 *     <ViroARPlaneSelector ref={selectorRef} alignment="Both" onPlaneSelected={...}>
 *       <MyContent />
 *     </ViroARPlaneSelector>
 *   </ViroARScene>
 */
export declare class ViroARPlaneSelector extends React.Component<Props, State> {
    state: State;
    handleAnchorFound: (anchor: ViroAnchor) => void;
    handleAnchorUpdated: (anchor: ViroAnchor) => void;
    handleAnchorRemoved: (anchor: ViroAnchor) => void;
    /** Reset the selection so the user can pick a different plane. */
    reset: () => void;
    _passesAlignmentFilter: (anchor: ViroAnchor) => boolean;
    render(): React.JSX.Element;
    _renderPlanes(): React.JSX.Element[];
}
export {};
