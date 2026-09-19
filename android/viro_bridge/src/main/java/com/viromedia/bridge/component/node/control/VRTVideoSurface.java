//  Copyright © 2016 Viro Media. All rights reserved.
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

package com.viromedia.bridge.component.node.control;

import android.net.Uri;

import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.ReactContext;
import com.facebook.react.bridge.WritableMap;
import com.viromedia.bridge.utility.ViroEventEmitter;
import com.viro.core.Material;
import com.viro.core.Texture;
import com.viro.core.ViroContext;
import com.viro.core.Quad;
import com.viro.core.VideoTexture;
import com.viromedia.bridge.utility.Helper;
import com.viromedia.bridge.utility.ViroEvents;

import java.lang.ref.WeakReference;
import java.util.List;

public class VRTVideoSurface extends VRTControl {

    private static class VideoSurfaceDelegate implements VideoTexture.PlaybackListener {

        private WeakReference<VRTVideoSurface> mSurface;

        public VideoSurfaceDelegate(VRTVideoSurface surface) {
            mSurface = new WeakReference<VRTVideoSurface>(surface);
        }

        @Override
        public void onVideoBufferStart(VideoTexture video) {
            VRTVideoSurface surface = mSurface.get();
            if (surface == null || surface.isTornDown()) {
                return;
            }
            surface.playerBufferStart();
        }

        @Override
        public void onVideoBufferEnd(VideoTexture video) {
            VRTVideoSurface surface = mSurface.get();
            if (surface == null || surface.isTornDown()) {
                return;
            }
            surface.playerBufferEnd();
        }

        @Override
        public void onVideoFinish(VideoTexture video) {
            VRTVideoSurface surface = mSurface.get();
            if (surface == null || surface.isTornDown()) {
                return;
            }
            surface.playerDidFinishPlaying();
        }

        @Override
        public void onReady(VideoTexture video) {

        }

        @Override
        public void onVideoFailed(String error) {
            VRTVideoSurface surface = mSurface.get();
            if (surface == null || surface.isTornDown()) {
                return;
            }
            surface.onError(error);
        }

        @Override
        public void onVideoUpdatedTime(VideoTexture video, float currentTime, float totalVideoTime) {
            VRTVideoSurface surface = mSurface.get();
            if (surface == null || surface.isTornDown()) {
                return;
            }
            surface.playerOnUpdateTime(currentTime, totalVideoTime);
        }

        @Override
        public void onVideoSizeChanged(VideoTexture video, float width, float height) {
            VRTVideoSurface surface = mSurface.get();
            if (surface == null || surface.isTornDown()) {
                return;
            }
            surface.updateVideoSize(width, height);
        }
    }

    private float mWidth = 1;
    private float mHeight = 1;
    private boolean mPaused = false;
    private boolean mLoop = false;
    private boolean mMuted = false;
    private float mVolume = 1;
    private String mSource;
    private Quad mQuad = null;
    private VideoTexture mVideoTexture = null;
    private VideoTexture.PlaybackListener mDelegate = null;
    private String mStereoMode;
    private boolean mGeometryNeedsUpdate = false;
    private boolean mWidthOrHeightPropSet = false;

    public VRTVideoSurface(ReactContext reactContext) {
        super(reactContext);
    }

    @Override
    public void onTearDown(){
        if (mQuad != null) {
            mQuad.dispose();
            mQuad = null;
        }
        if (mVideoTexture != null){
            mVideoTexture.dispose();
            mVideoTexture = null;
        }
        super.onTearDown();
    }

    private void resetVideo() {
        if (mViroContext == null || mSource == null) {
            return;
        }

        if (mVideoTexture != null) {
            mVideoTexture.dispose();
            mVideoTexture = null;
        }

        if (mQuad != null) {
            mQuad.dispose();
            mQuad = null;
        }

        // Create Texture
        mQuad = new Quad(mWidth, mHeight, 0, 0, 1, 1);
        getNodeJni().setGeometry(mQuad);
        if (mMaterials != null) {
            applyMaterials();
        }
        mDelegate = new VideoSurfaceDelegate(this);

        mVideoTexture = new VideoTexture(mViroContext, Uri.parse(mSource), mDelegate,
                Texture.StereoMode.valueFromString(mStereoMode));
        loadVideo();

        mVideoTexture.setPlaybackListener(mDelegate);
    }

    @Override
    protected void setMaterials(List<Material> materials) {
        super.setMaterials(materials);
        if (mVideoTexture != null && mQuad != null) {
            mQuad.setVideoTexture(mVideoTexture);
        }
    }

    private void loadVideo(){
        mQuad.setVideoTexture(mVideoTexture);
        setVolume(mVolume);
        setLoop(mLoop);
        setMuted(mMuted);
        setVolume(mVolume);
        setPaused(mPaused);
    }

    @Override
    public void setViroContext(ViroContext context) {
        super.setViroContext(context);
        resetVideo();
    }

    public void setWidth(float width) {
        mWidth = width;
        mWidthOrHeightPropSet = true;
        mGeometryNeedsUpdate = true;
    }

    public void setHeight(float height) {
        mHeight = height;
        mWidthOrHeightPropSet = true;
        mGeometryNeedsUpdate = true;
    }

    /**
     * With neither size prop given the quad takes the source's aspect ratio at one unit
     * wide, the rule VRTImage applies to an image. Only the geometry is rebuilt: resetVideo()
     * would recreate the texture and restart playback.
     */
    private void updateVideoSize(float width, float height) {
        if (mWidthOrHeightPropSet || width <= 0 || height <= 0
                || mVideoTexture == null || getNodeJni() == null) {
            return;
        }

        float scaledHeight = mWidth / (width / height);
        if (Math.abs(scaledHeight - mHeight) < 1e-4f) {
            return;
        }
        mHeight = scaledHeight;

        Quad previousQuad = mQuad;
        mQuad = new Quad(mWidth, mHeight, 0, 0, 1, 1);
        getNodeJni().setGeometry(mQuad);
        if (mMaterials != null) {
            applyMaterials();
        }
        mQuad.setVideoTexture(mVideoTexture);
        if (previousQuad != null) {
            previousQuad.dispose();
        }
    }

    public void setStereoMode(String mode){
        mStereoMode = mode;
    }

    public void setSource(String source) {
        mSource = Helper.parseUri(source, getContext()).toString();
        mGeometryNeedsUpdate = true;
    }

    public void setPaused(boolean paused) {
        mPaused = paused;
        if (mVideoTexture == null) {
            return;
        }

        if (mPaused || !shouldAppear()) {
            mVideoTexture.pause();
        } else {
            mVideoTexture.play();
        }
    }

    public void setLoop(boolean loop) {
        mLoop = loop;
        if (mVideoTexture != null) {
            mVideoTexture.setLoop(loop);

            if (!mPaused) {
                mVideoTexture.play();
            }
        }
    }

    public void setMuted(boolean muted) {
        mMuted = muted;
        if (mVideoTexture != null) {
            mVideoTexture.setMuted(muted);
        }
    }

    public void setVolume(float volume) {
        mVolume = volume;
        if (mVideoTexture != null) {
            mVideoTexture.setVolume(volume);
        }
    }

    public void seekToTime(float time) {
        if (mVideoTexture != null) {
            mVideoTexture.seekToTime(time);
            if (!mPaused) {
                mVideoTexture.play();
            }
        }
    }

    @Override
    protected void handleAppearanceChange() {
        setPaused(mPaused);
        super.handleAppearanceChange();
    }

    private void playerBufferStart() {
        ViroEventEmitter.emit(mReactContext, getId(), ViroEvents.ON_BUFFER_START, null);
    }

    private void playerBufferEnd() {
        ViroEventEmitter.emit(mReactContext, getId(), ViroEvents.ON_BUFFER_END, null);
    }

    private void playerDidFinishPlaying() {
        ViroEventEmitter.emit(mReactContext, getId(), ViroEvents.ON_FINISH, null);
    }

    private void playerOnUpdateTime(float currentTime, float totalTime) {
        WritableMap event = Arguments.createMap();
        event.putDouble("currentTime", (double) currentTime);
        event.putDouble("totalTime", (double) totalTime);

        ViroEventEmitter.emit(mReactContext, getId(), ViroEvents.ON_UPDATE_TIME, event);
    }

    @Override
    public void onPropsSet() {
        super.onPropsSet();
        if(mGeometryNeedsUpdate) {
            resetVideo();
        }
        mGeometryNeedsUpdate = false;
    }

    @Override
    public void onHostPause(){
        super.onHostPause();
        if (mVideoTexture != null) {
            mVideoTexture.pause();
        }
    }

    @Override
    public void sceneWillDisappear() {
        if (mVideoTexture != null){
            mVideoTexture.pause();
        }
    }

    @Override
    public void onHostResume(){
        super.onHostResume();
        setPaused(mPaused);
    }

    @Override
    public void sceneWillAppear() {
        setPaused(mPaused);
    }

}
