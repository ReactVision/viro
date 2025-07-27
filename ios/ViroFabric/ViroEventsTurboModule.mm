//
//  ViroEventsTurboModule.mm
//  ViroReact
//
//  Created for ReactVision.
//  Copyright © 2025 ReactVision. All rights reserved.
//

#import "ViroEventsTurboModule.h"
#import <React/RCTLog.h>
#import <React/RCTUtils.h>

@interface ViroEventsTurboModule ()
@property (nonatomic, assign) NSInteger listenerCount;
@property (nonatomic, strong) NSMutableSet<NSString *> *activeEvents;
@end

@implementation ViroEventsTurboModule

static ViroEventsTurboModule *sharedInstance = nil;

+ (instancetype)sharedInstance {
    static dispatch_once_t onceToken;
    dispatch_once(&onceToken, ^{
        sharedInstance = [[ViroEventsTurboModule alloc] init];
    });
    return sharedInstance;
}

- (instancetype)init {
    self = [super init];
    if (self) {
        _listenerCount = 0;
        _activeEvents = [[NSMutableSet alloc] init];
        RCTLogInfo(@"[ViroEventsTurboModule] Initialized");
    }
    return self;
}

#pragma mark - RCTEventEmitter

- (NSArray<NSString *> *)supportedEvents {
    return @[
        @"ViroJSICallback",
        @"ViroNodeEvent", 
        @"ViroSceneEvent"
    ];
}

- (void)startObserving {
    _listenerCount++;
    RCTLogInfo(@"[ViroEventsTurboModule] Started observing, listener count: %ld", (long)_listenerCount);
}

- (void)stopObserving {
    _listenerCount--;
    if (_listenerCount <= 0) {
        _listenerCount = 0;
        [_activeEvents removeAllObjects];
    }
    RCTLogInfo(@"[ViroEventsTurboModule] Stopped observing, listener count: %ld", (long)_listenerCount);
}

#pragma mark - TurboModule Methods

RCT_EXPORT_MODULE(ViroEvents)

RCT_EXPORT_METHOD(addListener:(NSString *)eventName) {
    [super addListener:eventName];
    [_activeEvents addObject:eventName];
    RCTLogInfo(@"[ViroEventsTurboModule] Added listener for event: %@", eventName);
}

RCT_EXPORT_METHOD(removeListeners:(double)count) {
    [super removeListeners:count];
    RCTLogInfo(@"[ViroEventsTurboModule] Removed %d listeners", (int)count);
}

RCT_EXPORT_METHOD(emitJSICallback:(NSString *)callbackId eventData:(NSDictionary *)eventData) {
    [self emitJSICallback:callbackId eventData:eventData];
}

RCT_EXPORT_METHOD(emitNodeEvent:(NSString *)nodeId eventName:(NSString *)eventName eventData:(NSDictionary *)eventData) {
    [self emitNodeEvent:nodeId eventName:eventName eventData:eventData];
}

RCT_EXPORT_METHOD(emitSceneEvent:(NSString *)sceneId eventName:(NSString *)eventName eventData:(NSDictionary *)eventData) {
    [self emitSceneEvent:sceneId eventName:eventName eventData:eventData];
}

RCT_EXPORT_SYNCHRONOUS_TYPED_METHOD(NSNumber *, isEventSystemReady) {
    return @([self isEventSystemReady]);
}

RCT_EXPORT_SYNCHRONOUS_TYPED_METHOD(NSNumber *, getActiveListenerCount) {
    return @([self getActiveListenerCount]);
}

#pragma mark - Event Emission Methods

- (void)emitJSICallback:(NSString *)callbackId eventData:(NSDictionary *)eventData {
    if (_listenerCount <= 0) {
        RCTLogWarn(@"[ViroEventsTurboModule] No listeners for JSI callback: %@", callbackId);
        return;
    }
    
    NSDictionary *body = @{
        @"callbackId": callbackId ?: @"",
        @"eventData": eventData ?: @{},
        @"timestamp": @([[NSDate date] timeIntervalSince1970])
    };
    
    [self sendEventWithName:@"ViroJSICallback" body:body];
    
    RCTLogInfo(@"[ViroEventsTurboModule] Emitted JSI callback: %@", callbackId);
}

- (void)emitNodeEvent:(NSString *)nodeId eventName:(NSString *)eventName eventData:(NSDictionary *)eventData {
    if (_listenerCount <= 0) {
        RCTLogWarn(@"[ViroEventsTurboModule] No listeners for node event: %@.%@", nodeId, eventName);
        return;
    }
    
    NSDictionary *body = @{
        @"nodeId": nodeId ?: @"",
        @"eventName": eventName ?: @"",
        @"eventData": eventData ?: @{},
        @"timestamp": @([[NSDate date] timeIntervalSince1970])
    };
    
    [self sendEventWithName:@"ViroNodeEvent" body:body];
    
    RCTLogInfo(@"[ViroEventsTurboModule] Emitted node event: %@.%@", nodeId, eventName);
}

- (void)emitSceneEvent:(NSString *)sceneId eventName:(NSString *)eventName eventData:(NSDictionary *)eventData {
    if (_listenerCount <= 0) {
        RCTLogWarn(@"[ViroEventsTurboModule] No listeners for scene event: %@.%@", sceneId, eventName);
        return;
    }
    
    NSDictionary *body = @{
        @"sceneId": sceneId ?: @"",
        @"eventName": eventName ?: @"",
        @"eventData": eventData ?: @{},
        @"timestamp": @([[NSDate date] timeIntervalSince1970])
    };
    
    [self sendEventWithName:@"ViroSceneEvent" body:body];
    
    RCTLogInfo(@"[ViroEventsTurboModule] Emitted scene event: %@.%@", sceneId, eventName);
}

#pragma mark - Utility Methods

- (BOOL)isEventSystemReady {
    return _listenerCount > 0;
}

- (NSInteger)getActiveListenerCount {
    return _listenerCount;
}

#pragma mark - Memory Management

- (void)dealloc {
    [_activeEvents removeAllObjects];
    RCTLogInfo(@"[ViroEventsTurboModule] Deallocated");
}

@end
