//
//  ViroFabricContainerViewRegister.mm
//  ViroReact
//
//  Created for ReactVision.
//  Copyright © 2025 ReactVision. All rights reserved.
//

#import <React/RCTLog.h>
#import <React/RCTUIManager.h>
#import <React/RCTViewManager.h>
#import <React/RCTComponentViewFactory.h>

#import "ViroFabricContainerComponentView.h"
#import "ViroFabricContainer.h"

// This macro registers the component with React Native
RCT_EXPORT_MODULE(ViroFabricContainerView)

@interface ViroFabricContainerViewManager : RCTViewManager
@end

@implementation ViroFabricContainerViewManager

// Return the view
- (UIView *)view
{
    return [[ViroFabricContainer alloc] initWithBridge:self.bridge];
}

// Export the initialize command
RCT_EXPORT_METHOD(initialize:(nonnull NSNumber *)reactTag
                  apiKey:(NSString *)apiKey
                  debug:(BOOL)debug
                  arEnabled:(BOOL)arEnabled
                  worldAlignment:(NSString *)worldAlignment)
{
    [self.bridge.uiManager addUIBlock:^(RCTUIManager *uiManager, NSDictionary<NSNumber *,UIView *> *viewRegistry) {
        ViroFabricContainer *view = (ViroFabricContainer *)viewRegistry[reactTag];
        if (!view || ![view isKindOfClass:[ViroFabricContainer class]]) {
            RCTLogError(@"Cannot find ViroFabricContainer with tag #%@", reactTag);
            return;
        }
        
        [view initialize:apiKey debug:debug arEnabled:arEnabled worldAlignment:worldAlignment];
    }];
}

// Export the cleanup command
RCT_EXPORT_METHOD(cleanup:(nonnull NSNumber *)reactTag)
{
    [self.bridge.uiManager addUIBlock:^(RCTUIManager *uiManager, NSDictionary<NSNumber *,UIView *> *viewRegistry) {
        ViroFabricContainer *view = (ViroFabricContainer *)viewRegistry[reactTag];
        if (!view || ![view isKindOfClass:[ViroFabricContainer class]]) {
            RCTLogError(@"Cannot find ViroFabricContainer with tag #%@", reactTag);
            return;
        }
        
        [view cleanup];
    }];
}

@end

// Register the component with React Native's Fabric system
Class<RCTComponentViewProtocol> ViroFabricContainerViewCls(void);

@implementation RCTComponentViewFactory(ViroFabricContainerView)

+ (void)load {
    RCTRegisterComponentViewClass([ViroFabricContainerComponentView class]);
}

@end
