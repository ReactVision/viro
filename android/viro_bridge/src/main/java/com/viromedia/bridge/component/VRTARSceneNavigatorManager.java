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

package com.viromedia.bridge.component;

import android.util.Log;

import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReadableMap;
import com.facebook.react.common.MapBuilder;
import com.facebook.react.uimanager.ThemedReactContext;
import com.facebook.react.uimanager.annotations.ReactProp;

import java.util.Map;

/**
 * ARSceneNavigatorManager for building a {@link VRTARSceneNavigator}
 * corresponding to the ViroARNavigator.js control.
 */
public class VRTARSceneNavigatorManager extends VRTViroViewGroupManager<VRTARSceneNavigator> {

    public VRTARSceneNavigatorManager(ReactApplicationContext context) {
        super(context);
    }

    @Override
    public String getName() {
        return "VRTARSceneNavigator";
    }

    @Override
    protected VRTARSceneNavigator createViewInstance(ThemedReactContext reactContext) {
        return new VRTARSceneNavigator(reactContext);
    }

    @ReactProp(name = "currentSceneIndex")
    public void setCurrentSceneIndex(VRTARSceneNavigator view, int selectedIndex) {
        view.setCurrentSceneIndex(selectedIndex);
    }

    @ReactProp(name = "numberOfTrackedImages")
    public void setNumberOfTrackedImages(VRTARSceneNavigator navigator, int numberOfTrackedImages) {
        // no-op
    }

    @ReactProp(name = "autofocus", defaultBoolean = false)
    public void setAutoFocus(VRTARSceneNavigator navigator, boolean enabled) {
        navigator.setAutoFocusEnabled(enabled);
    }


    @ReactProp(name = "hdrEnabled", defaultBoolean = true)
    public void setHDREnabled(VRTARSceneNavigator navigator, boolean enabled) {
        navigator.setHDREnabled(enabled);
    }

    @ReactProp(name = "pbrEnabled", defaultBoolean = true)
    public void setPBREnabled(VRTARSceneNavigator navigator, boolean enabled) {
        navigator.setPBREnabled(enabled);
    }

    @ReactProp(name = "bloomEnabled", defaultBoolean = true)
    public void setBloomEnabled(VRTARSceneNavigator navigator, boolean enabled) {
        navigator.setBloomEnabled(enabled);
    }

    @ReactProp(name = "shadowsEnabled", defaultBoolean = true)
    public void setShadowsEnabled(VRTARSceneNavigator navigator, boolean enabled) {
        navigator.setShadowsEnabled(enabled);
    }

    @ReactProp(name = "multisamplingEnabled", defaultBoolean = true)
    public void setMultisamplingEnabled(VRTARSceneNavigator navigator, boolean enabled) {
        navigator.setMultisamplingEnabled(enabled);
    }

    @ReactProp(name = "occlusionMode")
    public void setOcclusionMode(VRTARSceneNavigator navigator, String mode) {
        navigator.setOcclusionMode(mode);
    }

    @ReactProp(name = "depthEnabled", defaultBoolean = false)
    public void setDepthEnabled(VRTARSceneNavigator navigator, boolean enabled) {
        navigator.setDepthEnabled(enabled);
    }

    @ReactProp(name = "cloudAnchorProvider")
    public void setCloudAnchorProvider(VRTARSceneNavigator navigator, String provider) {
        navigator.setCloudAnchorProvider(provider);
    }

    @ReactProp(name = "geospatialAnchorProvider")
    public void setGeospatialAnchorProvider(VRTARSceneNavigator navigator, String provider) {
        navigator.setGeospatialAnchorProvider(provider);
    }

    @ReactProp(name = "worldMeshEnabled", defaultBoolean = false)
    public void setWorldMeshEnabled(VRTARSceneNavigator navigator, boolean enabled) {
        navigator.setWorldMeshEnabled(enabled);
    }

    @ReactProp(name = "worldMeshConfig")
    public void setWorldMeshConfig(VRTARSceneNavigator navigator, ReadableMap config) {
        navigator.setWorldMeshConfig(config);
    }

    @Override
    public Map<String, Object> getExportedCustomDirectEventTypeConstants() {
        Map<String, Object> events = super.getExportedCustomDirectEventTypeConstants();
        if (events == null) {
            events = MapBuilder.newHashMap();
        }

        // Export the onTabSwitch event so React can listen to it
        // This event is emitted when a tab switch is detected (window reattach after detach)
        events.put("onTabSwitch", MapBuilder.of("registrationName", "onTabSwitch"));

        return events;
    }
}
