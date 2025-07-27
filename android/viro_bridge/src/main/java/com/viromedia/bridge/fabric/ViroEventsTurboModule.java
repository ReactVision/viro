package com.viromedia.bridge.fabric;

import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.ReadableMap;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.modules.core.DeviceEventManagerModule;
import com.facebook.react.turbomodule.core.interfaces.TurboModule;

import android.util.Log;

import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * ViroEventsTurboModule provides cross-platform event emission for Viro JSI callbacks
 * in React Native's New Architecture (Fabric + TurboModules)
 */
public class ViroEventsTurboModule extends com.facebook.react.bridge.ReactContextBaseJavaModule implements TurboModule {
    
    private static final String TAG = "ViroEventsTurboModule";
    private static final String MODULE_NAME = "ViroEvents";
    
    // Singleton instance for JSI integration
    private static ViroEventsTurboModule sInstance;
    
    // Event tracking
    private final AtomicInteger mListenerCount = new AtomicInteger(0);
    private final Map<String, Boolean> mActiveEvents = new HashMap<>();
    
    // Supported events
    private static final String EVENT_JSI_CALLBACK = "ViroJSICallback";
    private static final String EVENT_NODE_EVENT = "ViroNodeEvent";
    private static final String EVENT_SCENE_EVENT = "ViroSceneEvent";
    
    public ViroEventsTurboModule(ReactApplicationContext reactContext) {
        super(reactContext);
        sInstance = this;
        Log.i(TAG, "ViroEventsTurboModule initialized");
    }
    
    @Override
    public String getName() {
        return MODULE_NAME;
    }
    
    /**
     * Get the singleton instance for JSI integration
     */
    public static ViroEventsTurboModule getInstance() {
        return sInstance;
    }
    
    /**
     * Check if the event system is ready (has active listeners)
     */
    public boolean isEventSystemReady() {
        return mListenerCount.get() > 0;
    }
    
    /**
     * Get the number of active listeners
     */
    public int getActiveListenerCount() {
        return mListenerCount.get();
    }
    
    // React Native event listener management
    
    @ReactMethod
    public void addListener(String eventName) {
        mListenerCount.incrementAndGet();
        mActiveEvents.put(eventName, true);
        Log.i(TAG, "Added listener for event: " + eventName + ", total listeners: " + mListenerCount.get());
    }
    
    @ReactMethod
    public void removeListeners(double count) {
        int removeCount = (int) count;
        int newCount = Math.max(0, mListenerCount.get() - removeCount);
        mListenerCount.set(newCount);
        
        if (newCount == 0) {
            mActiveEvents.clear();
        }
        
        Log.i(TAG, "Removed " + removeCount + " listeners, total listeners: " + newCount);
    }
    
    // Event emission methods (for JavaScript calls)
    
    @ReactMethod
    public void emitJSICallback(String callbackId, ReadableMap eventData) {
        emitJSICallbackInternal(callbackId, eventData);
    }
    
    @ReactMethod
    public void emitNodeEvent(String nodeId, String eventName, ReadableMap eventData) {
        emitNodeEventInternal(nodeId, eventName, eventData);
    }
    
    @ReactMethod
    public void emitSceneEvent(String sceneId, String eventName, ReadableMap eventData) {
        emitSceneEventInternal(sceneId, eventName, eventData);
    }
    
    @ReactMethod(isBlockingSynchronousMethod = true)
    public boolean isEventSystemReadySync() {
        return isEventSystemReady();
    }
    
    @ReactMethod(isBlockingSynchronousMethod = true)
    public double getActiveListenerCountSync() {
        return getActiveListenerCount();
    }
    
    // Internal event emission methods (for native calls)
    
    /**
     * Emit a JSI callback event to JavaScript
     */
    public void emitJSICallbackInternal(String callbackId, ReadableMap eventData) {
        if (!isEventSystemReady()) {
            Log.w(TAG, "No listeners for JSI callback: " + callbackId);
            return;
        }
        
        WritableMap body = Arguments.createMap();
        body.putString("callbackId", callbackId != null ? callbackId : "");
        body.putMap("eventData", eventData != null ? eventData : Arguments.createMap());
        body.putDouble("timestamp", System.currentTimeMillis() / 1000.0);
        
        sendEvent(EVENT_JSI_CALLBACK, body);
        
        Log.i(TAG, "Emitted JSI callback: " + callbackId);
    }
    
    /**
     * Emit a node event to JavaScript
     */
    public void emitNodeEventInternal(String nodeId, String eventName, ReadableMap eventData) {
        if (!isEventSystemReady()) {
            Log.w(TAG, "No listeners for node event: " + nodeId + "." + eventName);
            return;
        }
        
        WritableMap body = Arguments.createMap();
        body.putString("nodeId", nodeId != null ? nodeId : "");
        body.putString("eventName", eventName != null ? eventName : "");
        body.putMap("eventData", eventData != null ? eventData : Arguments.createMap());
        body.putDouble("timestamp", System.currentTimeMillis() / 1000.0);
        
        sendEvent(EVENT_NODE_EVENT, body);
        
        Log.i(TAG, "Emitted node event: " + nodeId + "." + eventName);
    }
    
    /**
     * Emit a scene event to JavaScript
     */
    public void emitSceneEventInternal(String sceneId, String eventName, ReadableMap eventData) {
        if (!isEventSystemReady()) {
            Log.w(TAG, "No listeners for scene event: " + sceneId + "." + eventName);
            return;
        }
        
        WritableMap body = Arguments.createMap();
        body.putString("sceneId", sceneId != null ? sceneId : "");
        body.putString("eventName", eventName != null ? eventName : "");
        body.putMap("eventData", eventData != null ? eventData : Arguments.createMap());
        body.putDouble("timestamp", System.currentTimeMillis() / 1000.0);
        
        sendEvent(EVENT_SCENE_EVENT, body);
        
        Log.i(TAG, "Emitted scene event: " + sceneId + "." + eventName);
    }
    
    /**
     * Send an event to JavaScript using React Native's event system
     */
    private void sendEvent(String eventName, WritableMap params) {
        try {
            ReactApplicationContext reactContext = getReactApplicationContext();
            if (reactContext != null && reactContext.hasActiveCatalystInstance()) {
                reactContext
                    .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class)
                    .emit(eventName, params);
            } else {
                Log.w(TAG, "Cannot send event " + eventName + ": no active React context");
            }
        } catch (Exception e) {
            Log.e(TAG, "Error sending event " + eventName + ": " + e.getMessage(), e);
        }
    }
    
    /**
     * Cleanup method
     */
    public void cleanup() {
        Log.i(TAG, "Cleaning up ViroEventsTurboModule");
        mActiveEvents.clear();
        mListenerCount.set(0);
        if (sInstance == this) {
            sInstance = null;
        }
    }
    
    @Override
    public void onCatalystInstanceDestroy() {
        super.onCatalystInstanceDestroy();
        cleanup();
    }
}
