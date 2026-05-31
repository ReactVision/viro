//
//  VRTCameraTextureManager.java
//  ViroReact
//
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

package com.viromedia.bridge.component;

import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.common.MapBuilder;
import com.facebook.react.uimanager.ThemedReactContext;
import com.facebook.react.uimanager.annotations.ReactProp;
import com.viromedia.bridge.utility.ViroEvents;

import java.util.Map;

/**
 * React Native ViewManager for {@link VRTCameraTexture}.
 *
 * Registers the component as "VRTCameraTexture" and exposes the three props
 * (material, cameraPosition, paused) plus the two direct events
 * (onCameraReadyViro, onErrorViro).
 */
public class VRTCameraTextureManager extends VRTViroViewGroupManager<VRTCameraTexture> {

    public VRTCameraTextureManager(ReactApplicationContext context) {
        super(context);
    }

    @Override
    protected VRTCameraTexture createViewInstance(ThemedReactContext reactContext) {
        return new VRTCameraTexture(reactContext);
    }

    @Override
    public String getName() {
        return "VRTCameraTexture";
    }

    // -----------------------------------------------------------------------
    // Props
    // -----------------------------------------------------------------------

    @ReactProp(name = "material")
    public void setMaterial(VRTCameraTexture view, String material) {
        view.setMaterial(material);
    }

    @ReactProp(name = "cameraPosition")
    public void setCameraPosition(VRTCameraTexture view, String position) {
        view.setCameraPosition(position);
    }

    @ReactProp(name = "paused", defaultBoolean = false)
    public void setPaused(VRTCameraTexture view, boolean paused) {
        view.setPaused(paused);
    }

    // -----------------------------------------------------------------------
    // Events
    // -----------------------------------------------------------------------

    @Override
    public Map getExportedCustomDirectEventTypeConstants() {
        return MapBuilder.of(
            ViroEvents.ON_CAMERA_READY,
                MapBuilder.of("registrationName", ViroEvents.ON_CAMERA_READY),
            ViroEvents.ON_ERROR,
                MapBuilder.of("registrationName", ViroEvents.ON_ERROR)
        );
    }
}
