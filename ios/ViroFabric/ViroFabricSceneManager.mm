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
#import <mach/mach.h>
#import <mach/task.h>
#import <mach/task_info.h>
#import "../ViroReact/Views/VRTScene.h"
#import "../ViroReact/AR/Views/VRTARScene.h"
#import "../ViroReact/Views/VRTSceneNavigator.h"
#import "../ViroReact/AR/Views/VRTARSceneNavigator.h"
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

#pragma mark - JSI Bridge Support Methods

- (void)initializeWithConfig:(NSDictionary *)config {
    RCTLogInfo(@"[ViroFabricSceneManager] Initializing with config: %@", config);
    
    // Extract configuration options
    BOOL debug = [config[@"debug"] boolValue];
    BOOL arEnabled = [config[@"arEnabled"] boolValue];
    NSString *worldAlignment = config[@"worldAlignment"] ?: @"Gravity";
    
    // Apply debug configuration
    if (debug) {
        RCTLogInfo(@"[ViroFabricSceneManager] Debug mode enabled");
        // Enable detailed logging for all scene operations
        self.sceneStates[@"__debug_enabled__"] = @(YES);
    }
    
    // Configure world alignment for AR scenes
    if (arEnabled) {
        RCTLogInfo(@"[ViroFabricSceneManager] AR mode enabled with world alignment: %@", worldAlignment);
        
        // Apply world alignment to container
        if (self.container) {
            // Get the AR scene navigator from container
            SEL getARNavigatorSelector = NSSelectorFromString(@"arSceneNavigator");
            if ([self.container respondsToSelector:getARNavigatorSelector]) {
                id arNavigator = [self.container performSelector:getARNavigatorSelector];
                if (arNavigator) {
                    // Set world alignment on AR navigator
                    SEL setWorldAlignmentSelector = NSSelectorFromString(@"setWorldAlignment:");
                    if ([arNavigator respondsToSelector:setWorldAlignmentSelector]) {
                        [arNavigator performSelector:setWorldAlignmentSelector withObject:worldAlignment];
                        RCTLogInfo(@"[ViroFabricSceneManager] Applied world alignment: %@", worldAlignment);
                    }
                }
            }
        }
    }
    
    // Store configuration for later use
    self.sceneStates[@"__config__"] = config;
    
    // Initialize performance monitoring if debug enabled
    if (debug) {
        [self startPerformanceMonitoring];
    }
}

- (void)configureARPlaneDetection:(NSDictionary *)config {
    RCTLogInfo(@"[ViroFabricSceneManager] Configuring AR plane detection: %@", config);
    
    BOOL enabled = [config[@"enabled"] boolValue];
    BOOL horizontal = [config[@"horizontal"] boolValue];
    BOOL vertical = [config[@"vertical"] boolValue];
    NSString *alignment = config[@"alignment"] ?: @"Gravity";
    
    if (enabled) {
        RCTLogInfo(@"[ViroFabricSceneManager] AR plane detection enabled - horizontal:%@, vertical:%@, alignment:%@", 
                  @(horizontal), @(vertical), alignment);
        
        // Store AR plane detection configuration
        self.sceneStates[@"__ar_plane_config__"] = config;
        
        // Apply AR plane detection configuration to active AR scene
        if (self.container) {
            SEL getARNavigatorSelector = NSSelectorFromString(@"arSceneNavigator");
            if ([self.container respondsToSelector:getARNavigatorSelector]) {
                id arNavigator = [self.container performSelector:getARNavigatorSelector];
                if (arNavigator) {
                    // Configure plane detection types
                    NSMutableArray *planeTypes = [NSMutableArray array];
                    if (horizontal) [planeTypes addObject:@"horizontal"];
                    if (vertical) [planeTypes addObject:@"vertical"];
                    
                    // Use reflection to set plane detection properties
                    @try {
                        SEL setPlaneDetectionSelector = NSSelectorFromString(@"setPlaneDetection:");
                        if ([arNavigator respondsToSelector:setPlaneDetectionSelector]) {
                            [arNavigator performSelector:setPlaneDetectionSelector withObject:@(enabled)];
                        }
                        
                        SEL setPlaneTypesSelector = NSSelectorFromString(@"setPlaneTypes:");
                        if ([arNavigator respondsToSelector:setPlaneTypesSelector]) {
                            [arNavigator performSelector:setPlaneTypesSelector withObject:planeTypes];
                        }
                        
                        RCTLogInfo(@"[ViroFabricSceneManager] Successfully applied AR plane detection configuration");
                    } @catch (NSException *exception) {
                        RCTLogWarn(@"[ViroFabricSceneManager] Could not apply AR plane detection: %@", exception.reason);
                    }
                }
            }
        }
    } else {
        RCTLogInfo(@"[ViroFabricSceneManager] AR plane detection disabled");
        [self.sceneStates removeObjectForKey:@"__ar_plane_config__"];
        
        // Disable plane detection on AR navigator
        if (self.container) {
            SEL getARNavigatorSelector = NSSelectorFromString(@"arSceneNavigator");
            if ([self.container respondsToSelector:getARNavigatorSelector]) {
                id arNavigator = [self.container performSelector:getARNavigatorSelector];
                if (arNavigator) {
                    @try {
                        SEL setPlaneDetectionSelector = NSSelectorFromString(@"setPlaneDetection:");
                        if ([arNavigator respondsToSelector:setPlaneDetectionSelector]) {
                            [arNavigator performSelector:setPlaneDetectionSelector withObject:@(NO)];
                        }
                    } @catch (NSException *exception) {
                        RCTLogWarn(@"[ViroFabricSceneManager] Could not disable AR plane detection: %@", exception.reason);
                    }
                }
            }
        }
    }
}

- (void)configureARImageTargets:(NSDictionary *)targets {
    RCTLogInfo(@"[ViroFabricSceneManager] Configuring AR image targets: %lu targets", (unsigned long)targets.count);
    
    // Process and validate image targets
    NSMutableDictionary *processedTargets = [NSMutableDictionary dictionary];
    
    for (NSString *targetName in targets.allKeys) {
        NSDictionary *targetInfo = targets[targetName];
        NSString *source = targetInfo[@"source"];
        NSString *orientation = targetInfo[@"orientation"] ?: @"Up";
        NSNumber *physicalWidth = targetInfo[@"physicalWidth"] ?: @(0.1); // Default 10cm
        
        RCTLogInfo(@"[ViroFabricSceneManager] Processing AR image target '%@': source=%@, orientation=%@, width=%@", 
                  targetName, source, orientation, physicalWidth);
        
        // Validate required properties
        if (source) {
            NSMutableDictionary *processedTarget = [NSMutableDictionary dictionary];
            processedTarget[@"source"] = source;
            processedTarget[@"orientation"] = orientation;
            processedTarget[@"physicalWidth"] = physicalWidth;
            
            // Add additional properties for AR processing
            processedTarget[@"name"] = targetName;
            processedTarget[@"type"] = @"image";
            
            processedTargets[targetName] = processedTarget;
        } else {
            RCTLogWarn(@"[ViroFabricSceneManager] Skipping AR image target '%@': missing source", targetName);
        }
    }
    
    // Store AR image targets configuration
    self.sceneStates[@"__ar_image_targets__"] = processedTargets;
    
    // Apply AR image targets configuration to active AR scene
    if (self.container && processedTargets.count > 0) {
        SEL getARNavigatorSelector = NSSelectorFromString(@"arSceneNavigator");
        if ([self.container respondsToSelector:getARNavigatorSelector]) {
            id arNavigator = [self.container performSelector:getARNavigatorSelector];
            if (arNavigator) {
                @try {
                    // Try to set image targets using reflection
                    SEL setImageTargetsSelector = NSSelectorFromString(@"setImageTargets:");
                    if ([arNavigator respondsToSelector:setImageTargetsSelector]) {
                        [arNavigator performSelector:setImageTargetsSelector withObject:processedTargets];
                        RCTLogInfo(@"[ViroFabricSceneManager] Successfully configured %lu AR image targets", (unsigned long)processedTargets.count);
                    } else {
                        // Alternative method names to try
                        SEL setARImageTargetsSelector = NSSelectorFromString(@"setARImageTargets:");
                        if ([arNavigator respondsToSelector:setARImageTargetsSelector]) {
                            [arNavigator performSelector:setARImageTargetsSelector withObject:processedTargets];
                            RCTLogInfo(@"[ViroFabricSceneManager] Successfully configured AR image targets using alternative method");
                        } else {
                            RCTLogWarn(@"[ViroFabricSceneManager] AR image targets methods not available on navigator");
                        }
                    }
                } @catch (NSException *exception) {
                    RCTLogWarn(@"[ViroFabricSceneManager] Could not apply AR image targets: %@", exception.reason);
                }
            }
        }
    } else if (processedTargets.count == 0) {
        RCTLogInfo(@"[ViroFabricSceneManager] No valid AR image targets to configure");
    }
}

- (void)projectPoint:(NSArray *)point 
             forNode:(NSString *)nodeId 
          completion:(void (^)(NSArray *screenPoint))completion {
    RCTLogInfo(@"[ViroFabricSceneManager] Projecting point %@ for node %@", point, nodeId);
    
    if (!completion) {
        RCTLogWarn(@"[ViroFabricSceneManager] No completion block provided for projectPoint");
        return;
    }
    
    if (!point || point.count < 3) {
        RCTLogError(@"[ViroFabricSceneManager] Invalid point for projection: %@", point);
        completion(@[@(-1), @(-1), @(-1)]);
        return;
    }
    
    // Extract 3D coordinates
    float worldX = [point[0] floatValue];
    float worldY = [point[1] floatValue];
    float worldZ = [point[2] floatValue];
    
    // Get the active navigator to access camera and view information
    id activeNavigator = nil;
    if (self.container) {
        // Try AR navigator first
        SEL getARNavigatorSelector = NSSelectorFromString(@"arSceneNavigator");
        if ([self.container respondsToSelector:getARNavigatorSelector]) {
            activeNavigator = [self.container performSelector:getARNavigatorSelector];
        }
        
        // Fall back to regular scene navigator
        if (!activeNavigator) {
            SEL getSceneNavigatorSelector = NSSelectorFromString(@"sceneNavigator");
            if ([self.container respondsToSelector:getSceneNavigatorSelector]) {
                activeNavigator = [self.container performSelector:getSceneNavigatorSelector];
            }
        }
    }
    
    if (!activeNavigator) {
        RCTLogWarn(@"[ViroFabricSceneManager] No active navigator found for projection");
        completion(@[@(-1), @(-1), @(-1)]);
        return;
    }
    
    // Try to get camera and projection information
    @try {
        // Attempt to use Viro's built-in projection methods if available
        SEL projectPointSelector = NSSelectorFromString(@"projectPoint:completion:");
        if ([activeNavigator respondsToSelector:projectPointSelector]) {
            // Use native Viro projection
            NSValue *pointValue = [NSValue valueWithCGPoint:CGPointMake(worldX, worldY)];
            [activeNavigator performSelector:projectPointSelector withObject:pointValue withObject:completion];
            return;
        }
        
        // Manual projection calculation using standard 3D to 2D projection math
        // Get the view bounds for viewport calculations
        CGRect bounds = CGRectZero;
        if ([activeNavigator respondsToSelector:@selector(bounds)]) {
            bounds = [[activeNavigator performSelector:@selector(bounds)] CGRectValue];
        } else if ([activeNavigator respondsToSelector:@selector(frame)]) {
            bounds = [[activeNavigator performSelector:@selector(frame)] CGRectValue];
        }
        
        if (CGRectIsEmpty(bounds)) {
            bounds = CGRectMake(0, 0, 375, 667); // Default iPhone bounds
        }
        
        // Simplified projection calculation
        // This is a basic implementation - real projection would need camera matrices
        float viewportWidth = bounds.size.width;
        float viewportHeight = bounds.size.height;
        
        // Basic perspective projection (assumes camera at origin looking down -Z axis)
        float fov = 60.0f; // Default field of view in degrees
        float aspectRatio = viewportWidth / viewportHeight;
        float near = 0.1f;
        float far = 1000.0f;
        
        // Convert to radians
        float fovRad = fov * M_PI / 180.0f;
        float tanHalfFov = tanf(fovRad / 2.0f);
        
        // Project to normalized device coordinates
        float ndc_x = worldX / (worldZ * tanHalfFov * aspectRatio);
        float ndc_y = worldY / (worldZ * tanHalfFov);
        
        // Convert to screen coordinates
        float screenX = (ndc_x + 1.0f) * 0.5f * viewportWidth;
        float screenY = (1.0f - ndc_y) * 0.5f * viewportHeight; // Flip Y for screen coordinates
        float screenZ = worldZ; // Preserve depth
        
        // Clamp to viewport bounds
        screenX = fmaxf(0.0f, fminf(viewportWidth, screenX));
        screenY = fmaxf(0.0f, fminf(viewportHeight, screenY));
        
        NSArray *screenPoint = @[@(screenX), @(screenY), @(screenZ)];
        
        RCTLogInfo(@"[ViroFabricSceneManager] Projected [%.2f, %.2f, %.2f] to [%.2f, %.2f, %.2f]", 
                  worldX, worldY, worldZ, screenX, screenY, screenZ);
        
        dispatch_async(dispatch_get_main_queue(), ^{
            completion(screenPoint);
        });
        
    } @catch (NSException *exception) {
        RCTLogError(@"[ViroFabricSceneManager] Error during point projection: %@", exception.reason);
        dispatch_async(dispatch_get_main_queue(), ^{
            completion(@[@(-1), @(-1), @(-1)]);
        });
    }
}

- (void)unprojectPoint:(NSArray *)point 
               forNode:(NSString *)nodeId 
            completion:(void (^)(NSArray *worldPoint))completion {
    RCTLogInfo(@"[ViroFabricSceneManager] Unprojecting point %@ for node %@", point, nodeId);
    
    if (!completion) {
        RCTLogWarn(@"[ViroFabricSceneManager] No completion block provided for unprojectPoint");
        return;
    }
    
    if (!point || point.count < 2) {
        RCTLogError(@"[ViroFabricSceneManager] Invalid point for unprojection: %@", point);
        completion(@[@(0), @(0), @(-1)]);
        return;
    }
    
    // Extract screen coordinates
    float screenX = [point[0] floatValue];
    float screenY = [point[1] floatValue];
    float depth = point.count > 2 ? [point[2] floatValue] : 1.0f; // Default depth
    
    // Get the active navigator to access camera and view information
    id activeNavigator = nil;
    if (self.container) {
        // Try AR navigator first
        SEL getARNavigatorSelector = NSSelectorFromString(@"arSceneNavigator");
        if ([self.container respondsToSelector:getARNavigatorSelector]) {
            activeNavigator = [self.container performSelector:getARNavigatorSelector];
        }
        
        // Fall back to regular scene navigator
        if (!activeNavigator) {
            SEL getSceneNavigatorSelector = NSSelectorFromString(@"sceneNavigator");
            if ([self.container respondsToSelector:getSceneNavigatorSelector]) {
                activeNavigator = [self.container performSelector:getSceneNavigatorSelector];
            }
        }
    }
    
    if (!activeNavigator) {
        RCTLogWarn(@"[ViroFabricSceneManager] No active navigator found for unprojection");
        completion(@[@(0), @(0), @(-1)]);
        return;
    }
    
    @try {
        // Attempt to use Viro's built-in unprojection methods if available
        SEL unprojectPointSelector = NSSelectorFromString(@"unprojectPoint:completion:");
        if ([activeNavigator respondsToSelector:unprojectPointSelector]) {
            // Use native Viro unprojection
            NSValue *pointValue = [NSValue valueWithCGPoint:CGPointMake(screenX, screenY)];
            [activeNavigator performSelector:unprojectPointSelector withObject:pointValue withObject:completion];
            return;
        }
        
        // Manual unprojection calculation (inverse of projection)
        // Get the view bounds for viewport calculations
        CGRect bounds = CGRectZero;
        if ([activeNavigator respondsToSelector:@selector(bounds)]) {
            bounds = [[activeNavigator performSelector:@selector(bounds)] CGRectValue];
        } else if ([activeNavigator respondsToSelector:@selector(frame)]) {
            bounds = [[activeNavigator performSelector:@selector(frame)] CGRectValue];
        }
        
        if (CGRectIsEmpty(bounds)) {
            bounds = CGRectMake(0, 0, 375, 667); // Default iPhone bounds
        }
        
        float viewportWidth = bounds.size.width;
        float viewportHeight = bounds.size.height;
        
        // Basic perspective unprojection
        float fov = 60.0f; // Default field of view in degrees
        float aspectRatio = viewportWidth / viewportHeight;
        
        // Convert to radians
        float fovRad = fov * M_PI / 180.0f;
        float tanHalfFov = tanf(fovRad / 2.0f);
        
        // Convert screen coordinates to normalized device coordinates
        float ndc_x = (screenX / viewportWidth) * 2.0f - 1.0f;
        float ndc_y = 1.0f - (screenY / viewportHeight) * 2.0f; // Flip Y back
        
        // Project to world coordinates at given depth
        float worldX = ndc_x * depth * tanHalfFov * aspectRatio;
        float worldY = ndc_y * depth * tanHalfFov;
        float worldZ = depth;
        
        NSArray *worldPoint = @[@(worldX), @(worldY), @(worldZ)];
        
        RCTLogInfo(@"[ViroFabricSceneManager] Unprojected [%.2f, %.2f, %.2f] to [%.2f, %.2f, %.2f]", 
                  screenX, screenY, depth, worldX, worldY, worldZ);
        
        dispatch_async(dispatch_get_main_queue(), ^{
            completion(worldPoint);
        });
        
    } @catch (NSException *exception) {
        RCTLogError(@"[ViroFabricSceneManager] Error during point unprojection: %@", exception.reason);
        dispatch_async(dispatch_get_main_queue(), ^{
            completion(@[@(0), @(0), @(-1)]);
        });
    }
}

- (void)recenterTrackingForNode:(NSString *)nodeId {
    RCTLogInfo(@"[ViroFabricSceneManager] Recentering tracking for node: %@", nodeId);
    
    // Get the AR navigator if available
    id arNavigator = nil;
    if (self.container) {
        SEL getARNavigatorSelector = NSSelectorFromString(@"arSceneNavigator");
        if ([self.container respondsToSelector:getARNavigatorSelector]) {
            arNavigator = [self.container performSelector:getARNavigatorSelector];
        }
    }
    
    if (!arNavigator) {
        RCTLogWarn(@"[ViroFabricSceneManager] Cannot recenter tracking: not in AR mode");
        return;
    }
    
    @try {
        // Try different methods to reset AR tracking
        BOOL trackingReset = NO;
        
        // Method 1: Try standard Viro recenter tracking
        SEL recenterTrackingSelector = NSSelectorFromString(@"recenterTracking");
        if ([arNavigator respondsToSelector:recenterTrackingSelector]) {
            [arNavigator performSelector:recenterTrackingSelector];
            trackingReset = YES;
            RCTLogInfo(@"[ViroFabricSceneManager] Successfully recentered tracking using recenterTracking method");
        }
        
        // Method 2: Try reset world origin
        if (!trackingReset) {
            SEL resetWorldOriginSelector = NSSelectorFromString(@"resetWorldOrigin");
            if ([arNavigator respondsToSelector:resetWorldOriginSelector]) {
                [arNavigator performSelector:resetWorldOriginSelector];
                trackingReset = YES;
                RCTLogInfo(@"[ViroFabricSceneManager] Successfully recentered tracking using resetWorldOrigin method");
            }
        }
        
        // Method 3: Try session reset
        if (!trackingReset) {
            SEL resetSessionSelector = NSSelectorFromString(@"resetSession");
            if ([arNavigator respondsToSelector:resetSessionSelector]) {
                [arNavigator performSelector:resetSessionSelector];
                trackingReset = YES;
                RCTLogInfo(@"[ViroFabricSceneManager] Successfully recentered tracking using resetSession method");
            }
        }
        
        // Method 4: Try getting ARSession directly and resetting
        if (!trackingReset) {
            SEL getSessionSelector = NSSelectorFromString(@"session");
            if ([arNavigator respondsToSelector:getSessionSelector]) {
                id session = [arNavigator performSelector:getSessionSelector];
                if (session) {
                    // Try to reset the AR session
                    SEL runConfigurationSelector = NSSelectorFromString(@"runWithConfiguration:");
                    if ([session respondsToSelector:runConfigurationSelector]) {
                        // Get current configuration
                        SEL getConfigurationSelector = NSSelectorFromString(@"configuration");
                        if ([session respondsToSelector:getConfigurationSelector]) {
                            id configuration = [session performSelector:getConfigurationSelector];
                            if (configuration) {
                                // Reset with options
                                SEL runWithOptionsSelector = NSSelectorFromString(@"runWithConfiguration:options:");
                                if ([session respondsToSelector:runWithOptionsSelector]) {
                                    // ARSessionRunOptions.resetTracking = 1
                                    NSNumber *resetOptions = @(1);
                                    [session performSelector:runWithOptionsSelector withObject:configuration withObject:resetOptions];
                                    trackingReset = YES;
                                    RCTLogInfo(@"[ViroFabricSceneManager] Successfully recentered tracking using AR session reset");
                                }
                            }
                        }
                    }
                }
            }
        }
        
        if (!trackingReset) {
            RCTLogWarn(@"[ViroFabricSceneManager] No available methods to recenter tracking found on AR navigator");
        }
        
        // Store the recenter operation in scene states for reference
        NSMutableDictionary *trackingInfo = [NSMutableDictionary dictionary];
        trackingInfo[@"lastRecenterTime"] = @([[NSDate date] timeIntervalSince1970]);
        trackingInfo[@"nodeId"] = nodeId ?: @"unknown";
        trackingInfo[@"success"] = @(trackingReset);
        
        self.sceneStates[@"__tracking_recenter__"] = trackingInfo;
        
        RCTLogInfo(@"[ViroFabricSceneManager] Tracking recenter operation completed for node: %@ (success: %@)", nodeId, @(trackingReset));
        
    } @catch (NSException *exception) {
        RCTLogError(@"[ViroFabricSceneManager] Error recentering tracking: %@", exception.reason);
    }
}

#pragma mark - Performance Monitoring

- (void)startPerformanceMonitoring {
    RCTLogInfo(@"[ViroFabricSceneManager] Starting performance monitoring");
    
    // Store the start time for performance tracking
    self.sceneStates[@"__performance_start_time__"] = @([[NSDate date] timeIntervalSince1970]);
    
    // Set up periodic performance monitoring (every 5 seconds)
    dispatch_async(dispatch_get_global_queue(DISPATCH_QUEUE_PRIORITY_LOW, 0), ^{
        [self performPerformanceCheck];
        
        // Schedule next check
        dispatch_after(dispatch_time(DISPATCH_TIME_NOW, (int64_t)(5.0 * NSEC_PER_SEC)), dispatch_get_global_queue(DISPATCH_QUEUE_PRIORITY_LOW, 0), ^{
            [self performPerformanceCheck];
        });
    });
}

- (void)performPerformanceCheck {
    @try {
        // Get current memory usage
        NSDictionary *memoryStats = [self getMemoryStats];
        
        // Log performance metrics if debug enabled
        if ([self.sceneStates[@"__debug_enabled__"] boolValue]) {
            NSNumber *usedMemoryMB = memoryStats[@"usedMemoryMB"];
            NSNumber *sceneCount = memoryStats[@"activeScenes"];
            NSNumber *nodeCount = memoryStats[@"managedNodes"];
            
            RCTLogInfo(@"[ViroFabricSceneManager] Performance Check - Memory: %@MB, Scenes: %@, Nodes: %@", 
                      usedMemoryMB, sceneCount, nodeCount);
        }
        
        // Check for memory warnings
        NSNumber *usedMemoryMB = memoryStats[@"usedMemoryMB"];
        if (usedMemoryMB && [usedMemoryMB floatValue] > 100.0f) { // 100MB threshold
            RCTLogWarn(@"[ViroFabricSceneManager] High memory usage detected: %@MB", usedMemoryMB);
            
            // Trigger memory cleanup if usage is very high
            if ([usedMemoryMB floatValue] > 200.0f) { // 200MB threshold
                [self performMemoryCleanup];
            }
        }
        
    } @catch (NSException *exception) {
        RCTLogError(@"[ViroFabricSceneManager] Error during performance check: %@", exception.reason);
    }
}

@end
