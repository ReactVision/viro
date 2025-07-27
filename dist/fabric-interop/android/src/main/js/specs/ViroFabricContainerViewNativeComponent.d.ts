/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @format
 */
import type { ViewProps } from "react-native";
import type { HostComponent } from "react-native";
export interface NativeProps extends ViewProps {
    apiKey?: string;
    debug?: boolean;
    arEnabled?: boolean;
    worldAlignment?: string;
    onInitialized?: (event: {
        nativeEvent: {
            success: boolean;
        };
    }) => void;
    onTrackingUpdated?: (event: {
        nativeEvent: any;
    }) => void;
    onCameraTransformUpdate?: (event: {
        nativeEvent: any;
    }) => void;
}
export type ViroFabricContainerViewType = HostComponent<NativeProps>;
interface NativeCommands {
    initialize: (viewRef: React.ElementRef<ViroFabricContainerViewType>, apiKey: string, debug: boolean, arEnabled: boolean, worldAlignment: string) => void;
    cleanup: (viewRef: React.ElementRef<ViroFabricContainerViewType>) => void;
}
export declare const Commands: NativeCommands;
declare const _default: import("react-native/Libraries/Utilities/codegenNativeComponent").NativeComponentType<NativeProps>;
export default _default;
