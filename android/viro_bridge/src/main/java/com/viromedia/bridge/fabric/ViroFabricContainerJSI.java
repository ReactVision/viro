package com.viromedia.bridge.fabric;

import com.facebook.jni.HybridData;
import com.facebook.jni.annotations.DoNotStrip;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContext;
import com.facebook.react.turbomodule.core.CallInvokerHolderImpl;
import com.facebook.react.turbomodule.core.interfaces.CallInvokerHolder;

import android.util.Log;

/**
 * ViroFabricContainerJSI provides the Java side of the JSI bridge.
 * This class connects the Java ViroFabricContainer to the C++ JSI implementation.
 */
public class ViroFabricContainerJSI {
    
    private static final String TAG = "ViroFabricContainerJSI";
    
    @DoNotStrip
    private final HybridData mHybridData;
    
    private final ViroFabricContainer mContainer;
    
    static {
        try {
            System.loadLibrary("virofabricjsi");
            Log.d(TAG, "Successfully loaded virofabricjsi native library");
        } catch (UnsatisfiedLinkError e) {
            Log.e(TAG, "Failed to load virofabricjsi native library", e);
        }
    }
    
    public ViroFabricContainerJSI(ReactContext reactContext, ViroFabricContainer container) {
        mContainer = container;
        
        HybridData hybridData = null;
        try {
            // Get the JSI runtime and call invoker
            long jsContext = getJSContext(reactContext);
            CallInvokerHolder callInvokerHolder = getCallInvokerHolder(reactContext);
            
            if (jsContext != 0 && callInvokerHolder != null) {
                hybridData = initHybrid(jsContext, callInvokerHolder, container);
                installJSIBindings();
                Log.d(TAG, "JSI bridge initialized successfully");
            } else {
                Log.e(TAG, "Failed to get JSI context or call invoker");
            }
        } catch (Exception e) {
            Log.e(TAG, "Error initializing JSI bridge", e);
        }
        
        mHybridData = hybridData;
    }
    
    /**
     * Get the JSI runtime context from React context.
     */
    private long getJSContext(ReactContext reactContext) {
        try {
            // Use reflection to access the JSI runtime from React Native
            java.lang.reflect.Method getJavaScriptContextHolderMethod = 
                reactContext.getClass().getMethod("getJavaScriptContextHolder");
            Object jsContextHolder = getJavaScriptContextHolderMethod.invoke(reactContext);
            
            if (jsContextHolder != null) {
                java.lang.reflect.Method getMethod = 
                    jsContextHolder.getClass().getMethod("get");
                Object jsContext = getMethod.invoke(jsContextHolder);
                
                if (jsContext != null) {
                    // Get the native pointer from the JSI runtime
                    java.lang.reflect.Field nativeRuntimeField = 
                        jsContext.getClass().getDeclaredField("mNativeRuntime");
                    nativeRuntimeField.setAccessible(true);
                    long nativeRuntime = nativeRuntimeField.getLong(jsContext);
                    
                    Log.d(TAG, "Successfully obtained JSI runtime: " + nativeRuntime);
                    return nativeRuntime;
                }
            }
        } catch (Exception e) {
            Log.w(TAG, "Could not access JSI runtime via reflection, trying alternative approach: " + e.getMessage());
            
            // Alternative approach: try to get from CatalystInstance
            try {
                java.lang.reflect.Method getCatalystInstanceMethod = 
                    reactContext.getClass().getMethod("getCatalystInstance");
                Object catalystInstance = getCatalystInstanceMethod.invoke(reactContext);
                
                if (catalystInstance != null) {
                    java.lang.reflect.Method getJSIModuleMethod = 
                        catalystInstance.getClass().getMethod("getJSIModule", Class.class);
                    
                    // Try to get JSI runtime from TurboModuleManager
                    Class<?> turboModuleManagerClass = Class.forName("com.facebook.react.turbomodule.core.TurboModuleManager");
                    Object turboModuleManager = getJSIModuleMethod.invoke(catalystInstance, turboModuleManagerClass);
                    
                    if (turboModuleManager != null) {
                        java.lang.reflect.Method getRuntimeMethod = 
                            turboModuleManager.getClass().getMethod("getRuntime");
                        Object runtime = getRuntimeMethod.invoke(turboModuleManager);
                        
                        if (runtime != null) {
                            java.lang.reflect.Field nativeRuntimeField = 
                                runtime.getClass().getDeclaredField("mNativeRuntime");
                            nativeRuntimeField.setAccessible(true);
                            long nativeRuntime = nativeRuntimeField.getLong(runtime);
                            
                            Log.d(TAG, "Successfully obtained JSI runtime via TurboModuleManager: " + nativeRuntime);
                            return nativeRuntime;
                        }
                    }
                }
            } catch (Exception e2) {
                Log.w(TAG, "Alternative JSI runtime access also failed: " + e2.getMessage());
            }
        }
        
        Log.w(TAG, "Could not obtain JSI runtime, JSI bridge will not be available");
        return 0;
    }
    
    /**
     * Get the call invoker holder from React context.
     */
    private CallInvokerHolder getCallInvokerHolder(ReactContext reactContext) {
        try {
            // Try to get CallInvoker from CatalystInstance
            java.lang.reflect.Method getCatalystInstanceMethod = 
                reactContext.getClass().getMethod("getCatalystInstance");
            Object catalystInstance = getCatalystInstanceMethod.invoke(reactContext);
            
            if (catalystInstance != null) {
                // Try to get from TurboModuleManager
                java.lang.reflect.Method getJSIModuleMethod = 
                    catalystInstance.getClass().getMethod("getJSIModule", Class.class);
                
                Class<?> turboModuleManagerClass = Class.forName("com.facebook.react.turbomodule.core.TurboModuleManager");
                Object turboModuleManager = getJSIModuleMethod.invoke(catalystInstance, turboModuleManagerClass);
                
                if (turboModuleManager != null) {
                    java.lang.reflect.Method getCallInvokerHolderMethod = 
                        turboModuleManager.getClass().getMethod("getCallInvokerHolder");
                    CallInvokerHolder callInvokerHolder = (CallInvokerHolder) getCallInvokerHolderMethod.invoke(turboModuleManager);
                    
                    if (callInvokerHolder != null) {
                        Log.d(TAG, "Successfully obtained CallInvokerHolder");
                        return callInvokerHolder;
                    }
                }
                
                // Alternative: try to create CallInvokerHolder from NativeModuleCallExceptionHandler
                try {
                    java.lang.reflect.Method getNativeModuleCallExceptionHandlerMethod = 
                        catalystInstance.getClass().getMethod("getNativeModuleCallExceptionHandler");
                    Object exceptionHandler = getNativeModuleCallExceptionHandlerMethod.invoke(catalystInstance);
                    
                    // CallInvokerHolderImpl requires HybridData, skip direct instantiation
                    Log.d(TAG, "CallInvokerHolderImpl requires HybridData, skipping direct instantiation");
                } catch (Exception e2) {
                    Log.w(TAG, "Could not create CallInvokerHolder via CallInvokerHolderImpl: " + e2.getMessage());
                }
            }
            
            // Final fallback: try ReactApplicationContext specific methods
            if (reactContext instanceof ReactApplicationContext) {
                ReactApplicationContext appContext = (ReactApplicationContext) reactContext;
                
                try {
                    java.lang.reflect.Method getCallInvokerMethod = 
                        appContext.getClass().getMethod("getCallInvoker");
                    Object callInvoker = getCallInvokerMethod.invoke(appContext);
                    
                    if (callInvoker != null) {
                        // CallInvokerHolderImpl requires HybridData, cannot instantiate directly
                        Log.d(TAG, "Found CallInvoker but cannot wrap in CallInvokerHolderImpl without HybridData");
                    }
                } catch (Exception e3) {
                    Log.w(TAG, "Could not get CallInvoker from ReactApplicationContext: " + e3.getMessage());
                }
            }
            
        } catch (Exception e) {
            Log.w(TAG, "Error getting call invoker holder: " + e.getMessage());
        }
        
        Log.w(TAG, "Could not obtain CallInvokerHolder, JSI bridge will not be available");
        return null;
    }
    
    /**
     * Initialize the hybrid C++ object.
     */
    @DoNotStrip
    private native HybridData initHybrid(long jsContext, CallInvokerHolder callInvokerHolder, ViroFabricContainer container);
    
    /**
     * Install the JSI bindings.
     */
    @DoNotStrip
    private native void installJSIBindings();
    
    /**
     * Cleanup the JSI bridge.
     */
    public void cleanup() {
        if (mHybridData != null) {
            mHybridData.resetNative();
        }
    }
    
    /**
     * Check if the JSI bridge is available.
     */
    public boolean isAvailable() {
        return mHybridData != null;
    }
}
