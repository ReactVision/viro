#import <React/RCTBridgeModule.h>
#import <React/RCTBridge.h>

@interface VRTStudioModule : NSObject <RCTBridgeModule>

@end

// @internal True while a first-party session set through rvSetStudioSession is active.
FOUNDATION_EXPORT BOOL VRTStudioHasSession(void);
