/**
 * Web implementation of ViroButton — a ViroImage whose source swaps on
 * hover/click and forwards onClick. Mirrors native: hoverSource (a.k.a.
 * gazeSource) and clickSource (a.k.a. tapSource) fall back to `source`.
 */
import * as React from "react";
import { useState } from "react";
import { ViroClickState } from "@reactvision/viro-web-renderer";
import { ViroImage } from "./ViroImage.web";

type Props = {
  source: unknown;
  hoverSource?: unknown;
  gazeSource?: unknown;
  clickSource?: unknown;
  tapSource?: unknown;
  width?: number;
  height?: number;
  onClick?: (position: [number, number, number], source: number) => void;
  [key: string]: any;
};

export function ViroButton(props: Props) {
  const [hovering, setHovering] = useState(false);
  const [pressed, setPressed] = useState(false);

  const hoverSource = props.hoverSource ?? props.gazeSource;
  const clickSource = props.clickSource ?? props.tapSource;

  const source =
    pressed && clickSource ? clickSource : hovering && hoverSource ? hoverSource : props.source;

  return (
    <ViroImage
      {...props}
      source={source}
      onHover={(isHovering) => setHovering(isHovering)}
      onClickState={(clickState) => {
        setPressed(clickState === ViroClickState.ClickDown);
      }}
      onClick={props.onClick}
    />
  );
}
