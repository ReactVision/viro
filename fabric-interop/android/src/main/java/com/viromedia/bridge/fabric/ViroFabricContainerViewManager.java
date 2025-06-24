package com.viromedia.bridge.fabric;

import android.util.Log;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;

import com.facebook.react.bridge.ReadableArray;
import com.facebook.react.bridge.UiThreadUtil;
import com.facebook.react.common.MapBuilder;
import com.facebook.react.module.annotations.ReactModule;
import com.facebook.react.uimanager.ThemedReactContext;
import com.facebook.react.uimanager.ViewManagerDelegate;
import com.facebook.react.uimanager.ViewGroupManager;
import com.facebook.react.viewmanagers.ViroFabricContainerViewManagerInterface;
import com.facebook.react.viewmanagers.ViroFabricContainerViewManagerDelegate;

import java.util.Map;

/**
 * ViewManager for the ViroFabricContainerView component.
 * This is the Fabric-specific implementation that uses the generated ViewManagerDelegate.
 */
@ReactModule(name = ViroFabricContainerViewManager.REACT_CLASS)
public class ViroFabricContainerViewManager extends ViewGroupManager<ViroFabricContainer>
        implements ViroFabricContainerViewManagerInterface<ViroFabricContainer> {

    public static final String REACT_CLASS = "ViroFabricContainerView";
    private static final String TAG = "ViroFabricViewManager";

    // Commands
    public static final String COMMAND_INITIALIZE = "initialize";
    public static final String COMMAND_CLEANUP = "cleanup";

    private final ViewManagerDelegate<ViroFabricContainer> mDelegate;

    public ViroFabricContainerViewManager() {
        mDelegate = new ViroFabricContainerViewManagerDelegate<>(this);
    }

    @Override
    public String getName() {
        return REACT_CLASS;
    }

    @Override
    protected ViroFabricContainer createViewInstance(ThemedReactContext reactContext) {
        Log.d(TAG, "Creating ViroFabricContainer instance");
        return new ViroFabricContainer(reactContext);
    }

    @Override
    public void onDropViewInstance(ViroFabricContainer view) {
        Log.d(TAG, "Dropping ViroFabricContainer instance");
        UiThreadUtil.runOnUiThread(() -> {
            try {
                view.cleanup();
                super.onDropViewInstance(view);
            } catch (Exception e) {
                Log.e(TAG, "Error dropping ViroFabricContainer instance", e);
            }
        });
    }

    @Override
    public ViewManagerDelegate<ViroFabricContainer> getDelegate() {
        return mDelegate;
    }

    @Nullable
    @Override
    public Map<String, Object> getExportedCustomDirectEventTypeConstants() {
        return MapBuilder.<String, Object>builder()
                .put("onInitialized", MapBuilder.of("registrationName", "onInitialized"))
                .put("onTrackingUpdated", MapBuilder.of("registrationName", "onTrackingUpdated"))
                .put("onCameraTransformUpdate", MapBuilder.of("registrationName", "onCameraTransformUpdate"))
                .build();
    }

    @Nullable
    @Override
    public Map<String, Object> getCommandsMap() {
        return MapBuilder.<String, Object>builder()
                .put(COMMAND_INITIALIZE, 1)
                .put(COMMAND_CLEANUP, 2)
                .build();
    }

    @Override
    public void receiveCommand(@NonNull ViroFabricContainer view, String commandId, @Nullable ReadableArray args) {
        Log.d(TAG, "Received command: " + commandId);
        mDelegate.receiveCommand(view, commandId, args);
    }

    // Note: This method signature needs to match the interface
    // If the interface expects apiKey, we need to update our ViroFabricContainer.java
    // For now, let's implement both versions for compatibility
    public void initialize(ViroFabricContainer view, String apiKey, boolean debug, boolean arEnabled, String worldAlignment) {
        Log.d(TAG, "Initializing ViroFabricContainer with apiKey (legacy)");
        UiThreadUtil.runOnUiThread(() -> {
            try {
                // Ignore apiKey for now since our implementation doesn't use it
                view.initialize(debug, arEnabled, worldAlignment);
            } catch (Exception e) {
                Log.e(TAG, "Error initializing ViroFabricContainer", e);
            }
        });
    }
    
    @Override
    public void initialize(ViroFabricContainer view, boolean debug, boolean arEnabled, String worldAlignment) {
        Log.d(TAG, "Initializing ViroFabricContainer");
        UiThreadUtil.runOnUiThread(() -> {
            try {
                view.initialize(debug, arEnabled, worldAlignment);
            } catch (Exception e) {
                Log.e(TAG, "Error initializing ViroFabricContainer", e);
            }
        });
    }

    @Override
    public void cleanup(ViroFabricContainer view) {
        Log.d(TAG, "Cleaning up ViroFabricContainer");
        UiThreadUtil.runOnUiThread(() -> {
            try {
                view.cleanup();
            } catch (Exception e) {
                Log.e(TAG, "Error cleaning up ViroFabricContainer", e);
            }
        });
    }
}
