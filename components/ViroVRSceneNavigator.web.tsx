/**
 * ViroVRSceneNavigator.web.tsx
 *
 * The web has no headset or Cardboard target, so the scenes render through
 * Viro3DSceneNavigator in mono, as a phone shows them with vrModeEnabled={false}.
 * The ref (project, unproject, recenterTracking) and the scene navigator are the
 * 3D navigator's.
 *
 * Copyright © 2026 ReactVision. All rights reserved.
 */
import * as React from "react";
import { useEffect } from "react";
import { Viro3DSceneNavigator } from "./Viro3DSceneNavigator.web";

let warnedStereo = false;

export function ViroVRSceneNavigator(props: React.ComponentProps<typeof Viro3DSceneNavigator> & { vrModeEnabled?: boolean }) {
  const { vrModeEnabled, ...rest } = props;
  useEffect(() => {
    if (vrModeEnabled === false || warnedStereo) return;
    warnedStereo = true;
    console.warn("[Viro web] ViroVRSceneNavigator has no stereo VR mode on web; rendering in mono.");
  }, [vrModeEnabled]);
  return <Viro3DSceneNavigator {...rest} />;
}
