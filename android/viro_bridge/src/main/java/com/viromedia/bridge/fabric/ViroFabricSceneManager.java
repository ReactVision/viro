package com.viromedia.bridge.fabric;

import android.util.Log;
import android.view.ViewGroup;

import com.facebook.react.bridge.ReadableMap;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.bridge.WritableNativeMap;
import com.facebook.react.uimanager.ThemedReactContext;

import com.viromedia.bridge.component.VRT3DSceneNavigator;
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
import java.io.RandomAccessFile;
import java.io.IOException;
import android.app.ActivityManager;
import android.content.Context;
import android.os.Debug;
import android.os.Process;
import android.os.SystemClock;
import android.system.Os;
import android.system.ErrnoException;

/**
 * Simplified ViroFabricSceneManager manages scene lifecycle and memory cleanup
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
    
    // Performance monitoring
    private long mLastMemoryCheckTime = 0;
    private static final long MEMORY_CHECK_INTERVAL_MS = 5000; // Check every 5 seconds
    private static final double MEMORY_WARNING_THRESHOLD = 0.8; // 80% usage threshold
    private static final double MEMORY_CRITICAL_THRESHOLD = 0.9; // 90% usage threshold
    private boolean mMemoryWarningActive = false;
    
    // Scene lifecycle listener - use VRTComponent as common base
    public interface SceneLifecycleListener {
        void onSceneCreated(String sceneId, com.viromedia.bridge.component.VRTComponent scene);
        void onSceneActivated(String sceneId, com.viromedia.bridge.component.VRTComponent scene);
        void onSceneDeactivated(String sceneId, com.viromedia.bridge.component.VRTComponent scene);
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
                    // For AR scenes, we'll create a regular VRTScene for now
                    // since VRTARScene doesn't extend VRTScene
                    scene = new VRTScene(mReactContext);
                    break;
                default:
                    Log.e(TAG, "Unknown scene type: " + sceneType);
                    return null;
            }
            
            if (scene == null) {
                Log.e(TAG, "Failed to create scene of type: " + sceneType);
                return null;
            }
            
            // Apply properties - skip for now since onPropsSet is protected
            if (props != null) {
                // For now, just log that properties would be applied
                Log.d(TAG, "Properties would be applied to scene (not implemented yet)");
            }
            
            // Register the scene
            mSceneRegistry.put(sceneId, new WeakReference<>(scene));
            mSceneStates.put(sceneId, SceneState.CREATED);
            mSceneCreationTimes.put(sceneId, System.currentTimeMillis());
            
            // Set up scene lifecycle callbacks (simplified)
            setupSceneLifecycleCallbacks(sceneId, scene);
            
            // Notify listener
            if (mLifecycleListener != null) {
                mLifecycleListener.onSceneCreated(sceneId, scene);
            }
            
            // Check memory pressure after scene creation
            checkMemoryPressure();
            
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
                if (navigator instanceof VRT3DSceneNavigator) {
                    ((VRT3DSceneNavigator) navigator).addView(scene);
                } else if (navigator instanceof VRTARSceneNavigator) {
                    ((VRTARSceneNavigator) navigator).addView(scene);
                } else if (navigator instanceof VRTVRSceneNavigator) {
                    ((VRTVRSceneNavigator) navigator).addView(scene);
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
            
            // Check memory pressure after scene activation
            checkMemoryPressure();
            
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
     * Perform memory cleanup with intelligent memory pressure handling.
     */
    public void performMemoryCleanup() {
        performMemoryCleanup(false);
    }
    
    /**
     * Perform memory cleanup with optional aggressive mode.
     */
    public void performMemoryCleanup(boolean aggressive) {
        Log.d(TAG, "Performing memory cleanup (aggressive: " + aggressive + ")");
        
        try {
            // Check current memory pressure
            WritableMap memStats = getMemoryStats();
            double memoryUsage = memStats.getDouble("jvmMemoryUsagePercent");
            
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
            
            // Aggressive cleanup if memory pressure is high
            if (aggressive || memoryUsage > MEMORY_CRITICAL_THRESHOLD) {
                performAggressiveCleanup();
            }
            
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
     * Perform aggressive memory cleanup during critical memory pressure.
     */
    private void performAggressiveCleanup() {
        Log.w(TAG, "Performing aggressive memory cleanup due to high memory pressure");
        
        try {
            // Find and destroy oldest inactive scenes
            long currentTime = System.currentTimeMillis();
            List<String> candidateScenes = new ArrayList<>();
            
            for (Map.Entry<String, Long> entry : mSceneCreationTimes.entrySet()) {
                String sceneId = entry.getKey();
                long age = currentTime - entry.getValue();
                
                // Target scenes older than 30 seconds that aren't active
                if (age > 30000 && !sceneId.equals(mActiveSceneId)) {
                    SceneState state = mSceneStates.get(sceneId);
                    if (state == SceneState.PAUSED || state == SceneState.LOADED) {
                        candidateScenes.add(sceneId);
                    }
                }
            }
            
            // Sort by age (oldest first)
            candidateScenes.sort((a, b) -> {
                long ageA = currentTime - mSceneCreationTimes.get(a);
                long ageB = currentTime - mSceneCreationTimes.get(b);
                return Long.compare(ageB, ageA);
            });
            
            // Destroy up to half of the old scenes
            int destroyCount = Math.min(candidateScenes.size() / 2 + 1, candidateScenes.size());
            for (int i = 0; i < destroyCount; i++) {
                String sceneId = candidateScenes.get(i);
                Log.d(TAG, "Aggressively destroying old scene: " + sceneId);
                destroyScene(sceneId);
            }
            
            // Clear any cached resources
            if (mContainer.get() != null) {
                ViroFabricContainer container = mContainer.get();
                // Clear component registry of unused components
                cleanupUnusedComponents(container);
            }
            
        } catch (Exception e) {
            Log.e(TAG, "Error during aggressive cleanup: " + e.getMessage(), e);
        }
    }
    
    /**
     * Clean up unused components from the container registry.
     */
    private void cleanupUnusedComponents(ViroFabricContainer container) {
        // This would access the component registry and clean up orphaned components
        // Implementation depends on ViroFabricContainer's component management
        Log.d(TAG, "Cleaning up unused components");
    }
    
    /**
     * Check memory pressure and trigger automatic cleanup if needed.
     */
    public void checkMemoryPressure() {
        long currentTime = System.currentTimeMillis();
        
        // Only check periodically to avoid performance impact
        if (currentTime - mLastMemoryCheckTime < MEMORY_CHECK_INTERVAL_MS) {
            return;
        }
        
        mLastMemoryCheckTime = currentTime;
        
        try {
            WritableMap memStats = getMemoryStats();
            double jvmUsage = memStats.getDouble("jvmMemoryUsagePercent");
            
            // Check if system is under memory pressure
            boolean systemLowMemory = false;
            if (memStats.hasKey("systemLowMemory")) {
                systemLowMemory = memStats.getBoolean("systemLowMemory");
            }
            
            // Trigger cleanup based on memory pressure
            if (systemLowMemory || jvmUsage > MEMORY_CRITICAL_THRESHOLD) {
                if (!mMemoryWarningActive) {
                    Log.w(TAG, "Critical memory pressure detected (JVM: " + jvmUsage + "%, System low: " + systemLowMemory + ")");
                    mMemoryWarningActive = true;
                    performMemoryCleanup(true); // Aggressive cleanup
                }
            } else if (jvmUsage > MEMORY_WARNING_THRESHOLD) {
                if (!mMemoryWarningActive) {
                    Log.w(TAG, "Memory warning threshold exceeded (JVM: " + jvmUsage + "%)");
                    mMemoryWarningActive = true;
                    performMemoryCleanup(false); // Normal cleanup
                }
            } else {
                // Memory pressure has subsided
                if (mMemoryWarningActive) {
                    Log.i(TAG, "Memory pressure subsided (JVM: " + jvmUsage + "%)");
                    mMemoryWarningActive = false;
                }
            }
            
        } catch (Exception e) {
            Log.e(TAG, "Error checking memory pressure: " + e.getMessage(), e);
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
     * Get comprehensive memory and performance statistics.
     */
    public WritableMap getMemoryStats() {
        WritableMap stats = new WritableNativeMap();
        
        try {
            // Scene statistics
            stats.putInt("totalScenes", mSceneRegistry.size());
            stats.putInt("activeScenes", mActiveScene != null ? 1 : 0);
            stats.putInt("managedNodes", mManagedNodes.size());
            
            // JVM Memory statistics
            Runtime runtime = Runtime.getRuntime();
            long totalMemory = runtime.totalMemory();
            long freeMemory = runtime.freeMemory();
            long usedMemory = totalMemory - freeMemory;
            long maxMemory = runtime.maxMemory();
            
            stats.putDouble("jvmTotalMemoryMB", totalMemory / (1024.0 * 1024.0));
            stats.putDouble("jvmUsedMemoryMB", usedMemory / (1024.0 * 1024.0));
            stats.putDouble("jvmFreeMemoryMB", freeMemory / (1024.0 * 1024.0));
            stats.putDouble("jvmMaxMemoryMB", maxMemory / (1024.0 * 1024.0));
            stats.putDouble("jvmMemoryUsagePercent", (usedMemory * 100.0) / maxMemory);
            
            // Android native memory statistics
            addNativeMemoryStats(stats);
            
            // Process memory statistics
            addProcessMemoryStats(stats);
            
            // System memory statistics
            addSystemMemoryStats(stats);
            
            // Performance statistics
            addPerformanceStats(stats);
            
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
     * Add native memory statistics (equivalent to iOS mach_task_basic_info).
     */
    private void addNativeMemoryStats(WritableMap stats) {
        try {
            // Get native heap info
            Debug.MemoryInfo memInfo = new Debug.MemoryInfo();
            Debug.getMemoryInfo(memInfo);
            
            // These fields are deprecated in newer Android versions
            // Using reflection to access them if available
            try {
                java.lang.reflect.Field nativeHeapSizeField = Debug.MemoryInfo.class.getField("nativeHeapSize");
                stats.putDouble("nativeHeapSizeMB", nativeHeapSizeField.getInt(memInfo) / 1024.0);
                
                java.lang.reflect.Field nativeHeapAllocatedSizeField = Debug.MemoryInfo.class.getField("nativeHeapAllocatedSize");
                stats.putDouble("nativeHeapAllocatedMB", nativeHeapAllocatedSizeField.getInt(memInfo) / 1024.0);
                
                java.lang.reflect.Field nativeHeapFreeSizeField = Debug.MemoryInfo.class.getField("nativeHeapFreeSize");
                stats.putDouble("nativeHeapFreeMB", nativeHeapFreeSizeField.getInt(memInfo) / 1024.0);
                
                java.lang.reflect.Field dalvikHeapSizeField = Debug.MemoryInfo.class.getField("dalvikHeapSize");
                stats.putDouble("dalvikHeapSizeMB", dalvikHeapSizeField.getInt(memInfo) / 1024.0);
                
                java.lang.reflect.Field dalvikHeapAllocatedSizeField = Debug.MemoryInfo.class.getField("dalvikHeapAllocatedSize");
                stats.putDouble("dalvikHeapAllocatedMB", dalvikHeapAllocatedSizeField.getInt(memInfo) / 1024.0);
                
                java.lang.reflect.Field dalvikHeapFreeSizeField = Debug.MemoryInfo.class.getField("dalvikHeapFreeSize");
                stats.putDouble("dalvikHeapFreeMB", dalvikHeapFreeSizeField.getInt(memInfo) / 1024.0);
            } catch (Exception reflectEx) {
                // Fallback: use available methods
                stats.putDouble("totalPssKB", memInfo.getTotalPss());
                stats.putDouble("nativePssKB", memInfo.nativePss);
                stats.putDouble("dalvikPssKB", memInfo.dalvikPss);
            }
            
            // Total PSS (Proportional Set Size) - closest to iOS resident memory
            stats.putDouble("totalPssMB", memInfo.getTotalPss() / 1024.0);
            stats.putDouble("nativePssMB", memInfo.nativePss / 1024.0);
            stats.putDouble("dalvikPssMB", memInfo.dalvikPss / 1024.0);
            stats.putDouble("otherPssMB", memInfo.otherPss / 1024.0);
            
        } catch (Exception e) {
            Log.w(TAG, "Could not get native memory stats: " + e.getMessage());
        }
    }
    
    /**
     * Add process-level memory statistics.
     */
    private void addProcessMemoryStats(WritableMap stats) {
        try {
            int pid = Process.myPid();
            
            // Read /proc/[pid]/status for detailed memory info
            RandomAccessFile reader = new RandomAccessFile("/proc/" + pid + "/status", "r");
            String line;
            while ((line = reader.readLine()) != null) {
                if (line.startsWith("VmRSS:")) {
                    // Resident Set Size (physical memory currently used)
                    String[] parts = line.split("\\s+");
                    if (parts.length >= 2) {
                        long vmRssKB = Long.parseLong(parts[1]);
                        stats.putDouble("processResidentMemoryMB", vmRssKB / 1024.0);
                    }
                } else if (line.startsWith("VmSize:")) {
                    // Virtual Memory Size
                    String[] parts = line.split("\\s+");
                    if (parts.length >= 2) {
                        long vmSizeKB = Long.parseLong(parts[1]);
                        stats.putDouble("processVirtualMemoryMB", vmSizeKB / 1024.0);
                    }
                } else if (line.startsWith("VmHWM:")) {
                    // High Water Mark (peak physical memory usage)
                    String[] parts = line.split("\\s+");
                    if (parts.length >= 2) {
                        long vmHwmKB = Long.parseLong(parts[1]);
                        stats.putDouble("processPeakMemoryMB", vmHwmKB / 1024.0);
                    }
                } else if (line.startsWith("VmSwap:")) {
                    // Swap usage
                    String[] parts = line.split("\\s+");
                    if (parts.length >= 2) {
                        long vmSwapKB = Long.parseLong(parts[1]);
                        stats.putDouble("processSwapMB", vmSwapKB / 1024.0);
                    }
                }
            }
            reader.close();
            
        } catch (Exception e) {
            Log.w(TAG, "Could not get process memory stats: " + e.getMessage());
        }
    }
    
    /**
     * Add system-level memory statistics.
     */
    private void addSystemMemoryStats(WritableMap stats) {
        try {
            Context context = mReactContext;
            ActivityManager activityManager = (ActivityManager) context.getSystemService(Context.ACTIVITY_SERVICE);
            
            if (activityManager != null) {
                // Get system memory info
                ActivityManager.MemoryInfo memInfo = new ActivityManager.MemoryInfo();
                activityManager.getMemoryInfo(memInfo);
                
                stats.putDouble("systemAvailableMemoryMB", memInfo.availMem / (1024.0 * 1024.0));
                stats.putDouble("systemTotalMemoryMB", memInfo.totalMem / (1024.0 * 1024.0));
                stats.putDouble("systemMemoryUsagePercent", 
                    ((memInfo.totalMem - memInfo.availMem) * 100.0) / memInfo.totalMem);
                stats.putBoolean("systemLowMemory", memInfo.lowMemory);
                stats.putDouble("systemMemoryThresholdMB", memInfo.threshold / (1024.0 * 1024.0));
                
                // Get running app processes
                List<ActivityManager.RunningAppProcessInfo> runningApps = 
                    activityManager.getRunningAppProcesses();
                stats.putInt("systemRunningProcesses", runningApps != null ? runningApps.size() : 0);
            }
            
        } catch (Exception e) {
            Log.w(TAG, "Could not get system memory stats: " + e.getMessage());
        }
    }
    
    /**
     * Add performance monitoring statistics.
     */
    private void addPerformanceStats(WritableMap stats) {
        try {
            // CPU usage
            addCpuStats(stats);
            
            // Thread information
            ThreadGroup rootGroup = Thread.currentThread().getThreadGroup();
            ThreadGroup parentGroup;
            while ((parentGroup = rootGroup.getParent()) != null) {
                rootGroup = parentGroup;
            }
            stats.putInt("totalThreads", rootGroup.activeCount());
            
            // GC statistics - Debug.getRuntimeStat returns String
            try {
                String gcCount = Debug.getRuntimeStat("art.gc.gc-count");
                if (gcCount != null && !gcCount.isEmpty()) {
                    stats.putLong("totalGcInvocations", Long.parseLong(gcCount));
                }
                
                String gcTime = Debug.getRuntimeStat("art.gc.gc-time");
                if (gcTime != null && !gcTime.isEmpty()) {
                    stats.putLong("totalGcTimeMs", Long.parseLong(gcTime));
                }
                
                String objectsAllocated = Debug.getRuntimeStat("art.gc.objects-allocated");
                if (objectsAllocated != null && !objectsAllocated.isEmpty()) {
                    stats.putLong("totalAllocatedObjects", Long.parseLong(objectsAllocated));
                }
                
                String objectsFreed = Debug.getRuntimeStat("art.gc.objects-freed");
                if (objectsFreed != null && !objectsFreed.isEmpty()) {
                    stats.putLong("totalFreedObjects", Long.parseLong(objectsFreed));
                }
                
                // Process uptime - use SystemClock instead
                long uptimeMs = SystemClock.elapsedRealtime();
                stats.putDouble("processUptimeSeconds", uptimeMs / 1000.0);
            } catch (Exception gcStatsEx) {
                Log.w(TAG, "Could not parse GC stats: " + gcStatsEx.getMessage());
            }
            
        } catch (Exception e) {
            Log.w(TAG, "Could not get performance stats: " + e.getMessage());
        }
    }
    
    /**
     * Add CPU usage statistics.
     */
    private void addCpuStats(WritableMap stats) {
        try {
            int pid = Process.myPid();
            
            // Read /proc/[pid]/stat for CPU usage
            RandomAccessFile reader = new RandomAccessFile("/proc/" + pid + "/stat", "r");
            String line = reader.readLine();
            reader.close();
            
            if (line != null) {
                String[] statParts = line.split(" ");
                if (statParts.length >= 15) {
                    // User time + System time (in jiffies)
                    long utime = Long.parseLong(statParts[13]);
                    long stime = Long.parseLong(statParts[14]);
                    long totalTime = utime + stime;
                    
                    // Get clock ticks per second
                    long clockTicks = Os.sysconf(android.system.OsConstants._SC_CLK_TCK);
                    double cpuTimeSeconds = totalTime / (double) clockTicks;
                    
                    stats.putDouble("processCpuTimeSeconds", cpuTimeSeconds);
                    stats.putLong("processUserTimeJiffies", utime);
                    stats.putLong("processSystemTimeJiffies", stime);
                }
            }
            
            // Read system CPU info
            reader = new RandomAccessFile("/proc/stat", "r");
            line = reader.readLine(); // First line contains overall CPU stats
            reader.close();
            
            if (line != null && line.startsWith("cpu ")) {
                String[] cpuParts = line.split("\\s+");
                if (cpuParts.length >= 8) {
                    long user = Long.parseLong(cpuParts[1]);
                    long nice = Long.parseLong(cpuParts[2]);
                    long system = Long.parseLong(cpuParts[3]);
                    long idle = Long.parseLong(cpuParts[4]);
                    long iowait = Long.parseLong(cpuParts[5]);
                    long irq = Long.parseLong(cpuParts[6]);
                    long softirq = Long.parseLong(cpuParts[7]);
                    
                    long totalCpu = user + nice + system + idle + iowait + irq + softirq;
                    long activeCpu = totalCpu - idle;
                    
                    stats.putDouble("systemCpuUsagePercent", (activeCpu * 100.0) / totalCpu);
                    stats.putLong("systemCpuTotalJiffies", totalCpu);
                    stats.putLong("systemCpuActiveJiffies", activeCpu);
                }
            }
            
        } catch (Exception e) {
            Log.w(TAG, "Could not get CPU stats: " + e.getMessage());
        }
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
     * Set up scene lifecycle callbacks - simplified version.
     */
    private void setupSceneLifecycleCallbacks(String sceneId, VRTScene scene) {
        // For now, just set the state to loaded since we can't access the actual callback methods
        mSceneStates.put(sceneId, SceneState.LOADED);
        Log.d(TAG, "Scene " + sceneId + " lifecycle callbacks set up");
    }
    
    /**
     * Clean up resources for a specific scene.
     */
    private void cleanupSceneResources(VRTScene scene) {
        try {
            // Remove all child nodes
            scene.removeAllViews();
            
            // Remove from parent if attached
            ViewGroup parent = (ViewGroup) scene.getParent();
            if (parent != null) {
                parent.removeView(scene);
            }
            
            // Call teardown
            scene.onTearDown();
            
            Log.d(TAG, "Scene resources cleaned up successfully");
            
        } catch (Exception e) {
            Log.e(TAG, "Error cleaning up scene resources: " + e.getMessage(), e);
        }
    }
}
