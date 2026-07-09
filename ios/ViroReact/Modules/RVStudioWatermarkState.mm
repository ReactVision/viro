//
//  RVStudioWatermarkState.mm
//  ViroReact
//

#import "RVStudioWatermarkState.h"

NSString *const RVStudioWatermarkDidChangeNotification =
    @"RVStudioWatermarkDidChangeNotification";

@interface RVStudioWatermarkState ()
@property (atomic, assign, readwrite) BOOL freeTier;
@end

@implementation RVStudioWatermarkState

+ (instancetype)sharedState {
  static RVStudioWatermarkState *shared = nil;
  static dispatch_once_t onceToken;
  dispatch_once(&onceToken, ^{
    shared = [[RVStudioWatermarkState alloc] init];
  });
  return shared;
}

- (void)updateFromSceneResponse:(NSDictionary *)response {
  BOOL freeTier = NO;

  id data = response[@"data"];
  if ([response[@"success"] boolValue] && [data isKindOfClass:[NSString class]]) {
    NSData *jsonData = [(NSString *)data dataUsingEncoding:NSUTF8StringEncoding];
    if (jsonData) {
      id parsed = [NSJSONSerialization JSONObjectWithData:jsonData
                                                  options:0
                                                    error:nil];
      if ([parsed isKindOfClass:[NSDictionary class]]) {
        freeTier = [((NSDictionary *)parsed)[@"is_free_tier"] boolValue];
      }
    }
  }

  [self setFreeTier:freeTier];
}

// Change-gated; notifies on the main queue (callers run on a background queue).
- (void)setFreeTier:(BOOL)freeTier {
  @synchronized(self) {
    if (_freeTier == freeTier) {
      return;
    }
    _freeTier = freeTier;
  }
  dispatch_async(dispatch_get_main_queue(), ^{
    [[NSNotificationCenter defaultCenter]
        postNotificationName:RVStudioWatermarkDidChangeNotification
                      object:nil];
  });
}

@end
