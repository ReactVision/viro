/// <reference types="react" />
import { ViroBase } from "./ViroBase";
declare type Props = {
    type?: "Dark" | "Light" | "dark" | "light";
};
/**
 * Composite control for a 2D Spinner
 */
export declare class ViroSpinner extends ViroBase<Props> {
    render(): JSX.Element;
    _getImage1(): any;
    _getImage1a(): any;
}
export {};
