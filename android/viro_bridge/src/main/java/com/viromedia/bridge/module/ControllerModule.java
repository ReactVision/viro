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

package com.viromedia.bridge.module;

import android.os.Handler;
import android.os.Looper;
import android.view.View;
import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.WritableArray;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.bridge.UIManager;
import com.facebook.react.fabric.FabricUIManager;
import com.facebook.react.uimanager.UIManagerHelper;
import com.facebook.react.module.annotations.ReactModule;
import com.viro.core.Controller;
import com.viromedia.bridge.component.VRTController;
import com.viromedia.bridge.utility.PendingRequests;

@ReactModule(name = "VRTControllerModule")
public class ControllerModule extends ReactContextBaseJavaModule {

    /**
     * The ViroController has no native controller yet (its scene is not attached to the
     * renderer), is torn down, or the tag is not a mounted ViroController. Ask again.
     */
    static final String E_CONTROLLER_NOT_READY = "E_CONTROLLER_NOT_READY";
    /** The renderer did not answer in time, as when the session has stopped. */
    static final String E_CONTROLLER_TIMEOUT = "E_CONTROLLER_TIMEOUT";
    static final String E_CONTROLLER = "E_CONTROLLER";
    /** The renderer answers within a frame or two; this only ends requests it never will. */
    private static final long REQUEST_TIMEOUT_MS = 2000;

    private final PendingRequests mPending = new PendingRequests();
    private final Handler mMainHandler = new Handler(Looper.getMainLooper());

    public ControllerModule(ReactApplicationContext context) {
        super(context);
    }
    // https://stackoverflow.com/a/44879687
    @Override
    public boolean canOverrideExistingModule() {
        return true;
    }
    @Override
    public String getName() {
        return "VRTControllerModule";
    }

    /**
     * One request to the renderer. It holds the callback handed to the renderer, which
     * the renderer itself keeps only weakly, and is in turn held by mPending until the
     * answer or the timeout claims it. Every path settles the promise exactly once.
     */
    private abstract class Request implements Runnable {
        private final Promise mPromise;
        private final String mName;

        Request(Promise promise, String name) {
            mPromise = promise;
            mName = name;
        }

        /** Hand the callback to the controller. False when it has no native controller. */
        abstract boolean send(VRTController controller);

        void start(VRTController controller) {
            mPending.add(this);
            mMainHandler.postDelayed(this, REQUEST_TIMEOUT_MS);
            boolean sent;
            try {
                sent = send(controller);
            } catch (RuntimeException e) {
                if (claim()) {
                    mPromise.reject(E_CONTROLLER, mName + " failed: " + e.getMessage(), e);
                }
                return;
            }
            if (!sent && claim()) {
                rejectNotReady(mPromise, mName);
            }
        }

        boolean claim() {
            if (!mPending.claim(this)) {
                return false;
            }
            mMainHandler.removeCallbacks(this);
            return true;
        }

        void resolve(Object value) {
            if (claim()) {
                mPromise.resolve(value);
            }
        }

        /** The timeout. */
        @Override
        public void run() {
            if (claim()) {
                mPromise.reject(E_CONTROLLER_TIMEOUT, mName + ": the renderer did not answer within "
                        + REQUEST_TIMEOUT_MS + " ms.");
            }
        }
    }

    private static void rejectNotReady(Promise promise, String name) {
        promise.reject(E_CONTROLLER_NOT_READY, name + ": the ViroController is not attached to the"
                + " renderer yet, or is no longer mounted.");
    }

    /** Runs the request against the VRTController with the given tag, on the UI thread. */
    private void withController(final int viewTag, final Promise promise, final String name,
                                final Request request) {
        UIManager uiManager = UIManagerHelper.getUIManager(getReactApplicationContext(), viewTag);
        if (!(uiManager instanceof FabricUIManager)) {
            promise.reject("ERROR", "UIManager not available");
            return;
        }
        ((FabricUIManager) uiManager).addUIBlock(new com.facebook.react.fabric.interop.UIBlock() {
            @Override
            public void execute(com.facebook.react.fabric.interop.UIBlockViewResolver viewResolver) {
                // Nothing may throw out of here: it would be uncaught on the main thread.
                View controllerView;
                try {
                    controllerView = viewResolver.resolveView(viewTag);
                } catch (RuntimeException e) {
                    controllerView = null;
                }
                if (!(controllerView instanceof VRTController)) {
                    rejectNotReady(promise, name);
                    return;
                }
                request.start((VRTController) controllerView);
            }
        });
    }

    @ReactMethod
    public void getForwardVectorAsync(final int viewTag, final Promise promise) {
        final String name = "getControllerForwardAsync";
        withController(viewTag, promise, name, new Request(promise, name) {
            private final Controller.ControllerJniCallback mCallback = new Controller.ControllerJniCallback() {
                @Override
                public void onGetForwardVector(float x, float y, float z) {
                    WritableArray array = Arguments.createArray();
                    array.pushDouble(x);
                    array.pushDouble(y);
                    array.pushDouble(z);
                    resolve(array);
                }
            };

            @Override
            boolean send(VRTController controller) {
                return controller.getForwardVectorAsync(mCallback);
            }
        });
    }

    @ReactMethod
    public void getRayAsync(final int viewTag, final int source, final Promise promise) {
        final String name = "getControllerRayAsync";
        withController(viewTag, promise, name, new Request(promise, name) {
            private final Controller.ControllerRayCallback mCallback = new Controller.ControllerRayCallback() {
                @Override
                public void onGetRay(float[] origin, float[] forward) {
                    // No ray for this source (a head-aimed controller): null, as before.
                    if (origin == null || forward == null) {
                        resolve(null);
                        return;
                    }
                    WritableMap ray = Arguments.createMap();
                    ray.putArray("origin", Arguments.fromArray(origin));
                    ray.putArray("forward", Arguments.fromArray(forward));
                    resolve(ray);
                }
            };

            @Override
            boolean send(VRTController controller) {
                return controller.getRayAsync(source, mCallback);
            }
        });
    }
}
