//
//  VRTViewLookup.h
//  ViroReact
//
//  Copyright © 2026 ReactVision. All rights reserved.
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

#import <UIKit/UIKit.h>
#import <React/RCTBridgeModule.h>
#import <React/RCTLog.h>
#import <React/RCTUIManager.h>
#import <React/RCTUtils.h>

/*
 Resolves a react tag to its Viro view the way VRTARSceneNavigatorModule and VRTCameraModule
 do. Under the new architecture the NSDictionary the legacy RCTUIManager block hands out never
 holds interop-mounted views, and a method called from componentDidMount can run before Fabric
 has mounted the view. RCTViewRegistry returns the interop wrapper, hence the paper-view unwrap.

 The block runs on the main queue once the tag resolves to an instance of expectedClass, or,
 after about a second of frames, with whatever it resolved to (possibly nil). Callers keep
 their own class check and error handling for that last case.
 */

typedef void (^VRTViewLookupBlock)(UIView *view);

static const int kVRTViewLookupMaxFrames = 60;

static inline void VRTWithViewForTagAttempt(RCTViewRegistry *registry, NSNumber *reactTag, Class expectedClass,
                                            int attempt, VRTViewLookupBlock block) {
    if (registry == nil) {
        RCTLogWarn(@"[Viro] viewRegistry_DEPRECATED is nil, view lookup for tag %@ cannot run", reactTag);
        RCTExecuteOnMainQueue(^{ block(nil); });
        return;
    }
    __weak RCTViewRegistry *weakRegistry = registry;
    [registry addUIBlock:^(RCTViewRegistry *viewRegistry) {
        UIView *view = RCTPaperViewOrCurrentView([viewRegistry viewForReactTag:reactTag]);
        if (![view isKindOfClass:expectedClass] && attempt < kVRTViewLookupMaxFrames) {
            dispatch_after(dispatch_time(DISPATCH_TIME_NOW, (int64_t)(16 * NSEC_PER_MSEC)), dispatch_get_main_queue(), ^{
                VRTWithViewForTagAttempt(weakRegistry, reactTag, expectedClass, attempt + 1, block);
            });
            return;
        }
        block(view);
    }];
}

static inline void VRTWithViewForTag(RCTViewRegistry *registry, NSNumber *reactTag, Class expectedClass,
                                     VRTViewLookupBlock block) {
    VRTWithViewForTagAttempt(registry, reactTag, expectedClass, 0, block);
}
