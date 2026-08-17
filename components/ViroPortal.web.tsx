/**
 * Web implementation of ViroPortal — the entrance frame (VROPortalFrame) of the
 * enclosing ViroPortalScene. Its children are the doorway geometry (e.g. a
 * Viro3DObject of an arch/door). Registering the entrance parents the frame
 * under the portal scene, so this does not use useViroNode's auto-parenting.
 */
import * as React from "react";
import { useEffect, useState } from "react";
import type { ViroHandle } from "@reactvision/viro-web-renderer";
import {
  useViroScene,
  useViroParentNode,
  ViroParentNodeContext,
} from "./Web/ViroWebContext";

const DEG2RAD = Math.PI / 180;

type Props = {
  position?: [number, number, number];
  rotation?: [number, number, number];
  scale?: [number, number, number];
  children?: React.ReactNode;
  [key: string]: any;
};

export function ViroPortal(props: Props) {
  const scene = useViroScene();
  const portalScene = useViroParentNode(); // the enclosing VROPortal
  const [frame] = useState<ViroHandle>(() => scene.createPortalFrame());

  // Register as the portal scene's entrance (this also parents the frame).
  useEffect(() => {
    scene.setPortalEntrance(portalScene, frame);
    return () => scene.destroyNode(frame);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [px, py, pz] = props.position ?? [0, 0, 0];
  const [rx, ry, rz] = props.rotation ?? [0, 0, 0];
  const [sx, sy, sz] = props.scale ?? [1, 1, 1];
  useEffect(() => {
    scene.setNodePosition(frame, px, py, pz);
    scene.setNodeRotation(frame, rx * DEG2RAD, ry * DEG2RAD, rz * DEG2RAD);
    scene.setNodeScale(frame, sx, sy, sz);
  }, [scene, frame, px, py, pz, rx, ry, rz, sx, sy, sz]);

  return (
    <ViroParentNodeContext.Provider value={frame}>
      {props.children}
    </ViroParentNodeContext.Provider>
  );
}
