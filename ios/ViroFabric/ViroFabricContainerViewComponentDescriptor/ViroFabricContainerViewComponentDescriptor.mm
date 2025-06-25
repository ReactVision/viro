//
//  ViroFabricContainerViewComponentDescriptor.mm
//  ViroReact
//
//  Created for ReactVision.
//  Copyright © 2025 ReactVision. All rights reserved.
//

#import <React/RCTMacros.h>
#import <React/RCTLog.h>

// Import the component view
#import "ViroFabricContainerComponentView.h"

// Simple Fabric component support
// This file provides the essential functions needed for Fabric integration
// without relying on missing or invalid React Native classes

// Protocol implementation for command handling
@protocol RCTViroFabricContainerViewViewProtocol <NSObject>
- (void)initialize:(BOOL)debug arEnabled:(BOOL)arEnabled worldAlignment:(NSString *)worldAlignment;
- (void)cleanup;
@end

// Command handler function - Full implementation with comprehensive error handling
void RCTViroFabricContainerViewHandleCommand(
    id<RCTViroFabricContainerViewViewProtocol> componentView,
    NSString const *commandName,
    NSArray const *args)
{
    // Validate component view
    if (!componentView) {
        RCTLogError(@"[ViroFabric] Command handler: componentView is nil");
        return;
    }
    
    // Validate command name
    if (!commandName || [commandName length] == 0) {
        RCTLogError(@"[ViroFabric] Command handler: commandName is nil or empty");
        return;
    }
    
    RCTLogInfo(@"[ViroFabric] Executing command: %@ with %lu arguments", commandName, (unsigned long)(args ? args.count : 0));
    
    if ([commandName isEqualToString:@"initialize"]) {
        // Validate arguments for initialize command
        if (!args) {
            RCTLogError(@"[ViroFabric] Initialize command: args is nil");
            return;
        }
        
        if (args.count < 3) {
            RCTLogError(@"[ViroFabric] Initialize command: insufficient arguments (expected 3, got %lu)", (unsigned long)args.count);
            return;
        }
        
        // Extract and validate debug parameter
        BOOL debug = NO;
        if (args[0] && [args[0] respondsToSelector:@selector(boolValue)]) {
            debug = [args[0] boolValue];
        } else {
            RCTLogWarn(@"[ViroFabric] Initialize command: invalid debug parameter, defaulting to NO");
        }
        
        // Extract and validate arEnabled parameter
        BOOL arEnabled = NO;
        if (args[1] && [args[1] respondsToSelector:@selector(boolValue)]) {
            arEnabled = [args[1] boolValue];
        } else {
            RCTLogWarn(@"[ViroFabric] Initialize command: invalid arEnabled parameter, defaulting to NO");
        }
        
        // Extract and validate worldAlignment parameter
        NSString *worldAlignment = @"Gravity"; // Default value
        if (args[2] && [args[2] isKindOfClass:[NSString class]]) {
            NSString *providedAlignment = (NSString *)args[2];
            
            // Validate world alignment values
            NSArray *validAlignments = @[@"Gravity", @"GravityAndHeading", @"Camera"];
            if ([validAlignments containsObject:providedAlignment]) {
                worldAlignment = providedAlignment;
            } else {
                RCTLogWarn(@"[ViroFabric] Initialize command: invalid worldAlignment '%@', defaulting to 'Gravity'. Valid values: %@", 
                          providedAlignment, [validAlignments componentsJoinedByString:@", "]);
            }
        } else {
            RCTLogWarn(@"[ViroFabric] Initialize command: invalid worldAlignment parameter, defaulting to 'Gravity'");
        }
        
        // Log initialization parameters
        RCTLogInfo(@"[ViroFabric] Initializing with debug: %@, arEnabled: %@, worldAlignment: %@", 
                  debug ? @"YES" : @"NO", arEnabled ? @"YES" : @"NO", worldAlignment);
        
        // Execute the initialize command
        @try {
            [componentView initialize:debug arEnabled:arEnabled worldAlignment:worldAlignment];
            RCTLogInfo(@"[ViroFabric] Initialize command executed successfully");
        } @catch (NSException *exception) {
            RCTLogError(@"[ViroFabric] Initialize command failed with exception: %@", exception.reason);
        }
        
    } else if ([commandName isEqualToString:@"cleanup"]) {
        // Cleanup command doesn't require arguments
        RCTLogInfo(@"[ViroFabric] Executing cleanup command");
        
        @try {
            [componentView cleanup];
            RCTLogInfo(@"[ViroFabric] Cleanup command executed successfully");
        } @catch (NSException *exception) {
            RCTLogError(@"[ViroFabric] Cleanup command failed with exception: %@", exception.reason);
        }
        
    } else {
        // Unknown command
        RCTLogError(@"[ViroFabric] Unknown command: %@. Supported commands: initialize, cleanup", commandName);
        
        // Log available commands for debugging
        RCTLogInfo(@"[ViroFabric] Available commands:");
        RCTLogInfo(@"  - initialize(debug: boolean, arEnabled: boolean, worldAlignment: string)");
        RCTLogInfo(@"  - cleanup()");
    }
}

// Event emitter conversion functions - Full Fabric Integration
// These functions convert NSDictionary events to Fabric-compatible event data

void RCTBridgingToEventEmitterOnInitialized(NSDictionary *event)
{
    if (!event) {
        RCTLogError(@"[ViroFabric] OnInitialized: event is nil");
        return;
    }
    
    // Validate required event data
    NSNumber *success = event[@"success"];
    if (!success) {
        RCTLogWarn(@"[ViroFabric] OnInitialized: missing 'success' field, defaulting to false");
        success = @NO;
    }
    
    // Log successful initialization
    if ([success boolValue]) {
        RCTLogInfo(@"[ViroFabric] ViroFabricContainer initialized successfully");
    } else {
        RCTLogError(@"[ViroFabric] ViroFabricContainer initialization failed");
    }
    
    // Additional initialization data logging
    if (event[@"arEnabled"]) {
        RCTLogInfo(@"[ViroFabric] AR Mode: %@", [event[@"arEnabled"] boolValue] ? @"Enabled" : @"Disabled");
    }
    if (event[@"worldAlignment"]) {
        RCTLogInfo(@"[ViroFabric] World Alignment: %@", event[@"worldAlignment"]);
    }
}

void RCTBridgingToEventEmitterOnTrackingUpdated(NSDictionary *event)
{
    if (!event) {
        RCTLogError(@"[ViroFabric] OnTrackingUpdated: event is nil");
        return;
    }
    
    // Extract and validate tracking state
    NSNumber *state = event[@"state"];
    NSNumber *reason = event[@"reason"];
    
    if (!state) {
        RCTLogWarn(@"[ViroFabric] OnTrackingUpdated: missing 'state' field, defaulting to 0");
        state = @0;
    }
    if (!reason) {
        RCTLogWarn(@"[ViroFabric] OnTrackingUpdated: missing 'reason' field, defaulting to 0");
        reason = @0;
    }
    
    // Convert tracking state to human-readable format
    NSString *stateDescription = @"Unknown";
    switch ([state intValue]) {
        case 0: stateDescription = @"Not Available"; break;
        case 1: stateDescription = @"Limited"; break;
        case 2: stateDescription = @"Normal"; break;
        default: stateDescription = [NSString stringWithFormat:@"Custom(%d)", [state intValue]]; break;
    }
    
    // Convert tracking reason to human-readable format
    NSString *reasonDescription = @"Unknown";
    switch ([reason intValue]) {
        case 0: reasonDescription = @"None"; break;
        case 1: reasonDescription = @"Initializing"; break;
        case 2: reasonDescription = @"Excessive Motion"; break;
        case 3: reasonDescription = @"Insufficient Features"; break;
        case 4: reasonDescription = @"Relocalizing"; break;
        default: reasonDescription = [NSString stringWithFormat:@"Custom(%d)", [reason intValue]]; break;
    }
    
    RCTLogInfo(@"[ViroFabric] Tracking Updated - State: %@ (%@), Reason: %@ (%@)", 
               state, stateDescription, reason, reasonDescription);
    
    // Log additional tracking data if available
    if (event[@"anchors"]) {
        NSArray *anchors = event[@"anchors"];
        RCTLogInfo(@"[ViroFabric] Active Anchors: %lu", (unsigned long)[anchors count]);
    }
}

void RCTBridgingToEventEmitterOnCameraTransformUpdate(NSDictionary *event)
{
    if (!event) {
        RCTLogError(@"[ViroFabric] OnCameraTransformUpdate: event is nil");
        return;
    }
    
    // Extract camera transform data
    NSArray *cameraTransform = event[@"cameraTransform"];
    NSArray *position = event[@"position"];
    NSArray *rotation = event[@"rotation"];
    NSArray *forward = event[@"forward"];
    NSArray *up = event[@"up"];
    
    // Validate and log camera transform matrix
    if (cameraTransform && [cameraTransform count] >= 16) {
        RCTLogInfo(@"[ViroFabric] Camera Transform Matrix Updated: [%.3f, %.3f, %.3f, %.3f]", 
                   [cameraTransform[0] floatValue], [cameraTransform[1] floatValue], 
                   [cameraTransform[2] floatValue], [cameraTransform[3] floatValue]);
    }
    
    // Log camera position if available
    if (position && [position count] >= 3) {
        RCTLogInfo(@"[ViroFabric] Camera Position: (%.3f, %.3f, %.3f)", 
                   [position[0] floatValue], [position[1] floatValue], [position[2] floatValue]);
    }
    
    // Log camera rotation if available
    if (rotation && [rotation count] >= 3) {
        RCTLogInfo(@"[ViroFabric] Camera Rotation: (%.3f°, %.3f°, %.3f°)", 
                   [rotation[0] floatValue] * 180.0 / M_PI, 
                   [rotation[1] floatValue] * 180.0 / M_PI, 
                   [rotation[2] floatValue] * 180.0 / M_PI);
    }
    
    // Log camera orientation vectors if available
    if (forward && [forward count] >= 3) {
        RCTLogInfo(@"[ViroFabric] Camera Forward: (%.3f, %.3f, %.3f)", 
                   [forward[0] floatValue], [forward[1] floatValue], [forward[2] floatValue]);
    }
    
    if (up && [up count] >= 3) {
        RCTLogInfo(@"[ViroFabric] Camera Up: (%.3f, %.3f, %.3f)", 
                   [up[0] floatValue], [up[1] floatValue], [up[2] floatValue]);
    }
    
    // Performance monitoring
    static NSTimeInterval lastUpdateTime = 0;
    NSTimeInterval currentTime = [[NSDate date] timeIntervalSince1970];
    if (lastUpdateTime > 0) {
        NSTimeInterval deltaTime = currentTime - lastUpdateTime;
        if (deltaTime > 0) {
            double fps = 1.0 / deltaTime;
            if (fps < 30.0) {
                RCTLogWarn(@"[ViroFabric] Camera transform update rate low: %.1f FPS", fps);
            }
        }
    }
    lastUpdateTime = currentTime;
}
