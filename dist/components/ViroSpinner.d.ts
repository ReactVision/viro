import * as React from "react";
import { ViroBase } from "./ViroBase";
type Props = {
    type?: "Dark" | "Light" | "dark" | "light";
};
/**
 * Composite control for a 2D Spinner
 */
export declare class ViroSpinner extends ViroBase<Props> {
    render(): React.JSX.Element;
    _getImage1(): any;
    _getImage1a(): any;
}
export {};
