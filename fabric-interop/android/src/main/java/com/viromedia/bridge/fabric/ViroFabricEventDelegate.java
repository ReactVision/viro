//  Copyright © 2025 ReactVision. All rights reserved.
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

package com.viromedia.bridge.fabric;

import android.util.Log;

import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.ReactContext;
import com.facebook.react.bridge.WritableArray;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.uimanager.events.RCTEventEmitter;
import com.viro.core.ARHitTestResult;
import com.viro.core.ARPointCloud;
import com.viro.core.ClickState;
import com.viro.core.ControllerStatus;
import com.viro.core.EventDelegate;
import com.viro.core.Node;
import com.viro.core.PinchState;
import com.viro.core.RotateState;
import com.viro.core.SwipeState;
import com.viro.core.TouchState;
import com.viro.core.internal.CameraCallback;

import java.lang.ref.WeakReference;
import java.util.HashMap;
import java.util.Map;

/**
 * Event delegate for the Viro Fabric interop layer.
 * This class bridges events from the native Viro engine to the Fabric event system.
 * It follows the same patterns as ComponentEventDelegate but integrates with the Fabric container.
 */
public class ViroFabricEventDelegate implements EventDelegate.EventDelegateCallback {
    private static final String TAG = "ViroFabricEventDelegate";
    
    private WeakReference<ViroFabricContainer> weakContainer;
    private ReactContext reactContext;
    private int containerId;
    
    // Event callback registry for JSI callbacks
    private Map<String, String> eventCallbacks = new HashMap<>();
    
    public ViroFabricEventDelegate(ViroFabricContainer container, ReactContext reactContext, int containerId) {
        this.weakContainer = new WeakReference<>(container);
        this.reactContext = reactContext;
        this.containerId = containerId;
    }
    
    /**
     * Register a callback for a specific event on a node.
     */
    public void registerEventCallback(String callbackId, String eventName, String nodeId) {
        String key = nodeId + ":" + eventName;
        eventCallbacks.put(key, callbackId);
        Log.d(TAG, "Registered event callback: " + key + " -> " + callbackId);
    }
    
    /**
     * Unregister a callback for a specific event on a node.
     */
    public void unregisterEventCallback(String callbackId, String eventName, String nodeId) {
        String key = nodeId + ":" + eventName;
        eventCallbacks.remove(key);
        Log.d(TAG, "Unregistered event callback: " + key);
    }
    
    /**
     * Emit an event to both the React Native event system and JSI callbacks.
     */
    private void emitEvent(String eventName, WritableMap eventData, String nodeId) {
        // Emit to React Native event system
        if (reactContext != null) {
            reactContext.getJSModule(RCTEventEmitter.class).receiveEvent(
                containerId,
                eventName,
                eventData
            );
        }
        
        // Emit to JSI callback if registered
        if (nodeId != null) {
            String key = nodeId + ":" + eventName;
            String callbackId = eventCallbacks.get(key);
            if (callbackId != null) {
                ViroFabricContainer container = weakContainer.get();
                if (container != null) {
                    container.dispatchEventToJS(callbackId, eventData);
                }
            }
        }
    }

    @Override
    public void onHover(int source, Node node, boolean isHovering, float position[]) {
        WritableArray positionArray = Arguments.createArray();
        if (position != null && position.length == 3) {
            positionArray.pushDouble(position[0]);
            positionArray.pushDouble(position[1]);
            positionArray.pushDouble(position[2]);
        }

        WritableMap event = Arguments.createMap();
        event.putInt("source", source);
        event.putBoolean("isHovering", isHovering);
        event.putArray("position", positionArray);

        String nodeId = node != null ? node.getUniqueID() : null;
        emitEvent(ViroFabricEvents.ON_HOVER, event, nodeId);
    }

    @Override
    public void onClick(int source, Node node, ClickState clickState, float position[]) {
        WritableArray positionArray = Arguments.createArray();
        if (position != null && position.length == 3) {
            positionArray.pushDouble(position[0]);
            positionArray.pushDouble(position[1]);
            positionArray.pushDouble(position[2]);
        }

        WritableMap event = Arguments.createMap();
        event.putInt("source", source);
        event.putInt("clickState", clickState.getTypeId());
        event.putArray("position", positionArray);

        String nodeId = node != null ? node.getUniqueID() : null;
        emitEvent(ViroFabricEvents.ON_CLICK, event, nodeId);
    }

    @Override
    public void onTouch(int source, Node node, TouchState touchState, float touchPadPos[]) {
        WritableMap event = Arguments.createMap();
        event.putInt("source", source);
        event.putInt("touchState", touchState.getTypeId());

        WritableArray touchPos = Arguments.createArray();
        if (touchPadPos != null && touchPadPos.length >= 2) {
            touchPos.pushDouble(touchPadPos[0]);
            touchPos.pushDouble(touchPadPos[1]);
        }
        event.putArray("touchPos", touchPos);

        String nodeId = node != null ? node.getUniqueID() : null;
        emitEvent(ViroFabricEvents.ON_TOUCH, event, nodeId);
    }

    @Override
    public void onSwipe(int source, Node target, SwipeState swipeState) {
        WritableMap event = Arguments.createMap();
        event.putInt("source", source);
        event.putInt("swipeState", swipeState.getTypeId());
        
        String nodeId = target != null ? target.getUniqueID() : null;
        emitEvent(ViroFabricEvents.ON_SWIPE, event, nodeId);
    }

    @Override
    public void onScroll(int source, Node node, float x, float y) {
        WritableMap event = Arguments.createMap();
        event.putInt("source", source);
        WritableArray scrollPos = Arguments.createArray();
        scrollPos.pushDouble(x);
        scrollPos.pushDouble(y);
        event.putArray("scrollPos", scrollPos);
        
        String nodeId = node != null ? node.getUniqueID() : null;
        emitEvent(ViroFabricEvents.ON_SCROLL, event, nodeId);
    }

    @Override
    public void onDrag(int source, Node target, float x, float y, float z) {
        WritableMap event = Arguments.createMap();
        event.putInt("source", source);
        WritableArray dragToPos = Arguments.createArray();
        dragToPos.pushDouble(x);
        dragToPos.pushDouble(y);
        dragToPos.pushDouble(z);
        event.putArray("dragToPos", dragToPos);

        String nodeId = target != null ? target.getUniqueID() : null;
        emitEvent(ViroFabricEvents.ON_DRAG, event, nodeId);
    }

    @Override
    public void onFuse(int source, Node target) {
        WritableMap event = Arguments.createMap();
        event.putInt("source", source);
        
        String nodeId = target != null ? target.getUniqueID() : null;
        emitEvent(ViroFabricEvents.ON_FUSE, event, nodeId);
    }

    @Override
    public void onPinch(int source, Node target, float scaleFactor, PinchState pinchState) {
        WritableMap event = Arguments.createMap();
        event.putInt("source", source);
        event.putDouble("scaleFactor", scaleFactor);
        event.putInt("pinchState", pinchState.getTypeId());

        String nodeId = target != null ? target.getUniqueID() : null;
        emitEvent(ViroFabricEvents.ON_PINCH, event, nodeId);
    }

    @Override
    public void onRotate(int source, Node target, float rotationRadians, RotateState rotateState) {
        WritableMap event = Arguments.createMap();
        event.putInt("source", source);
        event.putDouble("rotationFactor", Math.toDegrees(rotationRadians));
        event.putInt("rotateState", rotateState.getTypeId());

        String nodeId = target != null ? target.getUniqueID() : null;
        emitEvent(ViroFabricEvents.ON_ROTATE, event, nodeId);
    }

    @Override
    public void onControllerStatus(int source, ControllerStatus controllerStatus) {
        WritableMap event = Arguments.createMap();
        event.putInt("source", source);
        event.putInt("controllerStatus", controllerStatus.getTypeId());
        
        emitEvent(ViroFabricEvents.ON_CONTROLLER_STATUS, event, null);
    }

    @Override
    public void onCameraARHitTest(ARHitTestResult results[]) {
        ViroFabricContainer container = weakContainer.get();
        if (container == null) {
            return;
        }

        // Get camera position asynchronously (similar to ComponentEventDelegate)
        container.getCameraPositionAsync(new CameraCallback() {
            @Override
            public void onGetCameraOrientation(float posX, float poxY, float posZ,
                                               float rotEulerX, float rotEulerY, float rotEulerZ,
                                               float forwardX, float forwardY, float forwardZ,
                                               float upX, float upY, float upZ) {
                WritableArray cameraOrientationArray = Arguments.createArray();
                cameraOrientationArray.pushDouble(posX);
                cameraOrientationArray.pushDouble(poxY);
                cameraOrientationArray.pushDouble(posZ);
                cameraOrientationArray.pushDouble(Math.toDegrees(rotEulerX));
                cameraOrientationArray.pushDouble(Math.toDegrees(rotEulerY));
                cameraOrientationArray.pushDouble(Math.toDegrees(rotEulerZ));
                cameraOrientationArray.pushDouble(forwardX);
                cameraOrientationArray.pushDouble(forwardY);
                cameraOrientationArray.pushDouble(forwardZ);
                cameraOrientationArray.pushDouble(upX);
                cameraOrientationArray.pushDouble(upY);
                cameraOrientationArray.pushDouble(upZ);

                WritableArray hitTestResultsArray = Arguments.createArray();
                for (ARHitTestResult result : results) {
                    // Note: We would need to import ARUtils or create our own conversion
                    // For now, create a basic map structure
                    WritableMap resultMap = Arguments.createMap();
                    // Add basic hit test result data here
                    hitTestResultsArray.pushMap(resultMap);
                }
                
                WritableMap event = Arguments.createMap();
                event.putArray("hitTestResults", hitTestResultsArray);
                event.putArray("cameraOrientation", cameraOrientationArray);

                emitEvent(ViroFabricEvents.ON_CAMERA_AR_HIT_TEST_VIRO, event, null);
            }
        });
    }

    @Override
    public void onARPointCloudUpdate(ARPointCloud arPointCloud) {
        WritableMap event = Arguments.createMap();
        // Note: We would need to import ARUtils or create our own conversion
        // For now, create a basic map structure
        WritableMap pointCloudMap = Arguments.createMap();
        event.putMap("pointCloud", pointCloudMap);

        emitEvent(ViroFabricEvents.ON_AR_POINT_CLOUD_UPDATE, event, null);
    }

    @Override
    public void onCameraTransformUpdate(float posX, float poxY, float posZ,
                                        float rotEulerX, float rotEulerY, float rotEulerZ,
                                        float forwardX, float forwardY, float forwardZ,
                                        float upX, float upY, float upZ) {
        WritableMap event = Arguments.createMap();

        WritableArray cameraTransformArray = Arguments.createArray();
        cameraTransformArray.pushDouble(posX);
        cameraTransformArray.pushDouble(poxY);
        cameraTransformArray.pushDouble(posZ);
        cameraTransformArray.pushDouble(Math.toDegrees(rotEulerX));
        cameraTransformArray.pushDouble(Math.toDegrees(rotEulerY));
        cameraTransformArray.pushDouble(Math.toDegrees(rotEulerZ));
        cameraTransformArray.pushDouble(forwardX);
        cameraTransformArray.pushDouble(forwardY);
        cameraTransformArray.pushDouble(forwardZ);
        cameraTransformArray.pushDouble(upX);
        cameraTransformArray.pushDouble(upY);
        cameraTransformArray.pushDouble(upZ);

        event.putArray("cameraTransform", cameraTransformArray);

        // Emit both the legacy event and the Fabric-specific event
        emitEvent(ViroFabricEvents.ON_CAMERA_TRANSFORM_UPDATE, event, null);
        emitEvent(ViroFabricEvents.ON_CAMERA_TRANSFORM_UPDATE_FABRIC, event, null);
    }
    
    /**
     * Emit container-specific events
     */
    public void onInitialized(boolean success) {
        WritableMap event = Arguments.createMap();
        event.putBoolean("success", success);
        
        emitEvent(ViroFabricEvents.ON_INITIALIZED, event, null);
    }
    
    public void onTrackingUpdated(int state, int reason) {
        WritableMap event = Arguments.createMap();
        event.putInt("state", state);
        event.putInt("reason", reason);
        
        // Emit both the legacy event and the Fabric-specific event
        emitEvent(ViroFabricEvents.ON_TRACKING_UPDATED, event, null);
        emitEvent(ViroFabricEvents.ON_TRACKING_UPDATED_FABRIC, event, null);
    }
    
    /**
     * Clean up resources
     */
    public void dispose() {
        eventCallbacks.clear();
        weakContainer.clear();
        reactContext = null;
    }
}
