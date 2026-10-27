/**
 * Copyright © 2026 ReactVision
 *
 * @providesModule ViroVPSAnchor
 */

"use strict";

import * as React from "react";
import { NativeSyntheticEvent, requireNativeComponent } from "react-native";
import { isVisionOS } from "../Utilities/ViroPlatform";
import { warnUnsupported } from "../Utilities/ViroUnsupported";

export type ViroVPSAnchorState = "hidden" | "tracking";

export type ViroVPSAnchorStateEvent = {
  /** `tracking` once VPS localisation has placed the map; `hidden` before that and after it is lost or stopped. */
  state: ViroVPSAnchorState;
};

export type ViroVPSAnchorProps = {
  /** Content in the VPS map's frame: metres, Y up, the frame of the location's map and mesh. */
  children?: React.ReactNode;
  /** The app's own visibility; the anchor also stays hidden until it is placed. Default true. */
  visible?: boolean;
  renderingOrder?: number;
  viroTag?: string;
  onAnchorStateChange?: (event: ViroVPSAnchorStateEvent) => void;
};

/**
 * Places its children in the VPS map's frame.
 *
 * Inside a `<ViroARScene>` with a `<ViroVPS>` tracking a location, the
 * renderer moves this node with the map-to-world transform that VPS
 * localisation converges on, every frame, the same one the location's mesh
 * follows. So a child at `position={[1, 0, -2]}` sits 1 m along the map's X
 * and 2 m along its -Z, wherever the device started its session, and in the
 * same spot for every device and every session.
 *
 * The anchor stays hidden (children not rendered, their physics not
 * simulated) until localisation converges, and hides again when tracking
 * stops or its map is unloaded. It has no transform props of its own: the
 * renderer owns its transform.
 *
 * ```tsx
 * <ViroARScene>
 *   <ViroVPS ref={vpsRef} arSceneNavigator={nav} endpoint={url} credentials={creds} />
 *   <ViroVPSAnchor onAnchorStateChange={(e) => setPlaced(e.state === "tracking")}>
 *     <Viro3DObject source={statue} type="GLB" position={[1, 0, -2]} />
 *   </ViroVPSAnchor>
 * </ViroARScene>
 * ```
 */
export class ViroVPSAnchor extends React.Component<ViroVPSAnchorProps> {
  _onAnchorStateChange = (event: NativeSyntheticEvent<ViroVPSAnchorStateEvent>) => {
    const state = event?.nativeEvent?.state;
    if (state === "tracking" || state === "hidden") {
      this.props.onAnchorStateChange?.({ state });
    }
  };

  render() {
    // visionOS carries no AR session, so there is no VPS to place this.
    if (isVisionOS) {
      warnUnsupported("ViroVPSAnchor", "Apple Vision Pro", "VPS localisation needs an ARKit or ARCore session.");
      return null;
    }
    return (
      <VRTVPSAnchor
        visible={this.props.visible ?? true}
        renderingOrder={this.props.renderingOrder}
        viroTag={this.props.viroTag}
        onAnchorStateChangeViro={this._onAnchorStateChange}
      >
        {this.props.children}
      </VRTVPSAnchor>
    );
  }
}

const VRTVPSAnchor = requireNativeComponent<any>("VRTVPSAnchor");
