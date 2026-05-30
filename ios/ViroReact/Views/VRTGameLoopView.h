//  VRTGameLoopView.h — headless VRTNode that fires per-frame JS callbacks
//  Copyright © 2026 ReactVision. All rights reserved.

#pragma once
#import <React/RCTComponent.h>
#import "VRTNode.h"

@interface VRTGameLoopView : VRTNode

// Called every rendered frame: {dt: number, elapsed: number}
@property (nonatomic, copy) RCTDirectEventBlock onUpdate;
// Called after physics/rendering each frame
@property (nonatomic, copy) RCTDirectEventBlock onLateUpdate;
// When > 0: fire onFixedUpdate at this frequency (Hz)
@property (nonatomic, assign) float fixedHz;
// Called at the fixed-step rate set by fixedHz
@property (nonatomic, copy) RCTDirectEventBlock onFixedUpdate;

@end
