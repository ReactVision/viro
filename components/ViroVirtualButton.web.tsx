/**
 * ViroVirtualButton.web.tsx
 *
 * Not implemented on web — VR virtual-controller buttons have no counterpart
 * in the WASM/WebGL2 renderer (no VR headset target on web). Exists so the
 * platform-extension resolver picks this over ViroVirtualButton.tsx on web,
 * whose top-level requireNativeComponent() call otherwise crashes the whole
 * @reactvision/react-viro barrel import on web.
 *
 * Copyright © 2026 ReactVision. All rights reserved.
 */
import * as React from "react";

export type { ViroButtonName, ViroVirtualButtonProps } from "./ViroVirtualButton";

export const ViroVirtualButton: React.FC<any> = () => {
  if (__DEV__) {
    console.warn("[Viro web] ViroVirtualButton is not supported on web; rendering nothing.");
  }
  return null;
};

export default ViroVirtualButton;
