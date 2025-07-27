package com.viromedia.bridge.fabric;

import android.util.Log;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;

import com.facebook.react.bridge.ReadableArray;
import com.facebook.react.bridge.ReadableMap;
import com.facebook.react.bridge.UiThreadUtil;
import com.facebook.react.common.MapBuilder;
import com.facebook.react.module.annotations.ReactModule;
import com.facebook.react.uimanager.ThemedReactContext;
import com.facebook.react.uimanager.ViewGroupManager;
import com.facebook.react.uimanager.annotations.ReactProp;

import java.util.Map;

/**
 * ViewManager for the ViroFabricContainerView component.
 * This is the complete Fabric implementation with full functionality.
 */
@ReactModule(name = ViroFabricContainerViewManager.REACT_CLASS)
public class ViroFabricContainerViewManager extends ViewGroupManager<ViroFabricContainer> {

    public static final String REACT_CLASS = "ViroFabricContainerView";
    private static final String TAG = "ViroFabricViewManager";

    // Commands - Complete set
    public static final String COMMAND_INITIALIZE = "initialize";
    public static final String COMMAND_CLEANUP = "cleanup";
    public static final String COMMAND_CREATE_COMPONENT = "createComponent";
    public static final String COMMAND_UPDATE_COMPONENT = "updateComponent";
    public static final String COMMAND_DELETE_COMPONENT = "deleteComponent";
    public static final String COMMAND_ADD_CHILD = "addChild";
    public static final String COMMAND_REMOVE_CHILD = "removeChild";
    public static final String COMMAND_REGISTER_EVENT_CALLBACK = "registerEventCallback";
    public static final String COMMAND_UNREGISTER_EVENT_CALLBACK = "unregisterEventCallback";
    public static final String COMMAND_CREATE_MATERIAL = "createMaterial";
    public static final String COMMAND_CREATE_ANIMATION = "createAnimation";
    public static final String COMMAND_EXECUTE_ANIMATION = "executeAnimation";
    public static final String COMMAND_SET_AR_PLANE_DETECTION = "setARPlaneDetection";
    public static final String COMMAND_SET_AR_IMAGE_TARGETS = "setARImageTargets";

    public ViroFabricContainerViewManager() {
        super();
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
                .put("onSceneStateChanged", MapBuilder.of("registrationName", "onSceneStateChanged"))
                .put("onMemoryWarning", MapBuilder.of("registrationName", "onMemoryWarning"))
                .put("ViroEvent", MapBuilder.of("registrationName", "ViroEvent"))
                .build();
    }

    @Nullable
    @Override
    public Map<String, Integer> getCommandsMap() {
        return MapBuilder.<String, Integer>builder()
                .put(COMMAND_INITIALIZE, 1)
                .put(COMMAND_CLEANUP, 2)
                .put(COMMAND_CREATE_COMPONENT, 3)
                .put(COMMAND_UPDATE_COMPONENT, 4)
                .put(COMMAND_DELETE_COMPONENT, 5)
                .put(COMMAND_ADD_CHILD, 6)
                .put(COMMAND_REMOVE_CHILD, 7)
                .put(COMMAND_REGISTER_EVENT_CALLBACK, 8)
                .put(COMMAND_UNREGISTER_EVENT_CALLBACK, 9)
                .put(COMMAND_CREATE_MATERIAL, 10)
                .put(COMMAND_CREATE_ANIMATION, 11)
                .put(COMMAND_EXECUTE_ANIMATION, 12)
                .put(COMMAND_SET_AR_PLANE_DETECTION, 13)
                .put(COMMAND_SET_AR_IMAGE_TARGETS, 14)
                .build();
    }

    @Override
    public void receiveCommand(@NonNull ViroFabricContainer view, String commandId, @Nullable ReadableArray args) {
        Log.d(TAG, "Received command: " + commandId);
        
        UiThreadUtil.runOnUiThread(() -> {
            try {
                switch (commandId) {
                    case COMMAND_INITIALIZE:
                        handleInitialize(view, args);
                        break;
                    case COMMAND_CLEANUP:
                        handleCleanup(view);
                        break;
                    case COMMAND_CREATE_COMPONENT:
                        handleCreateComponent(view, args);
                        break;
                    case COMMAND_UPDATE_COMPONENT:
                        handleUpdateComponent(view, args);
                        break;
                    case COMMAND_DELETE_COMPONENT:
                        handleDeleteComponent(view, args);
                        break;
                    case COMMAND_ADD_CHILD:
                        handleAddChild(view, args);
                        break;
                    case COMMAND_REMOVE_CHILD:
                        handleRemoveChild(view, args);
                        break;
                    case COMMAND_REGISTER_EVENT_CALLBACK:
                        handleRegisterEventCallback(view, args);
                        break;
                    case COMMAND_UNREGISTER_EVENT_CALLBACK:
                        handleUnregisterEventCallback(view, args);
                        break;
                    case COMMAND_CREATE_MATERIAL:
                        handleCreateMaterial(view, args);
                        break;
                    case COMMAND_CREATE_ANIMATION:
                        handleCreateAnimation(view, args);
                        break;
                    case COMMAND_EXECUTE_ANIMATION:
                        handleExecuteAnimation(view, args);
                        break;
                    case COMMAND_SET_AR_PLANE_DETECTION:
                        handleSetARPlaneDetection(view, args);
                        break;
                    case COMMAND_SET_AR_IMAGE_TARGETS:
                        handleSetARImageTargets(view, args);
                        break;
                    default:
                        Log.w(TAG, "Unknown command: " + commandId);
                        break;
                }
            } catch (Exception e) {
                Log.e(TAG, "Error executing command " + commandId, e);
            }
        });
    }

    // Command handlers with enhanced error handling
    private void handleInitialize(ViroFabricContainer view, ReadableArray args) {
        if (args == null || args.size() < 3) {
            Log.e(TAG, "Initialize command requires 3 arguments: debug, arEnabled, worldAlignment");
            sendErrorEvent(view, "INITIALIZE_ERROR", "Invalid arguments: expected 3 arguments");
            return;
        }
        
        try {
            boolean debug = args.getBoolean(0);
            boolean arEnabled = args.getBoolean(1);
            String worldAlignment = args.getString(2);
            
            // Validate world alignment
            if (!isValidWorldAlignment(worldAlignment)) {
                Log.w(TAG, "Invalid world alignment: " + worldAlignment + ", defaulting to Gravity");
                worldAlignment = "Gravity";
            }
            
            Log.d(TAG, "Initializing with debug=" + debug + ", arEnabled=" + arEnabled + ", worldAlignment=" + worldAlignment);
            view.initialize(debug, arEnabled, worldAlignment);
            
        } catch (Exception e) {
            Log.e(TAG, "Error during initialization", e);
            sendErrorEvent(view, "INITIALIZE_ERROR", "Initialization failed: " + e.getMessage());
        }
    }

    private void handleCleanup(ViroFabricContainer view) {
        view.cleanup();
    }

    private void handleCreateComponent(ViroFabricContainer view, ReadableArray args) {
        if (args == null || args.size() < 3) {
            Log.e(TAG, "CreateComponent command requires 3 arguments: componentId, componentType, props");
            sendErrorEvent(view, "CREATE_COMPONENT_ERROR", "Invalid arguments: expected 3 arguments");
            return;
        }
        
        try {
            String componentId = args.getString(0);
            String componentType = args.getString(1);
            ReadableMap props = args.getMap(2);
            
            // Validate component ID
            if (!isValidComponentId(componentId)) {
                Log.e(TAG, "Invalid component ID: " + componentId);
                sendErrorEvent(view, "CREATE_COMPONENT_ERROR", "Invalid component ID: must be non-empty and <= 100 characters");
                return;
            }
            
            // Validate component type
            if (!isValidComponentType(componentType)) {
                Log.e(TAG, "Invalid component type: " + componentType);
                sendErrorEvent(view, "CREATE_COMPONENT_ERROR", "Invalid component type: " + componentType);
                return;
            }
            
            Log.d(TAG, "Creating component: " + componentId + " of type: " + componentType);
            view.createComponent(componentId, componentType, props);
            
        } catch (Exception e) {
            Log.e(TAG, "Error creating component", e);
            sendErrorEvent(view, "CREATE_COMPONENT_ERROR", "Component creation failed: " + e.getMessage());
        }
    }

    private void handleUpdateComponent(ViroFabricContainer view, ReadableArray args) {
        if (args == null || args.size() < 2) {
            Log.e(TAG, "UpdateComponent command requires 2 arguments: componentId, props");
            sendErrorEvent(view, "UPDATE_COMPONENT_ERROR", "Invalid arguments: expected 2 arguments");
            return;
        }
        
        try {
            String componentId = args.getString(0);
            ReadableMap props = args.getMap(1);
            
            // Validate component ID
            if (!isValidComponentId(componentId)) {
                Log.e(TAG, "Invalid component ID: " + componentId);
                sendErrorEvent(view, "UPDATE_COMPONENT_ERROR", "Invalid component ID: must be non-empty and <= 100 characters");
                return;
            }
            
            Log.d(TAG, "Updating component: " + componentId);
            view.updateComponent(componentId, props);
            
        } catch (Exception e) {
            Log.e(TAG, "Error updating component", e);
            sendErrorEvent(view, "UPDATE_COMPONENT_ERROR", "Component update failed: " + e.getMessage());
        }
    }

    private void handleDeleteComponent(ViroFabricContainer view, ReadableArray args) {
        if (args == null || args.size() < 1) {
            Log.e(TAG, "DeleteComponent command requires 1 argument: componentId");
            sendErrorEvent(view, "DELETE_COMPONENT_ERROR", "Invalid arguments: expected 1 argument");
            return;
        }
        
        try {
            String componentId = args.getString(0);
            
            // Validate component ID
            if (!isValidComponentId(componentId)) {
                Log.e(TAG, "Invalid component ID: " + componentId);
                sendErrorEvent(view, "DELETE_COMPONENT_ERROR", "Invalid component ID: must be non-empty and <= 100 characters");
                return;
            }
            
            Log.d(TAG, "Deleting component: " + componentId);
            view.deleteComponent(componentId);
            
        } catch (Exception e) {
            Log.e(TAG, "Error deleting component", e);
            sendErrorEvent(view, "DELETE_COMPONENT_ERROR", "Component deletion failed: " + e.getMessage());
        }
    }

    private void handleAddChild(ViroFabricContainer view, ReadableArray args) {
        if (args == null || args.size() < 2) {
            Log.e(TAG, "AddChild command requires 2 arguments: childId, parentId");
            return;
        }
        
        String childId = args.getString(0);
        String parentId = args.getString(1);
        
        view.addChild(childId, parentId);
    }

    private void handleRemoveChild(ViroFabricContainer view, ReadableArray args) {
        if (args == null || args.size() < 2) {
            Log.e(TAG, "RemoveChild command requires 2 arguments: childId, parentId");
            return;
        }
        
        String childId = args.getString(0);
        String parentId = args.getString(1);
        
        view.removeChild(childId, parentId);
    }

    private void handleRegisterEventCallback(ViroFabricContainer view, ReadableArray args) {
        if (args == null || args.size() < 3) {
            Log.e(TAG, "RegisterEventCallback command requires 3 arguments: callbackId, eventName, componentId");
            return;
        }
        
        String callbackId = args.getString(0);
        String eventName = args.getString(1);
        String componentId = args.getString(2);
        
        view.registerEventCallback(callbackId, eventName, componentId);
    }

    private void handleUnregisterEventCallback(ViroFabricContainer view, ReadableArray args) {
        if (args == null || args.size() < 3) {
            Log.e(TAG, "UnregisterEventCallback command requires 3 arguments: callbackId, eventName, componentId");
            return;
        }
        
        String callbackId = args.getString(0);
        String eventName = args.getString(1);
        String componentId = args.getString(2);
        
        view.unregisterEventCallback(callbackId, eventName, componentId);
    }

    private void handleCreateMaterial(ViroFabricContainer view, ReadableArray args) {
        if (args == null || args.size() < 2) {
            Log.e(TAG, "CreateMaterial command requires 2 arguments: materialName, properties");
            return;
        }
        
        String materialName = args.getString(0);
        ReadableMap properties = args.getMap(1);
        
        view.createMaterial(materialName, properties);
    }

    private void handleCreateAnimation(ViroFabricContainer view, ReadableArray args) {
        if (args == null || args.size() < 2) {
            Log.e(TAG, "CreateAnimation command requires 2 arguments: animationName, properties");
            return;
        }
        
        String animationName = args.getString(0);
        ReadableMap properties = args.getMap(1);
        
        view.createAnimation(animationName, properties);
    }

    private void handleExecuteAnimation(ViroFabricContainer view, ReadableArray args) {
        if (args == null || args.size() < 3) {
            Log.e(TAG, "ExecuteAnimation command requires 3 arguments: animationName, componentId, options");
            return;
        }
        
        String animationName = args.getString(0);
        String componentId = args.getString(1);
        ReadableMap options = args.getMap(2);
        
        view.executeAnimation(animationName, componentId, options);
    }

    private void handleSetARPlaneDetection(ViroFabricContainer view, ReadableArray args) {
        if (args == null || args.size() < 1) {
            Log.e(TAG, "SetARPlaneDetection command requires 1 argument: config");
            return;
        }
        
        ReadableMap config = args.getMap(0);
        view.setARPlaneDetection(config);
    }

    private void handleSetARImageTargets(ViroFabricContainer view, ReadableArray args) {
        if (args == null || args.size() < 1) {
            Log.e(TAG, "SetARImageTargets command requires 1 argument: targets");
            return;
        }
        
        ReadableMap targets = args.getMap(0);
        view.setARImageTargets(targets);
    }

    // Configuration storage for initialization
    private boolean mDebugMode = false;
    private boolean mArEnabled = false;
    private String mWorldAlignment = "Gravity";
    private boolean mAutoInitialize = true;

    // Props for initial configuration
    @ReactProp(name = "debug", defaultBoolean = false)
    public void setDebug(ViroFabricContainer view, boolean debug) {
        Log.d(TAG, "Setting debug mode: " + debug);
        mDebugMode = debug;
        
        if (mAutoInitialize) {
            // Auto-initialize if all required props are set
            initializeIfReady(view);
        }
    }

    @ReactProp(name = "arEnabled", defaultBoolean = false)
    public void setArEnabled(ViroFabricContainer view, boolean arEnabled) {
        Log.d(TAG, "Setting AR enabled: " + arEnabled);
        mArEnabled = arEnabled;
        
        if (mAutoInitialize) {
            // Auto-initialize if all required props are set
            initializeIfReady(view);
        }
    }

    @ReactProp(name = "worldAlignment")
    public void setWorldAlignment(ViroFabricContainer view, String worldAlignment) {
        Log.d(TAG, "Setting world alignment: " + worldAlignment);
        mWorldAlignment = worldAlignment != null ? worldAlignment : "Gravity";
        
        // Validate world alignment
        if (!isValidWorldAlignment(mWorldAlignment)) {
            Log.w(TAG, "Invalid world alignment: " + mWorldAlignment + ", defaulting to Gravity");
            mWorldAlignment = "Gravity";
        }
        
        if (mAutoInitialize) {
            // Auto-initialize if all required props are set
            initializeIfReady(view);
        }
    }

    @ReactProp(name = "autoInitialize", defaultBoolean = true)
    public void setAutoInitialize(ViroFabricContainer view, boolean autoInitialize) {
        Log.d(TAG, "Setting auto-initialize: " + autoInitialize);
        mAutoInitialize = autoInitialize;
        
        if (autoInitialize) {
            initializeIfReady(view);
        }
    }

    /**
     * Auto-initialize the container if all required configuration is available.
     */
    private void initializeIfReady(ViroFabricContainer view) {
        UiThreadUtil.runOnUiThread(() -> {
            try {
                // Check if view is ready for initialization
                if (view.getParent() != null && view.getWidth() > 0 && view.getHeight() > 0) {
                    Log.d(TAG, "Auto-initializing ViroFabricContainer with debug=" + mDebugMode + 
                          ", arEnabled=" + mArEnabled + ", worldAlignment=" + mWorldAlignment);
                    view.initialize(mDebugMode, mArEnabled, mWorldAlignment);
                }
            } catch (Exception e) {
                Log.e(TAG, "Error during auto-initialization", e);
            }
        });
    }

    /**
     * Validate world alignment value.
     */
    private boolean isValidWorldAlignment(String worldAlignment) {
        return worldAlignment != null && 
               (worldAlignment.equals("Gravity") || 
                worldAlignment.equals("GravityAndHeading") || 
                worldAlignment.equals("Camera"));
    }

    /**
     * Send an error event to JavaScript.
     */
    private void sendErrorEvent(ViroFabricContainer view, String errorCode, String errorMessage) {
        try {
            com.facebook.react.bridge.WritableMap errorEvent = com.facebook.react.bridge.Arguments.createMap();
            errorEvent.putString("errorCode", errorCode);
            errorEvent.putString("errorMessage", errorMessage);
            errorEvent.putDouble("timestamp", System.currentTimeMillis());
            
            // Send error event through the container's event system
            view.dispatchEventToJS("onError", errorEvent);
            
        } catch (Exception e) {
            Log.e(TAG, "Failed to send error event: " + e.getMessage(), e);
        }
    }

    /**
     * Validate component ID format.
     */
    private boolean isValidComponentId(String componentId) {
        return componentId != null && !componentId.trim().isEmpty() && componentId.length() <= 100;
    }

    /**
     * Validate component type.
     */
    private boolean isValidComponentType(String componentType) {
        if (componentType == null || componentType.trim().isEmpty()) {
            return false;
        }
        
        // List of valid component types
        String[] validTypes = {
            "scene", "arScene", "box", "sphere", "text", "image", "quad", "video", "3DObject",
            "node", "flexView", "polygon", "polyline", "geometry", "animatedImage", "360Image",
            "360Video", "skyBox", "lightingEnvironment", "portal", "portalScene", "particleEmitter",
            "camera", "orbitCamera", "ambientLight", "directionalLight", "omniLight", "spotLight",
            "sound", "soundField", "spatialSound", "controller", "materialVideo"
        };
        
        for (String validType : validTypes) {
            if (validType.equals(componentType)) {
                return true;
            }
        }
        
        return false;
    }

    /**
     * Validate event name.
     */
    private boolean isValidEventName(String eventName) {
        if (eventName == null || eventName.trim().isEmpty()) {
            return false;
        }
        
        // List of valid event names
        String[] validEvents = {
            "onClick", "onTouch", "onHover", "onScroll", "onSwipe", "onDrag", "onFuse",
            "onPinch", "onRotate", "onCollision", "onTransformUpdate", "onLoadStart",
            "onLoadEnd", "onError", "onAnimationStart", "onAnimationFinish", "onSoundFinish"
        };
        
        for (String validEvent : validEvents) {
            if (validEvent.equals(eventName)) {
                return true;
            }
        }
        
        return false;
    }
}
