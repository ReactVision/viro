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

import android.os.Handler;
import android.os.Looper;
import android.util.Log;


import com.facebook.react.bridge.ReactContext;
import com.facebook.react.bridge.ReactContext;
import com.facebook.react.bridge.ReadableMap;
import com.viromedia.bridge.component.node.VRTNode;
import com.viromedia.bridge.utility.ViroEvents;
import com.viromedia.bridge.utility.ViroLog;
import com.viromedia.bridge.utility.ViroEventEmitter;
import com.viro.core.internal.ExecutableAnimation;

import java.lang.ref.WeakReference;

/**
 * Manages the state (play, pause, loop, etc.) of an animation. Abstracts
 * away the loading of the ExecutableAnimation to subclasses.
 */
public abstract class VRTManagedAnimation {
    private static final String TAG = ViroLog.getTag(VRTManagedAnimation.class);

    private enum AnimationState {
        SCHEDULED, RUNNING, PAUSED, TERMINATED
    }

    private ReactContext mReactContext;
    private ExecutableAnimation mExecutableAnimation = null;
    private ExecutableAnimation mPreviousAnimationInterrupted = null; // used to store previous played animation so it can be terminated before destroyed.
    private float mDelayInMilliseconds = 0; // milliseconds
    private long mOverrideDurationInMilliseconds = -1; // overrides the animation's set duration
    private boolean mLoop = false;
    private boolean mRun = false;
    private boolean mInterruptible = false;
    private AnimationState mState = AnimationState.TERMINATED;

    /**
     * The node on which the animation is run.
     */
    private VRTNode mNode = null;

    /**
     * The Component on which the onStart and onFinish events are set.
     */
    private VRTComponent mParentComponent;

    /**
     * This is a handler to the main thread where we queue up our delayed runner
     */
    private Handler mMainLoopHandler = new Handler(Looper.getMainLooper());

    /**
     * This runnable is what we use to start animations w/ a delay.
     */
    private Runnable mDelayedRunner = new Runnable() {
        @Override
        public void run() {
            startAnimation();
        }
    };

    public VRTManagedAnimation(ReactContext context, VRTComponent parent) {
        mReactContext = context;
        mParentComponent = parent;
    }

    public void onTearDown() {
        if (mExecutableAnimation != null) {
            mExecutableAnimation.terminate(true);
            mExecutableAnimation.dispose();
        }

        if (mPreviousAnimationInterrupted != null) {
            mPreviousAnimationInterrupted.terminate(true);
            mPreviousAnimationInterrupted.dispose();
        }
    }

    /**
     * Load the animation. This is invoked each time the animation runs,
     * in case the animation properties changed and need to be refreshed.
     * The ManagedAnimation will own this animation, and will destroy it
     * on tear down.
     *
     * Return null to not run an animation.
     */
    public abstract ExecutableAnimation loadAnimation();

    /**
     * Load the animation fresh from its sources. This is only invoked
     * when an animation is scheduled (just before starting). If null is
     * returned by loadAnimation, then we keep the existing animation.
     */
    private void handleLoadAnimation() {
        ExecutableAnimation animation = loadAnimation();
        if (mExecutableAnimation != null) {
            mExecutableAnimation.dispose();
        }

        mExecutableAnimation = animation;
    }

    /**
     * Reads the playback values of an `animation` prop. A missing key reads as its
     * default, as does a null map.
     */
    public static VRTAnimationProps readProps(ReadableMap map) {
        String name = map != null && map.hasKey("name") ? map.getString("name") : null;
        boolean run = map != null && map.hasKey("run") && map.getBoolean("run");
        boolean loop = map != null && map.hasKey("loop") && map.getBoolean("loop");
        float delay = map != null && map.hasKey("delay") ? (float) map.getDouble("delay") : -1;
        long duration = map != null && map.hasKey("duration") ? map.getInt("duration") : -1;
        boolean interruptible = map != null && map.hasKey("interruptible")
                && map.getBoolean("interruptible");
        return new VRTAnimationProps(name, run, loop, delay, duration, interruptible);
    }

    /** Stores the values. The name is the subclass's to keep. */
    public void applyProps(VRTAnimationProps props) {
        setDelay(props.delay);
        setOverrideDuration(props.duration);
        setLoop(props.loop);
        setRun(props.run);
        setInterruptible(props.interruptible);
    }

    public void parseFromMap(ReadableMap map) {
        applyProps(readProps(map));
    }

    public void setInterruptible(boolean interruptible) { mInterruptible = interruptible;}

    public void setLoop(boolean loop) {
        mLoop = loop;
    }

    public void setDelay(float delay) {
        mDelayInMilliseconds = delay;
    }

    public void setOverrideDuration(long duration) { mOverrideDurationInMilliseconds = duration; }

    public void setRun(boolean run) {
        mRun = run;
    }

    /**
     * Set the node on which the animation runs.
     */
    public void setNode(VRTNode node) {
        mNode = node;
    }

    public void updateAnimation() {
        if (mRun) {
            playAnimation();
        }
        else {
            pauseAnimation();
        }
    }

    /**
     * This method sets us up to play the animation by scheduling a new animation or starting
     * a paused animation.
     */
    private void playAnimation() {

        // Properly destroy a previous animation if it exists. This animation will only be non-null if it was
        // not interrupted.
        if (mPreviousAnimationInterrupted != null) {
            mPreviousAnimationInterrupted.dispose();
            mPreviousAnimationInterrupted = null;
        }

        // Terminate current animation if it allowed to be interrupted. Store current animation
        // in mPreviousAnimationInterrupted so that terminate() can run to completion in renderer thread.

        if (mState == AnimationState.RUNNING && mInterruptible == true) {
            mExecutableAnimation.terminate(!mInterruptible);
            mState = AnimationState.TERMINATED;
            mPreviousAnimationInterrupted = mExecutableAnimation;
            mExecutableAnimation = null;
        }

        if (mState == AnimationState.PAUSED) {
            mExecutableAnimation.resume();
            mState = AnimationState.RUNNING;
        }
        else if (mState == AnimationState.TERMINATED) {
            mState = AnimationState.SCHEDULED;
            // invoke startAnimation() right away if there is no delay provided.
            if (mDelayInMilliseconds <= 0) {
                startAnimation();
            } else {
                mMainLoopHandler.postDelayed(mDelayedRunner, (long) mDelayInMilliseconds);
            }
        }
        else {
            // Already scheduled or running, and not interruptible: nothing to do. Not a
            // warning, because playing an animation that is playing is not a fault.
            if (Log.isLoggable(TAG, Log.VERBOSE)) {
                Log.v(TAG, "Unable to play animation in state " + mState.name());
            }
        }
    }

    /**
     * This method pauses a running animation or terminates a scheduled one.
     */
    private void pauseAnimation() {
        if (mExecutableAnimation == null) {
            return;
        }
        if (mState == AnimationState.RUNNING) {
            mExecutableAnimation.pause();
            mState = AnimationState.PAUSED;
        }
        else if (mState == AnimationState.SCHEDULED) {
            mState = AnimationState.TERMINATED;
            mMainLoopHandler.removeCallbacks(mDelayedRunner);
        }
    }

    /**
     * This method terminates any scheduled, running or paused animation and sets the state to
     * terminated.
     */
    private void terminateAnimation() {
        if (mState == AnimationState.SCHEDULED) {
            mMainLoopHandler.removeCallbacks(mDelayedRunner);
        }
        else if (mState == AnimationState.RUNNING || mState == AnimationState.PAUSED) {
            if (mExecutableAnimation != null) {
                mExecutableAnimation.terminate(true);
            }
        }
        mState = AnimationState.TERMINATED;
    }

    /**
     * This method starts a scheduled animation
     */
    private void startAnimation() {
        if (mState != AnimationState.SCHEDULED) {
            ViroLog.info(TAG, "Aborted starting new animation, was no longer scheduled");
            mState = AnimationState.TERMINATED;
            return;
        }
        if (mNode == null) {
            ViroLog.info(TAG, "Aborted starting new animation, no target node specified");
            mState = AnimationState.TERMINATED;
            return;
        }
        if (mNode.isTornDown()) {
            ViroLog.info(TAG, "Aborted starting new animation, node is torn down");
            mState = AnimationState.TERMINATED;
            return;
        }

        handleLoadAnimation();
        if (mExecutableAnimation == null) {
            ViroLog.info(TAG, "Aborted starting new animation, no animation is loaded");
            mState = AnimationState.TERMINATED;
            return;
        }
        onStartAnimation();

        final WeakReference<VRTManagedAnimation> weakSelf = new WeakReference<>(this);
        if (mOverrideDurationInMilliseconds > -1) {
            mExecutableAnimation.setDuration(mOverrideDurationInMilliseconds / 1000.0f);
        }
        mExecutableAnimation.execute(mNode.getNodeJni(), new ExecutableAnimation.AnimationDelegate() {
            @Override
            public void onFinish(ExecutableAnimation animation) {
                VRTManagedAnimation self = weakSelf.get();
                if (self != null) {
                    self.onFinishAnimation(animation);
                }
            }
        });
        mState = AnimationState.RUNNING;
    }

    /**
     * This method should be called when an animation starts and notifies the JS bridge
     */
    private void onStartAnimation() {
        ViroEventEmitter.emit(mReactContext, mParentComponent.getId(),
                ViroEvents.ON_ANIMATION_START, null);
    }

    /**
     * This method should be called by the JNI layer when the animation ends and notifies the JS
     * bridge. It also handles looping logic.
     */
    private void onFinishAnimation(ExecutableAnimation animation) {
        ViroEventEmitter.emit(mReactContext, mParentComponent.getId(),
                ViroEvents.ON_ANIMATION_FINISH, null);

        // If the animation changed, we won't terminate or loop
        if (mExecutableAnimation == animation) {
            mState = AnimationState.TERMINATED;
            if (mLoop && mRun) {
                playAnimation();
            }
        }
    }
}
