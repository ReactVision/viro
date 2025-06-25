//
//  RCTComponentViewHelpers.h
//  ViroReact
//
//  Created for ReactVision.
//  Copyright © 2025 ReactVision. All rights reserved.
//

#pragma once

#import <UIKit/UIKit.h>
#import <React/RCTDefines.h>

NS_ASSUME_NONNULL_BEGIN

/**
 * Protocol that defines the commands that can be sent to the ViroFabricContainerView component.
 */
@protocol RCTViroFabricContainerViewViewProtocol <NSObject>

/**
 * Initialize the Viro container with the given parameters.
 */
- (void)initialize:(NSString *)apiKey debug:(BOOL)debug arEnabled:(BOOL)arEnabled worldAlignment:(NSString *)worldAlignment;

/**
 * Clean up the Viro container.
 */
- (void)cleanup;

@end

/**
 * Helper function to handle commands sent to the ViroFabricContainerView component.
 */
RCT_EXTERN inline void RCTViroFabricContainerViewHandleCommand(
    id<RCTViroFabricContainerViewViewProtocol> componentView,
    const NSString *commandName,
    const NSArray *args)
{
    if ([commandName isEqualToString:@"initialize"]) {
        NSString *apiKey = args[0];
        BOOL debug = [args[1] boolValue];
        BOOL arEnabled = [args[2] boolValue];
        NSString *worldAlignment = args[3];
        [componentView initialize:apiKey debug:debug arEnabled:arEnabled worldAlignment:worldAlignment];
        return;
    }
    
    if ([commandName isEqualToString:@"cleanup"]) {
        [componentView cleanup];
        return;
    }
}

NS_ASSUME_NONNULL_END
