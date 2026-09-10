//
//  VROSharedSpaceBridge.mm
//  ViroReact
//
//  Copyright © 2026 ReactVision. All rights reserved.
//

#import "VROSharedSpaceBridge.h"

@implementation VROSharedSpaceBridge

+ (VROSharedSpaceBridge *)shared {
    static VROSharedSpaceBridge *instance = nil;
    static dispatch_once_t once;
    dispatch_once(&once, ^{ instance = [[VROSharedSpaceBridge alloc] init]; });
    return instance;
}

- (void)reset {
    self.supported            = NO;
    self.sharing              = NO;
    self.participantCount     = 0;
    self.nextOutgoingHandler  = nil;
    self.pushIncomingHandler  = nil;
}

@end
