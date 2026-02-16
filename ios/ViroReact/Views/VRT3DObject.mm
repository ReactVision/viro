//
//  VRT3DObject.m
//  React
//
//  Created by Vik Advani on 4/14/16.
//  Copyright © 2016 Viro Media. All rights reserved.
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

#import <React/RCTConvert.h>
#import "VRT3DObject.h"
#import "VRTMaterialManager.h"
#import "VRTUtils.h"
#import "VRTAnimationManager.h"

@interface VRT3DObjectAnimation : VRTNodeAnimation

@end

@implementation VRT3DObjectAnimation

- (std::shared_ptr<VROExecutableAnimation>)loadAnimation {
    std::shared_ptr<VRONode> node = self.node.lock();
    if (!node) {
        return [super loadAnimation];
    }
    std::set<std::string> animationKeys = node->getAnimationKeys(true);

    if (self.animationName) {
        std::string key = std::string([self.animationName UTF8String]);

        // First check if it's a built-in animation from the 3D model
        if (!animationKeys.empty()) {
            auto it = animationKeys.find(key);
            if (it != animationKeys.end()) {
                return node->getAnimation(key, true);
            }
        }
        // Not a built-in animation, try to load from animation manager
        return [super loadAnimation];
    }
    else {
        // No animation name specified, use first built-in animation if available
        if (!animationKeys.empty()) {
            return node->getAnimation(*animationKeys.begin(), true);
        }
        return [super loadAnimation];
    }
}

@end

@interface VRT3DObject ()

@end

@implementation VRT3DObject {

    NSURL *_url;
    std::shared_ptr<VROMaterial> _objMaterial;
    BOOL _sourceChanged;
    BOOL _modelLoaded;
    NSArray *_resources;

}

- (instancetype)initWithBridge:(RCTBridge *)bridge  {
    self = [super initWithBridge:bridge];
    _sourceChanged = NO;
    _modelLoaded = NO;
    self.nodeAnimation = [[VRT3DObjectAnimation alloc] init];
    self.nodeAnimation.bridge = bridge;  // Store bridge for lazy animation manager lookup
    // Use moduleForClass with NSClassFromString - works better with RCTBridgeProxy in new architecture
    Class animManagerClass = NSClassFromString(@"VRTAnimationManager");
    if (animManagerClass) {
        self.nodeAnimation.animationManager = [bridge moduleForClass:animManagerClass];
    }
    self.nodeAnimation.node = self.node;

    return self;
}

- (void)setDriver:(std::shared_ptr<VRODriver>)driver {
    [super setDriver:driver];
    [self didSetProps:nil];
}

- (void)setSource:(NSDictionary *)source {
    _source = source;
    _sourceChanged = YES;
}

- (void)setResources:(NSArray *)resources {
    NSLog(@"[VRX DEBUG] setResources called with %lu resources", (unsigned long)resources.count);
    for (int i = 0; i < resources.count; i++) {
        NSDictionary *resource = resources[i];
        NSLog(@"[VRX DEBUG]   Resource %d: %@", i, resource);
    }
    _resources = resources;
    _sourceChanged = YES;
}

- (void)setMorphTargets:(NSArray *)morphTargets {
    _morphTargets = morphTargets;
    if (!_modelLoaded){
        return;
    }
    
    for (NSDictionary *target in morphTargets) {
        // Grab the target key and values
        NSObject *targetObject = [target objectForKey:@"target"];
        if (targetObject == NULL){
            RCTLogWarn(@"Incorrectly configured Morph Targets.");
            return;
        }
        NSString *key = (NSString *) targetObject;
        float value = [[target objectForKey:@"weight"] floatValue];
        std::string targetStr = std::string([key UTF8String]);
        
        std::set<std::shared_ptr<VROMorpher>> morphers = self.node->getMorphers(true);
        for (auto morph : morphers) {
            morph->setWeightForTarget(targetStr, value);
        }
    }
}

- (void)updateAnimation {
    /*
     If no animation name was specified, then use the first keyframe animation,
     if available.
     */
    if (!self.nodeAnimation.animationName || self.nodeAnimation.animationName.length == 0) {
        std::set<std::string> animationKeys = self.node->getAnimationKeys(true);
        if (!animationKeys.empty()) {
            self.nodeAnimation.animationName = [NSString stringWithUTF8String:animationKeys.begin()->c_str()];
        }
    }
    
    [self.nodeAnimation updateAnimation];
}

- (void)setAnimation:(NSDictionary *)animation {
    [super setAnimation:animation];
    [self updateAnimation];
}

- (void)didSetProps:(NSArray<NSString *> *)changedProps {
    if (![NSThread isMainThread]) {
        RCTLogWarn(@"Calling [RCTConvert didSetProps:] on a background thread is not recommended");
        dispatch_sync(dispatch_get_main_queue(), ^{
            [self didSetProps:changedProps];
        });
        
        return;
    }
    
    // Wait until we have the driver
    if (!self.driver) {
        return;
    }
    
    // Only reload the model if its source changed
    if (!_sourceChanged) {
        return;
    }
    
    NSString *path;
    if (!(path = [RCTConvert NSString:self.source[@"uri"]])) {
        RCTLogError(@"Unable to load 3D model object with no path");
    }
    
    _url = [RCTConvert NSURL:path];
    std::string url = std::string([[_url description] UTF8String]);
    std::string base = url.substr(0, url.find_last_of('/'));
    
    if (self.onLoadStartViro) {
        self.onLoadStartViro(nil);
    }
    
    if (!_type) {
        RCTLogError(@"`type` property not set on Viro3DObject.");
        return;
    }
    
    // Clear all child nodes of this control before loading our 3D models
    for (std::shared_ptr<VRONode> child : self.node->getChildNodes()) {
        child->removeFromParentNode();
    }
    _modelLoaded = NO;
    __weak VRT3DObject *weakSelf = self;
    std::function<void(std::shared_ptr<VRONode> node, bool success)> onFinish =
    [weakSelf](std::shared_ptr<VRONode> node, bool success) {
        VRT3DObject *strongSelf = weakSelf;
        if (success && strongSelf) {
            strongSelf->_modelLoaded = YES;
            [strongSelf setMorphTargets:strongSelf->_morphTargets];

            if (strongSelf.materials) {
                // Apply materials recursively to all child geometries in the loaded model
                [strongSelf applyMaterialsRecursive:YES];
            }

            // Apply shader overrides if specified (preserves textures)
            if (strongSelf.shaderOverrides) {
                [strongSelf applyShaderOverridesRecursive:YES];
            }

            [weakSelf updateAnimation];
        }

        /*
         Once the object is loaded, set the lighting bit masks recursively
         down the tree to the internal FBX nodes.
         */
        if (node != nullptr) {
            node->setLightReceivingBitMask([weakSelf lightReceivingBitMask], true);
            node->setShadowCastingBitMask([weakSelf shadowCastingBitMask], true);
        }
        
        if (weakSelf && weakSelf.onLoadEndViro) {
            weakSelf.onLoadEndViro(nil);
        }

        if (!success) {
            if (weakSelf && weakSelf.onErrorViro) {
                weakSelf.onErrorViro(@{ @"error": @"model failed to load" });
            }
        }
    };

    if ([_type caseInsensitiveCompare:@"OBJ"] == NSOrderedSame) {
        VROOBJLoader::loadOBJFromResource(url, VROResourceType::URL, self.node, self.driver, onFinish);
    } else if ([_type caseInsensitiveCompare:@"VRX"] == NSOrderedSame) {
        if (_resources && _resources.count > 0) {
            // Convert NSArray of resource dictionaries to std::map<std::string, std::string>
            // Each resource is a dictionary with {uri: "...", name: "..."} from resolveAssetSource
            std::map<std::string, std::string> resourceMap;
            for (NSDictionary *resource in _resources) {
                if ([resource isKindOfClass:[NSDictionary class]]) {
                    NSString *uri = resource[@"uri"];
                    NSString *filename = nil;

                    // Extract filename from URI
                    NSURL *url = [NSURL URLWithString:uri];

                    // For Metro bundler URLs, the filename is in the unstable_path query parameter
                    if (url && url.query) {
                        NSURLComponents *components = [NSURLComponents componentsWithURL:url resolvingAgainstBaseURL:NO];
                        for (NSURLQueryItem *item in components.queryItems) {
                            if ([item.name isEqualToString:@"unstable_path"]) {
                                // unstable_path contains the relative path like "./assets/models/cloud_anim/file.png?platform=ios&hash=..."
                                NSString *unstablePath = [item.value stringByRemovingPercentEncoding];

                                // Strip any query parameters from the unstable_path itself
                                NSRange queryStart = [unstablePath rangeOfString:@"?"];
                                if (queryStart.location != NSNotFound) {
                                    unstablePath = [unstablePath substringToIndex:queryStart.location];
                                }

                                filename = [unstablePath lastPathComponent];
                                break;
                            }
                        }
                    }

                    // Fallback: extract from URL path (for file:// URLs)
                    if (!filename || filename.length == 0) {
                        NSString *path = url.path ?: uri;
                        filename = [[path lastPathComponent] stringByRemovingPercentEncoding];
                    }

                    if (uri && filename && filename.length > 0) {
                        resourceMap[std::string([filename UTF8String])] = std::string([uri UTF8String]);
                    }
                }
            }
            VROFBXLoader::loadFBXFromResources(url, VROResourceType::URL, self.node, resourceMap, self.driver, onFinish);
        } else {
            VROFBXLoader::loadFBXFromResource(url, VROResourceType::URL, self.node, self.driver, onFinish);
        }
    } else if ([_type caseInsensitiveCompare:@"GLTF"] == NSOrderedSame) {
        VROGLTFLoader::loadGLTFFromResource(url, {},  VROResourceType::URL, self.node, false, self.driver, onFinish);
    } else if ([_type caseInsensitiveCompare:@"GLB"] == NSOrderedSame) {
        VROGLTFLoader::loadGLTFFromResource(url, {},  VROResourceType::URL, self.node, true, self.driver, onFinish);
    } else {
        self.onErrorViro(@{ @"error": @"model failed to load" });
    }
    _sourceChanged = NO;
}

/*
 Set the bit masks recursively for 3D objects because they may have internal
 (FBX) nodes.
 */
- (void)setLightReceivingBitMask:(int)lightReceivingBitMask {
    [super setLightReceivingBitMask:lightReceivingBitMask];
    [self node]->setLightReceivingBitMask(lightReceivingBitMask, true);
}

- (void)setShadowCastingBitMask:(int)shadowCastingBitMask {
    [super setShadowCastingBitMask:shadowCastingBitMask];
    [self node]->setShadowCastingBitMask(shadowCastingBitMask, true);
}

@end
