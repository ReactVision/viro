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
import { requireNativeComponent, ViewStyle } from "react-native";

const VRTGameLoopView = requireNativeComponent<ViroGameLoopNativeProps>(
  "VRTGameLoopView"
);

// ── Types ─────────────────────────────────────────────────────────────────────

export type ViroGameLoopUpdateEvent = {
  dt: number;       // delta time in seconds since last frame
  elapsed: number;  // total elapsed seconds since component mounted
};

export type ViroGameLoopFixedEvent = {
  dt: number;       // fixed delta (1 / fixedHz)
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

type ViroGameLoopNativeProps = {
  onUpdate?: (e: { nativeEvent: ViroGameLoopUpdateEvent }) => void;
  onLateUpdate?: (e: { nativeEvent: ViroGameLoopUpdateEvent }) => void;
  onFixedUpdate?: (e: { nativeEvent: ViroGameLoopFixedEvent }) => void;
  fixedHz?: number;
  style?: ViewStyle;
};

// ── Component ─────────────────────────────────────────────────────────────────

export function ViroGameLoop({
  onUpdate,
  onLateUpdate,
  onFixedUpdate,
  fixedHz,
}: ViroGameLoopProps) {
  // Native sends dt/elapsed as strings to avoid Fabric conversions.h type-check spam.
  const parse = (e: any) => ({
    dt:      parseFloat(e.nativeEvent.dt),
    elapsed: parseFloat(e.nativeEvent.elapsed ?? "0"),
  });
  const parseFixed = (e: any) => ({ dt: parseFloat(e.nativeEvent.dt) });

  return (
    <VRTGameLoopView
      onUpdate={onUpdate ? (e) => onUpdate(parse(e)) : undefined}
      onLateUpdate={onLateUpdate ? (e) => onLateUpdate(parse(e)) : undefined}
      onFixedUpdate={onFixedUpdate ? (e) => onFixedUpdate(parseFixed(e)) : undefined}
      fixedHz={fixedHz}
    />
  );
}
