//
//  VRTCameraTexture.java
//  ViroReact
//
//  Copyright © 2026 ReactVision. All rights reserved.
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

import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.ReactContext;
import com.facebook.react.bridge.WritableMap;
import com.viro.core.CameraTexture;
import com.viro.core.Material;
import com.viro.core.ViroContext;
import com.viromedia.bridge.module.MaterialManager;
import com.viromedia.bridge.utility.ViroEventEmitter;
import com.viromedia.bridge.utility.ViroEvents;

/**
 * VRTCameraTexture is the Android React Native bridge component for ViroCameraTexture.
 *
 * It creates a {@link CameraTexture} (from virocore) and binds it as the diffuse texture
 * of a named material via the {@link MaterialManager} Java API.
 *
 * The CameraTexture requires a ViroContext (which carries the GL driver / VROFrameSynchronizer)
 * to initialise the OES texture on the GL thread. We therefore defer construction until
 * {@link #setViroContext(ViroContext)} is called — the same pattern used by VRT360Video.
 */
public class VRTCameraTexture extends VRTComponent {

    private CameraTexture mCameraTexture = null;
    private String mMaterialName = null;
    private String mCameraPosition = "front";
    private boolean mPaused = false;

    public VRTCameraTexture(ReactContext reactContext) {
        super(reactContext.getBaseContext(), null, -1, -1, reactContext);
        // CameraTexture cannot be created yet — mViroContext is still null.
        // createCameraTexture() is called once setViroContext() delivers it.
    }

    // -----------------------------------------------------------------------
    // ViroContext lifecycle — deferred camera-texture construction
    // -----------------------------------------------------------------------

    @Override
    public void setViroContext(ViroContext context) {
        super.setViroContext(context);
        createCameraTexture();
    }

    // -----------------------------------------------------------------------
    // React Native prop setters
    // -----------------------------------------------------------------------

    public void setMaterial(String materialName) {
        mMaterialName = materialName;
        bindToMaterial();
    }

    public void setCameraPosition(String position) {
        if (position == null || position.equals(mCameraPosition)) return;
        mCameraPosition = position;

        boolean wasPlaying = (mCameraTexture != null && !mCameraTexture.isPaused());

        if (mCameraTexture != null) {
            mCameraTexture.dispose();
            mCameraTexture = null;
        }

        // Re-create only if we already have a context; otherwise wait for setViroContext().
        if (mViroContext != null) {
            createCameraTexture();
            bindToMaterial();

            if (!wasPlaying) {
                mCameraTexture.pause();
            }
        }
    }

    public void setPaused(boolean paused) {
        mPaused = paused;
        if (mCameraTexture == null) return;

        if (paused) {
            mCameraTexture.pause();
        } else {
            mCameraTexture.play();
        }
    }

    // -----------------------------------------------------------------------
    // Internal helpers
    // -----------------------------------------------------------------------

    /**
     * Creates (or re-creates) the CameraTexture using the current ViroContext.
     * Guard: does nothing if mViroContext is not yet available.
     */
    private void createCameraTexture() {
        if (mViroContext == null) return;

        CameraTexture.Position pos = "back".equalsIgnoreCase(mCameraPosition)
            ? CameraTexture.Position.BACK
            : CameraTexture.Position.FRONT;

        // CameraTexture(ViroContext, Position) → nativeCreate + nativeInit dispatched to GL.
        mCameraTexture = new CameraTexture(mViroContext, pos, getContext());

        // Wire the onCameraReady callback — fires once on the first Camera2 frame.
        mCameraTexture.setReadyListener(new CameraTexture.ReadyListener() {
            @Override
            public void onCameraReady() {
                if (isTornDown()) return;
                ViroEventEmitter.emit(mReactContext, getId(), ViroEvents.ON_CAMERA_READY, null);
            }
        });

        if (!mPaused) {
            mCameraTexture.play();
        }

        // If the material name was already received, bind now.
        bindToMaterial();
    }

    private void bindToMaterial() {
        if (mMaterialName == null || mCameraTexture == null) return;

        MaterialManager materialManager =
            ((ReactContext) getContext()).getNativeModule(MaterialManager.class);
        if (materialManager == null) return;

        Material material = materialManager.getMaterial(mMaterialName);
        if (material != null) {
            material.setDiffuseTexture(mCameraTexture);
        } else {
            emitError("Material '" + mMaterialName + "' not found");
        }
    }

    private void emitError(String message) {
        WritableMap event = Arguments.createMap();
        event.putString("error", message);
        ViroEventEmitter.emit(mReactContext, getId(), ViroEvents.ON_ERROR, event);
    }

    // -----------------------------------------------------------------------
    // Capture — delegated from VRTCameraTextureModule
    // -----------------------------------------------------------------------

    public void capturePhoto(String outputPath, CameraTexture.CaptureCallback callback) {
        if (mCameraTexture == null) { callback.onError("Camera not ready"); return; }
        mCameraTexture.capturePhoto(outputPath, callback);
    }

    public void startRecording(String outputPath, CameraTexture.CaptureCallback callback) {
        if (mCameraTexture == null) { callback.onError("Camera not ready"); return; }
        mCameraTexture.startRecording(outputPath, callback);
    }

    public void stopRecording(CameraTexture.CaptureCallback callback) {
        if (mCameraTexture == null) { callback.onError("Camera not ready"); return; }
        mCameraTexture.stopRecording(callback);
    }

    // -----------------------------------------------------------------------
    // Cleanup
    // -----------------------------------------------------------------------

    @Override
    public void onTearDown() {
        if (mCameraTexture != null) {
            mCameraTexture.dispose();
            mCameraTexture = null;
        }
        super.onTearDown();
    }
}
