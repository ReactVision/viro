//
//  ViroFabricContainerManager.mm
//  ViroReact
//
//  Created for ReactVision.
//  Copyright © 2025 ReactVision. All rights reserved.
//

#import "ViroFabricContainerManager.h"
#import "ViroFabricContainer.h"
#import <React/RCTBridge.h>
#import <React/RCTUIManager.h>

@implementation ViroFabricContainerManager

RCT_EXPORT_MODULE()

- (UIView *)view
{
  return [[ViroFabricContainer alloc] initWithBridge:self.bridge];
}

// Export properties
RCT_EXPORT_VIEW_PROPERTY(onInitialized, RCTDirectEventBlock)
RCT_EXPORT_VIEW_PROPERTY(onTrackingUpdated, RCTDirectEventBlock)
RCT_EXPORT_VIEW_PROPERTY(onCameraTransformUpdate, RCTDirectEventBlock)

// Export methods
RCT_EXPORT_METHOD(initialize:(nonnull NSNumber *)reactTag
                  apiKey:(NSString *)apiKey
                  debug:(BOOL)debug
                  arEnabled:(BOOL)arEnabled
                  worldAlignment:(NSString *)worldAlignment)
{
  [self.bridge.uiManager addUIBlock:^(__unused RCTUIManager *uiManager, NSDictionary<NSNumber *, UIView *> *viewRegistry) {
    ViroFabricContainer *view = (ViroFabricContainer *)viewRegistry[reactTag];
    if (!view || ![view isKindOfClass:[ViroFabricContainer class]]) {
      RCTLogError(@"Cannot find ViroFabricContainer with tag #%@", reactTag);
      return;
    }
    
    [view initialize:debug arEnabled:arEnabled worldAlignment:worldAlignment];
  }];
}

RCT_EXPORT_METHOD(cleanup:(nonnull NSNumber *)reactTag)
{
  [self.bridge.uiManager addUIBlock:^(__unused RCTUIManager *uiManager, NSDictionary<NSNumber *, UIView *> *viewRegistry) {
    ViroFabricContainer *view = (ViroFabricContainer *)viewRegistry[reactTag];
    if (!view || ![view isKindOfClass:[ViroFabricContainer class]]) {
      RCTLogError(@"Cannot find ViroFabricContainer with tag #%@", reactTag);
      return;
    }
    
    [view cleanup];
  }];
}

@end
