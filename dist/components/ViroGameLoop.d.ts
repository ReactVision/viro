/**
 * ViroGameLoop.tsx — headless component that fires per-frame JS callbacks.
 *
 * Mount anywhere inside a ViroARScene or ViroScene to start the loop.
 * The loop automatically stops when the component unmounts.
 *
 * Usage:
 *   <ViroGameLoop onUpdate={(dt, elapsed) => { ... }} />
 *   <ViroGameLoop fixedHz={30} onFixedUpdate={(dt) => { ... }} />
 *
 * Copyright © 2026 ReactVision. All rights reserved.
 */
import React from "react";
export type ViroGameLoopUpdateEvent = {
    dt: number;
    elapsed: number;
};
export type ViroGameLoopFixedEvent = {
    dt: number;
};
export type ViroGameLoopProps = {
    /** Called every rendered frame. dt = seconds since last frame. */
    onUpdate?: (event: ViroGameLoopUpdateEvent) => void;
    /** Called after physics + rendering each frame (useLateUpdate equivalent). */
    onLateUpdate?: (event: ViroGameLoopUpdateEvent) => void;
    /** Fixed simulation frequency in Hz. When set, onFixedUpdate fires at this rate. */
    fixedHz?: number;
    /** Called at a fixed rate determined by fixedHz. */
    onFixedUpdate?: (event: ViroGameLoopFixedEvent) => void;
};
export declare function ViroGameLoop({ onUpdate, onLateUpdate, onFixedUpdate, fixedHz, }: ViroGameLoopProps): React.JSX.Element;
