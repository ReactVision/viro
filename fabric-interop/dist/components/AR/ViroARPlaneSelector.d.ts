/**
 * ViroARPlaneSelector
 *
 * This component wraps the logic required to enable user selection
 * of an AR plane. This currently only allows for 1 plane to be selected,
 * but could easily be modified to allow for more planes.
 */
import * as React from "react";
import { ViroPlaneUpdatedMap, ViroARPlaneSizes, ViroClickStateEvent } from "../../components/Types/ViroEvents";
import { ViroARPlaneType, ViroNativeRef } from "../../components/Types/ViroUtils";
import { ViroCommonProps, ViroObjectProps } from "../../components/AR/ViroCommonProps";
type Props = ViroCommonProps & ViroObjectProps & {
    maxPlanes?: number;
    minHeight?: number;
    minWidth?: number;
    alignment?: "Horizontal" | "HorizontalUpward" | "HorizontalDownward" | "Vertical";
    onPlaneSelected?: (updateMap: ViroPlaneUpdatedMap) => void;
};
type State = {
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
        foundARPlanes: ViroARPlaneType[];
        arPlaneSizes: number[];
    };
    render(): React.JSX.Element;
    _getARPlanes(): JSX.Element[];
    _getOnClickSurface: (index: number, event: ViroClickStateEvent) => void;
    _onARPlaneUpdated: (index: number) => (updateMap: ViroPlaneUpdatedMap) => void;
    _onPlaneSelected: (updateMap: ViroPlaneUpdatedMap) => void;
    reset: () => void;
}
export {};
//# sourceMappingURL=ViroARPlaneSelector.d.ts.map