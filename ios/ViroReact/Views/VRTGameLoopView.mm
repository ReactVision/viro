//  VRTGameLoopView.mm
//  Copyright © 2026 ReactVision. All rights reserved.

#import "VRTGameLoopView.h"
#import <ViroKit/VROGameLoopListener.h>
#import <ViroKit/VROFrameSynchronizer.h>

@implementation VRTGameLoopView {
    std::shared_ptr<VROGameLoopListener> _listener;
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
    _registered = YES;

    auto sync = self.context->getFrameSynchronizer();
    if (!sync) return;

    _listener = std::make_shared<VROGameLoopListener>();
    if (_fixedHz > 0.f) {
        _listener->setFixedHz(_fixedHz);
    }

    __weak VRTGameLoopView *weakSelf = self;

    _listener->setOnFrameWillRender([weakSelf](float dt, float elapsed) {
        VRTGameLoopView *self = weakSelf;
        if (!self || !self->_onUpdate) return;
        dispatch_async(dispatch_get_main_queue(), ^{
            if (self->_onUpdate) {
                self->_onUpdate(@{ @"dt": @(dt), @"elapsed": @(elapsed) });
            }
        });
    });

    _listener->setOnFrameDidRender([weakSelf](float dt, float elapsed) {
        VRTGameLoopView *self = weakSelf;
        if (!self || !self->_onLateUpdate) return;
        dispatch_async(dispatch_get_main_queue(), ^{
            if (self->_onLateUpdate) {
                self->_onLateUpdate(@{ @"dt": @(dt), @"elapsed": @(elapsed) });
            }
        });
    });

    _listener->setOnFixedStep([weakSelf](float dt) {
        VRTGameLoopView *self = weakSelf;
        if (!self || !self->_onFixedUpdate) return;
        dispatch_async(dispatch_get_main_queue(), ^{
            if (self->_onFixedUpdate) {
                self->_onFixedUpdate(@{ @"dt": @(dt) });
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
    auto sync = self.context ? self.context->getFrameSynchronizer() : nullptr;
    if (sync) {
        sync->removeFrameListener(_listener);
    }
    _listener.reset();
}

// ── Prop setters — apply immediately if already registered ───────────────────

- (void)setFixedHz:(float)fixedHz {
    _fixedHz = fixedHz;
    if (_listener) {
        _listener->setFixedHz(fixedHz);
    }
}

@end
