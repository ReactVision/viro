/**
 * ViroVirtualButton.tsx
 *
 * Copyright © 2026 ReactVision. All rights reserved.
 *
 * Permission is hereby granted, free of charge, to any person obtaining
 * a copy of this software and associated documentation files (the
 * "Software"), to deal in the Software without restriction, including
 * without limitation the rights to use, copy, modify, merge, publish,
 * distribute, sublicense, and/or sell copies of the Software, and to
 * permit persons to whom the Software is furnished to do so, subject to
 * the following conditions:
 *
 * The above copyright notice and this permission notice shall be included
 * in all copies or substantial portions of the Software.
 */
import * as React from "react";
import { StyleProp, ViewStyle } from "react-native";
/**
 * Native virtual-button component. Renders an on-screen circular button labelled
 * with the button name (e.g. "A", "B"). On press it writes setButton(idx, true)
 * to a VROInputState in VROVirtualControllerRegistry; on release it writes false.
 *
 * Like ViroVirtualJoystick, touch handling is entirely native — no JS bridge
 * round-trip — so press/release latency stays in the single-digit-milliseconds range.
 *
 * Example:
 *
 *     <ViroVirtualButton
 *       controllerId="p1"
 *       button="A"
 *       style={{ position: "absolute", bottom: 60, right: 60, width: 60, height: 60 }}
 *       size={44}
 *       tintColor="rgba(255,255,255,0.6)"
 *     />
 */
export type ViroButtonName = "A" | "B" | "X" | "Y" | "Z" | "L1" | "R1" | "L2" | "R2" | "Start" | "Select";
export interface ViroVirtualButtonProps {
    /**
     * Identifier of the controller this button writes to. Must match the
     * `controllerId` of any joystick or other adapter sharing the same state.
     */
    controllerId: string;
    /**
     * Which button this view maps to. Determines the index written to
     * VROInputState::setButton and the label drawn on the circle.
     */
    button: ViroButtonName;
    /**
     * Diameter of the button circle in points. Defaults to 44.
     */
    size?: number;
    /**
     * Fill colour of the circle. Any value accepted by React Native's color prop.
     * Defaults to `rgba(255, 255, 255, 0.6)`.
     */
    tintColor?: number | string;
    /** Fired when the button is pressed down (same tick as C++ VROInputState write). */
    onPressIn?: (event: {
        nativeEvent: {
            button: string;
        };
    }) => void;
    /** Fired when the button is released (same tick as C++ VROInputState write). */
    onPressOut?: (event: {
        nativeEvent: {
            button: string;
        };
    }) => void;
    /**
     * Positioning / sizing.
     */
    style?: StyleProp<ViewStyle>;
}
export declare const ViroVirtualButton: React.FC<ViroVirtualButtonProps>;
export default ViroVirtualButton;
