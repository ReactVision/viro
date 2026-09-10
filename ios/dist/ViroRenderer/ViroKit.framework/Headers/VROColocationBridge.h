//
//  VROColocationBridge.h
//  ViroKit
//
//  Copyright © 2026 ReactVision. All rights reserved.
//
//  Objective-C surface for the co-location frame channel, for iOS and visionOS.
//
//  Pure Objective-C on purpose. visionOS narrows what it can import to headers
//  that parse as plain Objective-C — most of this framework reaches into the
//  renderer's C++ — and the channel is one of the few things that has to work
//  on a platform where the AR subsystem does not exist at all.
//

#import <Foundation/Foundation.h>

NS_ASSUME_NONNULL_BEGIN

/** One peer's last known pose, in the shared location frame. */
@interface VROColocationPeerInfo : NSObject
@property (nonatomic, copy)   NSString *peerId;
/** Location-frame position [x, y, z]. Never world coordinates. */
@property (nonatomic, copy)   NSArray<NSNumber *> *position;
/** Quaternion [x, y, z, w]. */
@property (nonatomic, copy)   NSArray<NSNumber *> *rotation;
@property (nonatomic, assign) double timestampMs;
@property (nonatomic, assign) BOOL localized;
@end

typedef NS_ENUM(NSInteger, VROColocationBridgeState) {
    VROColocationBridgeStateIdle         = 0,
    VROColocationBridgeStateJoining      = 1,
    VROColocationBridgeStateJoined       = 2,
    VROColocationBridgeStateReconnecting = 3,
    VROColocationBridgeStateFailed       = 4,
};

@interface VROColocationBridge : NSObject

/** One session per process: a device is in one room at a time. */
+ (instancetype)shared;

/** NO when ReactVisionCCA is not linked, or the platform has no socket. */
- (BOOL)isAvailable;

/**
 * Join the room named by `roomId` — the cloud anchor id, Meta group id or
 * visionOS session id that already names the shared frame. Leaves any current
 * room. Pass nil for `endpoint` to use the default.
 */
- (void)joinRoom:(NSString *)roomId
          apiKey:(NSString *)apiKey
       projectId:(NSString *)projectId
        endpoint:(nullable NSString *)endpoint
      completion:(void (^)(BOOL success, NSString *error))completion;

- (void)leave;

/**
 * Publish the local pose as 16 comma-separated floats, column-major, **in the
 * shared location frame**. Safe to call every frame.
 */
- (void)setLocalPoseCsv:(NSString *)csv;

- (VROColocationBridgeState)state;
- (NSString *)localPeerId;
- (NSArray<VROColocationPeerInfo *> *)peers;

@end

NS_ASSUME_NONNULL_END
