package com.viromedia.bridge.fabric;

import com.facebook.react.ReactPackage;
import com.facebook.react.bridge.NativeModule;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.uimanager.ViewManager;

import java.util.Arrays;
import java.util.Collections;
import java.util.List;

/**
 * ViroFabricPackage provides the React Native package registration for Viro Fabric components.
 * This enables React Native to discover and use the ViroFabricContainer component.
 */
public class ViroFabricPackage implements ReactPackage {

    @Override
    public List<NativeModule> createNativeModules(ReactApplicationContext reactContext) {
        // No native modules needed for the Fabric container
        // All functionality is provided through the ViewManager
        return Collections.emptyList();
    }

    @Override
    public List<ViewManager> createViewManagers(ReactApplicationContext reactContext) {
        return Arrays.<ViewManager>asList(
            new ViroFabricContainerViewManager()
        );
    }
}
