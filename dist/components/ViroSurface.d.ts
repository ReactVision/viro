import * as React from "react";
import { ViroUVCoordinate } from "./Types/ViroUtils";
import { ViroBase } from "./ViroBase";
type Props = {
    uvCoordinates: ViroUVCoordinate[];
};
/**
 * Used to render a ViroSurface
 */
export declare class ViroSurface extends ViroBase<Props> {
    render(): React.JSX.Element;
}
export {};
