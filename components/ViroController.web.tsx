/**
 * ViroController.web.tsx
 *
 * The scene-wide input handlers. On the web the controller is the pointer (and
 * the screen centre for fuse), so onClick, onClickState, onPinch, onRotate,
 * onFuse and onDrag are delivered; a click that hits nothing reports position []
 * as Android does. onTouch, onScroll, onSwipe and onControllerStatus come from a
 * hand controller, which the web has none of.
 *
 * Copyright © 2026 ReactVision. All rights reserved.
 */
import * as React from "react";
import { useEffect, useRef } from "react";
import { ViroClickState, type ViroSceneApi } from "@reactvision/viro-web-renderer";
import { useViroRenderer } from "./Web/ViroWebContext";
import { onControllerDrag } from "./Web/useViroNode";
import { cameraOrientationAsync } from "./Web/viroCameraTransform";
import { warnUnsupported } from "./Utilities/ViroUnsupported";

const DEG2RAD = Math.PI / 180;

export class ViroController extends React.Component<any> {
  _scene: ViroSceneApi | null = null;

  async getControllerForwardAsync() {
    if (!this._scene) return null;
    return (await cameraOrientationAsync(this._scene)).forward;
  }

  /** The pointer's ray starts at the camera on the web. */
  async getControllerRayAsync(_source?: number) {
    if (!this._scene) return null;
    const { position, forward } = await cameraOrientationAsync(this._scene);
    return { origin: position, forward };
  }

  setNativeProps(_nativeProps: any) {}

  render() {
    return <ViroControllerEvents {...this.props} owner={this} />;
  }
}

function ViroControllerEvents(props: any) {
  const renderer = useViroRenderer();
  const scene = renderer.scene;
  const owner: ViroController = props.owner;
  owner._scene = scene;
  const propsRef = useRef(props);
  propsRef.current = props;

  const hasClick = !!(props.onClick || props.onClickState);
  const hasPinch = !!props.onPinch;
  const hasRotate = !!props.onRotate;
  const hasFuse = props.onFuse != undefined;
  const hasDrag = !!props.onDrag;
  const hasControllerOnly = !!(props.onTouch || props.onScroll || props.onSwipe || props.onControllerStatus);

  useEffect(() => {
    if (hasControllerOnly) {
      warnUnsupported("ViroController onTouch, onScroll, onSwipe and onControllerStatus", "the web");
    }
  }, [hasControllerOnly]);

  useEffect(() => {
    if (!hasClick && !hasPinch && !hasRotate && !hasFuse) return;
    const p = () => propsRef.current;
    const set = renderer.setControllerEventHandlers?.(owner, {
      onClick: hasClick
        ? (state, source, position) => {
            p().onClickState?.(state, position, source);
            if (state === ViroClickState.Clicked) p().onClick?.(position, source);
          }
        : undefined,
      onPinch: hasPinch ? (state, scale, source) => p().onPinch?.(state, scale, source) : undefined,
      onRotate: hasRotate ? (state, radians, source) => p().onRotate?.(state, radians / DEG2RAD, source) : undefined,
      onFuse: hasFuse
        ? (source) => {
            const fuse = p().onFuse;
            if (typeof fuse === "function") fuse(source);
            else fuse?.callback?.(source);
          }
        : undefined,
    });
    if (!set) {
      warnUnsupported("ViroController with this build of the web renderer", "the web");
      return;
    }
    return () => renderer.clearControllerEventHandlers(owner);
  }, [renderer, owner, hasClick, hasPinch, hasRotate, hasFuse]);

  useEffect(() => {
    if (!hasDrag) return;
    return onControllerDrag(scene, (to, source) => propsRef.current.onDrag?.(to, source));
  }, [scene, hasDrag]);

  return null;
}
