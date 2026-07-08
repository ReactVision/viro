//
//  RVStudioWatermarkState.h
//  ViroReact
//
//  Process-wide, native-only source of truth for whether the currently loaded
//  Studio scene belongs to a Free-tier org and must therefore display the
//  "Powered by ReactVision Studio" watermark.
//
//  The flag is written ONLY from the native rvGetScene response (see
//  VRTStudioModule), never from JavaScript, so an SDK consumer cannot strip the
//  watermark by editing JS. The AR scene navigator observes
//  RVStudioWatermarkDidChangeNotification to show/hide the native overlay.
//

#import <Foundation/Foundation.h>

/// Posted (on the main queue) whenever the watermark flag changes.
extern NSString *const RVStudioWatermarkDidChangeNotification;

@interface RVStudioWatermarkState : NSObject

/// YES when the last fetched Studio scene is owned by a Free-tier org.
@property (atomic, assign, readonly) BOOL freeTier;

+ (instancetype)sharedState;

/// Parses a VRTStudio rvGetScene resolve payload ({ success, data }) and
/// updates `freeTier` from the response's `is_free_tier` field.
- (void)updateFromSceneResponse:(NSDictionary *)response;

@end
