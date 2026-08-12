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
import { useState } from "react";
import { setButton } from "./Web/viroVirtualController";

export type { ViroButtonName, ViroVirtualButtonProps } from "./ViroVirtualButton";
import type { ViroVirtualButtonProps } from "./ViroVirtualButton";

export const ViroVirtualButton: React.FC<ViroVirtualButtonProps> = (props) => {
  const {
    controllerId,
    button,
    size = 44,
    tintColor = "rgba(255, 255, 255, 0.6)",
    onPressIn,
    onPressOut,
    style,
  } = props;

  const [pressed, setPressed] = useState(false);
  const tint = typeof tintColor === "string" ? tintColor : "rgba(255, 255, 255, 0.6)";

  const press = (e: React.PointerEvent) => {
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setPressed(true);
    setButton(controllerId, button, true);
    onPressIn?.({ nativeEvent: { button } });
  };
  const release = () => {
    if (!pressed) return;
    setPressed(false);
    setButton(controllerId, button, false);
    onPressOut?.({ nativeEvent: { button } });
  };

  const circleStyle: React.CSSProperties = {
    width: size,
    height: size,
    borderRadius: "50%",
    background: tint,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#000",
    fontSize: size * 0.4,
    fontWeight: 600,
    userSelect: "none",
    touchAction: "none",
    opacity: pressed ? 0.9 : 0.6,
  };

  return (
    <div style={style as React.CSSProperties}>
      <div
        style={circleStyle}
        onPointerDown={press}
        onPointerUp={release}
        onPointerCancel={release}
        onPointerLeave={release}
      >
        {button}
      </div>
    </div>
  );
};

export default ViroVirtualButton;
