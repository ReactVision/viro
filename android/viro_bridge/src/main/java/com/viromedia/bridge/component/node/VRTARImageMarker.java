//  Copyright © 2018 Viro Media. All rights reserved.
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

import com.facebook.react.bridge.ReactContext;
import com.viro.core.ARImageTarget;
import com.viro.core.ARScene;
import com.viro.core.Node;
import com.viro.core.internal.ARDeclarativeImageNode;
import com.viromedia.bridge.module.ARTrackingTargetsModule;

public class VRTARImageMarker extends VRTARNode {

    private String mTargetName;
    private boolean mShouldUpdate = false;
    private boolean mNeedsAddToScene = true;

    public VRTARImageMarker(ReactContext context) {
        super(context);
    }

    protected Node createNodeJni() {
        ARDeclarativeImageNode arImageNode = new ARDeclarativeImageNode();
        arImageNode.setDelegate(this);
        return arImageNode;
    }

    public void setTarget(String target) {
        android.util.Log.d("ViroARImageMarker", "setTarget called with: " + target);
        mTargetName = target;
        mShouldUpdate = true;
    }

    @Override
    public void setScene(VRTScene scene) {
        super.setScene(scene);

        // If the scene is finally set, then just invoke onPropsSet again to fetch the target
        // and add the ARDeclarativeImageNode to the ARScene.
        onPropsSet();
    }

    @Override
    public void onPropsSet() {
        android.util.Log.d("ViroARImageMarker", "onPropsSet called - mShouldUpdate: " + mShouldUpdate + ", mScene: " + (mScene != null ? "set" : "null") + ", mTargetName: " + mTargetName);
        if (mShouldUpdate && mScene != null) {
            android.util.Log.d("ViroARImageMarker", "Calling updateARDeclarativeImageNode, mNeedsAddToScene: " + mNeedsAddToScene);
            updateARDeclarativeImageNode(mNeedsAddToScene);
            mShouldUpdate = false;
            // we should only add to the scene on the first invocation of updateARDeclarativeImageNode,
            // otherwise just update.
            mNeedsAddToScene = false;
        }
    }

    /**
     * This function fetches the target and either creates a new ARDeclarativeImageNode or
     * updates it with the new target.
     *
     * @param shouldAddToScene whether or not this should add or update an existing
     *                         ARDeclarativeImageNode
     */
    private void updateARDeclarativeImageNode(final boolean shouldAddToScene) {
        android.util.Log.d("ViroARImageMarker", "updateARDeclarativeImageNode called for target: " + mTargetName);
        ARTrackingTargetsModule trackingTargetsModule = getReactContext().getNativeModule(ARTrackingTargetsModule.class);
        // Register interest in the target by name. If it is already registered the listener
        // fires (now or when its image finishes downloading); if it is not registered yet
        // (e.g. createTargets runs in a useEffect after this marker mounts — a common race),
        // the module queues the listener and fires it once createTargets registers the target.
        // This must never throw: this runs inside a Fabric prop update and an unhandled
        // exception would tear down the ReactHost and crash the app (GitHub #478).
        trackingTargetsModule.addTargetPromiseListener(mTargetName,
            new ARTrackingTargetsModule.ARTargetPromiseListener() {
                @Override
                public void onComplete(String key, ARImageTarget newTarget) {
                    android.util.Log.d("ViroARImageMarker", "Promise onComplete - key: " + key + ", newTarget: " + (newTarget != null ? "valid" : "NULL"));
                    // The listener may fire after the marker/scene was torn down (deferred
                    // registration, navigation away). Guard against a null scene.
                    if (mScene == null) {
                        return;
                    }
                    ARDeclarativeImageNode imageNode = (ARDeclarativeImageNode) getNodeJni();
                    android.util.Log.d("ViroARImageMarker", "imageNode: " + (imageNode != null ? "valid" : "NULL"));
                    if (imageNode != null) {
                        ARImageTarget oldTarget = imageNode.getARImageTarget();
                        imageNode.setARImageTarget(newTarget);
                        ARScene arScene = (ARScene) mScene.getNativeScene();
                        android.util.Log.d("ViroARImageMarker", "arScene: " + (arScene != null ? "valid" : "NULL"));
                        if (arScene != null) {
                            if (shouldAddToScene) {
                                // add the node
                                android.util.Log.d("ViroARImageMarker", "Adding ARDeclarativeNode to scene");
                                arScene.addARDeclarativeNode(imageNode);
                            } else {
                                // remove old ARImageTarget and update the ARNode
                                if (oldTarget != null) {
                                    arScene.removeARImageTargetDeclarative(oldTarget);
                                }
                                arScene.updateARDeclarativeNode(imageNode);
                            }
                            // always add the ARImageTarget
                            android.util.Log.d("ViroARImageMarker", "Adding ARImageTargetDeclarative to scene");
                            arScene.addARImageTargetDeclarative(newTarget);
                        }
                    }
                }

                @Override
                public void onError(Exception e) {
                    // Never rethrow here: this callback runs on the main thread inside a
                    // Fabric prop update, so an unhandled exception tears down the ReactHost
                    // and crashes the whole app under the New Architecture (GitHub #478).
                    android.util.Log.e("ViroARImageMarker",
                        "ARImageMarker - unable to fetch target [" + mTargetName + "]", e);
                }
            });
    }
}
