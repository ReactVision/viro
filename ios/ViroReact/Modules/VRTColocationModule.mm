//
//  VRTColocationModule.mm
//  ViroReact
//
//  Copyright © 2026 ReactVision. All rights reserved.
//
//  React Native module for the co-location frame channel, iOS and visionOS.
//
//  Not part of VRTARSceneNavigatorModule: the channel needs no AR scene, only
//  a room id and poses. Keeping it independent is what lets the same JS API
//  work on visionOS, where the AR subsystem does not exist at all.
//

#import "VRTColocationModule.h"
#import <ViroKit/VROColocationBridge.h>

@implementation VRTColocationModule

RCT_EXPORT_MODULE(VRTColocationModule)

// Every method here is cheap and the completion for join already hops to the
// main queue, so the module can live there too.
- (dispatch_queue_t)methodQueue {
    return dispatch_get_main_queue();
}

RCT_EXPORT_METHOD(isAvailable:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
    resolve(@([VROColocationBridge.shared isAvailable]));
}

RCT_EXPORT_METHOD(join:(NSString *)roomId
                  apiKey:(NSString *)apiKey
                  projectId:(NSString *)projectId
                  endpoint:(NSString *)endpoint
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
    [VROColocationBridge.shared joinRoom:roomId ?: @""
                                  apiKey:apiKey ?: @""
                               projectId:projectId ?: @""
                                endpoint:endpoint
                              completion:^(BOOL success, NSString *error) {
        // Resolved either way: a failed join is a result, not an exception, and
        // the JS frame sources all read `success` rather than catching.
        if (success) {
            resolve(@{ @"success": @(YES) });
        } else {
            resolve(@{ @"success": @(NO), @"error": error ?: @"" });
        }
    }];
}

RCT_EXPORT_METHOD(leave:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
    [VROColocationBridge.shared leave];
    resolve(@(YES));
}

/// Pose as 16 comma-separated floats, column-major, in the location frame.
RCT_EXPORT_METHOD(setLocalPose:(NSString *)csv
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
    [VROColocationBridge.shared setLocalPoseCsv:csv ?: @""];
    resolve(@(YES));
}

RCT_EXPORT_METHOD(getState:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
    resolve(@{
        @"state":       @([VROColocationBridge.shared state]),
        @"localPeerId": [VROColocationBridge.shared localPeerId] ?: @"",
    });
}

RCT_EXPORT_METHOD(getPeers:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
    NSMutableArray *out = [NSMutableArray array];
    for (VROColocationPeerInfo *p in [VROColocationBridge.shared peers]) {
        [out addObject:@{
            @"peerId":      p.peerId ?: @"",
            @"position":    p.position ?: @[@0, @0, @0],
            @"rotation":    p.rotation ?: @[@0, @0, @0, @1],
            @"timestampMs": @(p.timestampMs),
            @"localized":   @(p.localized),
        }];
    }
    resolve(out);
}

@end
