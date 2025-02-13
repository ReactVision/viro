import * as React from "react";
import { ViroUVCoordinate } from "./Types/ViroUtils";
import { ViroBase } from "./ViroBase";
type Props = {
    arShadowReceiver?: boolean;
    uvCoordinates?: ViroUVCoordinate[];
};
/**
 * Used to render a ViroQuad.
 */
export declare class ViroQuad extends ViroBase<Props> {
    render(): React.JSX.Element;
}
export {};
