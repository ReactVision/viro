//
//  VRTController.m
//  React
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
#import <ViroKit/ViroKit.h>
#import <React/RCTLog.h>
#import "VRTController.h"
#import "VRTMaterialManager.h"


@implementation VRTController {
    std::shared_ptr<VROInputPresenter> _presenter;
    std::shared_ptr<VROEventDelegateiOS> _eventDelegate;
    bool _reticleEnabled;
    bool _controllerEnabled;
}

-(instancetype)initWithBridge:(RCTBridge *)bridge {
    self = [super initWithBridge:bridge];
    if (self) {
        _presenter = nil;
        _reticleEnabled = true;
        _controllerEnabled = true;
        _eventDelegate = std::make_shared<VROEventDelegateiOS>(self);
    }
    return self;
}

- (void)sceneWillAppear{
    [super sceneWillAppear];

    _presenter = self.scene->getControllerPresenter();
    _presenter->setEventDelegate(_eventDelegate);
    [self updateVisibility];
}

- (void)setReticleVisibility:(bool)visible {
    _reticleEnabled = visible;
}

- (void)setControllerVisibility:(bool)visible {
    _controllerEnabled = visible;
}

- (NSArray<NSNumber *> *)getControllerForwardVector {
    if (self.context) {
        VROVector3f vec = _presenter->getLastKnownForward();
        return @[@(vec.x), @(vec.y), @(vec.z)];
    } else {
        return @[@0, @0, @0];
    }
}

-(void) updateVisibility {
    if (!_presenter){
        return;
    }

    if(_presenter->getReticle() != nullptr) {
        _presenter->getReticle()->setEnabled(_reticleEnabled);
    }

    if(_presenter->getRootNode() != nullptr) {
        _presenter->getRootNode()->setHidden(!_controllerEnabled);
    }
}

- (void)didSetProps:(NSArray<NSString *> *)changedProps {
    [self updateVisibility];
}

#pragma mark default implementations for VRTEventDelegateProtocol
-(void)setCanClick:(BOOL)canClick {
    _eventDelegate->setEnabledEvent(VROEventDelegate::EventAction::OnClick, canClick);
}

-(void)setCanFuse:(BOOL)canFuse {
    _canFuse = canFuse;
    _eventDelegate->setEnabledEvent(VROEventDelegate::EventAction::OnFuse, canFuse);
}

-(void)onClick:(int)source node:(std::shared_ptr<VRONode>)node clickState:(VROEventDelegate::ClickState)clickState
 clickLocation:(std::vector<float>)location {
    if (self.onClickViro != nil) {
        if (location.size() > 0) {
            self.onClickViro(@{@"source": @(source),
                               @"clickState":@(clickState),
                               @"position":@[@(location[0]), @(location[1]), @(location[2])]});
        }
    }
}

-(void)onFuse:(int)source node:(std::shared_ptr<VRONode>)node {
    if (self.onFuseViro != nil) {
        self.onFuseViro(@{@"source": @(source)});
    }
}

// Drag, pinch and rotate carry the same payloads as VRTNode's and as Android's
// ComponentEventDelegate, so ViroController's handlers read one shape everywhere.
-(void)setCanDrag:(BOOL)canDrag {
    _canDrag = canDrag;
    _eventDelegate->setEnabledEvent(VROEventDelegate::EventAction::OnDrag, canDrag);
}

-(void)setCanPinch:(BOOL)canPinch {
    _canPinch = canPinch;
    _eventDelegate->setEnabledEvent(VROEventDelegate::EventAction::OnPinch, canPinch);
}

-(void)setCanRotate:(BOOL)canRotate {
    _canRotate = canRotate;
    _eventDelegate->setEnabledEvent(VROEventDelegate::EventAction::OnRotate, canRotate);
}

-(void)onDrag:(int)source node:(std::shared_ptr<VRONode>)node posX:(float)x posY:(float)y posZ:(float)z {
    if (self.onDragViro != nil) {
        self.onDragViro(@{@"source": @(source),
                          @"dragToPos": @[@(x), @(y), @(z)]});
    }
}

-(void)onPinch:(int)source node:(std::shared_ptr<VRONode>)node scaleFactor:(float)scale
    pinchState:(VROEventDelegate::PinchState)pinchState {
    if (self.onPinchViro != nil) {
        self.onPinchViro(@{@"source": @(source),
                           @"pinchState": @(pinchState),
                           @"scaleFactor": @(scale)});
    }
}

-(void)onRotate:(int)source node:(std::shared_ptr<VRONode>)node rotationRadians:(float)rotationRadians
    rotateState:(VROEventDelegate::RotateState)rotateState {
    if (self.onRotateViro != nil) {
        self.onRotateViro(@{@"source": @(source),
                            @"rotateState": @(rotateState),
                            @"rotationFactor": @(toDegrees(rotationRadians))});
    }
}

// Required by VROEventDelegateProtocol; ViroController has no hover event.
-(void)onHover:(int)source node:(std::shared_ptr<VRONode>)node isHovering:(bool)isHovering
 hoverLocation:(std::vector<float>)location {
}
@end


