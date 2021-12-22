import * as React from "react";
import { NativeSyntheticEvent, ViewProps } from "react-native";
import { ViroAnimatedComponentFinishEvent, ViroAnimatedComponentStartEvent } from "./Types/ViroEvents";
import { ViroNativeRef } from "./Types/ViroUtils";
declare type Props = ViewProps & {
    animation: string;
    delay: number;
    loop: boolean;
    onStart: () => void;
    onFinish: () => void;
    run: boolean;
};
/**
 * Used to render a ViroAnimatedComponent
 */
export declare class ViroAnimatedComponent extends React.Component<Props> {
    _component: ViroNativeRef;
    _onStart(_event: NativeSyntheticEvent<ViroAnimatedComponentStartEvent>): void;
    _onFinish(_event: NativeSyntheticEvent<ViroAnimatedComponentFinishEvent>): void;
    setNativeProps(nativeProps: Props): void;
    render(): JSX.Element;
}
export {};
