/**
 * Web implementation of ViroOrbitCamera — a camera at `position` looking at
 * `focalPoint`. Reuses the node camera; the look-at is expressed as an Euler
 * rotation (no roll). When `active`, becomes the renderer's point of view.
 *
 * NOTE: the look-at Euler is MVP-approximate (yaw/pitch, no roll); validate the
 * sign convention on-device if precise framing matters.
 */
import * as React from "react";
import { useEffect } from "react";
import { useViroNode, type ViroWebNodeProps } from "./Web/useViroNode";
import { useViroScene, ViroParentNodeContext } from "./Web/ViroWebContext";

type Vec3 = [number, number, number];

type Props = ViroWebNodeProps & {
  active?: boolean;
  focalPoint?: Vec3;
  projection?: "perspective" | "orthographic";
  orthographicScale?: number;
  children?: React.ReactNode;
  [key: string]: any;
};

const RAD2DEG = 180 / Math.PI;

function lookAtEuler(position: Vec3, focal: Vec3): Vec3 {
  const dx = focal[0] - position[0];
  const dy = focal[1] - position[1];
  const dz = focal[2] - position[2];
  const len = Math.hypot(dx, dy, dz) || 1;
  const nx = dx / len;
  const ny = dy / len;
  const nz = dz / len;
  const yaw = Math.atan2(nx, -nz) * RAD2DEG;
  const pitch = -Math.asin(Math.max(-1, Math.min(1, ny))) * RAD2DEG;
  return [pitch, yaw, 0];
}

export function ViroOrbitCamera(props: Props) {
  const position = (props.position ?? [0, 0, 0]) as Vec3;
  const rotation = props.focalPoint
    ? lookAtEuler(position, props.focalPoint)
    : props.rotation;

  const node = useViroNode({ ...props, rotation });
  const scene = useViroScene();
  const active = props.active !== false;

  useEffect(() => {
    scene.setNodeCamera(node);
  }, [scene, node]);

  useEffect(() => {
    if (active) scene.setActiveCameraNode(node);
  }, [scene, node, active]);

  useEffect(() => {
    scene.setCameraProjection(node, props.projection ?? "perspective");
  }, [scene, node, props.projection]);

  useEffect(() => {
    if (props.orthographicScale !== undefined) {
      scene.setCameraOrthographicScale(node, props.orthographicScale);
    }
  }, [scene, node, props.orthographicScale]);

  return (
    <ViroParentNodeContext.Provider value={node}>
      {props.children}
    </ViroParentNodeContext.Provider>
  );
}
