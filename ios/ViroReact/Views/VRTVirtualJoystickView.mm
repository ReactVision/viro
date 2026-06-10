//
//  VRTVirtualJoystickView.mm
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

#import "VRTVirtualJoystickView.h"

#include <memory>
#include <string>
#include <cmath>

// Imported via the ViroKit framework's public header surface. The two virocore
// headers below must be marked Public in their Xcode target membership for this
// import path to resolve.
#import <ViroKit/VROInputState.h>
#import <ViroKit/VROVirtualControllerRegistry.h>

static const CGFloat kDefaultRadius = 60.0;
static const CGFloat kKnobRadiusFactor = 0.4;   // knob is 40% of outer radius

@interface VRTVirtualJoystickView ()
@property (nonatomic, strong) CAShapeLayer *ringLayer;
@property (nonatomic, strong) CAShapeLayer *knobLayer;
@property (nonatomic, assign) CGPoint knobCenter;     // current knob offset (relative to view centre)
@property (nonatomic, assign) BOOL active;
@end

@implementation VRTVirtualJoystickView {
    std::shared_ptr<VROInputState> _inputState;
    std::string _acquiredId;     // tracks which id we currently hold a ref to
}

#pragma mark - Lifecycle

- (instancetype)initWithFrame:(CGRect)frame {
    self = [super initWithFrame:frame];
    if (self) {
        _radius = kDefaultRadius;
        _stickSide = @"left";
        _tintColor = [UIColor colorWithWhite:1.0 alpha:0.6];
        _active = NO;
        _knobCenter = CGPointZero;
        self.backgroundColor = [UIColor clearColor];
        self.multipleTouchEnabled = NO;
        [self buildLayers];
    }
    return self;
}

- (void)dealloc {
    [self releaseFromRegistry];
}

#pragma mark - Layers

- (void)buildLayers {
    _ringLayer = [CAShapeLayer layer];
    _ringLayer.fillColor = [UIColor clearColor].CGColor;
    _ringLayer.strokeColor = _tintColor.CGColor;
    _ringLayer.lineWidth = 2.0;
    [self.layer addSublayer:_ringLayer];

    _knobLayer = [CAShapeLayer layer];
    _knobLayer.fillColor = _tintColor.CGColor;
    _knobLayer.strokeColor = [UIColor clearColor].CGColor;
    [self.layer addSublayer:_knobLayer];

    [self updateLayerGeometry];
}

- (void)updateLayerGeometry {
    CGPoint c = CGPointMake(self.bounds.size.width  / 2.0,
                            self.bounds.size.height / 2.0);

    UIBezierPath *ringPath =
        [UIBezierPath bezierPathWithArcCenter:c
                                       radius:self.radius
                                   startAngle:0
                                     endAngle:M_PI * 2
                                    clockwise:YES];
    _ringLayer.path = ringPath.CGPath;

    CGFloat knobR = self.radius * kKnobRadiusFactor;
    CGPoint knobPos = CGPointMake(c.x + _knobCenter.x, c.y + _knobCenter.y);
    UIBezierPath *knobPath =
        [UIBezierPath bezierPathWithArcCenter:knobPos
                                       radius:knobR
                                   startAngle:0
                                     endAngle:M_PI * 2
                                    clockwise:YES];
    _knobLayer.path = knobPath.CGPath;
}

- (void)layoutSubviews {
    [super layoutSubviews];
    [self updateLayerGeometry];
}

#pragma mark - Property setters

- (void)setControllerId:(NSString *)controllerId {
    if ([_controllerId isEqualToString:controllerId]) {
        return;
    }
    _controllerId = [controllerId copy];
    [self rebindRegistry];
}

- (void)setStickSide:(NSString *)stickSide {
    if ([_stickSide isEqualToString:stickSide]) {
        return;
    }
    _stickSide = [stickSide copy];
}

- (void)setRadius:(CGFloat)radius {
    if (radius <= 0) {
        radius = kDefaultRadius;
    }
    _radius = radius;
    [self updateLayerGeometry];
}

- (void)setTintColor:(UIColor *)tintColor {
    if (tintColor == nil) {
        tintColor = [UIColor colorWithWhite:1.0 alpha:0.6];
    }
    _tintColor = tintColor;
    _ringLayer.strokeColor = tintColor.CGColor;
    _knobLayer.fillColor   = tintColor.CGColor;
}

#pragma mark - Registry binding

- (void)rebindRegistry {
    [self releaseFromRegistry];
    if (self.controllerId.length == 0) {
        return;
    }
    _acquiredId = std::string([self.controllerId UTF8String]);
    _inputState = VROVirtualControllerRegistry::instance().acquire(_acquiredId);
}

- (void)releaseFromRegistry {
    if (!_acquiredId.empty()) {
        VROVirtualControllerRegistry::instance().release(_acquiredId);
        _acquiredId.clear();
    }
    _inputState.reset();
}

- (void)didMoveToWindow {
    [super didMoveToWindow];
    if (self.window == nil) {
        // Being removed — neutralise the stick before releasing.
        [self writeNeutral];
    }
}

#pragma mark - Touch handling

- (void)touchesBegan:(NSSet<UITouch *> *)touches withEvent:(UIEvent *)event {
    UITouch *t = [touches anyObject];
    if (!t) return;

    self.active = YES;
    [self updateFromTouch:t];
}

- (void)touchesMoved:(NSSet<UITouch *> *)touches withEvent:(UIEvent *)event {
    if (!self.active) return;
    UITouch *t = [touches anyObject];
    if (!t) return;
    [self updateFromTouch:t];
}

- (void)touchesEnded:(NSSet<UITouch *> *)touches withEvent:(UIEvent *)event {
    [self resetKnob];
}

- (void)touchesCancelled:(NSSet<UITouch *> *)touches withEvent:(UIEvent *)event {
    [self resetKnob];
}

#pragma mark - Stick computation

- (void)updateFromTouch:(UITouch *)touch {
    CGPoint location = [touch locationInView:self];
    CGPoint centre = CGPointMake(self.bounds.size.width  / 2.0,
                                 self.bounds.size.height / 2.0);

    CGFloat dx = location.x - centre.x;
    CGFloat dy = location.y - centre.y;
    CGFloat mag = std::sqrt(dx * dx + dy * dy);

    // Clamp knob to the outer ring.
    if (mag > self.radius && self.radius > 0) {
        CGFloat scale = self.radius / mag;
        dx *= scale;
        dy *= scale;
        mag = self.radius;
    }

    self.knobCenter = CGPointMake(dx, dy);
    [self updateLayerGeometry];

    // Normalise to [-1, 1]. UIView coordinate system has y pointing DOWN; we
    // flip it so that "up on screen" maps to positive y on the stick — the
    // convention games expect.
    float nx = (float)(dx / self.radius);
    float ny = (float)(-dy / self.radius);

    [self writeStick:nx y:ny];
}

- (void)resetKnob {
    self.active = NO;
    self.knobCenter = CGPointZero;
    [self updateLayerGeometry];
    [self writeNeutral];
}

- (void)writeStick:(float)x y:(float)y {
    if (!_inputState) return;
    if ([self.stickSide isEqualToString:@"right"]) {
        _inputState->setStickR(x, y);
    } else {
        _inputState->setStickL(x, y);
    }
    // Fire JS callback for React-side feedback (same tick as C++ write)
    if (self.onStickChange) {
        // Pass as strings to avoid Fabric conversions.h:338 type-check spam
        self.onStickChange(@{
            @"x": [NSString stringWithFormat:@"%.4f", x],
            @"y": [NSString stringWithFormat:@"%.4f", y]
        });
    }
}

- (void)writeNeutral {
    [self writeStick:0.f y:0.f];  // writeStick already fires onStickChange with (0,0)
}

@end
