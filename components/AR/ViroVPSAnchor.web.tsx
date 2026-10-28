/**
 * ViroVPSAnchor.web.tsx
 *
 * Not implemented on web: VPS localisation needs an ARKit or ARCore session.
 * This file exists so the platform-extension resolver picks it instead of
 * ViroVPSAnchor.tsx on web, which calls requireNativeComponent() at module
 * scope and so crashes the whole @reactvision/react-viro import there. Like
 * the native anchor on a platform without VPS, it renders nothing; `<ViroVPS>`
 * reports the state `unsupported`.
 *
 * Copyright © 2026 ReactVision. All rights reserved.
 */
import * as React from "react";
import type { ViroVPSAnchorProps } from "./ViroVPSAnchor";
import { warnUnsupported } from "../Utilities/ViroUnsupported";

export class ViroVPSAnchor extends React.Component<ViroVPSAnchorProps> {
  render() {
    warnUnsupported("ViroVPSAnchor", "web", "VPS localisation needs an ARKit or ARCore session.");
    return null;
  }
}
