//
//  VRTARTrackingTargetsModule.mm
//  ViroReact
//
//  Created by Andy Chu on 2/1/18.
//  Copyright © 2018 Viro Media. All rights reserved.
//
//  Permission is hereby granted, free of charge, to any person obtaining
//  a copy of this software and associated documentation files (the
//  "Software"), to deal in the Software without restriction, including
//  without limitation the rights to use, copy, modify, merge, publish,
//  distribute, sublicense, and/or sell copies of the Software, and to
//  permit persons to whom the Software is furnished to do so, subject to
//  the following conditions:
//
//  The above copyright notice and this permission notice shall be included
//  in all copies or substantial portions of the Software.
//
//  THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
//  EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
//  MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
//  IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
//  CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
//  TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
//  SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
//

#import "VRTARTrackingTargetsModule.h"
#import "VRTUtils.h"

#pragma mark - VRTARImageTargetPromise Implementation

@implementation VRTARImageTargetPromise {
    NSString *_key;
    RCTImageSource *_source;
    VROImageOrientation _orientation;
    float _physicalWidth;
    std::shared_ptr<VROARImageTarget> _arTarget;
    NSMutableArray *_waitBlocks;
    NSURLSessionDataTask *_downloadTask;
}

- (instancetype)initWithKey:(NSString *)key
                      source:(RCTImageSource *)source
                 orientation:(VROImageOrientation)orientation
               physicalWidth:(float)physicalWidth {
    self = [super init];
    if (self) {
        _key = key;
        _source = source;
        _orientation = orientation;
        _physicalWidth = physicalWidth;
        _ready = NO;
        _waitBlocks = [[NSMutableArray alloc] init];
    }
    return self;
}

- (void)wait:(VRTARImageTargetPromiseCompletion)finishBlock {
    BOOL settled;
    @synchronized (self) {
        settled = _ready;
        if (!settled) {
            [_waitBlocks addObject:finishBlock];
        }
    }
    if (settled) {
        finishBlock(_key, _arTarget);
    }
}

// Marks the promise settled and notifies every waiter, with a null target on failure.
- (void)settleWithTarget:(std::shared_ptr<VROARImageTarget>)target {
    NSArray *blocks;
    @synchronized (self) {
        _arTarget = target;
        _ready = YES;
        blocks = _waitBlocks;
        _waitBlocks = nil;
    }
    for (VRTARImageTargetPromiseCompletion completion in blocks) {
        completion(_key, target);
    }
}

- (void)fetch {
    if (_arTarget) {
        return;
    }

    NSURL *URL = _source.request.URL;
    NSString *scheme = URL.scheme.lowercaseString;
    if([scheme isEqualToString:@"file"] || [scheme isEqualToString:@"http"] || [scheme isEqualToString:@"data"] ||  [scheme isEqualToString:@"https"]) {
        _downloadTask = downloadDataWithURL(URL, ^(NSData *data, NSError *error) {
            _downloadTask = nil;
            if (error || !data) {
                RCTLogError(@"[VRTARTrackingTargets] Error downloading image target source [%@]", _key);
                [self settleWithTarget:nullptr];
                return;
            }

            UIImage *image = [[UIImage alloc] initWithData:data];
            if (!image) {
                RCTLogError(@"[VRTARTrackingTargets] Error converting data into image target [%@]", _key);
                [self settleWithTarget:nullptr];
                return;
            }

            // create image target
            [self settleWithTarget:std::make_shared<VROARImageTargetiOS>(image, _orientation, _physicalWidth)];
        });
    } else {
        RCTLogError(@"[VRTARTrackingTargets] Unsupported image target source for [%@]", _key);
        [self settleWithTarget:nullptr];
    }
}

@end

#pragma mark - VRTARObjectTargetPromise Implementation

@implementation VRTARObjectTargetPromise {
    NSString *_key;
    NSDictionary *_source;
    std::shared_ptr<VROARObjectTarget> _arTarget;
    NSMutableArray *_waitBlocks;
    NSURLSessionDataTask *_downloadTask;
    BOOL _assetDownloaded;
}

- (instancetype)initWithKey:(NSString *)key
                     source:(NSDictionary *)source {
    self = [super init];
    if (self) {
        _key = key;
        _source = source;
        _ready = NO;
        _assetDownloaded = NO;
        _waitBlocks = [[NSMutableArray alloc] init];
    }
    return self;
}

- (void)dealloc {
    // if the asset was downloaded, delete it from the filesystem once this target is destroyed!
    if (_arTarget && _assetDownloaded) {
        std::shared_ptr<VROARObjectTargetiOS> targetiOS = std::dynamic_pointer_cast<VROARObjectTargetiOS>(_arTarget);
        if (targetiOS) {
            NSURL *localFile = targetiOS->getLocalFileUrl();
            NSFileManager *fileManager = [NSFileManager defaultManager];
            NSError *error;
            BOOL success = [fileManager removeItemAtPath:localFile.path error:&error];
            if (!success) {
                NSLog(@"[Viro] - could not delete file %@, err: %@", localFile.path, [error localizedDescription]);
            }
        }
    }
}

- (void)wait:(VRTARObjectTargetPromiseCompletion)finishBlock {
    BOOL settled;
    @synchronized (self) {
        settled = _ready;
        if (!settled) {
            [_waitBlocks addObject:finishBlock];
        }
    }
    if (settled) {
        finishBlock(_key, _arTarget);
    }
}

// Marks the promise settled and notifies every waiter, with a null target on failure.
- (void)settleWithTarget:(std::shared_ptr<VROARObjectTarget>)target {
    NSArray *blocks;
    @synchronized (self) {
        _arTarget = target;
        _ready = YES;
        blocks = _waitBlocks;
        _waitBlocks = nil;
    }
    for (VRTARObjectTargetPromiseCompletion completion in blocks) {
        completion(_key, target);
    }
}

- (void)fetch {
    if (_arTarget) {
        return;
    }

    NSString *uri = [_source objectForKey:@"uri"];
    NSURL *url = [uri isKindOfClass:[NSString class]] ? [NSURL URLWithString:uri] : nil;
    NSString *scheme = url.scheme.lowercaseString;

    if([scheme isEqualToString:@"file"] || [scheme isEqualToString:@"http"] || [scheme isEqualToString:@"https"]) {
        if (![scheme isEqualToString:@"file"]) {
            _assetDownloaded = YES;
            _downloadTask = downloadDataWithURL(url, ^(NSData *data, NSError *error) {
                _downloadTask = nil;
                if (error || !data) {
                    RCTLogError(@"[VRTARTrackingTargets] Error downloading object target source [%@]", _key);
                    [self settleWithTarget:nullptr];
                    return;
                }

                // write the data to a local file!
                NSString *filename = [NSString stringWithFormat:@"%@-%@", [url lastPathComponent], [[NSProcessInfo processInfo] globallyUniqueString]];
                NSArray *localPaths = NSSearchPathForDirectoriesInDomains(NSCachesDirectory, NSUserDomainMask, YES);
                NSString *cachesDirectory = [localPaths objectAtIndex:0];
                NSString *filePath = [cachesDirectory stringByAppendingPathComponent:filename];
                NSError *writeError;
                BOOL success = [data writeToFile:filePath options:NSDataWritingAtomic error:&writeError];
                if (success) {
                    // create object target
                    [self settleWithTarget:std::make_shared<VROARObjectTargetiOS>([NSURL fileURLWithPath:filePath])];
                } else {
                    NSLog(@"[Viro] error writing obj to local file %@", [writeError localizedDescription]);
                    [self settleWithTarget:nullptr];
                }
            });
        } else {
            [self settleWithTarget:std::make_shared<VROARObjectTargetiOS>(url)];
        }
    } else {
        RCTLogError(@"[VRTARTrackingTargets] Unsupported object target source for [%@]", _key);
        [self settleWithTarget:nullptr];
    }
}

@end

#pragma mark - VRTARTrackingTargetsModule Implemetation

@implementation VRTARTrackingTargetsModule {
    NSMutableDictionary *_targetsDict;
}

- (instancetype)init {
    self = [super init];
    if (self) {
        _targetsDict = [[NSMutableDictionary alloc] init];
    }
    return self;
}

+ (BOOL)requiresMainQueueSetup {
  return NO;
}

- (VRTARImageTargetPromise *)getARImageTargetPromise:(NSString *)name {
    NSObject *obj;
    @synchronized (_targetsDict) {
        obj = _targetsDict[name];
    }
    if (obj && [obj isKindOfClass:[VRTARImageTargetPromise class]]) {
        return (VRTARImageTargetPromise *) obj;
    } else {
        return nil;
    }
}

- (VRTARObjectTargetPromise *)getARObjectTargetPromise:(NSString *)name {
    NSObject *obj;
    @synchronized (_targetsDict) {
        obj = _targetsDict[name];
    }
    if (obj && [obj isKindOfClass:[VRTARObjectTargetPromise class]]) {
        return (VRTARObjectTargetPromise *) obj;
    } else {
        return nil;
    }
}

#pragma mark RCT_EXPORT_METHODS

RCT_EXPORT_MODULE()

RCT_EXPORT_METHOD(createTargets:(NSDictionary *)targets) {
    for (NSString *key in targets) {
        NSDictionary *target = [targets objectForKey:key];
        
        NSString *targetType = [target objectForKey:@"type"];

        if (targetType && [targetType caseInsensitiveCompare:@"Object"] == NSOrderedSame) {
            VRTARObjectTargetPromise *promise = [[VRTARObjectTargetPromise alloc] initWithKey:key source:[target objectForKey:@"source"]];
            @synchronized (_targetsDict) {
                _targetsDict[key] = promise;
            }
            [promise fetch];
        } else { // Assume the default is an Image target!
            RCTImageSource *source = [RCTConvert RCTImageSource:[target objectForKey:@"source"]];

            NSNumber *width = [target objectForKey:@"physicalWidth"];
            float physicalWidth = [width floatValue];

            VROImageOrientation orientation = VROImageOrientation::Up; // default orientation!
            NSString *strOrientation = [target objectForKey:@"orientation"];
            if (strOrientation) {
                if ([strOrientation caseInsensitiveCompare:@"Up"] == NSOrderedSame) {
                    orientation = VROImageOrientation::Up;
                } else if ([strOrientation caseInsensitiveCompare:@"Down"] == NSOrderedSame) {
                    orientation = VROImageOrientation::Down;
                } else if ([strOrientation caseInsensitiveCompare:@"Left"] == NSOrderedSame) {
                    orientation = VROImageOrientation::Left;
                } else if ([strOrientation caseInsensitiveCompare:@"Right"] == NSOrderedSame) {
                    orientation = VROImageOrientation::Right;
                } else {
                    RCTLogError(@"[VRTARTrackingTargets] Unknown orientation [%@] for target [%@]", strOrientation, key);
                }
            }

            VRTARImageTargetPromise *promise = [[VRTARImageTargetPromise alloc] initWithKey:key
                                                                                     source:source
                                                                                orientation:orientation
                                                                              physicalWidth:physicalWidth];
            @synchronized (_targetsDict) {
                _targetsDict[key] = promise;
            }
            [promise fetch];
        }
    }
}

RCT_EXPORT_METHOD(deleteTarget:(NSString *)name) {
    @synchronized (_targetsDict) {
        [_targetsDict removeObjectForKey:name];
    }
}

@end


// RCTBridge (VRTARTrackingTargetsModule) Category Implementation
@implementation RCTBridge (VRTARTrackingTargetsModule)

- (VRTARTrackingTargetsModule *)trackingTargetsModule {
    return [self moduleForClass:[VRTARTrackingTargetsModule class]];
}

@end
