//
//  ViroFabricManager.mm
//  ViroReact
//
//  Created for ReactVision.
//  Copyright © 2025 ReactVision. All rights reserved.
//

#import "ViroFabricManager.h"
#import <React/RCTLog.h>
#import <React/RCTBridge+Private.h>

@interface ViroFabricManager ()
@property (nonatomic, strong) NSMutableArray<NSString *> *supportedEvents;
@property (nonatomic, weak) RCTBridge *bridge;
@end

@implementation ViroFabricManager

// Singleton instance
static ViroFabricManager *sharedInstance = nil;

RCT_EXPORT_MODULE();

+ (instancetype)sharedInstance {
    static dispatch_once_t onceToken;
    dispatch_once(&onceToken, ^{
        sharedInstance = [[self alloc] init];
    });
    return sharedInstance;
}

- (instancetype)init {
    if (self = [super init]) {
        _supportedEvents = [NSMutableArray arrayWithObject:@"ViroEvent"];
    }
    return self;
}

- (void)setBridge:(RCTBridge *)bridge {
    [super setBridge:bridge];
    //_bridge = bridge;
}

+ (BOOL)requiresMainQueueSetup {
    return NO;
}

// Override to return the array of supported events
- (NSArray<NSString *> *)supportedEvents {
    return _supportedEvents;
}

// Method to emit events to JavaScript
- (void)sendEventWithName:(NSString *)name body:(NSDictionary *)body {
    if (self.bridge) {
        // Check if we're on the main thread
        if ([NSThread isMainThread]) {
            [super sendEventWithName:name body:body];
        } else {
            // Dispatch to main thread if we're not already on it
            dispatch_async(dispatch_get_main_queue(), ^{
                [super sendEventWithName:name body:body];
            });
        }
    } else {
        RCTLogWarn(@"Cannot send event: bridge is not available");
    }
}

// Add a new supported event
RCT_EXPORT_METHOD(addSupportedEvent:(NSString *)eventName) {
    if (![_supportedEvents containsObject:eventName]) {
        [_supportedEvents addObject:eventName];
    }
}

// Remove a supported event
RCT_EXPORT_METHOD(removeSupportedEvent:(NSString *)eventName) {
    [_supportedEvents removeObject:eventName];
}

// Check if an event is supported
RCT_EXPORT_METHOD(isEventSupported:(NSString *)eventName
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
    BOOL isSupported = [_supportedEvents containsObject:eventName];
    resolve(@(isSupported));
}

@end
