//
//  VRTManagedAnimation.m
//  ViroReact
//
//  Created by Raj Advani on 7/21/17.
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
//

#import "VRTManagedAnimation.h"
#if TARGET_OS_VISION
#import "VRORendererBridge.h"
#endif

enum class VRTAnimationState {
    Scheduled,
    Running,
    Paused,
    Terminated
};

@interface VRTManagedAnimation ()

@property (readwrite, nonatomic) VRTAnimationState state;
@property (readwrite, nonatomic) std::shared_ptr<VROExecutableAnimation> executableAnimation;

@end

@implementation VRTManagedAnimation

- (id)init {
    self = [super init];
    if (self) {
        self.delay = -1.0f;
        self.durationOverride = -1.0f;
        self.loop = false;
        self.run = false;
        self.state = VRTAnimationState::Terminated;
        self.interruptible = NO;
    }
    return self;
}

- (void)dealloc {
    // Cleanup any transactions that were paused
    if (self.executableAnimation) {
        self.executableAnimation->terminate(true);
        self.executableAnimation.reset();
    }
}

- (std::shared_ptr<VROExecutableAnimation>)loadAnimation {
    return nullptr;
}

- (void)handleLoadAnimation {
    self.executableAnimation = [self loadAnimation];
}

- (void)parseFromDictionary:(NSDictionary *)dictionary {
    if (!dictionary || [dictionary count] == 0) {
        self.loop = NO;
        self.run = NO;
        self.delay = -1;
        self.durationOverride = -1;
        self.interruptible = NO;
    }
    else {
        id delayValue = [dictionary objectForKey:@"delay"];
        if (delayValue != nil) {
            self.delay = [delayValue floatValue];
        } else {
            self.delay = -1;
        }
        
        id durationValue = [dictionary objectForKey:@"duration"];
        if (durationValue != nil) {
            self.durationOverride = [durationValue floatValue];
        } else {
            self.durationOverride = -1;
        }
        
        self.loop = [[dictionary objectForKey:@"loop"] boolValue];
        self.run = [[dictionary objectForKey:@"run"] boolValue];
        id interruptible = [dictionary objectForKey:@"interruptible"];
        if (interruptible != nil) {
            self.interruptible = [interruptible boolValue];
        }
    }
}

- (void)updateAnimation {
    if (self.run) {
        [self playAnimation];
    }
    else {
        [self pauseAnimation];
    }
}

/*
 Plays the animation. If the animation is paused, resumes the animation.
 Otherwise starts a new animation if is not running. If there is a delay
 associated with this VRTAnimatedComponent, we start a new animation with the
 given delay.
 */
- (void)playAnimation {
    
    //If current animation is running and is allowed to be interrupted, then terminate it.
    if(self.state == VRTAnimationState::Running && self.interruptible == YES) {
        self.executableAnimation->terminate(!self.interruptible);
        self.state = VRTAnimationState::Terminated;
    }
    
    if (self.state == VRTAnimationState::Paused) {
        self.executableAnimation->resume();
        self.state = VRTAnimationState::Running;
    }
    else if (self.state == VRTAnimationState::Terminated) {
        self.state = VRTAnimationState::Scheduled;
        if(self.delay <= 0) {
            // start animation right away if there is no delay.
            [self startAnimation];
        }else {
            [self performSelector:@selector(startAnimation) withObject:self afterDelay:self.delay / 1000.0];
        }
    }
}

- (void)pauseAnimation {
    if (self.state == VRTAnimationState::Running) {
        self.executableAnimation->pause();
        self.state = VRTAnimationState::Paused;
    }
    else if (self.state == VRTAnimationState::Scheduled) {
        [NSObject cancelPreviousPerformRequestsWithTarget:self selector:@selector(startAnimation) object:self];
        self.state = VRTAnimationState::Terminated;
    }
}

- (void)startAnimation {
    [self startAnimationWithRetryCount:0];
}

- (void)startAnimationWithRetryCount:(int)retryCount {
    if (self.state != VRTAnimationState::Scheduled) {
        self.state = VRTAnimationState::Terminated;
        return;
    }

    std::shared_ptr<VRONode> node = self.node.lock();
    if (!node) {
        self.state = VRTAnimationState::Terminated;
        return;
    }

    [self handleLoadAnimation];
    if (!self.executableAnimation) {
        // Animation may not be registered yet (race condition with JS registration)
        // Retry up to 10 times with a longer delay
        if (retryCount < 10) {
            dispatch_after(dispatch_time(DISPATCH_TIME_NOW, (int64_t)(0.2 * NSEC_PER_SEC)), dispatch_get_main_queue(), ^{
                [self startAnimationWithRetryCount:retryCount + 1];
            });
            return;
        }
        self.state = VRTAnimationState::Terminated;
        return;
    }
    if (self.onStart) {
        self.onStart(nil);
    }
    
    __weak VRTManagedAnimation *weakSelf = self;
    std::shared_ptr<VROExecutableAnimation> animation = _executableAnimation;
    
    if (self.durationOverride > -1) {
        animation->setDuration(self.durationOverride / 1000.0f);
    }
    // The completion hop back to the main queue is not incidental: onAnimationFinish fires the
    // onFinish React event and may restart a looping animation, and neither belongs on the
    // render thread.
    auto onFinish = [weakSelf, animation] {
        dispatch_async(dispatch_get_main_queue(), ^{
            if (weakSelf) {
                [weakSelf onAnimationFinish:animation];
            }
        });
    };

#if TARGET_OS_VISION
    // VROAnimatable::animate() drops any animation started off the renderer thread — it calls
    // onTermination() and the property snaps to its final value. React starts animations from the
    // main thread, so on visionOS every `animation` prop rendered its node correctly and then sat
    // there without moving. Hand the execute to the render thread, where the transaction it opens
    // lives in the same thread_local storage that update() advances.
    [VRORendererBridge runOnRenderThread:^{
        animation->execute(node, onFinish);
    }];
#else
    animation->execute(node, onFinish);
#endif
    self.state = VRTAnimationState::Running;
}

- (void)onAnimationFinish:(std::shared_ptr<VROExecutableAnimation>)animation {
    if (self.onFinish) {
        self.onFinish(nil);
    }
    
    if (self.executableAnimation == animation) {
        self.state = VRTAnimationState::Terminated;
        if (self.loop && self.run) {
            [self playAnimation];
        }
    }
}

@end
