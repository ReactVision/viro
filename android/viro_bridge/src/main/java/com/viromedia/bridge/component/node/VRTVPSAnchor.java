//  Copyright © 2026 ReactVision. All rights reserved.
//
//  Permission is hereby granted, free of charge, to any person obtaining
//  a copy of this software and associated documentation files (the
//  "Software"), to deal in the Software without restriction, including
//  without limitation the rights to use, copy, modify, merge, publish,
//  distribute, sublicense, and/or sell copies of the Software, and to
//  permit persons to whom the Software is furnished to do so, subject to
//  the following conditions:
//
//  The above copyright notice and this permission notice shall be included
//  in all copies or substantial portions of the Software.
//
//  THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
//  EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
//  MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
//  IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
//  CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
//  TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
//  SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

package com.viromedia.bridge.component.node;

import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.ReactContext;
import com.facebook.react.bridge.WritableMap;
import com.viro.core.ARScene;
import com.viro.core.Node;
import com.viro.core.internal.VPSAnchorNode;
import com.viromedia.bridge.utility.ViroEventEmitter;
import com.viromedia.bridge.utility.ViroEvents;

/**
 * A node whose children are in the VPS map's frame (&lt;ViroVPSAnchor&gt;). The
 * renderer moves it with the map's transform every frame; it appears once VPS
 * localisation has converged.
 */
public class VRTVPSAnchor extends VRTNode implements VPSAnchorNode.Listener {

    private boolean mPlaced = false;

    public VRTVPSAnchor(ReactContext context) {
        super(context);
    }

    @Override
    protected Node createNodeJni() {
        VPSAnchorNode node = new VPSAnchorNode();
        node.setListener(this);
        return node;
    }

    // Under a VR root there is no VPS: the anchor stays hidden.
    @Override
    public void setScene(VRTScene scene) {
        super.setScene(scene);
        if (scene instanceof VRTARScene && scene.getNativeScene() instanceof ARScene
                && getNodeJni() instanceof VPSAnchorNode) {
            ((ARScene) scene.getNativeScene()).addVPSAnchorNode((VPSAnchorNode) getNodeJni());
        }
    }

    // Children appear, and their physics bodies simulate, only once placed.
    @Override
    public boolean shouldAppear() {
        return super.shouldAppear() && mPlaced;
    }

    @Override
    public void onPlacedChanged(boolean placed) {
        if (placed == mPlaced || isTornDown()) {
            return;
        }
        mPlaced = placed;
        handleAppearanceChange();
        WritableMap event = Arguments.createMap();
        event.putString("state", placed ? "tracking" : "hidden");
        ViroEventEmitter.emit(mReactContext, getId(), ViroEvents.ON_ANCHOR_STATE_CHANGE, event);
    }
}
