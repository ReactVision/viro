//
//  ViroControllerView.java
//  ViroReact
//
//  Created for ReactVision.
//  Copyright © 2025 ReactVision. All rights reserved.
//

package com.viromedia.bridge.fabric;

import android.content.Context;
import android.util.Log;
import android.view.GestureDetector;
import android.view.MotionEvent;
import android.view.ScaleGestureDetector;
import android.view.View;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;

import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.ReactContext;
import com.facebook.react.bridge.ReadableArray;
import com.facebook.react.bridge.WritableArray;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.uimanager.events.RCTEventEmitter;

import com.viro.core.Controller;
import com.viro.core.EventDelegate;
import com.viro.core.Node;
import com.viro.core.Vector;
import com.viro.core.ViroContext;
import com.viromedia.bridge.component.VRTComponent;
import com.viromedia.bridge.utility.ComponentEventDelegate;

import java.lang.ref.WeakReference;
import java.util.Timer;
import java.util.TimerTask;

/**
 * Native Android view for ViroController component.
 * ViroController provides comprehensive VR/AR controller input management
 * with gesture handling, input capabilities, and controller state tracking.
 */
public class ViroControllerView extends View implements 
    GestureDetector.OnGestureListener, 
    ScaleGestureDetector.OnScaleGestureListener {
    
    private static final String TAG = "ViroControllerView";
    
    // Controller status
    private static final String STATUS_CONNECTED = "Connected";
    private static final String STATUS_DISCONNECTED = "Disconnected";
    private static final String STATUS_ERROR = "Error";
    
    private ReactContext mReactContext;
    
    // ViroReact Integration
    private Node mNodeJni;
    private Controller mControllerJni;
    private ViroContext mViroContext;
    private EventDelegate mEventDelegateJni;
    private ComponentEventDelegate mComponentEventDelegate;
    
    // Controller properties
    private boolean mReticleVisibility = true;
    private boolean mControllerVisibility = true;
    private Vector mControllerPosition = new Vector(0.0f, 0.0f, 0.0f);
    private Vector mControllerRotation = new Vector(0.0f, 0.0f, 0.0f);
    private Vector mControllerForward = new Vector(0.0f, 0.0f, -1.0f);
    
    // Input capabilities
    private boolean mCanClick = false;
    private boolean mCanTouch = false;
    private boolean mCanScroll = false;
    private boolean mCanSwipe = false;
    private boolean mCanDrag = false;
    private boolean mCanPinch = false;
    private boolean mCanRotate = false;
    private boolean mCanFuse = false;
    private boolean mCanGetControllerStatus = false;
    
    // Fuse properties
    private float mTimeToFuse = 2.0f;
    private Timer mFuseTimer;
    private boolean mIsFusing = false;
    
    // Controller state
    private String mControllerStatus = STATUS_DISCONNECTED;
    private boolean mIsControllerActive = false;
    private Controller.ConnectionState mConnectionState = Controller.ConnectionState.DISCONNECTED;
    
    // Gesture detectors
    private GestureDetector mGestureDetector;
    private ScaleGestureDetector mScaleGestureDetector;
    
    // Touch tracking
    private float mLastTouchX, mLastTouchY;
    private long mLastInputTime;
    
    public ViroControllerView(@NonNull Context context) {
        super(context);
        mReactContext = (ReactContext) context;
        Log.d(TAG, "ViroControllerView initialized with ViroReact Controller integration");
        
        initializeController();
    }
    
    private void initializeController() {
        Log.d(TAG, "Initializing ViroReact controller with default properties");
        
        // Create ViroReact Node for the controller
        mNodeJni = new Node();
        
        // Create Controller with initial properties
        mControllerJni = new Controller(mViroContext);
        
        // Configure initial controller properties
        applyControllerProperties();
        
        // Attach controller to node
        mNodeJni.setController(mControllerJni);
        
        // Create and attach event callbacks
        mComponentEventDelegate = new ComponentEventDelegate(new VRTComponentWrapper(this));
        mEventDelegateJni = new EventDelegate();
        mEventDelegateJni.setEventDelegateCallback(mComponentEventDelegate);
        mNodeJni.setEventDelegate(mEventDelegateJni);
        
        // Initialize gesture detectors
        mGestureDetector = new GestureDetector(getContext(), this);
        mScaleGestureDetector = new ScaleGestureDetector(getContext(), this);
        
        mLastInputTime = System.currentTimeMillis();
        
        // Controller views are typically transparent
        setBackgroundColor(android.graphics.Color.TRANSPARENT);
        setClickable(true);
        setFocusable(true);
        
        Log.d(TAG, "ViroReact Controller initialized successfully");
    }
    
    /**
     * Wrapper class to make ViroControllerView compatible with ComponentEventDelegate
     */
    private static class VRTComponentWrapper extends VRTComponent {
        private WeakReference<ViroControllerView> mControllerView;
        
        public VRTComponentWrapper(ViroControllerView controllerView) {
            super(controllerView.getContext(), null, -1, -1, controllerView.mReactContext);
            mControllerView = new WeakReference<>(controllerView);
        }
        
        @Override
        public void emitEvent(String eventName, WritableMap eventData) {
            ViroControllerView controllerView = mControllerView.get();
            if (controllerView != null) {
                controllerView.emitControllerEvent(eventName, eventData);
            }
        }
    }
    
    /**
     * Get the underlying ViroReact Node object
     */
    public Node getNodeJni() {
        return mNodeJni;
    }
    
    /**
     * Get the underlying ViroReact Controller object
     */
    public Controller getControllerJni() {
        return mControllerJni;
    }
    
    /**
     * Set the ViroContext for this controller
     */
    public void setViroContext(ViroContext context) {
        mViroContext = context;
        // Recreate controller with ViroContext if needed
        if (mControllerJni != null) {
            mControllerJni.dispose();
            mControllerJni = new Controller(mViroContext);
            applyControllerProperties();
            if (mNodeJni != null) {
                mNodeJni.setController(mControllerJni);
            }
        }
    }
    
    @Override
    protected void onMeasure(int widthMeasureSpec, int heightMeasureSpec) {
        // Controllers don't have traditional dimensions
        // Set a minimal size for the view container
        setMeasuredDimension(1, 1);
    }
    
    @Override
    protected void onLayout(boolean changed, int left, int top, int right, int bottom) {
        // Controller layout is handled by 3D positioning and controller tracking
        Log.d(TAG, "onLayout called: " + changed + " bounds: [" + left + "," + top + "," + right + "," + bottom + "]");
    }
    
    @Override
    public boolean onTouchEvent(MotionEvent event) {
        boolean handled = false;
        
        // Handle scale gestures first
        if (mCanPinch) {
            handled = mScaleGestureDetector.onTouchEvent(event) || handled;
        }
        
        // Handle other gestures
        if (mCanClick || mCanTouch || mCanDrag || mCanSwipe || mCanScroll) {
            handled = mGestureDetector.onTouchEvent(event) || handled;
        }
        
        // Handle touch events
        if (mCanTouch) {
            handleTouchEvent(event);
            handled = true;
        }
        
        // Handle drag events
        if (mCanDrag && event.getAction() == MotionEvent.ACTION_MOVE) {
            handleDragEvent(event);
            handled = true;
        }
        
        return handled || super.onTouchEvent(event);
    }
    
    // Property setters
    
    public void setReticleVisibility(boolean visible) {
        Log.d(TAG, "Setting reticle visibility: " + visible);
        mReticleVisibility = visible;
        updateReticleVisibility();
    }
    
    public void setControllerVisibility(boolean visible) {
        Log.d(TAG, "Setting controller visibility: " + visible);
        mControllerVisibility = visible;
        updateControllerVisibility();
    }
    
    public void setCanClick(boolean canClick) {
        mCanClick = canClick;
        Log.d(TAG, "Can click: " + canClick);
        updateInputCapabilities();
    }
    
    public void setCanTouch(boolean canTouch) {
        mCanTouch = canTouch;
        Log.d(TAG, "Can touch: " + canTouch);
        updateInputCapabilities();
    }
    
    public void setCanScroll(boolean canScroll) {
        mCanScroll = canScroll;
        Log.d(TAG, "Can scroll: " + canScroll);
        updateInputCapabilities();
    }
    
    public void setCanSwipe(boolean canSwipe) {
        mCanSwipe = canSwipe;
        Log.d(TAG, "Can swipe: " + canSwipe);
        updateInputCapabilities();
    }
    
    public void setCanDrag(boolean canDrag) {
        mCanDrag = canDrag;
        Log.d(TAG, "Can drag: " + canDrag);
        updateInputCapabilities();
    }
    
    public void setCanPinch(boolean canPinch) {
        mCanPinch = canPinch;
        Log.d(TAG, "Can pinch: " + canPinch);
        updateInputCapabilities();
    }
    
    public void setCanRotate(boolean canRotate) {
        mCanRotate = canRotate;
        Log.d(TAG, "Can rotate: " + canRotate);
        updateInputCapabilities();
    }
    
    public void setCanFuse(boolean canFuse) {
        mCanFuse = canFuse;
        Log.d(TAG, "Can fuse: " + canFuse);
        updateInputCapabilities();
    }
    
    public void setCanGetControllerStatus(boolean canGetStatus) {
        mCanGetControllerStatus = canGetStatus;
        Log.d(TAG, "Can get controller status: " + canGetStatus);
        updateInputCapabilities();
    }
    
    public void setTimeToFuse(float timeToFuse) {
        Log.d(TAG, "Setting time to fuse: " + timeToFuse);
        mTimeToFuse = timeToFuse;
        
        if (mControllerJni != null) {
            mControllerJni.setFuseTime(timeToFuse);
        }
    }
    
    public void setControllerPosition(@Nullable ReadableArray position) {
        Log.d(TAG, "Setting controller position: " + position);
        
        if (position != null && position.size() >= 3) {
            try {
                float x = (float) position.getDouble(0);
                float y = (float) position.getDouble(1);
                float z = (float) position.getDouble(2);
                mControllerPosition = new Vector(x, y, z);
            } catch (Exception e) {
                Log.e(TAG, "Error parsing controller position: " + e.getMessage());
                mControllerPosition = new Vector(0.0f, 0.0f, 0.0f);
            }
        } else {
            mControllerPosition = new Vector(0.0f, 0.0f, 0.0f);
        }
        
        applyControllerTransform();
    }
    
    public void setControllerRotation(@Nullable ReadableArray rotation) {
        Log.d(TAG, "Setting controller rotation: " + rotation);
        
        if (rotation != null && rotation.size() >= 3) {
            try {
                float x = (float) Math.toRadians(rotation.getDouble(0)); // Convert to radians
                float y = (float) Math.toRadians(rotation.getDouble(1));
                float z = (float) Math.toRadians(rotation.getDouble(2));
                mControllerRotation = new Vector(x, y, z);
            } catch (Exception e) {
                Log.e(TAG, "Error parsing controller rotation: " + e.getMessage());
                mControllerRotation = new Vector(0.0f, 0.0f, 0.0f);
            }
        } else {
            mControllerRotation = new Vector(0.0f, 0.0f, 0.0f);
        }
        
        applyControllerTransform();
    }
    
    public void setControllerForward(@Nullable ReadableArray forward) {
        Log.d(TAG, "Setting controller forward: " + forward);
        
        if (forward != null && forward.size() >= 3) {
            try {
                float x = (float) forward.getDouble(0);
                float y = (float) forward.getDouble(1);
                float z = (float) forward.getDouble(2);
                mControllerForward = new Vector(x, y, z);
            } catch (Exception e) {
                Log.e(TAG, "Error parsing controller forward: " + e.getMessage());
                mControllerForward = new Vector(0.0f, 0.0f, -1.0f);
            }
        } else {
            mControllerForward = new Vector(0.0f, 0.0f, -1.0f);
        }
        
        if (mControllerJni != null) {
            mControllerJni.setForwardVector(mControllerForward);
        }
    }
    
    // Controller management
    
    public void startController() {
        Log.d(TAG, "Starting controller");
        mIsControllerActive = true;
        
        if (mControllerJni != null) {
            mControllerJni.setActive(true);
            mConnectionState = Controller.ConnectionState.CONNECTED;
        }
        
        updateControllerStatus(STATUS_CONNECTED);
    }
    
    public void stopController() {
        Log.d(TAG, "Stopping controller");
        mIsControllerActive = false;
        
        stopFuseTimer();
        
        if (mControllerJni != null) {
            mControllerJni.setActive(false);
            mConnectionState = Controller.ConnectionState.DISCONNECTED;
        }
        
        updateControllerStatus(STATUS_DISCONNECTED);
    }
    
    // Helper Methods
    private void applyControllerProperties() {
        if (mControllerJni != null) {
            Log.d(TAG, "Applying controller properties to ViroReact Controller");
            
            // Apply visibility settings
            updateControllerVisibility();
            updateReticleVisibility();
            
            // Apply input capabilities
            updateInputCapabilities();
            
            // Apply controller transform
            applyControllerTransform();
            
            // Apply fuse settings
            mControllerJni.setFuseTime(mTimeToFuse);
            mControllerJni.setForwardVector(mControllerForward);
            
            Log.d(TAG, "Controller properties applied successfully");
        }
    }
    
    private void updateControllerVisibility() {
        Log.d(TAG, "Updating controller visibility: " + (mControllerVisibility ? "visible" : "hidden"));
        setAlpha(mControllerVisibility ? 1.0f : 0.0f);
        
        if (mControllerJni != null) {
            mControllerJni.setVisible(mControllerVisibility);
        }
    }
    
    private void updateReticleVisibility() {
        Log.d(TAG, "Updating reticle visibility: " + (mReticleVisibility ? "visible" : "hidden"));
        
        if (mControllerJni != null) {
            mControllerJni.setReticleVisible(mReticleVisibility);
        }
    }
    
    private void updateInputCapabilities() {
        if (mControllerJni != null) {
            Log.d(TAG, "Updating input capabilities");
            
            // Set input capabilities on the ViroReact controller
            mControllerJni.setClickEnabled(mCanClick);
            mControllerJni.setTouchEnabled(mCanTouch);
            mControllerJni.setScrollEnabled(mCanScroll);
            mControllerJni.setSwipeEnabled(mCanSwipe);
            mControllerJni.setDragEnabled(mCanDrag);
            mControllerJni.setPinchEnabled(mCanPinch);
            mControllerJni.setRotateEnabled(mCanRotate);
            mControllerJni.setFuseEnabled(mCanFuse);
            
            Log.d(TAG, "Input capabilities updated successfully");
        }
    }
    
    private void applyControllerTransform() {
        if (mNodeJni != null && mControllerJni != null) {
            Log.d(TAG, "Applying controller transform properties");
            
            // Apply position and rotation to the controller node
            mNodeJni.setPosition(mControllerPosition);
            mNodeJni.setRotation(mControllerRotation);
            
            // Update controller position and orientation
            mControllerJni.setPosition(mControllerPosition);
            mControllerJni.setRotation(mControllerRotation);
            
            Log.d(TAG, "Controller transform applied: Position=" + mControllerPosition + ", Rotation=" + mControllerRotation);
        }
    }
    
    private void updateControllerStatus(String status) {
        if (mControllerStatus.equals(status)) return;
        
        mControllerStatus = status;
        Log.d(TAG, "Controller status updated: " + status);
        
        // Update ViroReact controller connection state
        if (mControllerJni != null) {
            switch (status) {
                case STATUS_CONNECTED:
                    mConnectionState = Controller.ConnectionState.CONNECTED;
                    break;
                case STATUS_DISCONNECTED:
                    mConnectionState = Controller.ConnectionState.DISCONNECTED;
                    break;
                case STATUS_ERROR:
                    mConnectionState = Controller.ConnectionState.ERROR;
                    break;
            }
            mControllerJni.setConnectionState(mConnectionState);
        }
        
        // Emit controller status event
        if (mCanGetControllerStatus) {
            emitControllerStatusEvent(status);
        }
    }
    
    // Gesture handling implementation
    
    @Override
    public boolean onDown(MotionEvent e) {
        mLastTouchX = e.getX();
        mLastTouchY = e.getY();
        mLastInputTime = System.currentTimeMillis();
        return true;
    }
    
    @Override
    public void onShowPress(MotionEvent e) {
        // Not used
    }
    
    @Override
    public boolean onSingleTapUp(MotionEvent e) {
        if (mCanClick && mIsControllerActive) {
            handleClickEvent(e);
            
            // Start fuse timer if enabled
            if (mCanFuse) {
                startFuseTimer();
            }
            return true;
        }
        return false;
    }
    
    @Override
    public boolean onScroll(MotionEvent e1, MotionEvent e2, float distanceX, float distanceY) {
        if (mCanScroll && mIsControllerActive) {
            handleScrollEvent(distanceX, distanceY);
            return true;
        }
        return false;
    }
    
    @Override
    public void onLongPress(MotionEvent e) {
        // Could be used for long press events
    }
    
    @Override
    public boolean onFling(MotionEvent e1, MotionEvent e2, float velocityX, float velocityY) {
        if (mCanSwipe && mIsControllerActive) {
            handleSwipeEvent(velocityX, velocityY);
            return true;
        }
        return false;
    }
    
    @Override
    public boolean onScale(ScaleGestureDetector detector) {
        if (mCanPinch && mIsControllerActive) {
            handlePinchEvent(detector.getScaleFactor(), "changed");
            return true;
        }
        return false;
    }
    
    @Override
    public boolean onScaleBegin(ScaleGestureDetector detector) {
        if (mCanPinch && mIsControllerActive) {
            handlePinchEvent(detector.getScaleFactor(), "began");
            return true;
        }
        return false;
    }
    
    @Override
    public void onScaleEnd(ScaleGestureDetector detector) {
        if (mCanPinch && mIsControllerActive) {
            handlePinchEvent(detector.getScaleFactor(), "ended");
        }
    }
    
    // Event handling
    
    private void handleClickEvent(MotionEvent event) {
        Log.d(TAG, "Handling click event");
        
        WritableArray position = Arguments.createArray();
        position.pushDouble(event.getX());
        position.pushDouble(event.getY());
        position.pushDouble(0.0);
        
        WritableMap eventData = Arguments.createMap();
        eventData.putArray("position", position);
        eventData.putString("source", "controller");
        eventData.putString("clickState", "clicked");
        
        emitControllerEvent("onClickViro", eventData);
    }
    
    private void handleTouchEvent(MotionEvent event) {
        String state;
        switch (event.getAction()) {
            case MotionEvent.ACTION_DOWN:
                state = "began";
                break;
            case MotionEvent.ACTION_MOVE:
                state = "changed";
                break;
            case MotionEvent.ACTION_UP:
            case MotionEvent.ACTION_CANCEL:
                state = "ended";
                break;
            default:
                return;
        }
        
        WritableArray touchPos = Arguments.createArray();
        touchPos.pushDouble(event.getX());
        touchPos.pushDouble(event.getY());
        
        WritableMap eventData = Arguments.createMap();
        eventData.putString("touchState", state);
        eventData.putArray("touchPos", touchPos);
        eventData.putString("source", "controller");
        
        emitControllerEvent("onTouchViro", eventData);
    }
    
    private void handleScrollEvent(float distanceX, float distanceY) {
        WritableArray scrollPos = Arguments.createArray();
        scrollPos.pushDouble(-distanceX); // Invert for natural scrolling
        scrollPos.pushDouble(-distanceY);
        
        WritableMap eventData = Arguments.createMap();
        eventData.putArray("scrollPos", scrollPos);
        eventData.putString("source", "controller");
        
        emitControllerEvent("onScrollViro", eventData);
    }
    
    private void handleSwipeEvent(float velocityX, float velocityY) {
        String direction;
        if (Math.abs(velocityX) > Math.abs(velocityY)) {
            direction = velocityX > 0 ? "right" : "left";
        } else {
            direction = velocityY > 0 ? "down" : "up";
        }
        
        WritableMap eventData = Arguments.createMap();
        eventData.putString("swipeState", direction);
        eventData.putString("source", "controller");
        
        emitControllerEvent("onSwipeViro", eventData);
    }
    
    private void handleDragEvent(MotionEvent event) {
        WritableArray dragToPos = Arguments.createArray();
        dragToPos.pushDouble(event.getX());
        dragToPos.pushDouble(event.getY());
        dragToPos.pushDouble(0.0);
        
        WritableMap eventData = Arguments.createMap();
        eventData.putArray("dragToPos", dragToPos);
        eventData.putString("source", "controller");
        
        emitControllerEvent("onDragViro", eventData);
    }
    
    private void handlePinchEvent(float scaleFactor, String state) {
        WritableMap eventData = Arguments.createMap();
        eventData.putString("pinchState", state);
        eventData.putDouble("scaleFactor", scaleFactor);
        eventData.putString("source", "controller");
        
        emitControllerEvent("onPinchViro", eventData);
    }
    
    private void handleRotateEvent(float rotationFactor, String state) {
        WritableMap eventData = Arguments.createMap();
        eventData.putString("rotateState", state);
        eventData.putDouble("rotationFactor", rotationFactor);
        eventData.putString("source", "controller");
        
        emitControllerEvent("onRotateViro", eventData);
    }
    
    private void handleFuseEvent() {
        WritableMap eventData = Arguments.createMap();
        eventData.putString("source", "controller");
        
        emitControllerEvent("onFuseViro", eventData);
    }
    
    // Fuse timer management
    
    private void startFuseTimer() {
        if (mIsFusing || mTimeToFuse <= 0) return;
        
        mIsFusing = true;
        mFuseTimer = new Timer();
        mFuseTimer.schedule(new TimerTask() {
            @Override
            public void run() {
                post(() -> {
                    mIsFusing = false;
                    handleFuseEvent();
                });
            }
        }, (long) (mTimeToFuse * 1000));
    }
    
    private void stopFuseTimer() {
        if (mFuseTimer != null) {
            mFuseTimer.cancel();
            mFuseTimer = null;
        }
        mIsFusing = false;
    }
    
    // Event emission
    
    private void emitControllerEvent(String eventName, @Nullable WritableMap eventData) {
        try {
            if (mReactContext != null && mReactContext.hasActiveCatalystInstance()) {
                mReactContext.getJSModule(RCTEventEmitter.class)
                    .receiveEvent(getId(), eventName, eventData);
            } else {
                Log.w(TAG, "Cannot emit event " + eventName + ": no active React context");
            }
        } catch (Exception e) {
            Log.e(TAG, "Error emitting event " + eventName + ": " + e.getMessage(), e);
        }
    }
    
    private void emitControllerStatusEvent(String status) {
        WritableMap eventData = Arguments.createMap();
        eventData.putString("controllerStatus", status);
        eventData.putString("source", "controller");
        
        emitControllerEvent("onControllerStatusViro", eventData);
    }
    
    // Public methods
    
    public Vector getControllerForward() {
        return mControllerForward;
    }
    
    public Vector getControllerPosition() {
        return mControllerPosition;
    }
    
    public Vector getControllerRotation() {
        return mControllerRotation;
    }
    
    public boolean isControllerConnected() {
        return mConnectionState == Controller.ConnectionState.CONNECTED;
    }
    
    // Lifecycle methods
    
    public void onDropViewInstance() {
        Log.d(TAG, "onDropViewInstance called");
        
        stopController();
        
        // Clean up ViroReact controller resources
        if (mNodeJni != null) {
            mNodeJni.setEventDelegate(null);
            mNodeJni.setController(null);
            mNodeJni.dispose();
            mNodeJni = null;
        }
        
        if (mEventDelegateJni != null) {
            mEventDelegateJni.dispose();
            mEventDelegateJni = null;
        }
        
        if (mControllerJni != null) {
            mControllerJni.dispose();
            mControllerJni = null;
        }
        
        // Clear references
        mComponentEventDelegate = null;
        mViroContext = null;
        mReactContext = null;
    }
    
    @Override
    protected void onAttachedToWindow() {
        super.onAttachedToWindow();
        Log.d(TAG, "ViroControllerView attached to window");
        
        // Controller will be added to scene hierarchy through parent-child relationships
        if (mNodeJni != null && mControllerJni != null && mViroContext != null) {
            Log.d(TAG, "ViroReact controller ready for scene attachment");
        }
        
        // Ensure controller properties are applied
        applyControllerProperties();
    }
    
    @Override
    protected void onDetachedFromWindow() {
        super.onDetachedFromWindow();
        Log.d(TAG, "ViroControllerView detached from window");
        
        // Controller cleanup is handled in onDropViewInstance
        // Scene hierarchy cleanup is automatic through parent-child relationships
    }
    
    // Getters for current values (useful for debugging and testing)
    public boolean isReticleVisible() { return mReticleVisibility; }
    public boolean isControllerVisible() { return mControllerVisibility; }
    public boolean canClick() { return mCanClick; }
    public boolean canTouch() { return mCanTouch; }
    public boolean canScroll() { return mCanScroll; }
    public boolean canSwipe() { return mCanSwipe; }
    public boolean canDrag() { return mCanDrag; }
    public boolean canPinch() { return mCanPinch; }
    public boolean canRotate() { return mCanRotate; }
    public boolean canFuse() { return mCanFuse; }
    public boolean canGetControllerStatus() { return mCanGetControllerStatus; }
    public float getTimeToFuse() { return mTimeToFuse; }
    public String getControllerStatus() { return mControllerStatus; }
    public boolean isControllerActive() { return mIsControllerActive; }
    public boolean isFusing() { return mIsFusing; }
}