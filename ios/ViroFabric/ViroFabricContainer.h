//
//  ViroFabricContainer.h
//  ViroReact
//
//  Created for ReactVision.
//  Copyright © 2025 ReactVision. All rights reserved.
//

#import <React/RCTView.h>
#import <React/RCTBridge.h>
#import <React/RCTEventDispatcher.h>
#import <ReactCommon/RuntimeExecutor.h>
#import <jsi/jsi.h>

@interface ViroFabricContainer : RCTView

@property (nonatomic, copy) RCTDirectEventBlock onInitialized;
@property (nonatomic, copy) RCTDirectEventBlock onTrackingUpdated;
@property (nonatomic, copy) RCTDirectEventBlock onCameraTransformUpdate;
@property (nonatomic, copy) RCTDirectEventBlock onSceneStateChanged;
@property (nonatomic, copy) RCTDirectEventBlock onMemoryWarning;

- (instancetype)initWithBridge:(RCTBridge *)bridge;

// Commands
- (void)initialize:(BOOL)debug arEnabled:(BOOL)arEnabled worldAlignment:(NSString *)worldAlignment;
- (void)cleanup;

// Event handling methods
- (void)dispatchEventToJS:(NSString *)callbackId withData:(NSDictionary *)data;
- (void)getCameraPositionAsync:(void (^)(NSArray *cameraOrientation))callback;

// Navigator access
- (id)getActiveNavigator;

// Material management
- (void)createMaterial:(NSString *)materialName withProps:(NSDictionary *)props;
- (void)updateMaterial:(NSString *)materialName withProps:(NSDictionary *)props;

// Animation management
- (void)createAnimation:(NSString *)animationName withProps:(NSDictionary *)props;
- (void)executeAnimation:(NSString *)animationName onNode:(NSString *)nodeId withOptions:(NSDictionary *)options;

// AR configuration
- (void)setARPlaneDetection:(NSDictionary *)config;
- (void)setARImageTargets:(NSDictionary *)targets;

@end

@interface ViroFabricContainer (Utilities)
/**
 * Converts a JSI value to an Objective-C object.
 * This method handles all JSI value types and converts them to their Objective-C equivalents.
 *
 * @param value The JSI value to convert
 * @param runtime The JSI runtime
 * @return The converted Objective-C object
 */
- (id)convertJSIValueToObjC:(const facebook::jsi::Value &)value
                    runtime:(facebook::jsi::Runtime &)runtime;

/**
 * Converts an Objective-C object to a JSI value.
 * This method handles common Objective-C types and converts them to their JSI equivalents.
 *
 * @param value The Objective-C object to convert
 * @param runtime The JSI runtime
 * @return The converted JSI value
 */
- (facebook::jsi::Value)convertObjCToJSIValue:(id)value
                                      runtime:(facebook::jsi::Runtime &)runtime;
@end

@interface ViroFabricContainer (NodeManagement)
- (void)createNode:(NSString *)nodeId
            ofType:(NSString *)nodeType
         withProps:(NSDictionary *)props;

- (void)updateNode:(NSString *)nodeId
         withProps:(NSDictionary *)props;

- (void)deleteNode:(NSString *)nodeId;

- (void)addChild:(NSString *)childId
        toParent:(NSString *)parentId;

- (void)removeChild:(NSString *)childId
        fromParent:(NSString *)parentId;

- (void)registerEventCallback:(NSString *)callbackId
                     forEvent:(NSString *)eventName
                       onNode:(NSString *)nodeId;

- (void)unregisterEventCallback:(NSString *)callbackId
                       forEvent:(NSString *)eventName
                         onNode:(NSString *)nodeId;
@end
