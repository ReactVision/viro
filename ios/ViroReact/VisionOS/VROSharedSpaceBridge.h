//
//  VROSharedSpaceBridge.h
//  ViroReact
//
//  Copyright © 2026 ReactVision. All rights reserved.
//
//  Meeting point between the Swift shared-coordinate-space provider
//  (ViroSharedSpace, owned by the ViroReactUI pod) and the React Native module
//  that drives it from JS (VRTVisionOSModule, in this pod).
//
//  It exists because the dependency only runs one way: ViroReactUI depends on
//  ViroReact and `import ViroReact` gives Swift these headers, but ViroReact
//  cannot see back into the pure-Swift pod. So Swift pushes its state and
//  handlers down here, and the module reads them.
//
//  Must stay pure Objective-C. On visionOS this pod exposes only a handful of
//  public headers precisely because most of them reach into the renderer's C++,
//  which a Clang module compiled as plain Objective-C cannot parse.
//

#import <Foundation/Foundation.h>

NS_ASSUME_NONNULL_BEGIN

@interface VROSharedSpaceBridge : NSObject

/// Nil until an ImmersiveSpace has started a provider.
@property (class, nonatomic, readonly) VROSharedSpaceBridge *shared;

/// False when the device cannot join a shared coordinate space at all.
@property (nonatomic, assign) BOOL supported;

/// True between ARKit's sharingEnabled and sharingDisabled events.
@property (nonatomic, assign) BOOL sharing;

/// Participants aligned to this space, excluding the local device.
@property (nonatomic, assign) NSInteger participantCount;

/// Set by Swift. Returns alignment data to deliver to the other participants,
/// or nil when there is nothing new to send.
@property (nonatomic, copy, nullable) NSData * _Nullable (^nextOutgoingHandler)(void);

/// Set by Swift. Hands ARKit alignment data received from another participant.
@property (nonatomic, copy, nullable) void (^pushIncomingHandler)(NSData *data);

/// Cleared when the ImmersiveSpace closes so a stale provider is not addressed.
- (void)reset;

@end

NS_ASSUME_NONNULL_END
