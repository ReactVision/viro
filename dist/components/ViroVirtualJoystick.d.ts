/**
 * ViroVirtualJoystick.tsx
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
 * Native virtual-joystick component. Renders an on-screen analog stick whose
 * deflection is written to a process-wide controller state identified by
 * `controllerId`. The touch handling and state update happen entirely on the
 * native side — events do not cross the JS bridge — so input latency stays in
 * the single-digit-milliseconds range even under heavy JS load.
 *
 * Consumers read the resulting controller state from native code (via a
 * VROFrameListener that calls VROVirtualControllerRegistry::instance().peek(id))
 * or from JS via the forthcoming useVirtualController hook.
 *
 * Multiple input sources (this joystick, a future MFi-gamepad adapter, a tilt
 * adapter) can target the same `controllerId`; the controller state aggregates
 * whichever sources last wrote to each field.
 *
 * Example:
 *
 *     <ViroVirtualJoystick
 *       controllerId="p1"
 *       stickSide="left"
 *       style={{ position: "absolute", bottom: 40, left: 40, width: 140, height: 140 }}
 *       radius={60}
 *       tintColor="rgba(255,255,255,0.6)"
 *     />
 */
export type ViroStickSide = "left" | "right";
export interface ViroVirtualJoystickProps {
    /**
     * Identifier of the controller this joystick writes to. Matches the id used
     * by readers (e.g. native simulation adapters) and by other input adapters
     * targeting the same controller.
     */
    controllerId: string;
    /**
     * Which stick on the controller this joystick drives. Defaults to `"left"`.
     */
    stickSide?: ViroStickSide;
    /**
     * Outer ring radius in points (the knob is clamped to this distance from the
     * centre). The view's frame should be at least `radius * 2 + knobMargin` on
     * each axis for the stick to render fully inside its bounds. Defaults to 60.
     */
    radius?: number;
    /**
     * Tint colour applied to both the outer ring stroke and the knob fill. Any
     * value accepted by React Native's color prop. Defaults to
     * `rgba(255, 255, 255, 0.6)`.
     */
    tintColor?: number | string;
    /**
     * Fired on every stick movement with { x, y } normalised to [-1, 1].
     * Called from native synchronously after VROInputState is updated,
     * so you can drive JS visuals from the same user gesture.
     */
    onStickChange?: (event: {
        nativeEvent: {
            x: number;
            y: number;
        };
    }) => void;
    /**
     * Positioning / sizing. Same prop as any RN view.
     */
    style?: StyleProp<ViewStyle>;
}
export declare const ViroVirtualJoystick: React.FC<ViroVirtualJoystickProps>;
export default ViroVirtualJoystick;
