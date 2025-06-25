//
//  ViroFabricSceneManager.mm
//  ViroReact
//
//  Created for ReactVision.
//  Copyright © 2025 ReactVision. All rights reserved.
//

#import "ViroFabricSceneManager.h"
#import "ViroFabricContainer.h"
#import <React/RCTLog.h>
#import "../ViroReact/Views/VRTScene.h"
#import "../ViroReact/AR/Views/VRTARScene.h"
#import "../ViroReact/Views/VRTSceneNavigator.h"
#import "../ViroReact/AR/Views/VRTARSceneNavigator.h"
#import "../VRTVRSceneNavigator.h"
#import "../ViroReact/Views/VRTNode.h"

@interface ViroFabricSceneManager ()

// Scene registry with weak references to prevent memory leaks
@property (nonatomic, strong) NSMutableDictionary<NSString *, NSValue *> *sceneRegistry;

// Active scene tracking
@property (nonatomic, weak) id activeScene;
@property (nonatomic, strong) NSString *activeSceneId;

// Scene state tracking
@property (nonatomic, strong) NSMutableDictionary<NSString *, NSNumber *> *sceneStates;

// Memory management
@property (nonatomic, strong) NSMutableArray<NSValue *> *managedNodes;
@property (nonatomic, strong) NSMutableDictionary<NSString *, NSNumber *> *sceneCreationTimes;

// Container reference
@property (nonatomic, weak) ViroFabricContainer *container;
@property (nonatomic, weak) RCTBridge *bridge;

// Scene lifecycle listener
@property (nonatomic, weak) id<ViroFabricSceneLifecycleListener> lifecycleListener;

@end

@implementation ViroFabricSceneManager

- (instancetype)initWithContainer:(ViroFabricContainer *)container
                           bridge:(RCTBridge *)bridge {
    self = [super init];
    if (self) {
        _container = container;
        _bridge = bridge;
        _sceneRegistry = [[NSMutableDictionary alloc] init];
        _sceneStates = [[NSMutableDictionary alloc] init];
        _managedNodes = [[NSMutableArray alloc] init];
        _sceneCreationTimes = [[NSMutableDictionary alloc] init];
        
        // Set up memory warning notifications
        [[NSNotificationCenter defaultCenter] addObserver:self
                                                 selector:@selector(handleMemoryWarning:)
                                                     name:UIApplicationDidReceiveMemoryWarningNotification
                                                   object:nil];
    }
    return self;
}

- (void)dealloc {
    [[NSNotificationCenter defaultCenter] removeObserver:self];
    [self cleanup];
}

#pragma mark - Public Methods

- (void)setLifecycleListener:(id<ViroFabricSceneLifecycleListener>)listener {
    _lifecycleListener = listener;
}

- (id)createScene:(NSString *)sceneId
        sceneType:(NSString *)sceneType
            props:(NSDictionary *)props {
    
    RCTLogInfo(@"[ViroFabricSceneManager] Creating scene: %@ of type: %@", sceneId, sceneType);
    
    @try {
        // Check if scene already exists
        NSValue *existingSceneValue = self.sceneRegistry[sceneId];
        if (existingSceneValue) {
            __weak id existingScene = [existingSceneValue nonretainedObjectValue];
            if (existingScene) {
                RCTLogWarn(@"[ViroFabricSceneManager] Scene %@ already exists, returning existing scene", sceneId);
                return existingScene;
            } else {
                // Clean up stale reference
                [self.sceneRegistry removeObjectForKey:sceneId];
                [self.sceneStates removeObjectForKey:sceneId];
            }
        }
        
        // Create the appropriate scene type
        id scene = nil;
        if ([sceneType isEqualToString:@"scene"]) {
            Class sceneClass = NSClassFromString(@"VRTScene");
            if (sceneClass) {
                scene = [[sceneClass alloc] initWithBridge:self.bridge];
            }
        } else if ([sceneType isEqualToString:@"arScene"]) {
            Class arSceneClass = NSClassFromString(@"VRTARScene");
            if (arSceneClass) {
                scene = [[arSceneClass alloc] initWithBridge:self.bridge];
            }
        } else {
            RCTLogError(@"[ViroFabricSceneManager] Unknown scene type: %@", sceneType);
            return nil;
        }
        
        if (!scene) {
            RCTLogError(@"[ViroFabricSceneManager] Failed to create scene of type: %@", sceneType);
            return nil;
        }
        
        // Set scene properties
        if (props && [scene respondsToSelector:@selector(setProperties:)]) {
            [scene performSelector:@selector(setProperties:) withObject:props];
        }
        
        // Register the scene with weak reference
        NSValue *sceneValue = [NSValue valueWithNonretainedObject:scene];
        self.sceneRegistry[sceneId] = sceneValue;
        self.sceneStates[sceneId] = @(ViroFabricSceneStateCreated);
        self.sceneCreationTimes[sceneId] = @([[NSDate date] timeIntervalSince1970]);
        
        // Set up scene lifecycle callbacks
        [self setupSceneLifecycleCallbacks:sceneId scene:scene];
        
        // Notify listener
        if (self.lifecycleListener && [self.lifecycleListener respondsToSelector:@selector(onSceneCreated:scene:)]) {
            [self.lifecycleListener onSceneCreated:sceneId scene:scene];
        }
        
        RCTLogInfo(@"[ViroFabricSceneManager] Successfully created scene: %@", sceneId);
        return scene;
        
    } @catch (NSException *exception) {
        RCTLogError(@"[ViroFabricSceneManager] Error creating scene %@: %@", sceneId, exception.reason);
        return nil;
    }
}

- (BOOL)activateScene:(NSString *)sceneId {
    RCTLogInfo(@"[ViroFabricSceneManager] Activating scene: %@", sceneId);
    
    @try {
        NSValue *sceneValue = self.sceneRegistry[sceneId];
        if (!sceneValue) {
            RCTLogError(@"[ViroFabricSceneManager] Cannot activate scene: scene not found - %@", sceneId);
            return NO;
        }
        
        __weak id scene = [sceneValue nonretainedObjectValue];
        if (!scene) {
            RCTLogError(@"[ViroFabricSceneManager] Cannot activate scene: scene reference is nil - %@", sceneId);
            return NO;
        }
        
        // Deactivate current active scene
        if (self.activeScene && self.activeSceneId) {
            [self deactivateScene:self.activeSceneId];
        }
        
        // Set the scene on the appropriate navigator
        if (self.container) {
            id navigator = [self.container getActiveNavigator];
            if (navigator) {
                if ([navigator respondsToSelector:@selector(setScene:)]) {
                    [navigator performSelector:@selector(setScene:) withObject:scene];
                } else if ([navigator respondsToSelector:@selector(setCurrentScene:)]) {
                    [navigator performSelector:@selector(setCurrentScene:) withObject:scene];
                }
            }
        }
        
        // Update active scene tracking
        self.activeScene = scene;
        self.activeSceneId = sceneId;
        self.sceneStates[sceneId] = @(ViroFabricSceneStateActive);
        
        // Notify listener
        if (self.lifecycleListener && [self.lifecycleListener respondsToSelector:@selector(onSceneActivated:scene:)]) {
            [self.lifecycleListener onSceneActivated:sceneId scene:scene];
        }
        
        RCTLogInfo(@"[ViroFabricSceneManager] Successfully activated scene: %@", sceneId);
        return YES;
        
    } @catch (NSException *exception) {
        RCTLogError(@"[ViroFabricSceneManager] Error activating scene %@: %@", sceneId, exception.reason);
        return NO;
    }
}

- (BOOL)deactivateScene:(NSString *)sceneId {
    RCTLogInfo(@"[ViroFabricSceneManager] Deactivating scene: %@", sceneId);
    
    @try {
        NSValue *sceneValue = self.sceneRegistry[sceneId];
        if (!sceneValue) {
            RCTLogWarn(@"[ViroFabricSceneManager] Scene not found for deactivation: %@", sceneId);
            return NO;
        }
        
        __weak id scene = [sceneValue nonretainedObjectValue];
        
        // Update state
        self.sceneStates[sceneId] = @(ViroFabricSceneStatePaused);
        
        // Clear active scene if this is the active one
        if ([sceneId isEqualToString:self.activeSceneId]) {
            self.activeScene = nil;
            self.activeSceneId = nil;
        }
        
        // Notify listener
        if (scene && self.lifecycleListener && [self.lifecycleListener respondsToSelector:@selector(onSceneDeactivated:scene:)]) {
            [self.lifecycleListener onSceneDeactivated:sceneId scene:scene];
        }
        
        RCTLogInfo(@"[ViroFabricSceneManager] Successfully deactivated scene: %@", sceneId);
        return YES;
        
    } @catch (NSException *exception) {
        RCTLogError(@"[ViroFabricSceneManager] Error deactivating scene %@: %@", sceneId, exception.reason);
        return NO;
    }
}

- (BOOL)destroyScene:(NSString *)sceneId {
    RCTLogInfo(@"[ViroFabricSceneManager] Destroying scene: %@", sceneId);
    
    @try {
        NSValue *sceneValue = self.sceneRegistry[sceneId];
        if (!sceneValue) {
            RCTLogWarn(@"[ViroFabricSceneManager] Scene not found for destruction: %@", sceneId);
            return NO;
        }
        
        __weak id scene = [sceneValue nonretainedObjectValue];
        
        // Deactivate if active
        if ([sceneId isEqualToString:self.activeSceneId]) {
            [self deactivateScene:sceneId];
        }
        
        // Clean up scene resources
        if (scene) {
            [self cleanupSceneResources:scene];
        }
        
        // Remove from registries
        [self.sceneRegistry removeObjectForKey:sceneId];
        self.sceneStates[sceneId] = @(ViroFabricSceneStateDestroyed);
        [self.sceneCreationTimes removeObjectForKey:sceneId];
        
        // Notify listener
        if (self.lifecycleListener && [self.lifecycleListener respondsToSelector:@selector(onSceneDestroyed:)]) {
            [self.lifecycleListener onSceneDestroyed:sceneId];
        }
        
        RCTLogInfo(@"[ViroFabricSceneManager] Successfully destroyed scene: %@", sceneId);
        return YES;
        
    } @catch (NSException *exception) {
        RCTLogError(@"[ViroFabricSceneManager] Error destroying scene %@: %@", sceneId, exception.reason);
        return NO;
    }
}

- (id)getActiveScene {
    return self.activeScene;
}

- (NSString *)getActiveSceneId {
    return self.activeSceneId;
}

- (id)getScene:(NSString *)sceneId {
    NSValue *sceneValue = self.sceneRegistry[sceneId];
    if (sceneValue) {
        return [sceneValue nonretainedObjectValue];
    }
    return nil;
}

- (ViroFabricSceneState)getSceneState:(NSString *)sceneId {
    NSNumber *stateNumber = self.sceneStates[sceneId];
    if (stateNumber) {
        return (ViroFabricSceneState)[stateNumber integerValue];
    }
    return ViroFabricSceneStateDestroyed;
}

- (NSArray<NSString *> *)getAllSceneIds {
    return [self.sceneRegistry allKeys];
}

- (void)performMemoryCleanup {
    RCTLogInfo(@"[ViroFabricSceneManager] Performing memory cleanup");
    
    @try {
        // Clean up stale scene references
        NSMutableArray *staleScenesIds = [[NSMutableArray alloc] init];
        for (NSString *sceneId in self.sceneRegistry) {
            NSValue *sceneValue = self.sceneRegistry[sceneId];
            __weak id scene = [sceneValue nonretainedObjectValue];
            if (!scene) {
                [staleScenesIds addObject:sceneId];
            }
        }
        
        for (NSString *sceneId in staleScenesIds) {
            RCTLogInfo(@"[ViroFabricSceneManager] Cleaning up stale scene reference: %@", sceneId);
            [self.sceneRegistry removeObjectForKey:sceneId];
            [self.sceneStates removeObjectForKey:sceneId];
            [self.sceneCreationTimes removeObjectForKey:sceneId];
        }
        
        // Clean up managed nodes
        NSMutableArray *staleNodes = [[NSMutableArray alloc] init];
        for (NSValue *nodeValue in self.managedNodes) {
            __weak id node = [nodeValue nonretainedObjectValue];
            if (!node) {
                [staleNodes addObject:nodeValue];
            }
        }
        [self.managedNodes removeObjectsInArray:staleNodes];
        
        // Notify listener
        if (self.lifecycleListener && [self.lifecycleListener respondsToSelector:@selector(onMemoryWarning)]) {
            [self.lifecycleListener onMemoryWarning];
        }
        
        RCTLogInfo(@"[ViroFabricSceneManager] Memory cleanup completed. Cleaned up %lu scenes and %lu nodes",
                   (unsigned long)staleScenesIds.count, (unsigned long)staleNodes.count);
        
    } @catch (NSException *exception) {
        RCTLogError(@"[ViroFabricSceneManager] Error during memory cleanup: %@", exception.reason);
    }
}

- (void)cleanup {
    RCTLogInfo(@"[ViroFabricSceneManager] Cleaning up all scenes and resources");
    
    @try {
        // Destroy all scenes
        NSArray<NSString *> *sceneIds = [self getAllSceneIds];
        for (NSString *sceneId in sceneIds) {
            [self destroyScene:sceneId];
        }
        
        // Clear all registries
        [self.sceneRegistry removeAllObjects];
        [self.sceneStates removeAllObjects];
        [self.sceneCreationTimes removeAllObjects];
        [self.managedNodes removeAllObjects];
        
        // Clear active scene
        self.activeScene = nil;
        self.activeSceneId = nil;
        
        RCTLogInfo(@"[ViroFabricSceneManager] Scene manager cleanup completed");
        
    } @catch (NSException *exception) {
        RCTLogError(@"[ViroFabricSceneManager] Error during scene manager cleanup: %@", exception.reason);
    }
}

- (NSDictionary *)getMemoryStats {
    NSMutableDictionary *stats = [[NSMutableDictionary alloc] init];
    
    @try {
        // Scene statistics
        stats[@"totalScenes"] = @(self.sceneRegistry.count);
        stats[@"activeScenes"] = @(self.activeScene ? 1 : 0);
        stats[@"managedNodes"] = @(self.managedNodes.count);
        
        // Memory statistics
        struct mach_task_basic_info info;
        mach_msg_type_number_t size = MACH_TASK_BASIC_INFO_COUNT;
        kern_return_t kerr = task_info(mach_task_self(), MACH_TASK_BASIC_INFO, (task_info_t)&info, &size);
        
        if (kerr == KERN_SUCCESS) {
            double usedMemoryMB = info.resident_size / (1024.0 * 1024.0);
            double virtualMemoryMB = info.virtual_size / (1024.0 * 1024.0);
            
            stats[@"usedMemoryMB"] = @(usedMemoryMB);
            stats[@"virtualMemoryMB"] = @(virtualMemoryMB);
        }
        
        // Scene age statistics
        NSTimeInterval currentTime = [[NSDate date] timeIntervalSince1970];
        NSTimeInterval oldestSceneAge = 0;
        for (NSNumber *creationTime in self.sceneCreationTimes.allValues) {
            NSTimeInterval age = currentTime - [creationTime doubleValue];
            if (age > oldestSceneAge) {
                oldestSceneAge = age;
            }
        }
        stats[@"oldestSceneAgeSeconds"] = @(oldestSceneAge);
        
    } @catch (NSException *exception) {
        RCTLogError(@"[ViroFabricSceneManager] Error getting memory stats: %@", exception.reason);
    }
    
    return [stats copy];
}

- (void)registerManagedNode:(id)node {
    if (node) {
        NSValue *nodeValue = [NSValue valueWithNonretainedObject:node];
        [self.managedNodes addObject:nodeValue];
    }
}

#pragma mark - Private Methods

- (void)setupSceneLifecycleCallbacks:(NSString *)sceneId scene:(id)scene {
    // Set up scene loading callbacks if the scene supports them
    if ([scene respondsToSelector:@selector(setOnLoadStart:)]) {
        [scene performSelector:@selector(setOnLoadStart:) withObject:^{
            self.sceneStates[sceneId] = @(ViroFabricSceneStateLoading);
            RCTLogInfo(@"[ViroFabricSceneManager] Scene %@ started loading", sceneId);
        }];
    }
    
    if ([scene respondsToSelector:@selector(setOnLoadEnd:)]) {
        [scene performSelector:@selector(setOnLoadEnd:) withObject:^{
            self.sceneStates[sceneId] = @(ViroFabricSceneStateLoaded);
            RCTLogInfo(@"[ViroFabricSceneManager] Scene %@ finished loading", sceneId);
        }];
    }
    
    if ([scene respondsToSelector:@selector(setOnError:)]) {
        [scene performSelector:@selector(setOnError:) withObject:^(NSString *error) {
            RCTLogError(@"[ViroFabricSceneManager] Scene %@ encountered error: %@", sceneId, error);
        }];
    }
}

- (void)cleanupSceneResources:(id)scene {
    @try {
        // Remove all child nodes if it's a view
        if ([scene respondsToSelector:@selector(removeFromSuperview)]) {
            [scene performSelector:@selector(removeFromSuperview)];
        }
        
        // Remove all subviews if it's a view container
        if ([scene respondsToSelector:@selector(subviews)]) {
            NSArray *subviews = [scene performSelector:@selector(subviews)];
            for (id subview in subviews) {
                if ([subview respondsToSelector:@selector(removeFromSuperview)]) {
                    [subview performSelector:@selector(removeFromSuperview)];
                }
            }
        }
        
        // Clear any animations
        if ([scene respondsToSelector:@selector(layer)]) {
            CALayer *layer = [scene performSelector:@selector(layer)];
            [layer removeAllAnimations];
        }
        
        RCTLogInfo(@"[ViroFabricSceneManager] Scene resources cleaned up successfully");
        
    } @catch (NSException *exception) {
        RCTLogError(@"[ViroFabricSceneManager] Error cleaning up scene resources: %@", exception.reason);
    }
}

- (void)handleMemoryWarning:(NSNotification *)notification {
    RCTLogWarn(@"[ViroFabricSceneManager] Received memory warning, performing cleanup");
    [self performMemoryCleanup];
}

@end
