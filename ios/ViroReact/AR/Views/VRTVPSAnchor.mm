//
//  VRTVPSAnchor.mm
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
//

#import <ViroKit/ViroKit.h>
#import <ViroKit/VROVPSAnchorNode.h>
#import "VRTVPSAnchor.h"

@implementation VRTVPSAnchor {
    BOOL _placed;
}

- (instancetype)initWithBridge:(RCTBridge *)bridge {
    return [super initWithBridge:bridge];
}

- (std::shared_ptr<VRONode>)createVroNode {
    std::shared_ptr<VROVPSAnchorNode> node = std::make_shared<VROVPSAnchorNode>();
    __weak VRTVPSAnchor *weakSelf = self;
    node->setPlacedListener([weakSelf](bool placed) {
        dispatch_async(dispatch_get_main_queue(), ^{
            [weakSelf placedDidChange:placed];
        });
    });
    return node;
}

- (void)setScene:(std::shared_ptr<VROScene>)scene {
    [super setScene:scene];
    // Under a VR root there is no VPS: the anchor stays hidden.
    std::shared_ptr<VROARScene> arScene = std::dynamic_pointer_cast<VROARScene>(scene);
    std::shared_ptr<VROVPSAnchorNode> node = std::dynamic_pointer_cast<VROVPSAnchorNode>([self node]);
    if (arScene && node) {
        arScene->addVPSAnchorNode(node);
    }
}

// Children appear, and their physics bodies simulate, only once placed.
- (BOOL)shouldAppear {
    return [super shouldAppear] && _placed;
}

- (void)placedDidChange:(BOOL)placed {
    if (placed == _placed) {
        return;
    }
    _placed = placed;
    [self handleAppearanceChange];
    if (_onAnchorStateChangeViro) {
        _onAnchorStateChangeViro(@{ @"state" : placed ? @"tracking" : @"hidden" });
    }
}

@end
