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
import { ViroSceneContext } from "./ViroSceneContext";
type Props = ViewProps & {
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
    /**
     * "perspective" (the default) or "orthographic".
     *
     * Orthographic keeps parallel lines parallel, which is what a floor plan, blueprint, isometric
     * or CAD-style view needs. A perspective camera makes parallel aisles converge, and on a map
     * that reads as a mistake rather than as depth.
     *
     * AR and VR scenes ignore this: there the projection comes from the device.
     */
    projection?: "perspective" | "orthographic";
    /**
     * Height of the orthographic view in world units — the full height, not the half-height. The
     * width follows from the viewport's aspect ratio, so proportions hold when the view resizes.
     *
     * Only meaningful when `projection` is "orthographic".
     */
    orthographicScale?: number;
};
type State = {
    active: boolean;
};
export declare class ViroCamera extends React.Component<Props, State> {
    _component: any;
    static contextType?: React.Context<any> | undefined;
    context: React.ContextType<typeof ViroSceneContext>;
    componentDidMount(): void;
    componentWillUnmount(): void;
    componentDidUpdate(prevProps: Props, _prevState: State): void;
    setNativeProps: (nativeProps: any) => void;
    _onAnimationStart: (_event: NativeSyntheticEvent<ViroAnimationStartEvent>) => void;
    _onAnimationFinish: (_event: NativeSyntheticEvent<ViroAnimationFinishEvent>) => void;
    render(): React.JSX.Element;
}
export {};
