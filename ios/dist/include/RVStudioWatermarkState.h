//
//  RVStudioWatermarkState.h
//  ViroReact
//

#import <Foundation/Foundation.h>

// Process-wide source of truth for the Free-tier "Powered by ReactVision
// Studio" watermark. Written only from the native rvGetScene response, never
// from JS, so a consumer cannot strip the watermark by editing JS.

/// Posted on the main queue whenever `freeTier` changes.
extern NSString *const RVStudioWatermarkDidChangeNotification;

@interface RVStudioWatermarkState : NSObject

@property (atomic, assign, readonly) BOOL freeTier;

+ (instancetype)sharedState;

/// Parses an rvGetScene resolve payload ({ success, data }) and updates
/// `freeTier` from its `is_free_tier` field.
- (void)updateFromSceneResponse:(NSDictionary *)response;

@end
