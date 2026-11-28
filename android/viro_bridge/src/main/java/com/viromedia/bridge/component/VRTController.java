//  Copyright © 2017 Viro Media. All rights reserved.
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

package com.viromedia.bridge.component;

import com.facebook.react.bridge.ReactContext;
import com.viro.core.Controller;
import com.viro.core.EventDelegate;
import com.viro.core.ViroContext;
import com.viromedia.bridge.utility.ComponentEventDelegate;
import com.viromedia.bridge.utility.ViroInputLog;
import com.viromedia.bridge.utility.ViroLog;

import java.lang.ref.WeakReference;
import java.util.ArrayList;
import java.util.Iterator;
import java.util.WeakHashMap;

public class VRTController extends VRTComponent {
    private static final String TAG = ViroLog.getTag(VRTController.class);

    // React defaults
    protected final static boolean DEFAULT_CAN_CLICK = false;
    protected final static boolean DEFAULT_CAN_TOUCH = false;
    protected final static boolean DEFAULT_CAN_SCROLL = false;
    protected final static boolean DEFAULT_CAN_SWIPE = false;
    protected final static boolean DEFAULT_CAN_FUSE = false;
    protected final static boolean DEFAULT_CAN_GET_CONTROLLER_STATUS = false;
    protected final static boolean DEFAULT_CAN_DRAG = false;
    protected final static boolean DEFAULT_CAN_PINCH = false;
    protected final static boolean DEFAULT_CAN_ROTATE = false;
    protected final static boolean DEFAULT_RETICLE_VISIBILITY = true;
    protected final static boolean DEFAULT_CONTROLLER_VISIBILITY = true;

    /**
     * The VRTControllers attached to each native Controller, oldest first. The renderer's
     * input presenter holds one event delegate, so the last one attached receives the
     * events. Kept so that when that one is torn down the delegate goes back to one that
     * is still mounted, instead of staying on a disposed delegate. Main thread only.
     */
    private static final WeakHashMap<Controller, ArrayList<WeakReference<VRTController>>> sAttached =
            new WeakHashMap<>();

    private Controller mNativeController = null;
    private boolean mIsReticleVisible = DEFAULT_RETICLE_VISIBILITY;
    private boolean mIsControllerVisible = DEFAULT_CONTROLLER_VISIBILITY;
    private EventDelegate mEventDelegateJni;
    private ComponentEventDelegate mComponentEventDelegate;

    public VRTController(ReactContext reactContext) {
        super(reactContext);
        mEventDelegateJni = new EventDelegate();
    }

    @Override
    public void onTearDown(){
        ViroInputLog.v("VRTController " + describe() + " onTearDown");
        Controller controller = mNativeController;
        mNativeController = null;
        if (mEventDelegateJni != null) {
            mEventDelegateJni.dispose();
            mEventDelegateJni = null;
        }
        if (controller != null) {
            detachFrom(controller);
        }
        super.onTearDown();
    }

    @Override
    public void setViroContext(ViroContext context) {
        super.setViroContext(context);
        if (context == null || mEventDelegateJni == null) {
            return;
        }
        mNativeController = context.getController();
        updateVisibility();

        // Create and attach callbacks.
        mComponentEventDelegate = new ComponentEventDelegate(this);
        mEventDelegateJni.setEventDelegateCallback(mComponentEventDelegate);
        mNativeController.setEventDelegate(mEventDelegateJni);
        attachTo(mNativeController);
        ViroInputLog.v("VRTController " + describe() + " setViroContext: event delegate set on controller "
                + System.identityHashCode(mNativeController));
    }

    private void attachTo(Controller controller) {
        ArrayList<WeakReference<VRTController>> attached = sAttached.get(controller);
        if (attached == null) {
            attached = new ArrayList<>();
            sAttached.put(controller, attached);
        }
        VRTController previous = null;
        for (Iterator<WeakReference<VRTController>> it = attached.iterator(); it.hasNext();) {
            VRTController other = it.next().get();
            if (other == null || other == this || other.isTornDown()) {
                it.remove();
            } else {
                previous = other;
            }
        }
        attached.add(new WeakReference<>(this));
        if (previous != null) {
            ViroLog.warn(TAG, "ViroController " + describe() + " replaces " + previous.describe()
                    + " as the receiver of controller events: only the most recently mounted"
                    + " ViroController of a navigator receives them.");
        }
    }

    private void detachFrom(Controller controller) {
        ArrayList<WeakReference<VRTController>> attached = sAttached.get(controller);
        if (attached == null) {
            return;
        }
        boolean wasReceiver = !attached.isEmpty() && attached.get(attached.size() - 1).get() == this;
        VRTController survivor = null;
        for (Iterator<WeakReference<VRTController>> it = attached.iterator(); it.hasNext();) {
            VRTController other = it.next().get();
            if (other == null || other == this || other.isTornDown() || other.mEventDelegateJni == null) {
                it.remove();
            } else {
                survivor = other;
            }
        }
        if (attached.isEmpty()) {
            sAttached.remove(controller);
        }
        if (wasReceiver && survivor != null) {
            controller.setEventDelegate(survivor.mEventDelegateJni);
            ViroInputLog.v("VRTController " + survivor.describe()
                    + " receives controller events again, after " + describe() + " was torn down");
        }
    }

    private String describe() {
        return "[tag " + getId() + ", " + System.identityHashCode(this) + "]";
    }

    public void setReticleVisibility(boolean reticleVisibility) {
        mIsReticleVisible = reticleVisibility;
    }

    public void setControllerVisibility(boolean controllerVisibility) {
        mIsControllerVisible = controllerVisibility;
    }

    private void setEventEnabled(EventDelegate.EventAction action, boolean enabled) {
        // Null once torn down: a prop applied after that has nothing to configure.
        if (mEventDelegateJni != null) {
            mEventDelegateJni.setEventEnabled(action, enabled);
        }
    }

    protected void setCanClick(boolean canClick){
        ViroInputLog.v("VRTController " + describe() + " canClick=" + canClick
                + (mEventDelegateJni == null ? " (ignored, torn down)" : ""));
        setEventEnabled(EventDelegate.EventAction.ON_CLICK, canClick);
    }

    protected void setCanTouch(boolean canTouch){
        setEventEnabled(EventDelegate.EventAction.ON_TOUCH, canTouch);
    }

    protected void setCanSwipe(boolean canSwipe){
        setEventEnabled(EventDelegate.EventAction.ON_SWIPE, canSwipe);
    }

    protected void setCanScroll(boolean canScroll){
        setEventEnabled(EventDelegate.EventAction.ON_SCROLL, canScroll);
    }

    protected void setCanFuse(boolean canFuse){
        setEventEnabled(EventDelegate.EventAction.ON_FUSE, canFuse);
    }

    protected void setCanGetControllerStatus(boolean canGetControllerStatus){
        setEventEnabled(EventDelegate.EventAction.ON_CONTROLLER_STATUS, canGetControllerStatus);
    }

    protected void setCanDrag(boolean canDrag){
        setEventEnabled(EventDelegate.EventAction.ON_DRAG, canDrag);
    }

    protected void setCanPinch(boolean canPinch){
        setEventEnabled(EventDelegate.EventAction.ON_PINCH, canPinch);
    }

    protected void setCanRotate(boolean canRotate){
        setEventEnabled(EventDelegate.EventAction.ON_ROTATE, canRotate);
    }

    /**
     * Asks the renderer for the controller's forward vector. Returns false, without
     * calling back, when this view has no native controller: before its scene is
     * attached to the renderer, and after tear down.
     */
    public boolean getForwardVectorAsync(Controller.ControllerJniCallback callback){
        Controller controller = mNativeController;
        if (controller == null) {
            return false;
        }
        controller.getControllerForwardVectorAsync(callback);
        return true;
    }

    /**
     * Asks the renderer for the ray of the given source. Returns false, without calling
     * back, when this view has no native controller (see getForwardVectorAsync).
     */
    public boolean getRayAsync(int source, Controller.ControllerRayCallback callback){
        Controller controller = mNativeController;
        if (controller == null) {
            return false;
        }
        controller.getControllerRayAsync(source, callback);
        return true;
    }

    @Override
    public void onPropsSet() {
        super.onPropsSet();
        updateVisibility();
    }

    private void updateVisibility(){
        if (mNativeController == null){
            return;
        }
        mNativeController.setControllerVisible(mIsControllerVisible);
        mNativeController.setReticleVisible(mIsReticleVisible);
    }

}
