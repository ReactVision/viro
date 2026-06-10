//
//  VRTVirtualButtonView.mm
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

#import "VRTVirtualButtonView.h"

#include <memory>
#include <string>

#import <ViroKit/VROInputState.h>
#import <ViroKit/VROVirtualControllerRegistry.h>

static const CGFloat kDefaultSize = 44.0;

// Maps button name string to VROInputState::DefaultButton index.
static int buttonIndexForName(NSString *name) {
    static NSDictionary<NSString *, NSNumber *> *map = nil;
    static dispatch_once_t once;
    dispatch_once(&once, ^{
        map = @{
            @"A":      @(0),
            @"B":      @(1),
            @"X":      @(2),
            @"Y":      @(3),
            @"Z":      @(4),
            @"L1":     @(5),
            @"R1":     @(6),
            @"L2":     @(7),
            @"R2":     @(8),
            @"Start":  @(9),
            @"Select": @(10),
        };
    });
    NSNumber *idx = map[name];
    return idx ? idx.intValue : 0;
}

@interface VRTVirtualButtonView ()
@property (nonatomic, strong) CAShapeLayer *circleLayer;
@property (nonatomic, strong) CATextLayer  *labelLayer;
@end

@implementation VRTVirtualButtonView {
    std::shared_ptr<VROInputState> _inputState;
    std::string _acquiredId;
    int _buttonIndex;
}

#pragma mark - Lifecycle

- (instancetype)initWithFrame:(CGRect)frame {
    self = [super initWithFrame:frame];
    if (self) {
        _size = kDefaultSize;
        _tintColor = [UIColor colorWithWhite:1.0 alpha:0.6];
        _buttonIndex = 0;
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
    _circleLayer = [CAShapeLayer layer];
    _circleLayer.fillColor   = _tintColor.CGColor;
    _circleLayer.strokeColor = [UIColor clearColor].CGColor;
    [self.layer addSublayer:_circleLayer];

    _labelLayer = [CATextLayer layer];
    _labelLayer.alignmentMode  = kCAAlignmentCenter;
    _labelLayer.foregroundColor = [UIColor whiteColor].CGColor;
    _labelLayer.contentsScale  = [UIScreen mainScreen].scale;
    _labelLayer.wrapped        = NO;
    [self.layer addSublayer:_labelLayer];

    [self updateLayerGeometry];
}

- (void)updateLayerGeometry {
    CGFloat r = _size / 2.0;
    CGPoint c = CGPointMake(self.bounds.size.width  / 2.0,
                            self.bounds.size.height / 2.0);

    UIBezierPath *path = [UIBezierPath bezierPathWithArcCenter:c
                                                        radius:r
                                                    startAngle:0
                                                      endAngle:M_PI * 2
                                                     clockwise:YES];
    _circleLayer.path = path.CGPath;

    CGFloat fontSize = MAX(r * 0.6, 10.0);
    _labelLayer.fontSize = fontSize;
    CGFloat labelH = fontSize * 1.2;
    _labelLayer.frame = CGRectMake(c.x - r, c.y - labelH / 2.0, _size, labelH);
}

- (void)layoutSubviews {
    [super layoutSubviews];
    [self updateLayerGeometry];
}

#pragma mark - Property setters

- (void)setControllerId:(NSString *)controllerId {
    if ([_controllerId isEqualToString:controllerId]) return;
    _controllerId = [controllerId copy];
    [self rebindRegistry];
}

- (void)setButton:(NSString *)button {
    if ([_button isEqualToString:button]) return;
    _button = [button copy];
    _buttonIndex = buttonIndexForName(button);
    _labelLayer.string = button ?: @"";
    [self updateLayerGeometry];
}

- (void)setSize:(CGFloat)size {
    _size = (size > 0) ? size : kDefaultSize;
    [self updateLayerGeometry];
}

- (void)setTintColor:(UIColor *)tintColor {
    if (!tintColor) tintColor = [UIColor colorWithWhite:1.0 alpha:0.6];
    _tintColor = tintColor;
    _circleLayer.fillColor = tintColor.CGColor;
}

#pragma mark - Registry binding

- (void)rebindRegistry {
    [self releaseFromRegistry];
    if (self.controllerId.length == 0) return;
    _acquiredId = std::string([self.controllerId UTF8String]);
    _inputState = VROVirtualControllerRegistry::instance().acquire(_acquiredId);
}

- (void)releaseFromRegistry {
    if (!_acquiredId.empty() && _inputState) {
        _inputState->setButton(_buttonIndex, false);
        VROVirtualControllerRegistry::instance().release(_acquiredId);
    }
    _acquiredId.clear();
    _inputState.reset();
}

- (void)didMoveToWindow {
    [super didMoveToWindow];
    if (self.window == nil) {
        if (_inputState) _inputState->setButton(_buttonIndex, false);
    }
}

#pragma mark - Touch handling

- (void)touchesBegan:(NSSet<UITouch *> *)touches withEvent:(UIEvent *)event {
    [self writeButton:true];
    // Visual feedback: darken slightly
    _circleLayer.opacity = 0.7f;
}

- (void)touchesEnded:(NSSet<UITouch *> *)touches withEvent:(UIEvent *)event {
    [self writeButton:false];
    _circleLayer.opacity = 1.0f;
}

- (void)touchesCancelled:(NSSet<UITouch *> *)touches withEvent:(UIEvent *)event {
    [self writeButton:false];
    _circleLayer.opacity = 1.0f;
}

- (void)writeButton:(bool)pressed {
    if (_inputState) _inputState->setButton(_buttonIndex, pressed);
    // Fire JS callback so React can update UI without a separate overlay
    if (pressed && self.onPressIn)  self.onPressIn(@{ @"button": self.button ?: @"" });
    if (!pressed && self.onPressOut) self.onPressOut(@{ @"button": self.button ?: @"" });
}

@end
