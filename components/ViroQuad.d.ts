/// <reference types="react" />
import { ViroUVCoordinate } from "./Types/ViroUtils";
import { ViroBase } from "./ViroBase";
declare type Props = {
    uvCoordinates?: ViroUVCoordinate[];
};
/**
 * Used to render a ViroQuad.
 */
export declare class ViroQuad extends ViroBase<Props> {
    render(): JSX.Element;
}
export {};
