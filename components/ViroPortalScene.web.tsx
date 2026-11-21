/**
 * Web implementation of ViroPortalScene — a VROPortal node holding the content
 * seen through a portal entrance. Its `<ViroPortal>` child defines the doorway;
 * other children are the content rendered inside the portal.
 */
import * as React from "react";
import { useEffect, useRef } from "react";
import { useViroNode, type ViroWebNodeProps } from "./Web/useViroNode";
import { useViroScene, ViroParentNodeContext } from "./Web/ViroWebContext";
import { warnUnsupported } from "./Utilities/ViroUnsupported";

type PortalEvent = { nativeEvent: Record<string, never> };

type Props = ViroWebNodeProps & {
  passable?: boolean;
  onPortalEnter?: (event: PortalEvent) => void;
  onPortalExit?: (event: PortalEvent) => void;
  children?: React.ReactNode;
  [key: string]: any;
};

export function ViroPortalScene(props: Props) {
  const scene = useViroScene();
  const node = useViroNode(props, undefined, true, undefined, (s) => s.createPortalScene());

  useEffect(() => {
    scene.setPortalPassable(node, props.passable ?? false);
  }, [scene, node, props.passable]);

  // Fired as the camera crosses the doorway, so only a passable portal does.
  const handlers = useRef(props);
  handlers.current = props;
  const listening = !!(props.onPortalEnter || props.onPortalExit);
  useEffect(() => {
    if (!listening) return;
    const report = (entered: boolean) => {
      const handler = entered ? handlers.current.onPortalEnter : handlers.current.onPortalExit;
      handler?.({ nativeEvent: {} });
    };
    if (typeof scene.setPortalHandler !== "function" || !scene.setPortalHandler(node, report)) {
      warnUnsupported("ViroPortalScene onPortalEnter and onPortalExit", "this version of the web renderer");
      return;
    }
    return () => {
      scene.setPortalHandler(node, null);
    };
  }, [scene, node, listening]);

  return (
    <ViroParentNodeContext.Provider value={node}>
      {props.children}
    </ViroParentNodeContext.Provider>
  );
}
