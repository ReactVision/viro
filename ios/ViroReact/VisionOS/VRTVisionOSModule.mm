// VRTVisionOSModule.mm
// ViroReact — VisionOS
//
// React Native native module that lets JavaScript control the visionOS
// ImmersiveSpace. Posts NSNotifications received by the SwiftUI layer
// (ViroImmersiveSpace.swift → .viroImmersiveSpaceController() modifier).

#import "VRTVisionOSModule.h"

// Notification names — must match those in ViroImmersiveSpace.swift.
static NSString *const kVRTEnterImmersiveSpace = @"VRTEnterImmersiveSpace";
static NSString *const kVRTExitImmersiveSpace  = @"VRTExitImmersiveSpace";

@implementation VRTVisionOSModule

RCT_EXPORT_MODULE(VRTVisionOSModule)

+ (BOOL)requiresMainQueueSetup {
    return YES;
}

- (dispatch_queue_t)methodQueue {
    return dispatch_get_main_queue();
}

// ─── enterImmersiveSpace ─────────────────────────────────────────────────────

/// Opens the Viro ImmersiveSpace on visionOS.
///
/// @param style  "mixed" (default) | "full" | "progressive"
/// @param resolve  Called with true on success.
/// @param reject   Called with an error message on failure.
RCT_EXPORT_METHOD(enterImmersiveSpace:(NSString *)style
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
    NSDictionary *userInfo = @{ @"style": style ?: @"mixed" };
    [[NSNotificationCenter defaultCenter]
        postNotificationName:kVRTEnterImmersiveSpace
                      object:nil
                    userInfo:userInfo];
    resolve(@(YES));
}

// ─── exitImmersiveSpace ──────────────────────────────────────────────────────

/// Dismisses the Viro ImmersiveSpace.
RCT_EXPORT_METHOD(exitImmersiveSpace:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
    [[NSNotificationCenter defaultCenter]
        postNotificationName:kVRTExitImmersiveSpace
                      object:nil];
    resolve(@(YES));
}

// ─── isVisionOS ──────────────────────────────────────────────────────────────

/// Synchronously returns whether this device is visionOS.
/// Use from JS as: const isVision = VRTVisionOSModule.isVisionOS;
- (NSDictionary *)constantsToExport {
#if TARGET_OS_VISION
    return @{ @"isVisionOS": @(YES) };
#else
    return @{ @"isVisionOS": @(NO) };
#endif
}

@end
