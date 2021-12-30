/// <reference types="react" />
import { NativeSyntheticEvent } from "react-native";
import { ViroStyle } from "./Styles/ViroStyle";
import { ViroLoadEndEvent, ViroLoadStartEvent } from "./Types/ViroEvents";
import { ViroSource } from "./Types/ViroUtils";
import { ViroBase } from "./ViroBase";
declare type Props = {
    source: ViroSource;
    style?: ViroStyle;
    resizeMode?: "ScaleToFill" | "ScaleToFit" | "StretchToFill";
    imageClipMode?: "None" | "ClipToBounds";
    stereoMode?: "LeftRight" | "RightLeft" | "TopBottom" | "BottomTop" | "None";
    placeholderSource?: ViroSource;
    /**
     * DEPRECATION WARNING: DO NOT USE THE FOLLOWING PROP!
     * @deprecated
     */
    placeHolderSource?: ViroSource;
    mipmap?: boolean;
    format?: "RGBA8" | "RGB565";
    /**
     * Callback triggered when we are processing the assets to be
     * displayed in this ViroImage (either downloading / reading from file).
     */
    onLoadStart?: (event: NativeSyntheticEvent<ViroLoadStartEvent>) => void;
    /**
     * Callback triggered when we have finished processing assets to be
     * displayed. Wether or not assets were processed successfully and
     * thus displayed will be indicated by the parameter "success".
     * For example:
     *
     *   _onLoadEnd(event:Event){
     *      // Indication of asset loading success
     *      event.nativeEvent.success
     *   }
     *
     */
    onLoadEnd?: (event: NativeSyntheticEvent<ViroLoadEndEvent>) => void;
};
/**
 * Used to render a ViroImage
 */
export declare class ViroImage extends ViroBase<Props> {
    _onLoadStart: (event: NativeSyntheticEvent<ViroLoadStartEvent>) => void;
    _onLoadEnd: (event: NativeSyntheticEvent<ViroLoadEndEvent>) => void;
    render(): JSX.Element;
    static evictFromCache: (imageSource: ViroSource) => void;
}
export {};
