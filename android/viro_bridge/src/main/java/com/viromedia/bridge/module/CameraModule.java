//  Copyright © 2017 Viro Media. All rights reserved.
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

package com.viromedia.bridge.module;

import android.view.View;

import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.WritableArray;
import com.facebook.react.bridge.UIManager;
import com.facebook.react.fabric.FabricUIManager;
import com.facebook.react.uimanager.UIManagerHelper;
import com.facebook.react.module.annotations.ReactModule;
import com.viro.core.internal.CameraCallback;
import com.viromedia.bridge.component.node.VRTScene;

@ReactModule(name = "VRTCameraModule")
public class CameraModule extends ReactContextBaseJavaModule {

    public CameraModule(ReactApplicationContext context) {
        super(context);
    }

    @Override
    public String getName() {
        return "VRTCameraModule";
    }

    // https://stackoverflow.com/a/44879687
    @Override
    public boolean canOverrideExistingModule() {
        return true;
    }

    @ReactMethod
    public void getCameraOrientation(final int sceneTag, final Promise promise) {
        UIManager uiManager = UIManagerHelper.getUIManager(getReactApplicationContext(), sceneTag);
        if (uiManager == null) {
            promise.reject("ERROR", "UIManager not available");
            return;
        }
        ((FabricUIManager) uiManager).addUIBlock(new com.facebook.react.fabric.interop.UIBlock() {
            @Override
            public void execute(com.facebook.react.fabric.interop.UIBlockViewResolver viewResolver) {
                View sceneView = viewResolver.resolveView(sceneTag);
                if (sceneView instanceof VRTScene) {
                    VRTScene scene = (VRTScene) sceneView;

                    scene.getCameraPositionAsync(new CameraCallback() {
                        @Override
                        public void onGetCameraOrientation(float posX, float poxY, float posZ,
                                                           float rotEulerX, float rotEulerY, float rotEulerZ,
                                                           float forwardX, float forwardY, float forwardZ,
                                                           float upX, float upY, float upZ) {
                            WritableArray array = Arguments.createArray();
                            array.pushDouble(posX);
                            array.pushDouble(poxY);
                            array.pushDouble(posZ);
                            array.pushDouble(Math.toDegrees(rotEulerX));
                            array.pushDouble(Math.toDegrees(rotEulerY));
                            array.pushDouble(Math.toDegrees(rotEulerZ));
                            array.pushDouble(forwardX);
                            array.pushDouble(forwardY);
                            array.pushDouble(forwardZ);
                            array.pushDouble(upX);
                            array.pushDouble(upY);
                            array.pushDouble(upZ);
                            promise.resolve(array);
                        }
                    });
                }


            }
        });
    }

    /*
     Only the scene is looked up here. The camera is named by tag and the scene attaches it
     itself, now if it is in the tree and otherwise as it joins (see VRTScene.setActiveCameraTag).
     ViroScene sends the same tag as a prop; these methods remain for callers of the module.
     */
    @ReactMethod
    public void setSceneCamera(final int sceneTag, final int cameraTag) {
        UIManager uiManager = UIManagerHelper.getUIManager(getReactApplicationContext(), sceneTag);
        if (uiManager == null) {
            return;
        }
        ((FabricUIManager) uiManager).addUIBlock(new com.facebook.react.fabric.interop.UIBlock() {
            @Override
            public void execute(com.facebook.react.fabric.interop.UIBlockViewResolver viewResolver) {
                View sceneView = viewResolver.resolveView(sceneTag);
                if (sceneView instanceof VRTScene) {
                    ((VRTScene) sceneView).setActiveCameraTag(cameraTag);
                }
            }
        });
    }

    @ReactMethod
    public void removeSceneCamera(final int sceneTag, final int cameraTag) {
        UIManager uiManager = UIManagerHelper.getUIManager(getReactApplicationContext(), sceneTag);
        if (uiManager == null) {
            return;
        }
        ((FabricUIManager) uiManager).addUIBlock(new com.facebook.react.fabric.interop.UIBlock() {
            @Override
            public void execute(com.facebook.react.fabric.interop.UIBlockViewResolver viewResolver) {
                View sceneView = viewResolver.resolveView(sceneTag);
                // Only the camera the scene was last asked for can take it back to the default camera.
                if (sceneView instanceof VRTScene && ((VRTScene) sceneView).getActiveCameraTag() == cameraTag) {
                    ((VRTScene) sceneView).setActiveCameraTag(0);
                }
            }
        });
    }
}
