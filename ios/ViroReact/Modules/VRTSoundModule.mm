//
//  VRTSoundModule.mm
//  ViroReact
//
//  Created by Andy Chu on 2/2/17.
//  Copyright © 2017 Viro Media. All rights reserved.
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

#import "VRTSoundModule.h"
#import <React/RCTLog.h>
#import <React/RCTConvert.h>
#import <React/RCTUtils.h>

@interface VRTSoundModule ()
@end

@implementation VRTSoundModule {
    std::map<std::string, std::shared_ptr<VROSoundData>> _preloadedSounds;
    std::map<std::string, std::shared_ptr<VROSoundDataDelegateiOS>> _preloadCallbacks;
}

RCT_EXPORT_MODULE()

// _preloadedSounds and _preloadCallbacks are read by VRTSound on the main thread
// (dataForName), so every method runs there too.
- (dispatch_queue_t)methodQueue {
    return dispatch_get_main_queue();
}

+ (BOOL)requiresMainQueueSetup {
    return NO;
}

RCT_EXPORT_METHOD(preloadSounds:(NSDictionary *)soundDict
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
    for (id key in soundDict) {
        NSString *path = [self parseImagePath:soundDict[key]];
        std::string cKeyString = std::string([((NSString *) key) UTF8String]);
        if (path == nil) {
            // Resolve rather than leave ViroSound.preloadSounds waiting forever.
            RCTLogError(@"Invalid preloaded sound path provided.");
            if (resolve) {
                resolve(@{ @"key" : key, @"result" : @(NO), @"msg" : @"Invalid preloaded sound path" });
            }
            return;
        }
        std::string cPathString = std::string([((NSString *) path) UTF8String]);

        // Same split as VRTSound's uri sources: http(s) is downloaded, anything else
        // (file:// in release builds) is read in place.
        VROResourceType resourceType = [path hasPrefix:@"http"] ? VROResourceType::URL : VROResourceType::LocalFile;
        std::shared_ptr<VROSoundDataGVR> data = VROSoundDataGVR::create(cPathString, resourceType);
        _preloadedSounds[cKeyString] = data;

        if (resolve) {
            // Resolves once, on the main thread: a download can finish off main, and
            // setDelegate notifies at once when the data is already loaded.
            auto resolved = std::make_shared<bool>(false);
            auto weakCallback = std::make_shared<std::weak_ptr<VROSoundDataDelegateiOS>>();
            std::function<void(bool success, std::string msg)> onFinish = [self, cKeyString, resolve, resolved, weakCallback](bool success, std::string msg) {
                void (^finish)(void) = ^{
                    if (*resolved) {
                        return;
                    }
                    *resolved = true;
                    RCTPromiseResolveBlock resolveOnce = resolve;
                    // Drop this key's callback, unless a later preload of the same key replaced it.
                    auto it = self->_preloadCallbacks.find(cKeyString);
                    if (it != self->_preloadCallbacks.end() && it->second == weakCallback->lock()) {
                        self->_preloadCallbacks.erase(it);
                    }
                    resolveOnce(@{
                                  @"key" : @(cKeyString.c_str()),
                                  @"result" : @(success),
                                  @"msg" : @(msg.c_str()),
                                  });
                };
                if ([NSThread isMainThread]) {
                    finish();
                } else {
                    dispatch_async(dispatch_get_main_queue(), finish);
                }
            };

            // Store a strong reference to the sound delegate callback for the given sound key.
            std::shared_ptr<VROSoundDataDelegateiOS> callback = std::make_shared<VROSoundDataDelegateiOS>(onFinish);
            *weakCallback = callback;
            _preloadCallbacks[cKeyString] = callback;
            // Notifies right away if the data finished loading before this line.
            data->setDelegate(callback);
        }
    }
}

- (NSString *)parseImagePath:(id)json {
    NSString *path;
    if ([json isKindOfClass:[NSString class]]) {
        path = json;
    } else if ([json isKindOfClass:[NSDictionary class]]) {
        NSDictionary *dictionary = (NSDictionary *)json;
        path = [RCTConvert NSString:dictionary[@"uri"]];
        if (!path) {
            return nil;
        }
    } else {
        return nil;
    }
    return path;
}

RCT_EXPORT_METHOD(unloadSounds:(NSArray<NSString *> *)soundArray) {
    for (id name in soundArray) {
        NSString *nameString = (NSString *)name;
        std::string cName = std::string([nameString UTF8String]);
        auto it = _preloadedSounds.find(cName);
        
        // "Unloading" a sound simply consists of removing it from our map. If something else is still using
        // the sound data, then the data won't actually be unloaded until all references to it are gone.
        if (it != _preloadedSounds.end()) {
            _preloadedSounds.erase(it);
        }
    }
}

- (std::shared_ptr<VROSoundData>)dataForName:(NSString *)name {
    std::string cName = std::string([name UTF8String]);
    auto it = _preloadedSounds.find(cName);
    if (it != _preloadedSounds.end()) {
        return it->second;
    } else {
        return nullptr;
    }
}

@end
