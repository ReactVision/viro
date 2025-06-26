//
//  ViroFabricContainer.mm
//  ViroReact
//
//  Created for ReactVision.
//  Copyright © 2025 ReactVision. All rights reserved.
//

#import "ViroFabricContainer.h"
#import "ViroFabricManager.h"
#import "ViroFabricEventDelegate.h"
#import "ViroFabricEvents.h"
#import "ViroFabricSceneManager.h"
#import "ViroFabricJSI.h"
#import <React/RCTLog.h>
#import <React/RCTUIManager.h>
#import <React/RCTUtils.h>
#import <React/RCTBridge+Private.h>
#import <ReactCommon/RCTTurboModule.h>
#import <ReactCommon/RCTTurboModuleManager.h>
#import <ReactCommon/RuntimeExecutor.h>
#import <jsi/jsi.h>

// Import existing Viro headers
#import "../ViroReact/Views/VRTSceneNavigator.h"
#import "../ViroReact/AR/Views/VRTARSceneNavigator.h"

// Forward declare VRONode to avoid circular dependencies
namespace VRO {
    class VRONode;
}
typedef std::shared_ptr<VRO::VRONode> VRONode;

using namespace facebook::jsi;

@interface ViroFabricContainer () {
    // Reference to the existing Viro navigator
    VRTSceneNavigator *_sceneNavigator;
    VRTARSceneNavigator *_arSceneNavigator;
    
    // Node registry
    NSMutableDictionary<NSString *, id> *_nodeRegistry;
    
    // Event callback registry
    NSMutableDictionary<NSString *, NSString *> *_eventCallbackRegistry;
    
    // Event delegate for handling Viro events
    ViroFabricEventDelegate *_eventDelegate;
    
    // Scene manager for lifecycle and memory management
    ViroFabricSceneManager *_sceneManager;
    
    // JSI bridge for enhanced performance
    ViroFabricJSI *_jsiBridge;
    
    // Flag to track if we're using AR
    BOOL _isAR;
    
    // Bridge reference
    __weak RCTBridge *_bridge;
    
    // Runtime executor for JSI
    facebook::react::RuntimeExecutor _runtimeExecutor;
}

/**
 * Get camera position asynchronously for AR hit testing.
 * This method is called by ViroFabricEventDelegate.
 */
- (void)getCameraPositionAsync:(void (^)(NSArray *cameraOrientation))callback {
    if (_arSceneNavigator) {
        // Use the existing VRTARSceneNavigator API to get camera position
        if ([_arSceneNavigator respondsToSelector:@selector(getCameraPositionAsync:)]) {
            [_arSceneNavigator performSelector:@selector(getCameraPositionAsync:) withObject:callback];
        } else {
            // Fallback with default values
            callback(@[@0, @0, @0, @0, @0, @0, @0, @0, @1, @0, @1, @0]);
        }
    } else if (_sceneNavigator) {
        // For non-AR scenes, we can still get camera position if available
        if ([_sceneNavigator respondsToSelector:@selector(getCameraPositionAsync:)]) {
            [_sceneNavigator performSelector:@selector(getCameraPositionAsync:) withObject:callback];
        } else {
            // Fallback with default values
            callback(@[@0, @0, @0, @0, @0, @0, @0, @0, @1, @0, @1, @0]);
        }
    } else {
        // If no navigator is available, call the callback with default values
        callback(@[@0, @0, @0, @0, @0, @0, @0, @0, @1, @0, @1, @0]);
    }
}

/**
 * Dispatch an event to JavaScript using the event delegate.
 * This method is called by ViroFabricEventDelegate.
 */

#pragma mark - ViroFabricSceneLifecycleListener

- (void)onSceneCreated:(NSString *)sceneId scene:(id)scene {
    RCTLogInfo(@"[ViroFabricContainer] Scene lifecycle: Scene created - %@", sceneId);
    
    // Register scene for memory management
    if (_eventDelegate && scene) {
        [_eventDelegate registerManagedNode:scene];
    }
    
    // Send event to JavaScript
    if (self.onSceneStateChanged) {
        self.onSceneStateChanged(@{
            @"sceneId": sceneId,
            @"state": @"created"
        });
    }
}

- (void)onSceneActivated:(NSString *)sceneId scene:(id)scene {
    RCTLogInfo(@"[ViroFabricContainer] Scene lifecycle: Scene activated - %@", sceneId);
    
    // Send event to JavaScript
    if (self.onSceneStateChanged) {
        self.onSceneStateChanged(@{
            @"sceneId": sceneId,
            @"state": @"active"
        });
    }
}

- (void)onSceneDeactivated:(NSString *)sceneId scene:(id)scene {
    RCTLogInfo(@"[ViroFabricContainer] Scene lifecycle: Scene deactivated - %@", sceneId);
    
    // Send event to JavaScript
    if (self.onSceneStateChanged) {
        self.onSceneStateChanged(@{
            @"sceneId": sceneId,
            @"state": @"paused"
        });
    }
}

- (void)onSceneDestroyed:(NSString *)sceneId {
    RCTLogInfo(@"[ViroFabricContainer] Scene lifecycle: Scene destroyed - %@", sceneId);
    
    // Send event to JavaScript
    if (self.onSceneStateChanged) {
        self.onSceneStateChanged(@{
            @"sceneId": sceneId,
            @"state": @"destroyed"
        });
    }
}

- (void)onMemoryWarning {
    RCTLogWarn(@"[ViroFabricContainer] Scene lifecycle: Memory warning received");
    
    // Send memory warning to JavaScript
    if (self.onMemoryWarning && _sceneManager) {
        NSDictionary *memoryStats = [_sceneManager getMemoryStats];
        self.onMemoryWarning(@{
            @"memoryStats": memoryStats
        });
    }
}

@end

// Forward declaration of the runtime bridge class
@interface ViroRuntimeBridge : NSObject
+ (void)installIntoRuntime:(facebook::jsi::Runtime &)runtime withContainer:(ViroFabricContainer *)container;
@end

// Forward declaration of the host object class
class ViroHostObject : public facebook::jsi::HostObject {
private:
    __weak ViroFabricContainer *_container;
    
public:
    ViroHostObject(ViroFabricContainer *container) : _container(container) {}
    
    facebook::jsi::Value get(facebook::jsi::Runtime &runtime, const facebook::jsi::PropNameID &name) override;
};

@implementation ViroFabricContainer <ViroFabricSceneLifecycleListener>

- (instancetype)initWithBridge:(RCTBridge *)bridge {
    if (self = [super init]) {
        _bridge = bridge;
        _nodeRegistry = [NSMutableDictionary new];
        _eventCallbackRegistry = [NSMutableDictionary new];
        _isAR = NO;
        
        // Initialize event delegate (handle nil bridge gracefully)
        _eventDelegate = [[ViroFabricEventDelegate alloc] initWithContainer:self
                                                                      bridge:bridge
                                                                 containerId:@(self.tag)];
        
        // Initialize scene manager (handle nil bridge gracefully)
        _sceneManager = [[ViroFabricSceneManager alloc] initWithContainer:self bridge:bridge];
        [_sceneManager setLifecycleListener:self];
        
        // Initialize JSI bridge (handle nil bridge gracefully)
        _jsiBridge = [[ViroFabricJSI alloc] initWithBridge:bridge];
        [_jsiBridge setSceneManager:_sceneManager];
        [_jsiBridge setFabricManager:[ViroFabricManager sharedInstance]];
        
        // Set up the runtime when the bridge is ready (only if bridge exists)
        if (bridge) {
            [[NSNotificationCenter defaultCenter] addObserver:self
                                                     selector:@selector(bridgeDidFinishLaunch:)
                                                         name:RCTJavaScriptDidLoadNotification
                                                       object:bridge];
        } else {
            // In Fabric mode without bridge, we'll use event emitter approach
            RCTLogInfo(@"ViroFabricContainer initialized without bridge - using Fabric event emitter approach");
        }
    }
    return self;
}

- (void)bridgeDidFinishLaunch:(NSNotification *)notification {
    // Get the bridge from the notification
    RCTBridge *bridge = notification.object;
    if (!bridge || ![bridge isKindOfClass:[RCTBridge class]]) {
        return;
    }
    
    // Get the CxxBridge for React Native 0.76.9+
    RCTCxxBridge *cxxBridge = (RCTCxxBridge *)bridge;
    if (!cxxBridge || ![cxxBridge isKindOfClass:[RCTCxxBridge class]]) {
        RCTLog(@"[warning] Could not get RCTCxxBridge. Some functionality may be limited.");
        return;
    }
    
    // Install JSI bindings for direct JavaScript communication
    if (_jsiBridge) {
        // Get the JSI runtime from the bridge
        RCTBridge *internalBridge = [cxxBridge valueForKey:@"_parentBridge"];
        if (!internalBridge) {
            internalBridge = cxxBridge;
        }
        
        // Try to get runtime executor
        if ([internalBridge respondsToSelector:@selector(jsCallInvoker)]) {
            auto callInvoker = [internalBridge performSelector:@selector(jsCallInvoker)];
            if (callInvoker) {
                // Install JSI functions on the next tick
                dispatch_async(dispatch_get_main_queue(), ^{
                    [self installJSIFunctionsWithRuntime];
                });
            }
        }
    }
    
    RCTLogInfo(@"JSI bindings scheduled for installation");
}

- (void)installJSIFunctionsWithRuntime {
    @try {
        // In React Native 0.76+, we need to use a different approach to get the JSI runtime
        // Since direct JSI access is more restricted, we'll rely on TurboModules for most functionality
        
        if (_jsiBridge && _bridge) {
            // Get the runtime from the bridge using private APIs (this is for compatibility)
            RCTCxxBridge *cxxBridge = (RCTCxxBridge *)_bridge;
            if ([cxxBridge respondsToSelector:@selector(runtime)]) {
                // Try to get the runtime
                void *runtimePtr = [cxxBridge performSelector:@selector(runtime)];
                if (runtimePtr) {
                    facebook::jsi::Runtime *runtime = static_cast<facebook::jsi::Runtime *>(runtimePtr);
                    if (runtime) {
                        [_jsiBridge installJSIFunctions:*runtime];
                        RCTLogInfo(@"[ViroFabricContainer] JSI functions installed successfully");
                        return;
                    }
                }
            }
        }
        
        RCTLogWarn(@"[ViroFabricContainer] Could not install JSI functions - falling back to TurboModule approach");
        
    } @catch (NSException *exception) {
        RCTLogWarn(@"[ViroFabricContainer] JSI installation failed: %@ - using TurboModule fallback", exception.reason);
    }
}

- (void)layoutSubviews {
    [super layoutSubviews];
    
    // Update the frame of the navigator
    if (_sceneNavigator) {
        _sceneNavigator.frame = self.bounds;
    }
    if (_arSceneNavigator) {
        _arSceneNavigator.frame = self.bounds;
    }
}

#pragma mark - Commands

- (void)initialize:(BOOL)debug arEnabled:(BOOL)arEnabled worldAlignment:(NSString *)worldAlignment {
    // Clean up any existing navigators
    [self cleanup];
    
    // Create the appropriate navigator based on the mode
    if (arEnabled) {
        _isAR = YES;
        _arSceneNavigator = [[VRTARSceneNavigator alloc] initWithFrame:self.bounds];
        [_arSceneNavigator setAutoresizingMask:UIViewAutoresizingFlexibleWidth | UIViewAutoresizingFlexibleHeight];
        [self addSubview:_arSceneNavigator];
        
        // Set world alignment if specified
        if ([worldAlignment isEqualToString:@"GravityAndHeading"]) {
            _arSceneNavigator.worldAlignment = @"GravityAndHeading";
        } else if ([worldAlignment isEqualToString:@"Camera"]) {
            _arSceneNavigator.worldAlignment = @"Camera";
        } else {
            _arSceneNavigator.worldAlignment = @"Gravity";
        }
    } else {
        _sceneNavigator = [[VRTSceneNavigator alloc] initWithFrame:self.bounds];
        [_sceneNavigator setAutoresizingMask:UIViewAutoresizingFlexibleWidth | UIViewAutoresizingFlexibleHeight];
        [self addSubview:_sceneNavigator];
    }
    
    // Notify JS that initialization is complete
    if (self.onInitialized) {
        self.onInitialized(@{@"success": @YES});
    }
}

- (void)cleanup {
    // Remove and release any existing navigators
    if (_sceneNavigator) {
        [_sceneNavigator removeFromSuperview];
        _sceneNavigator = nil;
    }
    if (_arSceneNavigator) {
        [_arSceneNavigator removeFromSuperview];
        _arSceneNavigator = nil;
    }
    
    // Clear node registry
    [_nodeRegistry removeAllObjects];
    
    // Clear event callback registry
    [_eventCallbackRegistry removeAllObjects];
    
    // Clean up scene manager
    if (_sceneManager) {
        [_sceneManager cleanup];
        _sceneManager = nil;
    }
    
    // Clean up event delegate
    if (_eventDelegate) {
        [_eventDelegate dispose];
        _eventDelegate = nil;
    }
    
    // Reset flags
    _isAR = NO;
}

#pragma mark - JSI Bindings


// This method is no longer used directly - JSI bindings are installed through ViroRuntimeBridge
- (void)installJSIBindings {
    RCTLogInfo(@"JSI bindings installation is now handled by ViroRuntimeBridge");
}

@end

// Implementation of the runtime bridge
@implementation ViroRuntimeBridge

+ (void)installIntoRuntime:(facebook::jsi::Runtime &)runtime withContainer:(ViroFabricContainer *)container {
    if (!container) {
        RCTLogError(@"Container not available for JSI installation");
        return;
    }
    
    // Create a host object for better memory management and organization
    auto hostObject = std::make_shared<ViroHostObject>(container);
    auto nativeViro = facebook::jsi::Object::createFromHostObject(runtime, std::move(hostObject));
    
    // Attach the NativeViro object to the global object
    runtime.global().setProperty(runtime, "NativeViro", std::move(nativeViro));
}

@end

// Implementation of ViroHostObject
facebook::jsi::Value ViroHostObject::get(facebook::jsi::Runtime &runtime, const facebook::jsi::PropNameID &name) {
    auto nameStr = name.utf8(runtime);
    
    // Node management functions
    if (nameStr == "createViroNode") {
        return facebook::jsi::Function::createFromHostFunction(
            runtime,
            name,
            3,  // nodeId, nodeType, props
            [weakContainer = _container](facebook::jsi::Runtime& rt, const facebook::jsi::Value& thisValue, const facebook::jsi::Value* args, size_t count) -> facebook::jsi::Value {
                __strong ViroFabricContainer *container = weakContainer;
                if (!container) return facebook::jsi::Value::undefined();
                
                if (count < 3) {
                    throw facebook::jsi::JSError(rt, "createViroNode requires 3 arguments");
                }
                
                NSString *nodeId = [NSString stringWithUTF8String:args[0].getString(rt).utf8(rt).c_str()];
                NSString *nodeType = [NSString stringWithUTF8String:args[1].getString(rt).utf8(rt).c_str()];
                
                // Convert props from JSI to NSDictionary
                id props = [container convertJSIValueToObjC:args[2] runtime:rt];
                
                // Create the node based on type
                [container createNode:nodeId ofType:nodeType withProps:props];
                
                return facebook::jsi::Value::undefined();
            }
        );
    }
    else if (nameStr == "updateViroNode") {
        return facebook::jsi::Function::createFromHostFunction(
            runtime,
            name,
            2,  // nodeId, props
            [weakContainer = _container](facebook::jsi::Runtime& rt, const facebook::jsi::Value& thisValue, const facebook::jsi::Value* args, size_t count) -> facebook::jsi::Value {
                __strong ViroFabricContainer *container = weakContainer;
                if (!container) return facebook::jsi::Value::undefined();
                
                if (count < 2) {
                    throw facebook::jsi::JSError(rt, "updateViroNode requires 2 arguments");
                }
                
                NSString *nodeId = [NSString stringWithUTF8String:args[0].getString(rt).utf8(rt).c_str()];
                
                // Convert props from JSI to NSDictionary
                id props = [container convertJSIValueToObjC:args[1] runtime:rt];
                
                // Update the node
                [container updateNode:nodeId withProps:props];
                
                return facebook::jsi::Value::undefined();
            }
        );
    }
    else if (nameStr == "deleteViroNode") {
        return facebook::jsi::Function::createFromHostFunction(
            runtime,
            name,
            1,  // nodeId
            [weakContainer = _container](facebook::jsi::Runtime& rt, const facebook::jsi::Value& thisValue, const facebook::jsi::Value* args, size_t count) -> facebook::jsi::Value {
                __strong ViroFabricContainer *container = weakContainer;
                if (!container) return facebook::jsi::Value::undefined();
                
                if (count < 1) {
                    throw facebook::jsi::JSError(rt, "deleteViroNode requires 1 argument");
                }
                
                NSString *nodeId = [NSString stringWithUTF8String:args[0].getString(rt).utf8(rt).c_str()];
                
                // Delete the node
                [container deleteNode:nodeId];
                
                return facebook::jsi::Value::undefined();
            }
        );
    }
    // Scene hierarchy functions
    else if (nameStr == "addViroNodeChild") {
        return facebook::jsi::Function::createFromHostFunction(
            runtime,
            name,
            2,  // parentId, childId
            [weakContainer = _container](facebook::jsi::Runtime& rt, const facebook::jsi::Value& thisValue, const facebook::jsi::Value* args, size_t count) -> facebook::jsi::Value {
                __strong ViroFabricContainer *container = weakContainer;
                if (!container) return facebook::jsi::Value::undefined();
                
                if (count < 2) {
                    throw facebook::jsi::JSError(rt, "addViroNodeChild requires 2 arguments");
                }
                
                NSString *parentId = [NSString stringWithUTF8String:args[0].getString(rt).utf8(rt).c_str()];
                NSString *childId = [NSString stringWithUTF8String:args[1].getString(rt).utf8(rt).c_str()];
                
                // Add child to parent
                [container addChild:childId toParent:parentId];
                
                return facebook::jsi::Value::undefined();
            }
        );
    }
    else if (nameStr == "removeViroNodeChild") {
        return facebook::jsi::Function::createFromHostFunction(
            runtime,
            name,
            2,  // parentId, childId
            [weakContainer = _container](facebook::jsi::Runtime& rt, const facebook::jsi::Value& thisValue, const facebook::jsi::Value* args, size_t count) -> facebook::jsi::Value {
                __strong ViroFabricContainer *container = weakContainer;
                if (!container) return facebook::jsi::Value::undefined();
                
                if (count < 2) {
                    throw facebook::jsi::JSError(rt, "removeViroNodeChild requires 2 arguments");
                }
                
                NSString *parentId = [NSString stringWithUTF8String:args[0].getString(rt).utf8(rt).c_str()];
                NSString *childId = [NSString stringWithUTF8String:args[1].getString(rt).utf8(rt).c_str()];
                
                // Remove child from parent
                [container removeChild:childId fromParent:parentId];
                
                return facebook::jsi::Value::undefined();
            }
        );
    }
    // Event handling functions
    else if (nameStr == "registerEventCallback") {
        return facebook::jsi::Function::createFromHostFunction(
            runtime,
            name,
            3,  // nodeId, eventName, callbackId
            [weakContainer = _container](facebook::jsi::Runtime& rt, const facebook::jsi::Value& thisValue, const facebook::jsi::Value* args, size_t count) -> facebook::jsi::Value {
                __strong ViroFabricContainer *container = weakContainer;
                if (!container) return facebook::jsi::Value::undefined();
                
                if (count < 3) {
                    throw facebook::jsi::JSError(rt, "registerEventCallback requires 3 arguments");
                }
                
                NSString *nodeId = [NSString stringWithUTF8String:args[0].getString(rt).utf8(rt).c_str()];
                NSString *eventName = [NSString stringWithUTF8String:args[1].getString(rt).utf8(rt).c_str()];
                NSString *callbackId = [NSString stringWithUTF8String:args[2].getString(rt).utf8(rt).c_str()];
                
                // Register event callback
                [container registerEventCallback:callbackId forEvent:eventName onNode:nodeId];
                
                return facebook::jsi::Value::undefined();
            }
        );
    }
    else if (nameStr == "unregisterEventCallback") {
        return facebook::jsi::Function::createFromHostFunction(
            runtime,
            name,
            3,  // nodeId, eventName, callbackId
            [weakContainer = _container](facebook::jsi::Runtime& rt, const facebook::jsi::Value& thisValue, const facebook::jsi::Value* args, size_t count) -> facebook::jsi::Value {
                __strong ViroFabricContainer *container = weakContainer;
                if (!container) return facebook::jsi::Value::undefined();
                
                if (count < 3) {
                    throw facebook::jsi::JSError(rt, "unregisterEventCallback requires 3 arguments");
                }
                
                NSString *nodeId = [NSString stringWithUTF8String:args[0].getString(rt).utf8(rt).c_str()];
                NSString *eventName = [NSString stringWithUTF8String:args[1].getString(rt).utf8(rt).c_str()];
                NSString *callbackId = [NSString stringWithUTF8String:args[2].getString(rt).utf8(rt).c_str()];
                
                // Unregister event callback
                [container unregisterEventCallback:callbackId forEvent:eventName onNode:nodeId];
                
                return facebook::jsi::Value::undefined();
            }
        );
    }
    // Initialize function
    else if (nameStr == "initialize") {
        return facebook::jsi::Function::createFromHostFunction(
            runtime,
            name,
            1,  // config
            [weakContainer = _container](facebook::jsi::Runtime& rt, const facebook::jsi::Value& thisValue, const facebook::jsi::Value* args, size_t count) -> facebook::jsi::Value {
                __strong ViroFabricContainer *container = weakContainer;
                if (!container) return facebook::jsi::Value::undefined();
                
                // Initialize Viro with configuration
                BOOL debug = NO;
                BOOL arEnabled = NO;
                NSString *worldAlignment = @"Gravity";
                
                if (count > 0 && args[0].isObject()) {
                    auto config = args[0].getObject(rt);
                    
                    if (config.hasProperty(rt, "debug")) {
                        debug = config.getProperty(rt, "debug").getBool();
                    }
                    if (config.hasProperty(rt, "arEnabled")) {
                        arEnabled = config.getProperty(rt, "arEnabled").getBool();
                    }
                    if (config.hasProperty(rt, "worldAlignment")) {
                        auto alignmentStr = config.getProperty(rt, "worldAlignment").getString(rt).utf8(rt);
                        worldAlignment = [NSString stringWithUTF8String:alignmentStr.c_str()];
                    }
                }
                
                // Call the initialize method
                [container initialize:debug arEnabled:arEnabled worldAlignment:worldAlignment];
                
                // Return a promise that resolves to true using Promise.resolve()
                auto promiseConstructor = rt.global().getPropertyAsObject(rt, "Promise");
                auto resolveMethod = promiseConstructor.getPropertyAsFunction(rt, "resolve");
                auto promise = resolveMethod.callWithThis(rt, promiseConstructor, facebook::jsi::Value(true));
                
                return promise;
            }
        );
    }
    // Material management functions
    else if (nameStr == "createViroMaterial") {
        return facebook::jsi::Function::createFromHostFunction(
            runtime,
            name,
            2,  // materialName, properties
            [weakContainer = _container](facebook::jsi::Runtime& rt, const facebook::jsi::Value& thisValue, const facebook::jsi::Value* args, size_t count) -> facebook::jsi::Value {
                __strong ViroFabricContainer *container = weakContainer;
                if (!container) return facebook::jsi::Value::undefined();
                
                if (count < 2) {
                    throw facebook::jsi::JSError(rt, "createViroMaterial requires 2 arguments");
                }
                
                NSString *materialName = [NSString stringWithUTF8String:args[0].getString(rt).utf8(rt).c_str()];
                id props = [container convertJSIValueToObjC:args[1] runtime:rt];
                
                // Create the material
                [container createMaterial:materialName withProps:props];
                
                return facebook::jsi::Value::undefined();
            }
        );
    }
    else if (nameStr == "updateViroMaterial") {
        return facebook::jsi::Function::createFromHostFunction(
            runtime,
            name,
            2,  // materialName, properties
            [weakContainer = _container](facebook::jsi::Runtime& rt, const facebook::jsi::Value& thisValue, const facebook::jsi::Value* args, size_t count) -> facebook::jsi::Value {
                __strong ViroFabricContainer *container = weakContainer;
                if (!container) return facebook::jsi::Value::undefined();
                
                if (count < 2) {
                    throw facebook::jsi::JSError(rt, "updateViroMaterial requires 2 arguments");
                }
                
                NSString *materialName = [NSString stringWithUTF8String:args[0].getString(rt).utf8(rt).c_str()];
                id props = [container convertJSIValueToObjC:args[1] runtime:rt];
                
                // Update the material
                [container updateMaterial:materialName withProps:props];
                
                return facebook::jsi::Value::undefined();
            }
        );
    }
    // Animation functions
    else if (nameStr == "createViroAnimation") {
        return facebook::jsi::Function::createFromHostFunction(
            runtime,
            name,
            2,  // animationName, properties
            [weakContainer = _container](facebook::jsi::Runtime& rt, const facebook::jsi::Value& thisValue, const facebook::jsi::Value* args, size_t count) -> facebook::jsi::Value {
                __strong ViroFabricContainer *container = weakContainer;
                if (!container) return facebook::jsi::Value::undefined();
                
                if (count < 2) {
                    throw facebook::jsi::JSError(rt, "createViroAnimation requires 2 arguments");
                }
                
                NSString *animationName = [NSString stringWithUTF8String:args[0].getString(rt).utf8(rt).c_str()];
                id props = [container convertJSIValueToObjC:args[1] runtime:rt];
                
                // Create the animation
                [container createAnimation:animationName withProps:props];
                
                return facebook::jsi::Value::undefined();
            }
        );
    }
    else if (nameStr == "executeViroAnimation") {
        return facebook::jsi::Function::createFromHostFunction(
            runtime,
            name,
            3,  // nodeId, animationName, options
            [weakContainer = _container](facebook::jsi::Runtime& rt, const facebook::jsi::Value& thisValue, const facebook::jsi::Value* args, size_t count) -> facebook::jsi::Value {
                __strong ViroFabricContainer *container = weakContainer;
                if (!container) return facebook::jsi::Value::undefined();
                
                if (count < 3) {
                    throw facebook::jsi::JSError(rt, "executeViroAnimation requires 3 arguments");
                }
                
                NSString *nodeId = [NSString stringWithUTF8String:args[0].getString(rt).utf8(rt).c_str()];
                NSString *animationName = [NSString stringWithUTF8String:args[1].getString(rt).utf8(rt).c_str()];
                id options = [container convertJSIValueToObjC:args[2] runtime:rt];
                
                // Execute the animation
                [container executeAnimation:animationName onNode:nodeId withOptions:options];
                
                return facebook::jsi::Value::undefined();
            }
        );
    }
    // AR specific functions
    else if (nameStr == "setViroARPlaneDetection") {
        return facebook::jsi::Function::createFromHostFunction(
            runtime,
            name,
            1,  // config
            [weakContainer = _container](facebook::jsi::Runtime& rt, const facebook::jsi::Value& thisValue, const facebook::jsi::Value* args, size_t count) -> facebook::jsi::Value {
                __strong ViroFabricContainer *container = weakContainer;
                if (!container) return facebook::jsi::Value::undefined();
                
                if (count < 1) {
                    throw facebook::jsi::JSError(rt, "setViroARPlaneDetection requires 1 argument");
                }
                
                id config = [container convertJSIValueToObjC:args[0] runtime:rt];
                
                // Set AR plane detection
                [container setARPlaneDetection:config];
                
                return facebook::jsi::Value::undefined();
            }
        );
    }
    else if (nameStr == "setViroARImageTargets") {
        return facebook::jsi::Function::createFromHostFunction(
            runtime,
            name,
            1,  // targets
            [weakContainer = _container](facebook::jsi::Runtime& rt, const facebook::jsi::Value& thisValue, const facebook::jsi::Value* args, size_t count) -> facebook::jsi::Value {
                __strong ViroFabricContainer *container = weakContainer;
                if (!container) return facebook::jsi::Value::undefined();
                
                if (count < 1) {
                    throw facebook::jsi::JSError(rt, "setViroARImageTargets requires 1 argument");
                }
                
                id targets = [container convertJSIValueToObjC:args[0] runtime:rt];
                
                // Set AR image targets
                [container setARImageTargets:targets];
                
                return facebook::jsi::Value::undefined();
            }
        );
    }
    
    return facebook::jsi::Value::undefined();
}

// Continue with ViroFabricContainer implementation
@implementation ViroFabricContainer (NodeManagement)

#pragma mark - Node Management

- (void)createNode:(NSString *)nodeId ofType:(NSString *)nodeType withProps:(NSDictionary *)props {
    // Get the appropriate navigator
    VRTSceneNavigator *navigator = [self getActiveNavigator];
    if (!navigator) {
        RCTLogError(@"Cannot create node: no active navigator");
        return;
    }
    
    // Store the node ID in the registry
    _nodeRegistry[nodeId] = @{@"type": nodeType, @"props": props ?: @{}};
    
    // If this is a scene node, add it to the navigator
    if ([nodeType isEqualToString:@"scene"]) {
        // For scene nodes, we need to create a VRTScene and set it on the navigator
        if (_sceneNavigator) {
            // Import the VRTScene class from the ViroReact framework
            Class sceneClass = NSClassFromString(@"VRTScene");
            if (!sceneClass) {
                RCTLogError(@"VRTScene class not found");
                return;
            }
            
            // Create a scene using the existing VRTScene implementation
            id scene = [[sceneClass alloc] initWithBridge:_bridge];
            
            // Set properties using individual property setters
            [self setNodeProperties:scene withProps:props];
            
            // Use setScene: instead of setSceneView:
            if ([_sceneNavigator respondsToSelector:@selector(setScene:)]) {
                [_sceneNavigator performSelector:@selector(setScene:) withObject:scene];
            } else if ([_sceneNavigator respondsToSelector:@selector(setCurrentScene:)]) {
                [_sceneNavigator performSelector:@selector(setCurrentScene:) withObject:scene];
            }
            
            _nodeRegistry[nodeId] = scene;
        }
    } else if ([nodeType isEqualToString:@"arScene"]) {
        // For AR scene nodes, we need to create a VRTARScene and set it on the navigator
        if (_arSceneNavigator) {
            // Import the VRTARScene class from the ViroReact framework
            Class arSceneClass = NSClassFromString(@"VRTARScene");
            if (!arSceneClass) {
                RCTLogError(@"VRTARScene class not found");
                return;
            }
            
            // Create an AR scene using the existing VRTARScene implementation
            id arScene = [[arSceneClass alloc] initWithBridge:_bridge];
            
            // Instead of using setProps:, set properties individually or use a different method
            if ([arScene respondsToSelector:@selector(setProperties:)]) {
                [arScene performSelector:@selector(setProperties:) withObject:props];
            }
            
            // Use setScene: method
            if ([_arSceneNavigator respondsToSelector:@selector(setScene:)]) {
                [_arSceneNavigator performSelector:@selector(setScene:) withObject:arScene];
            }
            
            _nodeRegistry[nodeId] = arScene;
        }
    } else {
        // For other node types, create the appropriate VRT node and add it to the scene
        id node = [self createVRTNodeOfType:nodeType withProps:props];
        if (node) {
            _nodeRegistry[nodeId] = node;
        } else {
            // Store as metadata for nodes we don't have VRT classes for yet
            _nodeRegistry[nodeId] = @{
                @"type": nodeType,
                @"props": props ?: @{}
            };
        }
    }
}

- (void)updateNode:(NSString *)nodeId withProps:(NSDictionary *)props {
    // Get the node from the registry
    id node = _nodeRegistry[nodeId];
    if (!node) {
        RCTLogError(@"Cannot update node: node not found");
        return;
    }
    
    // If the node is a VRTNode, update its properties
    Class vrtNodeClass = NSClassFromString(@"VRTNode");
    if (vrtNodeClass && [node isKindOfClass:vrtNodeClass]) {
        // Instead of using setProps:, set properties individually or use a different method
        if ([node respondsToSelector:@selector(setProperties:)]) {
            [node performSelector:@selector(setProperties:) withObject:props];
        }
    } else {
        // If it's just a dictionary (for nodes we don't have a VRT class for yet),
        // update the props in the registry
        NSMutableDictionary *nodeInfo = [node mutableCopy];
        NSMutableDictionary *nodeProps = [nodeInfo[@"props"] mutableCopy];
        [nodeProps addEntriesFromDictionary:props];
        nodeInfo[@"props"] = nodeProps;
        _nodeRegistry[nodeId] = nodeInfo;
    }
}

- (void)deleteNode:(NSString *)nodeId {
    // Get the node from the registry
    id node = _nodeRegistry[nodeId];
    if (!node) {
        RCTLogError(@"Cannot delete node: node not found");
        return;
    }
    
    // If the node is a VRTNode, remove it from its parent
    Class vrtNodeClass = NSClassFromString(@"VRTNode");
    if (vrtNodeClass && [node isKindOfClass:vrtNodeClass]) {
        // Check for the correct method to remove from parent
        if ([node respondsToSelector:@selector(removeFromParentNode)]) {
            [node performSelector:@selector(removeFromParentNode)];
        } else if ([node respondsToSelector:@selector(removeFromParent)]) {
            [node performSelector:@selector(removeFromParent)];
        }
    }
    
    // Remove the node from the registry
    [_nodeRegistry removeObjectForKey:nodeId];
}

- (void)addChild:(NSString *)childId toParent:(NSString *)parentId {
    // Get the parent and child nodes from the registry
    id parent = _nodeRegistry[parentId];
    id child = _nodeRegistry[childId];
    
    if (!parent || !child) {
        RCTLogError(@"Cannot add child: parent or child not found");
        return;
    }
    
    // If both parent and child are VRTNode, add the child to the parent
    Class vrtNodeClass = NSClassFromString(@"VRTNode");
    if (vrtNodeClass && [parent isKindOfClass:vrtNodeClass] && [child isKindOfClass:vrtNodeClass]) {
        // Try to use a direct method on VRTNode if available
        if ([parent respondsToSelector:@selector(addChildNode:)]) {
            [parent performSelector:@selector(addChildNode:) withObject:child];
        } else {
            // Fallback: try to add child using UIView hierarchy if VRT methods aren't available
            if ([parent isKindOfClass:[UIView class]] && [child isKindOfClass:[UIView class]]) {
                [(UIView *)parent addSubview:(UIView *)child];
            }
        }
    } else {
        // If they're not both VRT nodes, update the parent-child relationship in the registry
        NSMutableDictionary *parentInfo = [parent isKindOfClass:[NSDictionary class]] ? [parent mutableCopy] : [NSMutableDictionary new];
        NSMutableArray *children = [parentInfo[@"children"] mutableCopy] ?: [NSMutableArray new];
        [children addObject:childId];
        parentInfo[@"children"] = children;
        _nodeRegistry[parentId] = parentInfo;
    }
}

- (void)removeChild:(NSString *)childId fromParent:(NSString *)parentId {
    // Get the parent and child nodes from the registry
    id parent = _nodeRegistry[parentId];
    id child = _nodeRegistry[childId];
    
    if (!parent || !child) {
        RCTLogError(@"Cannot remove child: parent or child not found");
        return;
    }
    
    // If both parent and child are VRTNode, remove the child from the parent
    Class vrtNodeClass = NSClassFromString(@"VRTNode");
    if (vrtNodeClass && [parent isKindOfClass:vrtNodeClass] && [child isKindOfClass:vrtNodeClass]) {
        // Try to use a direct method on VRTNode if available
        if ([parent respondsToSelector:@selector(removeChildNode:)]) {
            [parent performSelector:@selector(removeChildNode:) withObject:child];
        } else if ([child respondsToSelector:@selector(removeFromParent)]) {
            [child performSelector:@selector(removeFromParent)];
        } else {
            // Fallback: try to remove child using UIView hierarchy if VRT methods aren't available
            if ([child isKindOfClass:[UIView class]]) {
                [(UIView *)child removeFromSuperview];
            }
        }
    } else {
        // If they're not both VRT nodes, update the parent-child relationship in the registry
        NSMutableDictionary *parentInfo = [parent isKindOfClass:[NSDictionary class]] ? [parent mutableCopy] : [NSMutableDictionary new];
        NSMutableArray *children = [parentInfo[@"children"] mutableCopy];
        [children removeObject:childId];
        parentInfo[@"children"] = children;
        _nodeRegistry[parentId] = parentInfo;
    }
}

// Helper method to get the active navigator
- (id)getActiveNavigator {
    if (_arSceneNavigator) {
        return _arSceneNavigator;
    } else {
        return _sceneNavigator;
    }
}

#pragma mark - Event Handling

- (void)registerEventCallback:(NSString *)callbackId forEvent:(NSString *)eventName onNode:(NSString *)nodeId {
    // Get the node from the registry
    id node = _nodeRegistry[nodeId];
    if (!node) {
        RCTLogError(@"Cannot register event callback: node not found");
        return;
    }
    
    // Store the callback ID in the registry
    NSString *key = [NSString stringWithFormat:@"%@_%@", nodeId, eventName];
    _eventCallbackRegistry[key] = callbackId;
    
    // If the node is a VRT node, register the event callback
    Class vrtNodeClass = NSClassFromString(@"VRTNode");
    if (vrtNodeClass && [node isKindOfClass:vrtNodeClass]) {
        // Create a block that will dispatch the event to JS
        __weak ViroFabricContainer *weakSelf = self;
        id eventCallback = ^(NSDictionary *event) {
            [weakSelf dispatchEventToJS:callbackId withData:event];
        };
        
        // Try different methods for registering event callbacks
        SEL registerSelector = NSSelectorFromString(@"registerEventCallback:withName:");
        if ([node respondsToSelector:registerSelector]) {
            NSMethodSignature *signature = [node methodSignatureForSelector:registerSelector];
            NSInvocation *invocation = [NSInvocation invocationWithMethodSignature:signature];
            [invocation setSelector:registerSelector];
            [invocation setTarget:node];
            [invocation setArgument:&eventCallback atIndex:2];
            [invocation setArgument:&eventName atIndex:3];
            [invocation invoke];
        } else if ([node respondsToSelector:@selector(addEventListener:withBlock:)]) {
            [node performSelector:@selector(addEventListener:withBlock:) 
                      withObject:eventName 
                      withObject:eventCallback];
        }
    }
}

- (void)unregisterEventCallback:(NSString *)callbackId forEvent:(NSString *)eventName onNode:(NSString *)nodeId {
    // Get the node from the registry
    id node = _nodeRegistry[nodeId];
    if (!node) {
        RCTLogError(@"Cannot unregister event callback: node not found");
        return;
    }
    
    // Remove the callback ID from the registry
    NSString *key = [NSString stringWithFormat:@"%@_%@", nodeId, eventName];
    [_eventCallbackRegistry removeObjectForKey:key];
    
    // If the node is a VRT node, unregister the event callback
    Class vrtNodeClass = NSClassFromString(@"VRTNode");
    if (vrtNodeClass && [node isKindOfClass:vrtNodeClass]) {
        // Try different methods for unregistering event callbacks
        SEL unregisterSelector = NSSelectorFromString(@"unregisterEventCallback:");
        if ([node respondsToSelector:unregisterSelector]) {
            [node performSelector:unregisterSelector withObject:eventName];
        } else if ([node respondsToSelector:@selector(removeEventListener:)]) {
            [node performSelector:@selector(removeEventListener:) withObject:eventName];
        }
    }
}

- (void)dispatchEventToJS:(NSString *)callbackId withData:(NSDictionary *)data {
    // Always use the event emitter approach
    if (_bridge) {
        // Send event through the ViroFabricManager
        [[ViroFabricManager sharedInstance] sendEventWithName:@"ViroEvent"
                                                         body:@{
                                                             @"callbackId": callbackId,
                                                             @"data": data
                                                         }];
    } else {
        RCTLogError(@"Cannot dispatch event: bridge is not available");
    }
}

#pragma mark - Material Management

- (void)createMaterial:(NSString *)materialName withProps:(NSDictionary *)props {
    RCTLogInfo(@"Creating material: %@", materialName);
    
    // Use the existing VRTMaterialManager with correct API
    Class materialManagerClass = NSClassFromString(@"VRTMaterialManager");
    if (!materialManagerClass) {
        RCTLogError(@"VRTMaterialManager class not found");
        return;
    }
    
    // Get the material manager instance
    id materialManager = [_bridge moduleForClass:materialManagerClass];
    if (!materialManager) {
        RCTLogError(@"VRTMaterialManager module not available");
        return;
    }
    
    // Use the correct VRTMaterialManager API - materials property
    if ([materialManager respondsToSelector:@selector(materials)] && 
        [materialManager respondsToSelector:@selector(setMaterials:)]) {
        
        NSMutableDictionary *materials = [[materialManager materials] mutableCopy];
        if (!materials) {
            materials = [NSMutableDictionary new];
        }
        materials[materialName] = props;
        [materialManager setMaterials:materials];
        
        RCTLogInfo(@"Successfully created material: %@", materialName);
    } else {
        RCTLogError(@"VRTMaterialManager does not support materials property");
    }
}

- (void)updateMaterial:(NSString *)materialName withProps:(NSDictionary *)props {
    RCTLogInfo(@"Updating material: %@", materialName);
    
    // Use the existing VRTMaterialManager with correct API
    Class materialManagerClass = NSClassFromString(@"VRTMaterialManager");
    if (!materialManagerClass) {
        RCTLogError(@"VRTMaterialManager class not found");
        return;
    }
    
    // Get the material manager instance
    id materialManager = [_bridge moduleForClass:materialManagerClass];
    if (!materialManager) {
        RCTLogError(@"VRTMaterialManager module not available");
        return;
    }
    
    // Use the correct VRTMaterialManager API - materials property
    if ([materialManager respondsToSelector:@selector(materials)] && 
        [materialManager respondsToSelector:@selector(setMaterials:)]) {
        
        NSMutableDictionary *materials = [[materialManager materials] mutableCopy];
        if (!materials) {
            materials = [NSMutableDictionary new];
        }
        materials[materialName] = props;
        [materialManager setMaterials:materials];
        
        RCTLogInfo(@"Successfully updated material: %@", materialName);
    } else {
        RCTLogError(@"VRTMaterialManager does not support materials property");
    }
}

#pragma mark - Animation Management

- (void)createAnimation:(NSString *)animationName withProps:(NSDictionary *)props {
    RCTLogInfo(@"Creating animation: %@", animationName);
    
    // Use the existing VRTAnimationManager with correct API
    Class animationManagerClass = NSClassFromString(@"VRTAnimationManager");
    if (!animationManagerClass) {
        RCTLogError(@"VRTAnimationManager class not found");
        return;
    }
    
    // Get the animation manager instance
    id animationManager = [_bridge moduleForClass:animationManagerClass];
    if (!animationManager) {
        RCTLogError(@"VRTAnimationManager module not available");
        return;
    }
    
    // Use the correct VRTAnimationManager API - animations property
    if ([animationManager respondsToSelector:@selector(animations)] && 
        [animationManager respondsToSelector:@selector(setAnimations:)]) {
        
        NSMutableDictionary *animations = [[animationManager animations] mutableCopy];
        if (!animations) {
            animations = [NSMutableDictionary new];
        }
        animations[animationName] = props;
        [animationManager setAnimations:animations];
        
        // Parse animations to make them available
        if ([animationManager respondsToSelector:@selector(parseAnimations)]) {
            [animationManager performSelector:@selector(parseAnimations)];
        }
        
        RCTLogInfo(@"Successfully created animation: %@", animationName);
    } else {
        RCTLogError(@"VRTAnimationManager does not support animations property");
    }
}

- (void)executeAnimation:(NSString *)animationName onNode:(NSString *)nodeId withOptions:(NSDictionary *)options {
    RCTLogInfo(@"Executing animation: %@ on node: %@", animationName, nodeId);
    
    // Get the node from the registry
    id node = _nodeRegistry[nodeId];
    if (!node) {
        RCTLogError(@"Cannot execute animation: node not found - %@", nodeId);
        return;
    }
    
    // If the node is a VRT node, execute the animation using the node's animation system
    Class vrtNodeClass = NSClassFromString(@"VRTNode");
    if (vrtNodeClass && [node isKindOfClass:vrtNodeClass]) {
        // Use the VRT node's built-in animation system
        NSMutableDictionary *animationConfig = [NSMutableDictionary new];
        animationConfig[@"name"] = animationName;
        
        if (options) {
            [animationConfig addEntriesFromDictionary:options];
        }
        
        // VRT nodes have their own animation system
        if ([node respondsToSelector:@selector(setAnimation:)]) {
            [node performSelector:@selector(setAnimation:) withObject:animationConfig];
            RCTLogInfo(@"Successfully executed animation: %@ on node: %@", animationName, nodeId);
        } else {
            RCTLogError(@"VRT node does not support setAnimation method");
        }
    } else {
        RCTLogWarn(@"Cannot execute animation on non-VRT node: %@", nodeId);
    }
}

#pragma mark - AR Configuration

- (void)setARPlaneDetection:(NSDictionary *)config {
    RCTLogInfo(@"Setting AR plane detection configuration");
    
    if (!_isAR || !_arSceneNavigator) {
        RCTLogWarn(@"Cannot set AR plane detection: not in AR mode");
        return;
    }
    
    // Configure AR plane detection using the existing VRTARSceneNavigator API
    if (config) {
        // Extract configuration options
        BOOL enabled = [config[@"enabled"] boolValue];
        NSString *alignment = config[@"alignment"] ?: @"Horizontal";
        
        // Apply configuration to the AR scene navigator
        if ([_arSceneNavigator respondsToSelector:@selector(setPlaneDetectionEnabled:)]) {
            [_arSceneNavigator performSelector:@selector(setPlaneDetectionEnabled:) 
                                    withObject:@(enabled)];
        }
        
        if ([_arSceneNavigator respondsToSelector:@selector(setPlaneDetectionAlignment:)]) {
            [_arSceneNavigator performSelector:@selector(setPlaneDetectionAlignment:) 
                                    withObject:alignment];
        }
        
        RCTLogInfo(@"Successfully configured AR plane detection - enabled: %@, alignment: %@", 
                   @(enabled), alignment);
    }
}

- (void)setARImageTargets:(NSDictionary *)targets {
    RCTLogInfo(@"Setting AR image targets");
    
    if (!_isAR || !_arSceneNavigator) {
        RCTLogWarn(@"Cannot set AR image targets: not in AR mode");
        return;
    }
    
    // Configure AR image targets using the existing VRTARSceneNavigator API
    if (targets) {
        // Apply image targets to the AR scene navigator
        if ([_arSceneNavigator respondsToSelector:@selector(setImageTargets:)]) {
            [_arSceneNavigator performSelector:@selector(setImageTargets:) 
                                    withObject:targets];
        }
        
        RCTLogInfo(@"Successfully configured AR image targets with %lu targets", 
                   (unsigned long)[targets count]);
    }
}

// Helper method to create VRT nodes of different types
- (id)createVRTNodeOfType:(NSString *)nodeType withProps:(NSDictionary *)props {
    id node = nil;
    
    @try {
        // Basic shape components
        if ([nodeType isEqualToString:@"box"]) {
            Class nodeClass = NSClassFromString(@"VRTBox");
            if (nodeClass) {
                node = [[nodeClass alloc] initWithBridge:_bridge];
            }
        } else if ([nodeType isEqualToString:@"sphere"]) {
            Class nodeClass = NSClassFromString(@"VRTSphere");
            if (nodeClass) {
                node = [[nodeClass alloc] initWithBridge:_bridge];
            }
        } else if ([nodeType isEqualToString:@"text"]) {
            Class nodeClass = NSClassFromString(@"VRTText");
            if (nodeClass) {
                node = [[nodeClass alloc] initWithBridge:_bridge];
            }
        } else if ([nodeType isEqualToString:@"image"]) {
            Class nodeClass = NSClassFromString(@"VRTImage");
            if (nodeClass) {
                node = [[nodeClass alloc] initWithBridge:_bridge];
            }
        } else if ([nodeType isEqualToString:@"quad"]) {
            Class nodeClass = NSClassFromString(@"VRTQuad");
            if (nodeClass) {
                node = [[nodeClass alloc] initWithBridge:_bridge];
            }
        } else if ([nodeType isEqualToString:@"video"]) {
            Class nodeClass = NSClassFromString(@"VRTVideoSurface");
            if (nodeClass) {
                node = [[nodeClass alloc] initWithBridge:_bridge];
            }
        } else if ([nodeType isEqualToString:@"3DObject"]) {
            Class nodeClass = NSClassFromString(@"VRT3DObject");
            if (nodeClass) {
                node = [[nodeClass alloc] initWithBridge:_bridge];
            }
        }
        // Layout components
        else if ([nodeType isEqualToString:@"node"]) {
            Class nodeClass = NSClassFromString(@"VRTNode");
            if (nodeClass) {
                node = [[nodeClass alloc] initWithBridge:_bridge];
            }
        } else if ([nodeType isEqualToString:@"flexView"]) {
            Class nodeClass = NSClassFromString(@"VRTFlexView");
            if (nodeClass) {
                node = [[nodeClass alloc] initWithBridge:_bridge];
            }
        }
        // Shape components
        else if ([nodeType isEqualToString:@"polygon"]) {
            Class nodeClass = NSClassFromString(@"VRTPolygon");
            if (nodeClass) {
                node = [[nodeClass alloc] initWithBridge:_bridge];
            }
        } else if ([nodeType isEqualToString:@"polyline"]) {
            Class nodeClass = NSClassFromString(@"VRTPolyline");
            if (nodeClass) {
                node = [[nodeClass alloc] initWithBridge:_bridge];
            }
        }
        // Interactive components
        else if ([nodeType isEqualToString:@"controller"]) {
            Class nodeClass = NSClassFromString(@"VRTController");
            if (nodeClass) {
                node = [[nodeClass alloc] initWithBridge:_bridge];
            }
        }
        // Media components
        else if ([nodeType isEqualToString:@"animatedImage"]) {
            Class nodeClass = NSClassFromString(@"VRTAnimatedImage");
            if (nodeClass) {
                node = [[nodeClass alloc] initWithBridge:_bridge];
            }
        } else if ([nodeType isEqualToString:@"materialVideo"]) {
            Class nodeClass = NSClassFromString(@"VRTMaterialVideo");
            if (nodeClass) {
                node = [[nodeClass alloc] initWithBridge:_bridge];
            }
        } else if ([nodeType isEqualToString:@"360Image"]) {
            Class nodeClass = NSClassFromString(@"VRT360Image");
            if (nodeClass) {
                node = [[nodeClass alloc] initWithBridge:_bridge];
            }
        } else if ([nodeType isEqualToString:@"360Video"]) {
            Class nodeClass = NSClassFromString(@"VRT360Video");
            if (nodeClass) {
                node = [[nodeClass alloc] initWithBridge:_bridge];
            }
        }
        // Environment components
        else if ([nodeType isEqualToString:@"skyBox"]) {
            Class nodeClass = NSClassFromString(@"VRTSkybox");
            if (nodeClass) {
                node = [[nodeClass alloc] initWithBridge:_bridge];
            }
        } else if ([nodeType isEqualToString:@"lightingEnvironment"]) {
            Class nodeClass = NSClassFromString(@"VRTLightingEnvironment");
            if (nodeClass) {
                node = [[nodeClass alloc] initWithBridge:_bridge];
            }
        }
        // Portal components
        else if ([nodeType isEqualToString:@"portal"]) {
            Class nodeClass = NSClassFromString(@"VRTPortal");
            if (nodeClass) {
                node = [[nodeClass alloc] initWithBridge:_bridge];
            }
        } else if ([nodeType isEqualToString:@"portalScene"]) {
            Class nodeClass = NSClassFromString(@"VRTPortalScene");
            if (nodeClass) {
                node = [[nodeClass alloc] initWithBridge:_bridge];
            }
        }
        // Effects components
        else if ([nodeType isEqualToString:@"particleEmitter"]) {
            Class nodeClass = NSClassFromString(@"VRTParticleEmitter");
            if (nodeClass) {
                node = [[nodeClass alloc] initWithBridge:_bridge];
            }
        }
        // Camera components
        else if ([nodeType isEqualToString:@"camera"]) {
            Class nodeClass = NSClassFromString(@"VRTCamera");
            if (nodeClass) {
                node = [[nodeClass alloc] initWithBridge:_bridge];
            }
        } else if ([nodeType isEqualToString:@"orbitCamera"]) {
            Class nodeClass = NSClassFromString(@"VRTOrbitCamera");
            if (nodeClass) {
                node = [[nodeClass alloc] initWithBridge:_bridge];
            }
        }
        // Lighting components (using VRTLight base class)
        else if ([nodeType isEqualToString:@"ambientLight"] ||
                 [nodeType isEqualToString:@"directionalLight"] ||
                 [nodeType isEqualToString:@"omniLight"] ||
                 [nodeType isEqualToString:@"spotLight"]) {
            Class nodeClass = NSClassFromString(@"VRTLight");
            if (nodeClass) {
                node = [[nodeClass alloc] initWithBridge:_bridge];
                // Set the light type as a property
                if ([node respondsToSelector:@selector(setLightType:)]) {
                    [node performSelector:@selector(setLightType:) withObject:nodeType];
                }
            }
        }
        // Audio components
        else if ([nodeType isEqualToString:@"sound"]) {
            Class nodeClass = NSClassFromString(@"VRTSound");
            if (nodeClass) {
                node = [[nodeClass alloc] initWithBridge:_bridge];
            }
        } else {
            RCTLogWarn(@"Unknown node type: %@", nodeType);
            return nil;
        }
        
        // Set props if node was created and props are provided
        if (node && props) {
            [self setNodeProperties:node withProps:props];
        }
        
    } @catch (NSException *exception) {
        RCTLogError(@"Error creating VRT node of type %@: %@", nodeType, exception.reason);
        return nil;
    }
    
    return node;
}

@end

@implementation ViroFabricContainer (Utilities)

#pragma mark - Utility Methods

- (id)convertJSIValueToObjC:(const facebook::jsi::Value &)value runtime:(facebook::jsi::Runtime &)runtime {
    if (value.isUndefined() || value.isNull()) {
        return nil;
    } else if (value.isBool()) {
        return @(value.getBool());
    } else if (value.isNumber()) {
        return @(value.getNumber());
    } else if (value.isString()) {
        return [NSString stringWithUTF8String:value.getString(runtime).utf8(runtime).c_str()];
    } else if (value.isObject()) {
        auto object = value.getObject(runtime);
        
        if (object.isArray(runtime)) {
            auto array = object.getArray(runtime);
            NSMutableArray *result = [NSMutableArray new];
            
            for (size_t i = 0; i < array.size(runtime); i++) {
                [result addObject:[self convertJSIValueToObjC:array.getValueAtIndex(runtime, i) runtime:runtime] ?: [NSNull null]];
            }
            
            return result;
        } else {
            NSMutableDictionary *result = [NSMutableDictionary new];
            auto propertyNames = object.getPropertyNames(runtime);
            
            for (size_t i = 0; i < propertyNames.size(runtime); i++) {
                auto name = propertyNames.getValueAtIndex(runtime, i).getString(runtime);
                auto prop = object.getProperty(runtime, name);
                
                NSString *key = [NSString stringWithUTF8String:name.utf8(runtime).c_str()];
                id value = [self convertJSIValueToObjC:prop runtime:runtime];
                
                if (value) {
                    result[key] = value;
                } else {
                    result[key] = [NSNull null];
                }
            }
            
            return result;
        }
    }
    
    return nil;
}

// Helper method to check if an object is JSON serializable
- (BOOL)isJSONSerializable:(id)obj {
    if ([obj isKindOfClass:[NSString class]] ||
        [obj isKindOfClass:[NSNumber class]] ||
        [obj isKindOfClass:[NSNull class]] ||
        [obj isKindOfClass:[NSArray class]] ||
        [obj isKindOfClass:[NSDictionary class]]) {
        
        if ([obj isKindOfClass:[NSArray class]]) {
            for (id item in (NSArray *)obj) {
                if (![self isJSONSerializable:item]) {
                    return NO;
                }
            }
        } else if ([obj isKindOfClass:[NSDictionary class]]) {
            for (id key in [(NSDictionary *)obj allKeys]) {
                if (![key isKindOfClass:[NSString class]]) {
                    return NO;
                }
                if (![self isJSONSerializable:[(NSDictionary *)obj objectForKey:key]]) {
                    return NO;
                }
            }
        }
        
        return YES;
    }
    
    return NO;
}

// Convert Objective-C objects to JSI values via JSON
- (facebook::jsi::Value)convertObjCToJSIValue:(id)value runtime:(facebook::jsi::Runtime &)runtime {
    if (value == nil || [value isKindOfClass:[NSNull class]]) {
        return facebook::jsi::Value::null();
    } else if ([value isKindOfClass:[NSNumber class]]) {
        if ([value isKindOfClass:[@YES class]]) {
            return facebook::jsi::Value([(NSNumber *)value boolValue]);
        } else {
            return facebook::jsi::Value([(NSNumber *)value doubleValue]);
        }
    } else if ([value isKindOfClass:[NSString class]]) {
        return facebook::jsi::String::createFromUtf8(runtime, [(NSString *)value UTF8String]);
    } else if ([value isKindOfClass:[NSArray class]] || [value isKindOfClass:[NSDictionary class]]) {
        // Check if the object is JSON serializable
        if (![self isJSONSerializable:value]) {
            RCTLogError(@"Object is not JSON serializable");
            return facebook::jsi::Value::undefined();
        }
        
        // Convert to JSON string
        NSError *error = nil;
        NSData *jsonData = [NSJSONSerialization dataWithJSONObject:value options:0 error:&error];
        if (error) {
            RCTLogError(@"Error serializing to JSON: %@", error);
            return facebook::jsi::Value::undefined();
        }
        
        NSString *jsonString = [[NSString alloc] initWithData:jsonData encoding:NSUTF8StringEncoding];
        
        // Create a JavaScript expression to parse the JSON
        std::string evalString = "JSON.parse('" + std::string([jsonString UTF8String]) + "')";
        
        // Evaluate the JavaScript expression to create the object
        try {
            return runtime.evaluateJavaScript(
                std::make_unique<facebook::jsi::StringBuffer>(evalString),
                "json_parse"
            );
        } catch (const std::exception &e) {
            RCTLogError(@"Error evaluating JSON: %s", e.what());
            return facebook::jsi::Value::undefined();
        }
    }
    
    return facebook::jsi::Value::undefined();
}

#pragma mark - Property Setting System

/**
 * Set properties on a VRT node using individual property setters.
 * This replaces the generic setProperties: method with the actual VRT property setting pattern.
 */
- (void)setNodeProperties:(id)node withProps:(NSDictionary *)props {
    if (!node || !props) {
        return;
    }
    
    @try {
        // Transform properties
        if (props[@"position"] && [props[@"position"] isKindOfClass:[NSArray class]]) {
            NSArray *position = props[@"position"];
            if ([node respondsToSelector:@selector(setPosition:)]) {
                [node performSelector:@selector(setPosition:) withObject:position];
            }
        }
        
        if (props[@"rotation"] && [props[@"rotation"] isKindOfClass:[NSArray class]]) {
            NSArray *rotation = props[@"rotation"];
            if ([node respondsToSelector:@selector(setRotation:)]) {
                [node performSelector:@selector(setRotation:) withObject:rotation];
            }
        }
        
        if (props[@"scale"] && [props[@"scale"] isKindOfClass:[NSArray class]]) {
            NSArray *scale = props[@"scale"];
            if ([node respondsToSelector:@selector(setScale:)]) {
                [node performSelector:@selector(setScale:) withObject:scale];
            }
        }
        
        if (props[@"rotationPivot"] && [props[@"rotationPivot"] isKindOfClass:[NSArray class]]) {
            NSArray *rotationPivot = props[@"rotationPivot"];
            if ([node respondsToSelector:@selector(setRotationPivot:)]) {
                [node performSelector:@selector(setRotationPivot:) withObject:rotationPivot];
            }
        }
        
        if (props[@"scalePivot"] && [props[@"scalePivot"] isKindOfClass:[NSArray class]]) {
            NSArray *scalePivot = props[@"scalePivot"];
            if ([node respondsToSelector:@selector(setScalePivot:)]) {
                [node performSelector:@selector(setScalePivot:) withObject:scalePivot];
            }
        }
        
        // Appearance properties
        if (props[@"opacity"] && [props[@"opacity"] isKindOfClass:[NSNumber class]]) {
            NSNumber *opacity = props[@"opacity"];
            if ([node respondsToSelector:@selector(setOpacity:)]) {
                [node performSelector:@selector(setOpacity:) withObject:opacity];
            }
        }
        
        if (props[@"visible"] && [props[@"visible"] isKindOfClass:[NSNumber class]]) {
            NSNumber *visible = props[@"visible"];
            if ([node respondsToSelector:@selector(setVisible:)]) {
                [node performSelector:@selector(setVisible:) withObject:visible];
            }
        }
        
        if (props[@"renderingOrder"] && [props[@"renderingOrder"] isKindOfClass:[NSNumber class]]) {
            NSNumber *renderingOrder = props[@"renderingOrder"];
            if ([node respondsToSelector:@selector(setRenderingOrder:)]) {
                [node performSelector:@selector(setRenderingOrder:) withObject:renderingOrder];
            }
        }
        
        // Lighting properties
        if (props[@"lightReceivingBitMask"] && [props[@"lightReceivingBitMask"] isKindOfClass:[NSNumber class]]) {
            NSNumber *bitMask = props[@"lightReceivingBitMask"];
            if ([node respondsToSelector:@selector(setLightReceivingBitMask:)]) {
                [node performSelector:@selector(setLightReceivingBitMask:) withObject:bitMask];
            }
        }
        
        if (props[@"shadowCastingBitMask"] && [props[@"shadowCastingBitMask"] isKindOfClass:[NSNumber class]]) {
            NSNumber *bitMask = props[@"shadowCastingBitMask"];
            if ([node respondsToSelector:@selector(setShadowCastingBitMask:)]) {
                [node performSelector:@selector(setShadowCastingBitMask:) withObject:bitMask];
            }
        }
        
        // Event handling properties
        if (props[@"canHover"] && [props[@"canHover"] isKindOfClass:[NSNumber class]]) {
            NSNumber *canHover = props[@"canHover"];
            if ([node respondsToSelector:@selector(setCanHover:)]) {
                [node performSelector:@selector(setCanHover:) withObject:canHover];
            }
        }
        
        if (props[@"canClick"] && [props[@"canClick"] isKindOfClass:[NSNumber class]]) {
            NSNumber *canClick = props[@"canClick"];
            if ([node respondsToSelector:@selector(setCanClick:)]) {
                [node performSelector:@selector(setCanClick:) withObject:canClick];
            }
        }
        
        if (props[@"canTouch"] && [props[@"canTouch"] isKindOfClass:[NSNumber class]]) {
            NSNumber *canTouch = props[@"canTouch"];
            if ([node respondsToSelector:@selector(setCanTouch:)]) {
                [node performSelector:@selector(setCanTouch:) withObject:canTouch];
            }
        }
        
        if (props[@"canScroll"] && [props[@"canScroll"] isKindOfClass:[NSNumber class]]) {
            NSNumber *canScroll = props[@"canScroll"];
            if ([node respondsToSelector:@selector(setCanScroll:)]) {
                [node performSelector:@selector(setCanScroll:) withObject:canScroll];
            }
        }
        
        if (props[@"canSwipe"] && [props[@"canSwipe"] isKindOfClass:[NSNumber class]]) {
            NSNumber *canSwipe = props[@"canSwipe"];
            if ([node respondsToSelector:@selector(setCanSwipe:)]) {
                [node performSelector:@selector(setCanSwipe:) withObject:canSwipe];
            }
        }
        
        if (props[@"canDrag"] && [props[@"canDrag"] isKindOfClass:[NSNumber class]]) {
            NSNumber *canDrag = props[@"canDrag"];
            if ([node respondsToSelector:@selector(setCanDrag:)]) {
                [node performSelector:@selector(setCanDrag:) withObject:canDrag];
            }
        }
        
        if (props[@"canFuse"] && [props[@"canFuse"] isKindOfClass:[NSNumber class]]) {
            NSNumber *canFuse = props[@"canFuse"];
            if ([node respondsToSelector:@selector(setCanFuse:)]) {
                [node performSelector:@selector(setCanFuse:) withObject:canFuse];
            }
        }
        
        if (props[@"canPinch"] && [props[@"canPinch"] isKindOfClass:[NSNumber class]]) {
            NSNumber *canPinch = props[@"canPinch"];
            if ([node respondsToSelector:@selector(setCanPinch:)]) {
                [node performSelector:@selector(setCanPinch:) withObject:canPinch];
            }
        }
        
        if (props[@"canRotate"] && [props[@"canRotate"] isKindOfClass:[NSNumber class]]) {
            NSNumber *canRotate = props[@"canRotate"];
            if ([node respondsToSelector:@selector(setCanRotate:)]) {
                [node performSelector:@selector(setCanRotate:) withObject:canRotate];
            }
        }
        
        if (props[@"timeToFuse"] && [props[@"timeToFuse"] isKindOfClass:[NSNumber class]]) {
            NSNumber *timeToFuse = props[@"timeToFuse"];
            if ([node respondsToSelector:@selector(setTimeToFuse:)]) {
                [node performSelector:@selector(setTimeToFuse:) withObject:timeToFuse];
            }
        }
        
        if (props[@"highAccuracyEvents"] && [props[@"highAccuracyEvents"] isKindOfClass:[NSNumber class]]) {
            NSNumber *highAccuracyEvents = props[@"highAccuracyEvents"];
            if ([node respondsToSelector:@selector(setHighAccuracyEvents:)]) {
                [node performSelector:@selector(setHighAccuracyEvents:) withObject:highAccuracyEvents];
            }
        }
        
        if (props[@"ignoreEventHandling"] && [props[@"ignoreEventHandling"] isKindOfClass:[NSNumber class]]) {
            NSNumber *ignoreEventHandling = props[@"ignoreEventHandling"];
            if ([node respondsToSelector:@selector(setIgnoreEventHandling:)]) {
                [node performSelector:@selector(setIgnoreEventHandling:) withObject:ignoreEventHandling];
            }
        }
        
        // Drag properties
        if (props[@"dragType"] && [props[@"dragType"] isKindOfClass:[NSString class]]) {
            NSString *dragType = props[@"dragType"];
            if ([node respondsToSelector:@selector(setDragType:)]) {
                [node performSelector:@selector(setDragType:) withObject:dragType];
            }
        }
        
        if (props[@"dragPlane"] && [props[@"dragPlane"] isKindOfClass:[NSDictionary class]]) {
            NSDictionary *dragPlane = props[@"dragPlane"];
            if ([node respondsToSelector:@selector(setDragPlane:)]) {
                [node performSelector:@selector(setDragPlane:) withObject:dragPlane];
            }
        }
        
        // Animation properties
        if (props[@"animation"] && [props[@"animation"] isKindOfClass:[NSDictionary class]]) {
            NSDictionary *animation = props[@"animation"];
            if ([node respondsToSelector:@selector(setAnimation:)]) {
                [node performSelector:@selector(setAnimation:) withObject:animation];
            }
        }
        
        // Material properties
        if (props[@"materials"] && [props[@"materials"] isKindOfClass:[NSArray class]]) {
            NSArray *materials = props[@"materials"];
            [self setNodeMaterials:node withMaterials:materials];
        }
        
        // Transform behaviors
        if (props[@"transformBehaviors"] && [props[@"transformBehaviors"] isKindOfClass:[NSArray class]]) {
            NSArray *transformBehaviors = props[@"transformBehaviors"];
            if ([node respondsToSelector:@selector(setTransformBehaviors:)]) {
                [node performSelector:@selector(setTransformBehaviors:) withObject:transformBehaviors];
            }
        }
        
        // Physics properties
        if (props[@"physicsBody"] && [props[@"physicsBody"] isKindOfClass:[NSDictionary class]]) {
            NSDictionary *physicsBody = props[@"physicsBody"];
            if ([node respondsToSelector:@selector(setPhysicsBody:)]) {
                [node performSelector:@selector(setPhysicsBody:) withObject:physicsBody];
            }
        }
        
        if (props[@"canCollide"] && [props[@"canCollide"] isKindOfClass:[NSNumber class]]) {
            NSNumber *canCollide = props[@"canCollide"];
            if ([node respondsToSelector:@selector(setCanCollide:)]) {
                [node performSelector:@selector(setCanCollide:) withObject:canCollide];
            }
        }
        
        // Viro tag
        if (props[@"viroTag"] && [props[@"viroTag"] isKindOfClass:[NSString class]]) {
            NSString *viroTag = props[@"viroTag"];
            if ([node respondsToSelector:@selector(setViroTag:)]) {
                [node performSelector:@selector(setViroTag:) withObject:viroTag];
            }
        }
        
        // Transform delegate
        if (props[@"hasTransformDelegate"] && [props[@"hasTransformDelegate"] isKindOfClass:[NSNumber class]]) {
            NSNumber *hasTransformDelegate = props[@"hasTransformDelegate"];
            if ([node respondsToSelector:@selector(setOnNativeTransformDelegate:)]) {
                [node performSelector:@selector(setOnNativeTransformDelegate:) withObject:hasTransformDelegate];
            }
        }
        
    } @catch (NSException *exception) {
        RCTLogError(@"Error setting node properties: %@", exception.reason);
    }
}

/**
 * Set materials on a VRT node using the MaterialManager.
 */
- (void)setNodeMaterials:(id)node withMaterials:(NSArray *)materials {
    if (!node || !materials) {
        return;
    }
    
    @try {
        // Get the material manager
        Class materialManagerClass = NSClassFromString(@"VRTMaterialManager");
        if (!materialManagerClass) {
            RCTLogError(@"VRTMaterialManager class not found");
            return;
        }
        
        id materialManager = [_bridge moduleForClass:materialManagerClass];
        if (!materialManager) {
            RCTLogError(@"VRTMaterialManager module not available");
            return;
        }
        
        // Convert material names to actual Material objects
        NSMutableArray *nativeMaterials = [NSMutableArray new];
        for (NSString *materialName in materials) {
            if (![materialName isKindOfClass:[NSString class]]) {
                continue;
            }
            
            // Get the material by name
            if ([materialManager respondsToSelector:@selector(getMaterialByName:)]) {
                id nativeMaterial = [materialManager performSelector:@selector(getMaterialByName:) withObject:materialName];
                
                if (nativeMaterial) {
                    [nativeMaterials addObject:nativeMaterial];
                } else {
                    RCTLogWarn(@"Material [%@] not found. Did you create it?", materialName);
                }
            }
        }
        
        // Set the materials on the node
        if ([node respondsToSelector:@selector(setMaterials:)]) {
            [node performSelector:@selector(setMaterials:) withObject:nativeMaterials];
        }
        
    } @catch (NSException *exception) {
        RCTLogError(@"Error setting node materials: %@", exception.reason);
    }
}

@end
