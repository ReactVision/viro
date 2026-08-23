/**
 * Web implementation of ViroARPlane. Binds to a detected plane (an anchor from
 * the AR session) and renders its children in that plane's local space. Matching
 * is either explicit (anchorId) or automatic (largest unclaimed plane meeting
 * minWidth/minHeight and the requested alignment); the enclosing ViroARScene
 * coordinates claims so two auto planes don't grab the same anchor.
 *
 * The bound node's transform is driven by the anchor each frame; when nothing is
 * matched the node is hidden. onAnchorFound/Updated/Removed fire on transitions.
 */
import * as React from "react";
import { useContext, useEffect, useMemo, useRef, useState } from "react";
import type { ArPlaneAnchor } from "@reactvision/viro-web-renderer";
import {
  useViroAR,
  ViroParentNodeContext,
  ViroARPlaneClaimsContext,
} from "../Web/ViroWebContext";
import { useViroNode, type ViroWebNodeProps } from "../Web/useViroNode";
import { anchorToViro, type ViroWebAnchor } from "./ViroARScene.web";

type Props = ViroWebNodeProps & {
  anchorId?: string;
  minWidth?: number;
  minHeight?: number;
  alignment?: "Horizontal" | "HorizontalUpward" | "HorizontalDownward" | "Vertical";
  onAnchorFound?: (anchor: ViroWebAnchor) => void;
  onAnchorUpdated?: (anchor: ViroWebAnchor) => void;
  onAnchorRemoved?: () => void;
  children?: React.ReactNode;
  [key: string]: any;
};

let nextPlaneId = 1;

function alignmentMatches(anchor: ArPlaneAnchor, want?: Props["alignment"]): boolean {
  if (!want || want === "Horizontal") {
    return anchor.alignment === "HorizontalUpward" || anchor.alignment === "HorizontalDownward";
  }
  return anchor.alignment === want;
}

export function ViroARPlane(props: Props) {
  const { anchors } = useViroAR();
  const claims = useContext(ViroARPlaneClaimsContext);
  const componentId = useRef(`plane-${nextPlaneId++}`).current;

  const [matchedId, setMatchedId] = useState<string | null>(null);

  // Candidate anchors (alignment + min size), largest first.
  const candidateIds = useMemo(() => {
    const minW = props.minWidth ?? 0;
    const minH = props.minHeight ?? 0;
    return anchors
      .filter((a) => alignmentMatches(a, props.alignment) && a.width >= minW && a.height >= minH)
      .sort((a, b) => b.width * b.height - a.width * a.height)
      .map((a) => a.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anchors, props.alignment, props.minWidth, props.minHeight]);

  // Resolve the match: explicit anchorId, else claim an auto candidate.
  useEffect(() => {
    if (props.anchorId) {
      setMatchedId(anchors.some((a) => a.id === props.anchorId) ? props.anchorId : null);
      return;
    }
    const picked = claims ? claims.claim(componentId, candidateIds) : (candidateIds[0] ?? null);
    setMatchedId(picked);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candidateIds, props.anchorId, anchors]);

  // Release the claim on unmount.
  useEffect(() => {
    return () => claims?.release(componentId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const matched = matchedId ? anchors.find((a) => a.id === matchedId) ?? null : null;

  // Drive the node transform from the matched anchor; hide when unmatched.
  const nodeProps: ViroWebNodeProps = {
    ...props,
    position: matched ? matched.center : [0, 0, 0],
    rotation: matched ? matched.rotation : [0, 0, 0],
    visible: matched ? props.visible ?? true : false,
  };
  const node = useViroNode(nodeProps);

  // onAnchorFound / onAnchorUpdated / onAnchorRemoved transitions.
  const propsRef = useRef(props);
  propsRef.current = props;
  const prevMatchRef = useRef<string | null>(null);
  useEffect(() => {
    const prev = prevMatchRef.current;
    const p = propsRef.current;
    if (matched) {
      if (prev !== matched.id) p.onAnchorFound?.(anchorToViro(matched));
      else p.onAnchorUpdated?.(anchorToViro(matched));
    } else if (prev) {
      p.onAnchorRemoved?.();
    }
    prevMatchRef.current = matched ? matched.id : null;
  }, [matched]);

  return <ViroParentNodeContext.Provider value={node}>{props.children}</ViroParentNodeContext.Provider>;
}
