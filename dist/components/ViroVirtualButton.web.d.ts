/**
 * ViroVirtualButton.web.tsx
 *
 * Web implementation of ViroVirtualButton — an on-screen circular button
 * rendered as a DOM overlay. Press/release write into the JS controller
 * registry under `controllerId` (read via `useVirtualController`), the web
 * equivalent of the native view's VROVirtualControllerRegistry write.
 *
 * Copyright © 2026 ReactVision. All rights reserved.
 */
import * as React from "react";
export type { ViroButtonName, ViroVirtualButtonProps } from "./ViroVirtualButton";
import type { ViroVirtualButtonProps } from "./ViroVirtualButton";
export declare const ViroVirtualButton: React.FC<ViroVirtualButtonProps>;
export default ViroVirtualButton;
