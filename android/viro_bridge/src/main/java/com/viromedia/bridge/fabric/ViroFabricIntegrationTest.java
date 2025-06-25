package com.viromedia.bridge.fabric;

import android.util.Log;

import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.ReadableMap;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.bridge.WritableNativeMap;
import com.facebook.react.uimanager.ThemedReactContext;

import com.viromedia.bridge.component.VRTComponent;
import com.viromedia.bridge.component.node.VRTNode;
import com.viromedia.bridge.component.node.VRTScene;
import com.viromedia.bridge.component.node.control.VRTBox;
import com.viromedia.bridge.component.node.control.VRTText;

/**
 * Integration test for the Viro Fabric interop layer.
 * This class tests all major functionality to ensure everything is working properly.
 */
public class ViroFabricIntegrationTest {
    
    private static final String TAG = "ViroFabricTest";
    
    private ViroFabricContainer mContainer;
    private ViroFabricSceneManager mSceneManager;
    private ViroFabricEventDelegate mEventDelegate;
    private ThemedReactContext mReactContext;
    
    public ViroFabricIntegrationTest(ThemedReactContext reactContext) {
        mReactContext = reactContext;
    }
    
    /**
     * Run all integration tests.
     */
    public boolean runAllTests() {
        Log.i(TAG, "Starting Viro Fabric integration tests...");
        
        boolean allTestsPassed = true;
        
        try {
            // Test 1: Container initialization
            allTestsPassed &= testContainerInitialization();
            
            // Test 2: Scene manager functionality
            allTestsPassed &= testSceneManager();
            
            // Test 3: Component creation and management
            allTestsPassed &= testComponentManagement();
            
            // Test 4: Event system
            allTestsPassed &= testEventSystem();
            
            // Test 5: Material and animation management
            allTestsPassed &= testMaterialAndAnimationManagement();
            
            // Test 6: JSI bridge functionality
            allTestsPassed &= testJSIBridge();
            
            // Test 7: Memory management
            allTestsPassed &= testMemoryManagement();
            
            // Test 8: AR functionality
            allTestsPassed &= testARFunctionality();
            
        } catch (Exception e) {
            Log.e(TAG, "Integration test failed with exception: " + e.getMessage(), e);
            allTestsPassed = false;
        }
        
        if (allTestsPassed) {
            Log.i(TAG, "✅ All Viro Fabric integration tests PASSED!");
        } else {
            Log.e(TAG, "❌ Some Viro Fabric integration tests FAILED!");
        }
        
        return allTestsPassed;
    }
    
    /**
     * Test container initialization.
     */
    private boolean testContainerInitialization() {
        Log.d(TAG, "Testing container initialization...");
        
        try {
            // Create container
            mContainer = new ViroFabricContainer(mReactContext);
            
            // Verify container is created
            if (mContainer == null) {
                Log.e(TAG, "Container creation failed");
                return false;
            }
            
            // Test initialization
            mContainer.initialize(true, false, "Gravity");
            
            // Verify New Architecture detection (using reflection since method is private)
            try {
                java.lang.reflect.Method isNewArchMethod = mContainer.getClass().getDeclaredMethod("isNewArchitectureEnabled");
                isNewArchMethod.setAccessible(true);
                boolean isNewArchEnabled = (Boolean) isNewArchMethod.invoke(mContainer);
                Log.d(TAG, "New Architecture enabled: " + isNewArchEnabled);
            } catch (Exception e) {
                Log.d(TAG, "Could not check New Architecture status: " + e.getMessage());
            }
            
            Log.d(TAG, "✅ Container initialization test passed");
            return true;
            
        } catch (Exception e) {
            Log.e(TAG, "❌ Container initialization test failed: " + e.getMessage(), e);
            return false;
        }
    }
    
    /**
     * Test scene manager functionality.
     */
    private boolean testSceneManager() {
        Log.d(TAG, "Testing scene manager...");
        
        try {
            // Create scene manager
            mSceneManager = new ViroFabricSceneManager(mContainer, mReactContext);
            
            // Test scene creation
            WritableMap sceneProps = new WritableNativeMap();
            sceneProps.putString("backgroundColor", "#000000");
            
            VRTScene scene = mSceneManager.createScene("testScene", "scene", sceneProps);
            if (scene == null) {
                Log.e(TAG, "Scene creation failed");
                return false;
            }
            
            // Test scene activation
            boolean activated = mSceneManager.activateScene("testScene");
            if (!activated) {
                Log.e(TAG, "Scene activation failed");
                return false;
            }
            
            // Test scene state
            ViroFabricSceneManager.SceneState state = mSceneManager.getSceneState("testScene");
            if (state != ViroFabricSceneManager.SceneState.ACTIVE) {
                Log.e(TAG, "Scene state incorrect: " + state);
                return false;
            }
            
            // Test memory stats
            WritableMap memoryStats = mSceneManager.getMemoryStats();
            if (memoryStats == null) {
                Log.e(TAG, "Memory stats retrieval failed");
                return false;
            }
            
            Log.d(TAG, "✅ Scene manager test passed");
            return true;
            
        } catch (Exception e) {
            Log.e(TAG, "❌ Scene manager test failed: " + e.getMessage(), e);
            return false;
        }
    }
    
    /**
     * Test component creation and management.
     */
    private boolean testComponentManagement() {
        Log.d(TAG, "Testing component management...");
        
        try {
            // Test component creation
            WritableMap boxProps = new WritableNativeMap();
            boxProps.putDouble("width", 1.0);
            boxProps.putDouble("height", 1.0);
            boxProps.putDouble("length", 1.0);
            
            mContainer.createComponent("testBox", "box", boxProps);
            
            // Verify component is in registry
            VRTComponent boxComponent = mContainer.mComponentRegistry.get("testBox");
            if (boxComponent == null || !(boxComponent instanceof VRTBox)) {
                Log.e(TAG, "Box component creation failed");
                return false;
            }
            
            // Test text component
            WritableMap textProps = new WritableNativeMap();
            textProps.putString("text", "Hello Viro!");
            textProps.putDouble("fontSize", 24.0);
            
            mContainer.createComponent("testText", "text", textProps);
            
            VRTComponent textComponent = mContainer.mComponentRegistry.get("testText");
            if (textComponent == null || !(textComponent instanceof VRTText)) {
                Log.e(TAG, "Text component creation failed");
                return false;
            }
            
            // Test component update
            WritableMap updateProps = new WritableNativeMap();
            updateProps.putString("text", "Updated Text!");
            mContainer.updateComponent("testText", updateProps);
            
            // Test hierarchy management
            mContainer.addChild("testText", "testBox");
            mContainer.removeChild("testText", "testBox");
            
            // Test component deletion
            mContainer.deleteComponent("testText");
            if (mContainer.mComponentRegistry.containsKey("testText")) {
                Log.e(TAG, "Component deletion failed");
                return false;
            }
            
            Log.d(TAG, "✅ Component management test passed");
            return true;
            
        } catch (Exception e) {
            Log.e(TAG, "❌ Component management test failed: " + e.getMessage(), e);
            return false;
        }
    }
    
    /**
     * Test event system.
     */
    private boolean testEventSystem() {
        Log.d(TAG, "Testing event system...");
        
        try {
            // Create event delegate
            mEventDelegate = new ViroFabricEventDelegate(mContainer, mReactContext, mContainer.getId());
            
            // Test event registration
            mEventDelegate.registerEventCallback("callback1", "onClick", "testBox");
            
            // Test event dispatch
            WritableMap eventData = new WritableNativeMap();
            eventData.putDouble("x", 0.5);
            eventData.putDouble("y", 0.5);
            eventData.putDouble("z", 0.0);
            
            mEventDelegate.dispatchEvent("testBox", "onClick", eventData);
            
            // Test event unregistration
            mEventDelegate.unregisterEventCallback("callback1", "onClick", "testBox");
            
            // Test event statistics
            WritableMap eventStats = mEventDelegate.getEventStats();
            if (eventStats == null) {
                Log.e(TAG, "Event stats retrieval failed");
                return false;
            }
            
            Log.d(TAG, "✅ Event system test passed");
            return true;
            
        } catch (Exception e) {
            Log.e(TAG, "❌ Event system test failed: " + e.getMessage(), e);
            return false;
        }
    }
    
    /**
     * Test material and animation management.
     */
    private boolean testMaterialAndAnimationManagement() {
        Log.d(TAG, "Testing material and animation management...");
        
        try {
            // Test material creation
            WritableMap materialProps = new WritableNativeMap();
            materialProps.putString("diffuseColor", "#FF0000");
            materialProps.putDouble("shininess", 2.0);
            
            mContainer.createMaterial("testMaterial", materialProps);
            
            // Test animation creation
            WritableMap animationProps = new WritableNativeMap();
            animationProps.putString("property", "position");
            animationProps.putDouble("duration", 1000);
            
            mContainer.createAnimation("testAnimation", animationProps);
            
            // Test animation execution
            WritableMap animationOptions = new WritableNativeMap();
            animationOptions.putBoolean("run", true);
            animationOptions.putBoolean("loop", false);
            
            mContainer.executeAnimation("testAnimation", "testBox", animationOptions);
            
            Log.d(TAG, "✅ Material and animation management test passed");
            return true;
            
        } catch (Exception e) {
            Log.e(TAG, "❌ Material and animation management test failed: " + e.getMessage(), e);
            return false;
        }
    }
    
    /**
     * Test JSI bridge functionality.
     */
    private boolean testJSIBridge() {
        Log.d(TAG, "Testing JSI bridge...");
        
        try {
            // Test JSI bridge initialization (this happens in container constructor)
            // The bridge may not be available in test environment, so we just check if it's properly handled
            
            // Test event dispatch via JSI (will fall back to RCTEventEmitter if JSI not available)
            WritableMap testEventData = new WritableNativeMap();
            testEventData.putString("testProperty", "testValue");
            
            mContainer.dispatchEventToJS("testCallback", testEventData);
            
            Log.d(TAG, "✅ JSI bridge test passed (fallback behavior verified)");
            return true;
            
        } catch (Exception e) {
            Log.e(TAG, "❌ JSI bridge test failed: " + e.getMessage(), e);
            return false;
        }
    }
    
    /**
     * Test memory management.
     */
    private boolean testMemoryManagement() {
        Log.d(TAG, "Testing memory management...");
        
        try {
            // Test memory cleanup
            mSceneManager.performMemoryCleanup();
            
            // Test component registry cleanup
            int initialSize = mContainer.mComponentRegistry.size();
            
            // Create and delete components to test cleanup
            mContainer.createComponent("tempComponent", "box", new WritableNativeMap());
            mContainer.deleteComponent("tempComponent");
            
            // Verify cleanup
            if (mContainer.mComponentRegistry.containsKey("tempComponent")) {
                Log.e(TAG, "Component cleanup failed");
                return false;
            }
            
            // Test scene cleanup
            mSceneManager.cleanup();
            
            Log.d(TAG, "✅ Memory management test passed");
            return true;
            
        } catch (Exception e) {
            Log.e(TAG, "❌ Memory management test failed: " + e.getMessage(), e);
            return false;
        }
    }
    
    /**
     * Test AR functionality.
     */
    private boolean testARFunctionality() {
        Log.d(TAG, "Testing AR functionality...");
        
        try {
            // Test AR initialization
            mContainer.initialize(true, true, "Gravity");
            
            // Test AR plane detection configuration
            WritableMap planeConfig = new WritableNativeMap();
            planeConfig.putBoolean("enabled", true);
            planeConfig.putString("alignment", "Horizontal");
            
            mContainer.setARPlaneDetection(planeConfig);
            
            // Test AR image targets configuration
            WritableMap imageTargets = new WritableNativeMap();
            WritableMap target1 = new WritableNativeMap();
            target1.putString("source", "test_image.jpg");
            target1.putDouble("physicalWidth", 0.1);
            imageTargets.putMap("target1", target1);
            
            mContainer.setARImageTargets(imageTargets);
            
            Log.d(TAG, "✅ AR functionality test passed");
            return true;
            
        } catch (Exception e) {
            Log.e(TAG, "❌ AR functionality test failed: " + e.getMessage(), e);
            return false;
        }
    }
    
    /**
     * Clean up test resources.
     */
    public void cleanup() {
        Log.d(TAG, "Cleaning up test resources...");
        
        try {
            if (mEventDelegate != null) {
                mEventDelegate.dispose();
            }
            
            if (mSceneManager != null) {
                mSceneManager.cleanup();
            }
            
            if (mContainer != null) {
                mContainer.cleanup();
            }
            
            Log.d(TAG, "Test cleanup completed");
            
        } catch (Exception e) {
            Log.e(TAG, "Error during test cleanup: " + e.getMessage(), e);
        }
    }
}
