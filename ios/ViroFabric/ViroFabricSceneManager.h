//
//  ViroFabricSceneManager.h
//  ViroReact
//
//  Created for ReactVision.
//  Copyright © 2025 ReactVision. All rights reserved.
//

#import <Foundation/Foundation.h>
#import <React/RCTBridge.h>

@class ViroFabricContainer;
@class VRTScene;
@class VRTARScene;

/**
 * Scene states for lifecycle management
 */
typedef NS_ENUM(NSInteger, ViroFabricSceneState) {
    ViroFabricSceneStateCreated,
    ViroFabricSceneStateLoading,
    ViroFabricSceneStateLoaded,
    ViroFabricSceneStateActive,
    ViroFabricSceneStatePaused,
    ViroFabricSceneStateDestroyed
};

/**
 * Scene lifecycle listener protocol
 */
@protocol ViroFabricSceneLifecycleListener <NSObject>
@optional
- (void)onSceneCreated:(NSString *)sceneId scene:(id)scene;
- (void)onSceneActivated:(NSString *)sceneId scene:(id)scene;
- (void)onSceneDeactivated:(NSString *)sceneId scene:(id)scene;
- (void)onSceneDestroyed:(NSString *)sceneId;
- (void)onMemoryWarning;
@end

/**
 * ViroFabricSceneManager manages scene lifecycle, memory cleanup, and resource management
 * for the Viro Fabric interop layer on iOS.
 */
@interface ViroFabricSceneManager : NSObject

/**
 * Initialize with container and bridge
 */
- (instancetype)initWithContainer:(ViroFabricContainer *)container
                           bridge:(RCTBridge *)bridge;

/**
 * Set the scene lifecycle listener
 */
- (void)setLifecycleListener:(id<ViroFabricSceneLifecycleListener>)listener;

/**
 * Create a new scene with proper lifecycle management
 */
- (id)createScene:(NSString *)sceneId
        sceneType:(NSString *)sceneType
            props:(NSDictionary *)props;

/**
 * Activate a scene (set it as the current scene)
 */
- (BOOL)activateScene:(NSString *)sceneId;

/**
 * Deactivate a scene
 */
- (BOOL)deactivateScene:(NSString *)sceneId;

/**
 * Destroy a scene and clean up its resources
 */
- (BOOL)destroyScene:(NSString *)sceneId;

/**
 * Get the current active scene
 */
- (id)getActiveScene;

/**
 * Get the active scene ID
 */
- (NSString *)getActiveSceneId;

/**
 * Get a scene by ID
 */
- (id)getScene:(NSString *)sceneId;

/**
 * Get the state of a scene
 */
- (ViroFabricSceneState)getSceneState:(NSString *)sceneId;

/**
 * Get all scene IDs
 */
- (NSArray<NSString *> *)getAllSceneIds;

/**
 * Perform memory cleanup
 */
- (void)performMemoryCleanup;

/**
 * Clean up all scenes and resources
 */
- (void)cleanup;

/**
 * Get memory usage statistics
 */
- (NSDictionary *)getMemoryStats;

/**
 * Register a node for memory management
 */
- (void)registerManagedNode:(id)node;

/**
 * Initialize with configuration options
 */
- (void)initializeWithConfig:(NSDictionary *)config;

/**
 * Configure AR plane detection
 */
- (void)configureARPlaneDetection:(NSDictionary *)config;

/**
 * Configure AR image targets
 */
- (void)configureARImageTargets:(NSDictionary *)targets;

/**
 * Project 3D point to 2D screen coordinates
 */
- (void)projectPoint:(NSArray *)point 
             forNode:(NSString *)nodeId 
          completion:(void (^)(NSArray *screenPoint))completion;

/**
 * Unproject 2D screen coordinates to 3D world coordinates
 */
- (void)unprojectPoint:(NSArray *)point 
               forNode:(NSString *)nodeId 
            completion:(void (^)(NSArray *worldPoint))completion;

/**
 * Recenter AR tracking for a given node
 */
- (void)recenterTrackingForNode:(NSString *)nodeId;

@end
