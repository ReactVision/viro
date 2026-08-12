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
import { useRef, useState } from "react";
import { setStick } from "./Web/viroVirtualController";

export type { ViroStickSide, ViroVirtualJoystickProps } from "./ViroVirtualJoystick";
import type { ViroVirtualJoystickProps } from "./ViroVirtualJoystick";

export const ViroVirtualJoystick: React.FC<ViroVirtualJoystickProps> = (props) => {
  const {
    controllerId,
    stickSide = "left",
    radius = 60,
    tintColor = "rgba(255, 255, 255, 0.6)",
    onStickChange,
    style,
  } = props;

  const ringRef = useRef<HTMLDivElement>(null);
  const activePointer = useRef<number | null>(null);
  const [knob, setKnob] = useState({ x: 0, y: 0 });

  const tint = typeof tintColor === "string" ? tintColor : "rgba(255, 255, 255, 0.6)";

  const update = (clientX: number, clientY: number) => {
    const ring = ringRef.current;
    if (!ring) return;
    const rect = ring.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    let dx = clientX - cx;
    let dy = clientY - cy;
    const dist = Math.hypot(dx, dy);
    if (dist > radius) {
      dx = (dx / dist) * radius;
      dy = (dy / dist) * radius;
    }
    setKnob({ x: dx, y: dy });
    // Normalise to [-1, 1]; invert Y so up is +1 (screen Y grows downward).
    const nx = dx / radius;
    const ny = -dy / radius;
    setStick(controllerId, stickSide, nx, ny);
    onStickChange?.({ nativeEvent: { x: nx, y: ny } });
  };

  const reset = () => {
    setKnob({ x: 0, y: 0 });
    setStick(controllerId, stickSide, 0, 0);
    onStickChange?.({ nativeEvent: { x: 0, y: 0 } });
  };

  const onPointerDown = (e: React.PointerEvent) => {
    activePointer.current = e.pointerId;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    update(e.clientX, e.clientY);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (activePointer.current !== e.pointerId) return;
    update(e.clientX, e.clientY);
  };
  const onPointerEnd = (e: React.PointerEvent) => {
    if (activePointer.current !== e.pointerId) return;
    activePointer.current = null;
    reset();
  };

  const size = radius * 2;
  const ringStyle: React.CSSProperties = {
    position: "relative",
    width: size,
    height: size,
    borderRadius: "50%",
    border: `2px solid ${tint}`,
    touchAction: "none",
    userSelect: "none",
  };
  const knobStyle: React.CSSProperties = {
    position: "absolute",
    left: "50%",
    top: "50%",
    width: radius,
    height: radius,
    marginLeft: -radius / 2,
    marginTop: -radius / 2,
    borderRadius: "50%",
    background: tint,
    transform: `translate(${knob.x}px, ${knob.y}px)`,
    pointerEvents: "none",
  };

  return (
    <div style={style as React.CSSProperties}>
      <div
        ref={ringRef}
        style={ringStyle}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerEnd}
      >
        <div style={knobStyle} />
      </div>
    </div>
  );
};

export default ViroVirtualJoystick;
