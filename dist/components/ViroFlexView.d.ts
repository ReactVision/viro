import * as React from "react";
import { ViroStyle } from "./Styles/ViroStyle";
import { ViroBase } from "./ViroBase";
type Props = {
    style?: ViroStyle;
};
/**
 * Used to render a ViroFlexView
 */
export declare class ViroFlexView extends ViroBase<Props> {
    render(): React.JSX.Element;
}
export {};
