import * as React from "react";
import { ImageSourcePropType, NativeSyntheticEvent, ViewProps } from "react-native";
import { ViroLoadEndEvent, ViroLoadErrorEvent, ViroLoadStartEvent } from "./Types/ViroEvents";
import { ViroNativeRef, ViroRotation } from "./Types/ViroUtils";
declare type Props = ViewProps & {
    /**
     * The image file, which is required
     */
    source: ImageSourcePropType;
    rotation?: ViroRotation;
    format?: "RGBA8" | "RGB565";
    steroMode?: "LeftRight" | "RightLeft" | "TopBottom" | "BottomTop" | "None";
    isHdr?: boolean;
    /**
     * Callback triggered when we are processing the assets to be
     * displayed in this 360 Photo (either downloading / reading from file).
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
    /**
     * Callback triggered when the image fails to load. Invoked with
     * {nativeEvent: {error}}
     */
    onError?: (event: NativeSyntheticEvent<ViroLoadErrorEvent>) => void;
};
export declare class Viro360Image extends React.Component<Props> {
    _component: ViroNativeRef;
    _onLoadStart: (event: NativeSyntheticEvent<ViroLoadStartEvent>) => void;
    _onLoadEnd: (event: NativeSyntheticEvent<ViroLoadEndEvent>) => void;
    _onError: (event: NativeSyntheticEvent<ViroLoadErrorEvent>) => void;
    setNativeProps(nativeProps: Props): void;
    render(): JSX.Element;
}
export {};
