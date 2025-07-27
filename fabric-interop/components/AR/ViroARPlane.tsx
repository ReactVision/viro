/**
 * ViroARPlane
 *
 * Container for Viro Components anchored to a detected plane.
 */

import * as React from "react";
import { useEffect, useState } from "react";
import { ViroNode } from "../ViroNode";
import { useViroNode } from "../ViroUtils";
import {
  registerEventListener,
  unregisterEventListener,
} from "../../NativeViro";
import { ViroCommonProps, ViroObjectProps } from "./ViroCommonProps";
import { ViroAnchorFoundMap, ViroAnchorUpdatedMap } from "../Types/ViroEvents";

type Props = ViroCommonProps &
  ViroObjectProps & {
    anchorId?: string;
    minHeight?: number;
    minWidth?: number;
    alignment?:
      | "Horizontal"
      | "HorizontalUpward"
      | "HorizontalDownward"
      | "Vertical";
    onAnchorFound?: (anchorMap: ViroAnchorFoundMap) => void;
    onAnchorUpdated?: (anchorMap: ViroAnchorUpdatedMap) => void;
    onAnchorRemoved?: () => void;
  };

/**
 * Container for Viro Components anchored to a detected plane.
 */
export function ViroARPlane(props: Props): React.ReactElement {
  const {
    anchorId,
    minHeight,
    minWidth,
    alignment,
    onAnchorFound,
    onAnchorUpdated,
    onAnchorRemoved,
    children,
    ...rest
  } = props;

  // Create the node
  const nodeProps = {
    ...rest,
    anchorId,
    minHeight,
    minWidth,
    alignment,
  };

  const nodeId = useViroNode("arPlane", nodeProps);

  // Set up event listeners
  useEffect(() => {
    const anchorFoundCallbackId = onAnchorFound
      ? registerEventListener(nodeId, "onAnchorFound", (event) => {
          onAnchorFound(event.anchorFoundMap);
        })
      : null;

    const anchorUpdatedCallbackId = onAnchorUpdated
      ? registerEventListener(nodeId, "onAnchorUpdated", (event) => {
          onAnchorUpdated(event.anchorUpdatedMap);
        })
      : null;

    const anchorRemovedCallbackId = onAnchorRemoved
      ? registerEventListener(nodeId, "onAnchorRemoved", () => {
          onAnchorRemoved();
        })
      : null;

    // Clean up event listeners
    return () => {
      if (anchorFoundCallbackId) {
        unregisterEventListener(nodeId, "onAnchorFound", anchorFoundCallbackId);
      }
      if (anchorUpdatedCallbackId) {
        unregisterEventListener(
          nodeId,
          "onAnchorUpdated",
          anchorUpdatedCallbackId
        );
      }
      if (anchorRemovedCallbackId) {
        unregisterEventListener(
          nodeId,
          "onAnchorRemoved",
          anchorRemovedCallbackId
        );
      }
    };
  }, [nodeId, onAnchorFound, onAnchorUpdated, onAnchorRemoved]);

  // Render children within this node
  return (
    <ViroNode viroTag={nodeId} position={[0, 0, 0]}>
      {children}
    </ViroNode>
  );
}
