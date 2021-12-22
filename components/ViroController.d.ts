import * as React from "react";
import { NativeSyntheticEvent } from "react-native";
import { ViroCommonProps, ViroObjectProps } from "./AR/ViroCommonProps";
import { ViroClickEvent, ViroClickStateEvent, ViroControllerStatus, ViroControllerStatusEvent, ViroDragEvent, ViroFuseEvent, ViroPinchEvent, ViroRotateEvent, ViroScrollEvent, ViroSwipeEvent, ViroTouchEvent } from "./Types/ViroEvents";
import { ViroNativeRef, ViroSource } from "./Types/ViroUtils";
declare type Props = ViroCommonProps & ViroObjectProps & {
    onSwipe?: () => void;
    onControllerStatus?: (status: ViroControllerStatus, source: ViroSource) => void;
    reticleVisibility?: boolean;
    controllerVisibility?: boolean;
};
export declare class ViroController extends React.Component<Props> {
    _component: ViroNativeRef;
    _onClick(event: NativeSyntheticEvent<ViroClickEvent>): void;
    _onClickState(event: NativeSyntheticEvent<ViroClickStateEvent>): void;
    _onTouch(event: NativeSyntheticEvent<ViroTouchEvent>): void;
    _onScroll(event: NativeSyntheticEvent<ViroScrollEvent>): void;
    _onSwipe(event: NativeSyntheticEvent<ViroSwipeEvent>): void;
    _onControllerStatus(event: NativeSyntheticEvent<ViroControllerStatusEvent>): void;
    _onFuse: (event: NativeSyntheticEvent<ViroFuseEvent>) => void;
    _onPinch(event: NativeSyntheticEvent<ViroPinchEvent>): void;
    _onRotate(event: NativeSyntheticEvent<ViroRotateEvent>): void;
    getControllerForwardAsync(): Promise<any>;
    setNativeProps(nativeProps: Props): void;
    _onDrag(event: NativeSyntheticEvent<ViroDragEvent>): void;
    render(): JSX.Element;
}
export {};
