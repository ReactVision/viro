import * as React from "react";
import { NativeSyntheticEvent, ViewProps } from "react-native";
import { ViroLoadEndEvent, ViroLoadErrorEvent, ViroLoadStartEvent } from "./Types/ViroEvents";
import { ViroNativeRef, ViroSource } from "./Types/ViroUtils";
declare type Props = ViewProps & {
    /**
     * The hdr image file, which is required
     */
    source: ViroSource;
    /**
     * Callback triggered when we are processing the assets to be
     * used in computing this lighting environment (either downloading / reading from file).
     */
    onLoadStart?: (event: NativeSyntheticEvent<ViroLoadStartEvent>) => void;
    /**
     * Callback triggered when we have finished processing assets to be
     * used in computing this lighting environment. Wether or not assets were
     * processed successfully will be indicated by the parameter "success".
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
     * Callback triggered when the hdr image fails to load. Invoked with
     * {nativeEvent: {error}}
     */
    onError?: (event: NativeSyntheticEvent<ViroLoadErrorEvent>) => void;
};
export declare class ViroLightingEnvironment extends React.Component<Props> {
    _component: ViroNativeRef;
    _onLoadStart: (event: NativeSyntheticEvent<ViroLoadStartEvent>) => void;
    _onLoadEnd: (event: NativeSyntheticEvent<ViroLoadEndEvent>) => void;
    _onError: (event: NativeSyntheticEvent<ViroLoadErrorEvent>) => void;
    setNativeProps: (nativeProps: Props) => void;
    render(): JSX.Element;
}
export {};
