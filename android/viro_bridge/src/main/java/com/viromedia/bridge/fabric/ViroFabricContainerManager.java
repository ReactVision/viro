package com.viromedia.bridge.fabric;

import android.util.Log;
import android.view.View;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;

import com.facebook.react.bridge.ReadableArray;
import com.facebook.react.bridge.UiThreadUtil;
import com.facebook.react.common.MapBuilder;
import com.facebook.react.module.annotations.ReactModule;
import com.facebook.react.uimanager.ThemedReactContext;
import com.facebook.react.uimanager.ViewGroupManager;
import com.facebook.react.uimanager.annotations.ReactProp;
import com.facebook.react.bridge.ReactApplicationContext;

import java.util.Map;

/**
 * ViewManager for the ViroFabricContainer component.
 */
@ReactModule(name = ViroFabricContainerManager.REACT_CLASS)
public class ViroFabricContainerManager extends ViewGroupManager<ViroFabricContainer> {

    public static final String REACT_CLASS = "ViroFabricContainer";
    private static final String TAG = "ViroFabricManager";

    // Commands
    private static final int COMMAND_INITIALIZE = 1;
    private static final int COMMAND_CLEANUP = 2;
    
    private final ReactApplicationContext reactContext;
    
    public ViroFabricContainerManager(ReactApplicationContext reactContext) {
        this.reactContext = reactContext;
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
    public Map<String, Integer> getCommandsMap() {
        return MapBuilder.of(
                "initialize", COMMAND_INITIALIZE,
                "cleanup", COMMAND_CLEANUP
        );
    }

    @Override
    public void receiveCommand(@NonNull ViroFabricContainer view, String commandId, @Nullable ReadableArray args) {
        Log.d(TAG, "Received command: " + commandId);
        try {
            int commandIdInt = Integer.parseInt(commandId);
            executeCommand(view, commandIdInt, args);
        } catch (NumberFormatException e) {
            Log.e(TAG, "Invalid command ID: " + commandId, e);
        }
    }

    @Override
    public void receiveCommand(@NonNull ViroFabricContainer view, int commandId, @Nullable ReadableArray args) {
        Log.d(TAG, "Received command: " + commandId);
        executeCommand(view, commandId, args);
    }
    
    /**
     * Execute a command on the view.
     */
    private void executeCommand(@NonNull ViroFabricContainer view, int commandId, @Nullable ReadableArray args) {
        UiThreadUtil.runOnUiThread(() -> {
            try {
                switch (commandId) {
                    case COMMAND_INITIALIZE:
                        if (args != null) {
                            boolean debug = args.getBoolean(0);
                            boolean arEnabled = args.getBoolean(1);
                            String worldAlignment = args.getString(2);
                            view.initialize(debug, arEnabled, worldAlignment);
                        }
                        break;
                    case COMMAND_CLEANUP:
                        view.cleanup();
                        break;
                    default:
                        Log.w(TAG, "Unknown command ID: " + commandId);
                        break;
                }
            } catch (Exception e) {
                Log.e(TAG, "Error executing command: " + commandId, e);
            }
        });
    }
}
