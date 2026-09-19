// VRTVisionOSModule.mm
// ViroReact — VisionOS
//
// React Native native module that lets JavaScript control the visionOS
// ImmersiveSpace. Posts NSNotifications received by the SwiftUI layer
// (ViroImmersiveSpace.swift → .viroImmersiveSpaceController() modifier).

#import "VRTVisionOSModule.h"
#import "VRORendererBridge.h"
#import "VROSharedSpaceBridge.h"
#import <React/RCTLog.h>

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
// ─── Shared coordinate space (CL-I) ──────────────────────────────────────────
//
// ARKit aligns the world origin across nearby devices, but it does not move the
// alignment data: it emits opaque blobs and expects them delivered to the other
// participants. These four methods are that pump, driven from JS so the app can
// use whatever transport it already has.

RCT_EXPORT_METHOD(sharedSpaceState:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
    VROSharedSpaceBridge *b = VROSharedSpaceBridge.shared;
    resolve(@{
        @"supported":    @(b.supported),
        @"sharing":      @(b.sharing),
        @"participants": @(b.participantCount),
    });
}

/// Base64 alignment data to send to the other participants, or null when there
/// is nothing new. Base64 because the RN bridge has no binary type.
RCT_EXPORT_METHOD(sharedSpaceNextOutgoing:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
    VROSharedSpaceBridge *b = VROSharedSpaceBridge.shared;
    if (b.nextOutgoingHandler == nil) { resolve([NSNull null]); return; }

    NSData *data = b.nextOutgoingHandler();
    if (data == nil || data.length == 0) { resolve([NSNull null]); return; }
    resolve([data base64EncodedStringWithOptions:0]);
}

/// Hand ARKit alignment data received from another participant.
RCT_EXPORT_METHOD(sharedSpacePushIncoming:(NSString *)base64
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
    VROSharedSpaceBridge *b = VROSharedSpaceBridge.shared;
    if (b.pushIncomingHandler == nil) {
        resolve(@(NO));
        return;
    }
    NSData *data = [[NSData alloc] initWithBase64EncodedString:base64 ?: @""
                                                       options:0];
    if (data == nil) {
        RCTLogWarn(@"[Viro] sharedSpacePushIncoming: not valid base64 — ignored.");
        resolve(@(NO));
        return;
    }
    b.pushIncomingHandler(data);
    resolve(@(YES));
}

// Live input tuning. Exists so the aim can be tuned with a headset on: a native rebuild is ten
// minutes and finding these numbers takes dozens of tries.
RCT_EXPORT_METHOD(setInputTuning:(NSDictionary *)tuning)
{
    VRORendererBridge *bridge = VRORendererBridge.currentBridge;
    if (bridge == nil) {
        RCTLogWarn(@"[Viro] setInputTuning called with no ImmersiveSpace open — ignored.");
        return;
    }
    [bridge setInputTuning:tuning];
}

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
