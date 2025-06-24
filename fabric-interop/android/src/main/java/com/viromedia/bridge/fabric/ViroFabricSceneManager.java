package com.viromedia.bridge.fabric;

import android.util.Log;
import android.view.ViewGroup;

import com.facebook.react.bridge.ReadableMap;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.bridge.WritableNativeMap;
import com.facebook.react.uimanager.ThemedReactContext;

import com.viromedia.bridge.component.VRTSceneNavigator;
import com.viromedia.bridge.component.VRTARSceneNavigator;
import com.viromedia.bridge.component.VRTVRSceneNavigator;
import com.viromedia.bridge.component.node.VRTScene;
import com.viromedia.bridge.component.node.VRTARScene;
import com.viromedia.bridge.component.node.VRTNode;

import java.util.HashMap;
import java.util.Map;
import java.util.List;
import java.util.ArrayList;
import java.util.concurrent.ConcurrentHashMap;
import java.lang.ref.WeakReference;

/**
 * ViroFabricSceneManager manages scene lifecycle, memory cleanup, and resource management
 * for the Viro Fabric interop layer.
 */
public class ViroFabricSceneManager {
    
    private static final String TAG = "ViroFabricSceneManager";
    
    // Scene registry with weak references to prevent memory leaks
    private final Map<String, WeakReference<VRTScene>> mSceneRegistry = new ConcurrentHashMap<>();
    
    // Active scene tracking
    private WeakReference<VRTScene> mActiveScene;
    private String mActiveSceneId;
    
    // Scene state tracking
    private final Map<String, SceneState> mSceneStates = new ConcurrentHashMap<>();
    
    // Memory management
    private final List<WeakReference<VRTNode>> mManagedNodes = new ArrayList<>();
    private final Map<String, Long> mSceneCreationTimes = new ConcurrentHashMap<>();
    
    // Container reference
    private final WeakReference<ViroFabricContainer> mContainer;
    private final ThemedReactContext mReactContext;
    
    // Scene lifecycle listener
    public interface SceneLifecycleListener {
        void onSceneCreated(String sceneId, VRTScene scene);
        void onSceneActivated(String sceneId, VRTScene scene);
        void onSceneDeactivated(String sceneId, VRTScene scene);
        void onSceneDestroyed(String sceneId);
        void onMemoryWarning();
    }
    
    private SceneLifecycleListener mLifecycleListener;
    
    // Scene states
    public enum SceneState {
        CREATED,
        LOADING,
        LOADED,
        ACTIVE,
        PAUSED,
        DESTROYED
    }
    
    public ViroFabricSceneManager(ViroFabricContainer container, ThemedReactContext reactContext) {
        mContainer = new WeakReference<>(container);
        mReactContext = reactContext;
    }
    
    /**
     * Set the scene lifecycle listener.
     */
    public void setLifecycleListener(SceneLifecycleListener listener) {
        mLifecycleListener = listener;
    }
    
    /**
     * Create a new scene with proper lifecycle management.
     */
    public VRTScene createScene(String sceneId, String sceneType, ReadableMap props) {
        Log.d(TAG, "Creating scene: " + sceneId + " of type: " + sceneType);
        
        try {
            // Check if scene already exists
            if (mSceneRegistry.containsKey(sceneId)) {
                WeakReference<VRTScene> existingRef = mSceneRegistry.get(sceneId);
                if (existingRef != null && existingRef.get() != null) {
                    Log.w(TAG, "Scene " + sceneId + " already exists, returning existing scene");
                    return existingRef.get();
                } else {
                    // Clean up stale reference
                    mSceneRegistry.remove(sceneId);
                    mSceneStates.remove(sceneId);
                }
            }
            
            // Create the appropriate scene type
            VRTScene scene = null;
            switch (sceneType) {
                case "scene":
                    scene = new VRTScene(mReactContext);
                    break;
                case "arScene":
                    scene = new VRTARScene(mReactContext);
                    break;
                default:
                    Log.e(TAG, "Unknown scene type: " + sceneType);
                    return null;
            }
            
            if (scene == null) {
                Log.e(TAG, "Failed to create scene of type: " + sceneType);
                return null;
            }
            
            // Set scene properties
            if (props != null) {
                scene.setProps(props);
            }
            
            // Register the scene
            mSceneRegistry.put(sceneId, new WeakReference<>(scene));
            mSceneStates.put(sceneId, SceneState.CREATED);
            mSceneCreationTimes.put(sceneId, System.currentTimeMillis());
            
            // Set up scene lifecycle callbacks
            setupSceneLifecycleCallbacks(sceneId, scene);
            
            // Notify listener
            if (mLifecycleListener != null) {
                mLifecycleListener.onSceneCreated(sceneId, scene);
            }
            
            Log.d(TAG, "Successfully created scene: " + sceneId);
            return scene;
            
        } catch (Exception e) {
            Log.e(TAG, "Error creating scene " + sceneId + ": " + e.getMessage(), e);
            return null;
        }
    }
    
    /**
     * Activate a scene (set it as the current scene).
     */
    public boolean activateScene(String sceneId) {
        Log.d(TAG, "Activating scene: " + sceneId);
        
        try {
            WeakReference<VRTScene> sceneRef = mSceneRegistry.get(sceneId);
            if (sceneRef == null || sceneRef.get() == null) {
                Log.e(TAG, "Cannot activate scene: scene not found - " + sceneId);
                return false;
            }
            
            VRTScene scene = sceneRef.get();
            
            // Deactivate current active scene
            if (mActiveScene != null && mActiveScene.get() != null && mActiveSceneId != null) {
                deactivateScene(mActiveSceneId);
            }
            
            // Set the scene on the appropriate navigator
            ViroFabricContainer container = mContainer.get();
            if (container != null) {
                ViewGroup navigator = container.getActiveNavigator();
                if (navigator instanceof VRTSceneNavigator) {
                    ((VRTSceneNavigator) navigator).setScene(scene);
                } else if (navigator instanceof VRTARSceneNavigator) {
                    ((VRTARSceneNavigator) navigator).setScene(scene);
                } else if (navigator instanceof VRTVRSceneNavigator) {
                    ((VRTVRSceneNavigator) navigator).setScene(scene);
                }
            }
            
            // Update active scene tracking
            mActiveScene = sceneRef;
            mActiveSceneId = sceneId;
            mSceneStates.put(sceneId, SceneState.ACTIVE);
            
            // Notify listener
            if (mLifecycleListener != null) {
                mLifecycleListener.onSceneActivated(sceneId, scene);
            }
            
            Log.d(TAG, "Successfully activated scene: " + sceneId);
            return true;
            
        } catch (Exception e) {
            Log.e(TAG, "Error activating scene " + sceneId + ": " + e.getMessage(), e);
            return false;
        }
    }
    
    /**
     * Deactivate a scene.
     */
    public boolean deactivateScene(String sceneId) {
        Log.d(TAG, "Deactivating scene: " + sceneId);
        
        try {
            WeakReference<VRTScene> sceneRef = mSceneRegistry.get(sceneId);
            if (sceneRef == null || sceneRef.get() == null) {
                Log.w(TAG, "Scene not found for deactivation: " + sceneId);
                return false;
            }
            
            VRTScene scene = sceneRef.get();
            
            // Update state
            mSceneStates.put(sceneId, SceneState.PAUSED);
            
            // Clear active scene if this is the active one
            if (sceneId.equals(mActiveSceneId)) {
                mActiveScene = null;
                mActiveSceneId = null;
            }
            
            // Notify listener
            if (mLifecycleListener != null) {
                mLifecycleListener.onSceneDeactivated(sceneId, scene);
            }
            
            Log.d(TAG, "Successfully deactivated scene: " + sceneId);
            return true;
            
        } catch (Exception e) {
            Log.e(TAG, "Error deactivating scene " + sceneId + ": " + e.getMessage(), e);
            return false;
        }
    }
    
    /**
     * Destroy a scene and clean up its resources.
     */
    public boolean destroyScene(String sceneId) {
        Log.d(TAG, "Destroying scene: " + sceneId);
        
        try {
            WeakReference<VRTScene> sceneRef = mSceneRegistry.get(sceneId);
            if (sceneRef == null) {
                Log.w(TAG, "Scene not found for destruction: " + sceneId);
                return false;
            }
            
            VRTScene scene = sceneRef.get();
            
            // Deactivate if active
            if (sceneId.equals(mActiveSceneId)) {
                deactivateScene(sceneId);
            }
            
            // Clean up scene resources
            if (scene != null) {
                cleanupSceneResources(scene);
            }
            
            // Remove from registries
            mSceneRegistry.remove(sceneId);
            mSceneStates.put(sceneId, SceneState.DESTROYED);
            mSceneCreationTimes.remove(sceneId);
            
            // Notify listener
            if (mLifecycleListener != null) {
                mLifecycleListener.onSceneDestroyed(sceneId);
            }
            
            Log.d(TAG, "Successfully destroyed scene: " + sceneId);
            return true;
            
        } catch (Exception e) {
            Log.e(TAG, "Error destroying scene " + sceneId + ": " + e.getMessage(), e);
            return false;
        }
    }
    
    /**
     * Get the current active scene.
     */
    public VRTScene getActiveScene() {
        if (mActiveScene != null) {
            return mActiveScene.get();
        }
        return null;
    }
    
    /**
     * Get the active scene ID.
     */
    public String getActiveSceneId() {
        return mActiveSceneId;
    }
    
    /**
     * Get a scene by ID.
     */
    public VRTScene getScene(String sceneId) {
        WeakReference<VRTScene> sceneRef = mSceneRegistry.get(sceneId);
        if (sceneRef != null) {
            return sceneRef.get();
        }
        return null;
    }
    
    /**
     * Get the state of a scene.
     */
    public SceneState getSceneState(String sceneId) {
        return mSceneStates.get(sceneId);
    }
    
    /**
     * Get all scene IDs.
     */
    public String[] getAllSceneIds() {
        return mSceneRegistry.keySet().toArray(new String[0]);
    }
    
    /**
     * Perform memory cleanup.
     */
    public void performMemoryCleanup() {
        Log.d(TAG, "Performing memory cleanup");
        
        try {
            // Clean up stale scene references
            List<String> staleScenes = new ArrayList<>();
            for (Map.Entry<String, WeakReference<VRTScene>> entry : mSceneRegistry.entrySet()) {
                if (entry.getValue().get() == null) {
                    staleScenes.add(entry.getKey());
                }
            }
            
            for (String sceneId : staleScenes) {
                Log.d(TAG, "Cleaning up stale scene reference: " + sceneId);
                mSceneRegistry.remove(sceneId);
                mSceneStates.remove(sceneId);
                mSceneCreationTimes.remove(sceneId);
            }
            
            // Clean up managed nodes
            List<WeakReference<VRTNode>> staleNodes = new ArrayList<>();
            for (WeakReference<VRTNode> nodeRef : mManagedNodes) {
                if (nodeRef.get() == null) {
                    staleNodes.add(nodeRef);
                }
            }
            mManagedNodes.removeAll(staleNodes);
            
            // Force garbage collection hint
            System.gc();
            
            // Notify listener
            if (mLifecycleListener != null) {
                mLifecycleListener.onMemoryWarning();
            }
            
            Log.d(TAG, "Memory cleanup completed. Cleaned up " + staleScenes.size() + " scenes and " + staleNodes.size() + " nodes");
            
        } catch (Exception e) {
            Log.e(TAG, "Error during memory cleanup: " + e.getMessage(), e);
        }
    }
    
    /**
     * Clean up all scenes and resources.
     */
    public void cleanup() {
        Log.d(TAG, "Cleaning up all scenes and resources");
        
        try {
            // Destroy all scenes
            String[] sceneIds = getAllSceneIds();
            for (String sceneId : sceneIds) {
                destroyScene(sceneId);
            }
            
            // Clear all registries
            mSceneRegistry.clear();
            mSceneStates.clear();
            mSceneCreationTimes.clear();
            mManagedNodes.clear();
            
            // Clear active scene
            mActiveScene = null;
            mActiveSceneId = null;
            
            Log.d(TAG, "Scene manager cleanup completed");
            
        } catch (Exception e) {
            Log.e(TAG, "Error during scene manager cleanup: " + e.getMessage(), e);
        }
    }
    
    /**
     * Get memory usage statistics.
     */
    public WritableMap getMemoryStats() {
        WritableMap stats = new WritableNativeMap();
        
        try {
            // Scene statistics
            stats.putInt("totalScenes", mSceneRegistry.size());
            stats.putInt("activeScenes", mActiveScene != null ? 1 : 0);
            stats.putInt("managedNodes", mManagedNodes.size());
            
            // Memory statistics
            Runtime runtime = Runtime.getRuntime();
            long totalMemory = runtime.totalMemory();
            long freeMemory = runtime.freeMemory();
            long usedMemory = totalMemory - freeMemory;
            long maxMemory = runtime.maxMemory();
            
            stats.putDouble("totalMemoryMB", totalMemory / (1024.0 * 1024.0));
            stats.putDouble("usedMemoryMB", usedMemory / (1024.0 * 1024.0));
            stats.putDouble("freeMemoryMB", freeMemory / (1024.0 * 1024.0));
            stats.putDouble("maxMemoryMB", maxMemory / (1024.0 * 1024.0));
            stats.putDouble("memoryUsagePercent", (usedMemory * 100.0) / maxMemory);
            
            // Scene age statistics
            long currentTime = System.currentTimeMillis();
            long oldestSceneAge = 0;
            for (Long creationTime : mSceneCreationTimes.values()) {
                long age = currentTime - creationTime;
                if (age > oldestSceneAge) {
                    oldestSceneAge = age;
                }
            }
            stats.putDouble("oldestSceneAgeSeconds", oldestSceneAge / 1000.0);
            
        } catch (Exception e) {
            Log.e(TAG, "Error getting memory stats: " + e.getMessage(), e);
        }
        
        return stats;
    }
    
    /**
     * Register a node for memory management.
     */
    public void registerManagedNode(VRTNode node) {
        if (node != null) {
            mManagedNodes.add(new WeakReference<>(node));
        }
    }
    
    /**
     * Set up scene lifecycle callbacks.
     */
    private void setupSceneLifecycleCallbacks(String sceneId, VRTScene scene) {
        // Set up scene loading callbacks
        scene.setOnLoadStart(() -> {
            mSceneStates.put(sceneId, SceneState.LOADING);
            Log.d(TAG, "Scene " + sceneId + " started loading");
        });
        
        scene.setOnLoadEnd(() -> {
            mSceneStates.put(sceneId, SceneState.LOADED);
            Log.d(TAG, "Scene " + sceneId + " finished loading");
        });
        
        scene.setOnError((error) -> {
            Log.e(TAG, "Scene " + sceneId + " encountered error: " + error);
        });
    }
    
    /**
     * Clean up resources for a specific scene.
     */
    private void cleanupSceneResources(VRTScene scene) {
        try {
            // Remove all child nodes
            scene.removeAllViews();
            
            // Clear any animations
            scene.clearAnimation();
            
            // Remove from parent if attached
            ViewGroup parent = (ViewGroup) scene.getParent();
            if (parent != null) {
                parent.removeView(scene);
            }
            
            Log.d(TAG, "Scene resources cleaned up successfully");
            
        } catch (Exception e) {
            Log.e(TAG, "Error cleaning up scene resources: " + e.getMessage(), e);
        }
    }
}
