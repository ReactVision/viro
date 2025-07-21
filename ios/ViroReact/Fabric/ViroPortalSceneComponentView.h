//
//  ViroPortalSceneComponentView.h
//  ViroReact
//
//  Created for ReactVision.
//  Copyright © 2025 ReactVision. All rights reserved.
//

#import <UIKit/UIKit.h>
#import <React/RCTViewComponentView.h>
#import <React/RCTComponent.h>

NS_ASSUME_NONNULL_BEGIN

@interface ViroPortalSceneComponentView : RCTViewComponentView

// Portal scene properties
@property (nonatomic, strong) NSString *passable;
@property (nonatomic, strong) NSArray<NSNumber *> *position;
@property (nonatomic, strong) NSArray<NSNumber *> *rotation;
@property (nonatomic, strong) NSArray<NSNumber *> *scale;

// Event callbacks
@property (nonatomic, copy) RCTBubblingEventBlock onPortalEnter;
@property (nonatomic, copy) RCTBubblingEventBlock onPortalExit;

// Scene management
- (void)addPortalContent:(SCNNode *)content;
- (void)removePortalContent:(SCNNode *)content;
- (void)updatePortalSceneState;

@end

NS_ASSUME_NONNULL_END