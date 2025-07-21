//
//  ViroPortalComponentView.h
//  ViroReact
//
//  Created for ReactVision.
//  Copyright © 2025 ReactVision. All rights reserved.
//

#import <UIKit/UIKit.h>
#import <React/RCTViewComponentView.h>
#import <React/RCTComponent.h>

NS_ASSUME_NONNULL_BEGIN

@interface ViroPortalComponentView : RCTViewComponentView

// Portal properties
@property (nonatomic, strong) NSString *passable;
@property (nonatomic, strong) NSString *portalEnterCompletionAction;
@property (nonatomic, strong) NSString *portalExitCompletionAction;
@property (nonatomic, assign) CGFloat portalScale;

// Event callbacks
@property (nonatomic, copy) RCTBubblingEventBlock onPortalEnter;
@property (nonatomic, copy) RCTBubblingEventBlock onPortalExit;
@property (nonatomic, copy) RCTBubblingEventBlock onClick;
@property (nonatomic, copy) RCTBubblingEventBlock onHover;

// Portal management
- (void)enterPortal;
- (void)exitPortal;
- (void)updatePortalState;

@end

NS_ASSUME_NONNULL_END