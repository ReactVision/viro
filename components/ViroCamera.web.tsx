/**
 * Web implementation of ViroCamera. Creates a node with a camera, positions it
 * via the shared node hook, and (when active) makes it the renderer's point of
 * view. Defaults to active unless `active={false}`.
 */
import * as React from "react";
import { useEffect } from "react";
import { useViroNode, type ViroWebNodeProps } from "./Web/useViroNode";
import { useViroScene, ViroParentNodeContext } from "./Web/ViroWebContext";
import { activateSceneCamera, setSceneCameraFieldOfView, setSceneCameraOrthographic } from "./Web/viroDrag";

type Props = ViroWebNodeProps & {
  active?: boolean;
  projection?: "perspective" | "orthographic";
  orthographicScale?: number;
  /** Degrees across the longer side of the view, as on native. */
  fieldOfView?: number;
  children?: React.ReactNode;
  [key: string]: any;
};

export function ViroCamera(props: Props) {
  const node = useViroNode(props);
  const scene = useViroScene();
  const active = props.active !== false;
  const { projection, orthographicScale, fieldOfView } = props;

  useEffect(() => {
    scene.setNodeCamera(node);
  }, [scene, node]);

  useEffect(() => (active ? activateSceneCamera(scene, node) : undefined), [scene, node, active]);

  // Order matters only in that the camera must exist first, which the effect
  // above guarantees — effects run in declaration order.
  useEffect(() => {
    scene.setCameraProjection(node, projection ?? "perspective");
    setSceneCameraOrthographic(scene, node, projection === "orthographic");
    return () => setSceneCameraOrthographic(scene, node, false);
  }, [scene, node, projection]);

  useEffect(() => {
    if (orthographicScale !== undefined) {
      scene.setCameraOrthographicScale(node, orthographicScale);
    }
  }, [scene, node, orthographicScale]);

  useEffect(() => {
    const degrees = fieldOfView ?? 0;
    // A renderer without the binding keeps the default, so drags keep its rays too.
    if (typeof scene.setCameraFieldOfView !== "function" || !scene.setCameraFieldOfView(node, degrees)) return;
    setSceneCameraFieldOfView(scene, node, degrees);
    return () => setSceneCameraFieldOfView(scene, node, 0);
  }, [scene, node, fieldOfView]);

  return (
    <ViroParentNodeContext.Provider value={node}>
      {props.children}
    </ViroParentNodeContext.Provider>
  );
}
