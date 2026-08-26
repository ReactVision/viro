/**
 * ViroVirtualJoystick.web.tsx
 *
 * Web implementation of ViroVirtualJoystick — an on-screen analog stick rendered
 * as a DOM overlay. Pointer drags are clamped to `radius` and normalised to
 * [-1, 1], then written to the JS controller registry under `controllerId`
 * (read via `useVirtualController`). This is the web equivalent of the native
 * view that writes into VROVirtualControllerRegistry; the read-path there is
 * C++, here it's the registry hook.
 *
 * Copyright © 2026 ReactVision. All rights reserved.
 */
import * as React from "react";
export type { ViroStickSide, ViroVirtualJoystickProps } from "./ViroVirtualJoystick";
import type { ViroVirtualJoystickProps } from "./ViroVirtualJoystick";
export declare const ViroVirtualJoystick: React.FC<ViroVirtualJoystickProps>;
export default ViroVirtualJoystick;
