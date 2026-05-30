//  VRTGameLoopView.mm
//  Copyright © 2026 ReactVision. All rights reserved.

#import "VRTGameLoopView.h"
#import <ViroKit/VROGameLoopListener.h>
#import <ViroKit/VROFrameSynchronizer.h>

@implementation VRTGameLoopView {
    std::shared_ptr<VROGameLoopListener>  _listener;
    std::weak_ptr<VROFrameSynchronizer>   _syncWeak;  // held directly, avoids context access at dealloc
    BOOL _registered;
}

- (instancetype)initWithBridge:(RCTBridge *)bridge {
    self = [super initWithBridge:bridge];
    if (self) {
        _fixedHz = 0.f;
        _registered = NO;
    }
    return self;
}

// ── Scene lifecycle ────────────────────────────────────────────────────────────

- (void)sceneWillAppear {
    [super sceneWillAppear];
    if (_registered) return;

    auto sync = self.context->getFrameSynchronizer();
    if (!sync) return;

    _registered = YES;
    _syncWeak = sync;  // store weak reference — safe to access even after context is gone

    _listener = std::make_shared<VROGameLoopListener>();
    if (_fixedHz > 0.f) {
        _listener->setFixedHz(_fixedHz);
    }

    __weak VRTGameLoopView *weakSelf = self;

    // Fabric (New Architecture) validates RCTDirectEventBlock payload values against
    // its type system. Floats passed as NSNumber cause conversions.h:338 spam.
    // Passing as NSString and parsing in JS avoids the validation failure.
    _listener->setOnFrameWillRender([weakSelf](float dt, float elapsed) {
        VRTGameLoopView *self = weakSelf;
        if (!self || !self->_onUpdate) return;
        dispatch_async(dispatch_get_main_queue(), ^{
            if (self->_onUpdate) {
                self->_onUpdate(@{
                    @"dt":      [NSString stringWithFormat:@"%.6f", dt],
                    @"elapsed": [NSString stringWithFormat:@"%.6f", elapsed]
                });
            }
        });
    });

    _listener->setOnFrameDidRender([weakSelf](float dt, float elapsed) {
        VRTGameLoopView *self = weakSelf;
        if (!self || !self->_onLateUpdate) return;
        dispatch_async(dispatch_get_main_queue(), ^{
            if (self->_onLateUpdate) {
                self->_onLateUpdate(@{
                    @"dt":      [NSString stringWithFormat:@"%.6f", dt],
                    @"elapsed": [NSString stringWithFormat:@"%.6f", elapsed]
                });
            }
        });
    });

    _listener->setOnFixedStep([weakSelf](float dt) {
        VRTGameLoopView *self = weakSelf;
        if (!self || !self->_onFixedUpdate) return;
        dispatch_async(dispatch_get_main_queue(), ^{
            if (self->_onFixedUpdate) {
                self->_onFixedUpdate(@{ @"dt": [NSString stringWithFormat:@"%.6f", dt] });
            }
        });
    });

    sync->addFrameListener(_listener);
}

- (void)sceneWillDisappear {
    [super sceneWillDisappear];
    [self _unregister];
}

- (void)dealloc {
    [self _unregister];
}

- (void)_unregister {
    if (!_registered || !_listener) return;
    _registered = NO;
    // Use the stored weak_ptr — safe even after VROContext is deallocated.
    auto sync = _syncWeak.lock();
    if (sync) {
        sync->removeFrameListener(_listener);
    }
    _listener.reset();
}

// ── Prop setters ──────────────────────────────────────────────────────────────

- (void)setFixedHz:(float)fixedHz {
    _fixedHz = fixedHz;
    if (_listener) {
        _listener->setFixedHz(fixedHz);
    }
}

@end
