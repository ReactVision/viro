/**
 * Copyright (c) 2015-present, Viro, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule ViroCamera
 * @flow
 */
import * as React from "react";
import { NativeSyntheticEvent, ViewProps } from "react-native";
import { ViroAnimationFinishEvent, ViroAnimationStartEvent } from "./Types/ViroEvents";
import { Viro3DPoint, ViroRotation } from "./Types/ViroUtils";
declare type Props = ViewProps & {
    position?: Viro3DPoint;
    rotation?: ViroRotation;
    active: boolean;
    animation?: {
        name?: string;
        delay?: number;
        loop?: boolean;
        onStart?: () => void;
        onFinish?: () => void;
        run?: boolean;
        interruptible?: boolean;
    };
    fieldOfView?: number;
};
declare type State = {
    active: boolean;
};
export declare class ViroCamera extends React.Component<Props, State> {
    _component: any;
    static contextType?: React.Context<any> | undefined;
    componentDidMount(): void;
    componentWillUnmount(): void;
    componentDidUpdate(prevProps: Props, _prevState: State): void;
    setNativeProps: (nativeProps: any) => void;
    _onAnimationStart: (_event: NativeSyntheticEvent<ViroAnimationStartEvent>) => void;
    _onAnimationFinish: (_event: NativeSyntheticEvent<ViroAnimationFinishEvent>) => void;
    render(): JSX.Element;
}
export {};
