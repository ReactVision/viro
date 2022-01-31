/// <reference types="react" />
import { ViroUVCoordinate } from "./Types/ViroUtils";
import { ViroBase } from "./ViroBase";
declare type Props = {
    uvCoordinates: ViroUVCoordinate[];
};
/**
 * Used to render a ViroSurface
 */
export declare class ViroSurface extends ViroBase<Props> {
    render(): JSX.Element;
}
export {};
