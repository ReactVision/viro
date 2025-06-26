//
//  ViroFabricJSI.mm
//  ViroReact
//
//  Created for ReactVision.
//  Copyright © 2025 ReactVision. All rights reserved.
//

#import "ViroFabricJSI.h"
#import "ViroFabricSceneManager.h"
#import "ViroFabricManager.h"
#import "ViroEventsTurboModule.h"
#import <React/RCTLog.h>
#import <React/RCTBridge+Private.h>
#import "../ViroReact/Views/VRTNode.h"
#import "../ViroReact/Views/VRTSphere.h"
#import "../ViroReact/Views/VRTText.h"
#import "../ViroReact/Views/VRTImage.h"
#import "../ViroReact/Views/VRTQuad.h"
#import "../ViroReact/Views/VRTLight.h"
#import "../ViroReact/Views/VRTSound.h"

using namespace facebook::jsi;

@interface ViroFabricJSI ()

@property (nonatomic, weak) RCTBridge *bridge;
@property (nonatomic, weak) ViroFabricSceneManager *sceneManager;
@property (nonatomic, weak) ViroFabricManager *fabricManager;

// Node registry for managing created nodes
@property (nonatomic, strong) NSMutableDictionary<NSString *, NSValue *> *nodeRegistry;

// Event callback registry
@property (nonatomic, strong) NSMutableDictionary<NSString *, NSValue *> *eventCallbacks;

// Material registry
@property (nonatomic, strong) NSMutableDictionary<NSString *, NSDictionary *> *materialRegistry;

// Animation registry
@property (nonatomic, strong) NSMutableDictionary<NSString *, NSDictionary *> *animationRegistry;

@end

@implementation ViroFabricJSI

- (instancetype)initWithBridge:(RCTBridge *)bridge {
    self = [super init];
    if (self) {
        _bridge = bridge;
        _nodeRegistry = [[NSMutableDictionary alloc] init];
        _eventCallbacks = [[NSMutableDictionary alloc] init];
        _materialRegistry = [[NSMutableDictionary alloc] init];
        _animationRegistry = [[NSMutableDictionary alloc] init];
    }
    return self;
}

- (void)setSceneManager:(ViroFabricSceneManager *)sceneManager {
    _sceneManager = sceneManager;
}

- (void)setFabricManager:(ViroFabricManager *)fabricManager {
    _fabricManager = fabricManager;
}

- (void)installJSIFunctions:(Runtime &)runtime {
    RCTLogInfo(@"[ViroFabricJSI] Installing JSI functions");
    
    // Create the NativeViro object to hold all our functions
    auto nativeViro = Object(runtime);
    
    // Node Management Functions
    [self installNodeManagementFunctions:runtime nativeViro:nativeViro];
    
    // Scene Management Functions
    [self installSceneManagementFunctions:runtime nativeViro:nativeViro];
    
    // Event Management Functions
    [self installEventManagementFunctions:runtime nativeViro:nativeViro];
    
    // Material Management Functions
    [self installMaterialManagementFunctions:runtime nativeViro:nativeViro];
    
    // Animation Management Functions
    [self installAnimationManagementFunctions:runtime nativeViro:nativeViro];
    
    // Memory Management Functions
    [self installMemoryManagementFunctions:runtime nativeViro:nativeViro];
    
    // Utility Functions
    [self installUtilityFunctions:runtime nativeViro:nativeViro];
    
    // Attach the NativeViro object to global scope
    runtime.global().setProperty(runtime, "NativeViro", std::move(nativeViro));
    
    RCTLogInfo(@"[ViroFabricJSI] All JSI functions installed successfully under global.NativeViro");
}

#pragma mark - Node Management Functions

- (void)installNodeManagementFunctions:(Runtime &)runtime nativeViro:(Object &)nativeViro {
    // generateNodeId
    auto generateNodeId = Function::createFromHostFunction(
        runtime,
        PropNameID::forAscii(runtime, "generateNodeId"),
        0,
        [](Runtime &runtime, const Value &thisValue, const Value *arguments, size_t count) -> Value {
            NSString *nodeId = [NSString stringWithFormat:@"viro_node_%@", [[NSUUID UUID] UUIDString]];
            return String::createFromUtf8(runtime, [nodeId UTF8String]);
        }
    );
    nativeViro.setProperty(runtime, "generateNodeId", generateNodeId);
    
    // generateCallbackId
    auto generateCallbackId = Function::createFromHostFunction(
        runtime,
        PropNameID::forAscii(runtime, "generateCallbackId"),
        0,
        [](Runtime &runtime, const Value &thisValue, const Value *arguments, size_t count) -> Value {
            NSString *callbackId = [NSString stringWithFormat:@"viro_callback_%@", [[NSUUID UUID] UUIDString]];
            return String::createFromUtf8(runtime, [callbackId UTF8String]);
        }
    );
    nativeViro.setProperty(runtime, "generateCallbackId", generateCallbackId);
    
    // createViroNode - renamed to match JavaScript expectations
    auto createViroNode = Function::createFromHostFunction(
        runtime,
        PropNameID::forAscii(runtime, "createViroNode"),
        3,
        [self](Runtime &runtime, const Value &thisValue, const Value *arguments, size_t count) -> Value {
            if (count < 3) return Value::undefined();
            
            std::string nodeIdStr = arguments[0].getString(runtime).utf8(runtime);
            std::string nodeTypeStr = arguments[1].getString(runtime).utf8(runtime);
            Object propsObj = arguments[2].getObject(runtime);
            
            NSString *nodeId = [NSString stringWithUTF8String:nodeIdStr.c_str()];
            NSString *nodeType = [NSString stringWithUTF8String:nodeTypeStr.c_str()];
            NSDictionary *props = [self convertJSObjectToNSDictionary:propsObj runtime:runtime];
            
            return [self createNativeNode:nodeId nodeType:nodeType props:props] ? Value(true) : Value(false);
        }
    );
    nativeViro.setProperty(runtime, "createViroNode", createViroNode);
    
    // updateViroNode - renamed to match JavaScript expectations
    auto updateViroNode = Function::createFromHostFunction(
        runtime,
        PropNameID::forAscii(runtime, "updateViroNode"),
        2,
        [self](Runtime &runtime, const Value &thisValue, const Value *arguments, size_t count) -> Value {
            if (count < 2) return Value::undefined();
            
            std::string nodeIdStr = arguments[0].getString(runtime).utf8(runtime);
            Object propsObj = arguments[1].getObject(runtime);
            
            NSString *nodeId = [NSString stringWithUTF8String:nodeIdStr.c_str()];
            NSDictionary *props = [self convertJSObjectToNSDictionary:propsObj runtime:runtime];
            
            return [self updateNativeNode:nodeId props:props] ? Value(true) : Value(false);
        }
    );
    nativeViro.setProperty(runtime, "updateViroNode", updateViroNode);
    
    // deleteViroNode - renamed to match JavaScript expectations
    auto deleteViroNode = Function::createFromHostFunction(
        runtime,
        PropNameID::forAscii(runtime, "deleteViroNode"),
        1,
        [self](Runtime &runtime, const Value &thisValue, const Value *arguments, size_t count) -> Value {
            if (count < 1) return Value::undefined();
            
            std::string nodeIdStr = arguments[0].getString(runtime).utf8(runtime);
            NSString *nodeId = [NSString stringWithUTF8String:nodeIdStr.c_str()];
            
            return [self deleteNativeNode:nodeId] ? Value(true) : Value(false);
        }
    );
    nativeViro.setProperty(runtime, "deleteViroNode", deleteViroNode);
    
    // addViroNodeChild - renamed to match JavaScript expectations
    auto addViroNodeChild = Function::createFromHostFunction(
        runtime,
        PropNameID::forAscii(runtime, "addViroNodeChild"),
        2,
        [self](Runtime &runtime, const Value &thisValue, const Value *arguments, size_t count) -> Value {
            if (count < 2) return Value::undefined();
            
            std::string parentIdStr = arguments[0].getString(runtime).utf8(runtime);
            std::string childIdStr = arguments[1].getString(runtime).utf8(runtime);
            
            NSString *parentId = [NSString stringWithUTF8String:parentIdStr.c_str()];
            NSString *childId = [NSString stringWithUTF8String:childIdStr.c_str()];
            
            return [self addChildNode:parentId childId:childId] ? Value(true) : Value(false);
        }
    );
    nativeViro.setProperty(runtime, "addViroNodeChild", addViroNodeChild);
    
    // removeViroNodeChild - renamed to match JavaScript expectations
    auto removeViroNodeChild = Function::createFromHostFunction(
        runtime,
        PropNameID::forAscii(runtime, "removeViroNodeChild"),
        2,
        [self](Runtime &runtime, const Value &thisValue, const Value *arguments, size_t count) -> Value {
            if (count < 2) return Value::undefined();
            
            std::string parentIdStr = arguments[0].getString(runtime).utf8(runtime);
            std::string childIdStr = arguments[1].getString(runtime).utf8(runtime);
            
            NSString *parentId = [NSString stringWithUTF8String:parentIdStr.c_str()];
            NSString *childId = [NSString stringWithUTF8String:childIdStr.c_str()];
            
            return [self removeChildNode:parentId childId:childId] ? Value(true) : Value(false);
        }
    );
    nativeViro.setProperty(runtime, "removeViroNodeChild", removeViroNodeChild);
}

#pragma mark - Scene Management Functions

- (void)installSceneManagementFunctions:(Runtime &)runtime nativeViro:(Object &)nativeViro {
    // createViroScene - renamed to match JavaScript expectations
    auto createViroScene = Function::createFromHostFunction(
        runtime,
        PropNameID::forAscii(runtime, "createViroScene"),
        3,
        [self](Runtime &runtime, const Value &thisValue, const Value *arguments, size_t count) -> Value {
            if (count < 3) return Value::undefined();
            
            std::string sceneIdStr = arguments[0].getString(runtime).utf8(runtime);
            std::string sceneTypeStr = arguments[1].getString(runtime).utf8(runtime);
            Object propsObj = arguments[2].getObject(runtime);
            
            NSString *sceneId = [NSString stringWithUTF8String:sceneIdStr.c_str()];
            NSString *sceneType = [NSString stringWithUTF8String:sceneTypeStr.c_str()];
            NSDictionary *props = [self convertJSObjectToNSDictionary:propsObj runtime:runtime];
            
            id scene = [self.sceneManager createScene:sceneId sceneType:sceneType props:props];
            return scene ? Value(true) : Value(false);
        }
    );
    nativeViro.setProperty(runtime, "createViroScene", createViroScene);
    
    // activateViroScene - renamed to match JavaScript expectations
    auto activateViroScene = Function::createFromHostFunction(
        runtime,
        PropNameID::forAscii(runtime, "activateViroScene"),
        1,
        [self](Runtime &runtime, const Value &thisValue, const Value *arguments, size_t count) -> Value {
            if (count < 1) return Value::undefined();
            
            std::string sceneIdStr = arguments[0].getString(runtime).utf8(runtime);
            NSString *sceneId = [NSString stringWithUTF8String:sceneIdStr.c_str()];
            
            return [self.sceneManager activateScene:sceneId] ? Value(true) : Value(false);
        }
    );
    nativeViro.setProperty(runtime, "activateViroScene", activateViroScene);
    
    // deactivateViroScene - added missing function
    auto deactivateViroScene = Function::createFromHostFunction(
        runtime,
        PropNameID::forAscii(runtime, "deactivateViroScene"),
        1,
        [self](Runtime &runtime, const Value &thisValue, const Value *arguments, size_t count) -> Value {
            if (count < 1) return Value::undefined();
            
            std::string sceneIdStr = arguments[0].getString(runtime).utf8(runtime);
            NSString *sceneId = [NSString stringWithUTF8String:sceneIdStr.c_str()];
            
            return [self.sceneManager deactivateScene:sceneId] ? Value(true) : Value(false);
        }
    );
    nativeViro.setProperty(runtime, "deactivateViroScene", deactivateViroScene);
    
    // destroyViroScene - renamed to match JavaScript expectations
    auto destroyViroScene = Function::createFromHostFunction(
        runtime,
        PropNameID::forAscii(runtime, "destroyViroScene"),
        1,
        [self](Runtime &runtime, const Value &thisValue, const Value *arguments, size_t count) -> Value {
            if (count < 1) return Value::undefined();
            
            std::string sceneIdStr = arguments[0].getString(runtime).utf8(runtime);
            NSString *sceneId = [NSString stringWithUTF8String:sceneIdStr.c_str()];
            
            return [self.sceneManager destroyScene:sceneId] ? Value(true) : Value(false);
        }
    );
    nativeViro.setProperty(runtime, "destroyViroScene", destroyViroScene);
    
    // getViroSceneState - added missing function
    auto getViroSceneState = Function::createFromHostFunction(
        runtime,
        PropNameID::forAscii(runtime, "getViroSceneState"),
        1,
        [self](Runtime &runtime, const Value &thisValue, const Value *arguments, size_t count) -> Value {
            if (count < 1) return Value::null();
            
            std::string sceneIdStr = arguments[0].getString(runtime).utf8(runtime);
            NSString *sceneId = [NSString stringWithUTF8String:sceneIdStr.c_str()];
            
            ViroFabricSceneState state = [self.sceneManager getSceneState:sceneId];
            switch (state) {
                case ViroFabricSceneStateCreated:
                    return String::createFromUtf8(runtime, "created");
                case ViroFabricSceneStateLoading:
                    return String::createFromUtf8(runtime, "loading");
                case ViroFabricSceneStateLoaded:
                    return String::createFromUtf8(runtime, "loaded");
                case ViroFabricSceneStateActive:
                    return String::createFromUtf8(runtime, "active");
                case ViroFabricSceneStatePaused:
                    return String::createFromUtf8(runtime, "paused");
                case ViroFabricSceneStateDestroyed:
                    return String::createFromUtf8(runtime, "destroyed");
                default:
                    return String::createFromUtf8(runtime, "unknown");
            }
        }
    );
    nativeViro.setProperty(runtime, "getViroSceneState", getViroSceneState);
}

#pragma mark - Event Management Functions

- (void)installEventManagementFunctions:(Runtime &)runtime nativeViro:(Object &)nativeViro {
    // registerEventCallback - renamed to match JavaScript expectations
    auto registerEventCallback = Function::createFromHostFunction(
        runtime,
        PropNameID::forAscii(runtime, "registerEventCallback"),
        3,
        [self](Runtime &runtime, const Value &thisValue, const Value *arguments, size_t count) -> Value {
            if (count < 3) return Value::undefined();
            
            std::string nodeIdStr = arguments[0].getString(runtime).utf8(runtime);
            std::string eventNameStr = arguments[1].getString(runtime).utf8(runtime);
            std::string callbackIdStr = arguments[2].getString(runtime).utf8(runtime);
            
            NSString *nodeId = [NSString stringWithUTF8String:nodeIdStr.c_str()];
            NSString *eventName = [NSString stringWithUTF8String:eventNameStr.c_str()];
            NSString *callbackId = [NSString stringWithUTF8String:callbackIdStr.c_str()];
            
            // Register with native node using callback ID (no function storage needed)
            [self registerNativeEventListener:nodeId eventName:eventName callbackId:callbackId];
            
            return Value(true);
        }
    );
    nativeViro.setProperty(runtime, "registerEventCallback", registerEventCallback);
    
    // unregisterEventCallback - renamed to match JavaScript expectations
    auto unregisterEventCallback = Function::createFromHostFunction(
        runtime,
        PropNameID::forAscii(runtime, "unregisterEventCallback"),
        3,
        [self](Runtime &runtime, const Value &thisValue, const Value *arguments, size_t count) -> Value {
            if (count < 3) return Value::undefined();
            
            std::string nodeIdStr = arguments[0].getString(runtime).utf8(runtime);
            std::string eventNameStr = arguments[1].getString(runtime).utf8(runtime);
            std::string callbackIdStr = arguments[2].getString(runtime).utf8(runtime);
            
            NSString *nodeId = [NSString stringWithUTF8String:nodeIdStr.c_str()];
            NSString *eventName = [NSString stringWithUTF8String:eventNameStr.c_str()];
            NSString *callbackId = [NSString stringWithUTF8String:callbackIdStr.c_str()];
            
            // Remove callback from registry if it exists
            [self.eventCallbacks removeObjectForKey:callbackId];
            
            // Unregister from native node
            [self unregisterNativeEventListener:nodeId eventName:eventName callbackId:callbackId];
            
            return Value(true);
        }
    );
    nativeViro.setProperty(runtime, "unregisterEventCallback", unregisterEventCallback);
}

#pragma mark - Material Management Functions

- (void)installMaterialManagementFunctions:(Runtime &)runtime nativeViro:(Object &)nativeViro {
    // createViroMaterial - renamed to match JavaScript expectations
    auto createViroMaterial = Function::createFromHostFunction(
        runtime,
        PropNameID::forAscii(runtime, "createViroMaterial"),
        2,
        [self](Runtime &runtime, const Value &thisValue, const Value *arguments, size_t count) -> Value {
            if (count < 2) return Value::undefined();
            
            std::string materialIdStr = arguments[0].getString(runtime).utf8(runtime);
            Object propsObj = arguments[1].getObject(runtime);
            
            NSString *materialId = [NSString stringWithUTF8String:materialIdStr.c_str()];
            NSDictionary *props = [self convertJSObjectToNSDictionary:propsObj runtime:runtime];
            
            // Store material in registry
            self.materialRegistry[materialId] = props;
            
            return Value(true);
        }
    );
    nativeViro.setProperty(runtime, "createViroMaterial", createViroMaterial);
    
    // updateViroMaterial - renamed to match JavaScript expectations
    auto updateViroMaterial = Function::createFromHostFunction(
        runtime,
        PropNameID::forAscii(runtime, "updateViroMaterial"),
        2,
        [self](Runtime &runtime, const Value &thisValue, const Value *arguments, size_t count) -> Value {
            if (count < 2) return Value::undefined();
            
            std::string materialIdStr = arguments[0].getString(runtime).utf8(runtime);
            Object propsObj = arguments[1].getObject(runtime);
            
            NSString *materialId = [NSString stringWithUTF8String:materialIdStr.c_str()];
            NSDictionary *props = [self convertJSObjectToNSDictionary:propsObj runtime:runtime];
            
            // Update material in registry
            NSMutableDictionary *existingProps = [self.materialRegistry[materialId] mutableCopy];
            if (existingProps) {
                [existingProps addEntriesFromDictionary:props];
                self.materialRegistry[materialId] = [existingProps copy];
            } else {
                self.materialRegistry[materialId] = props;
            }
            
            return Value(true);
        }
    );
    nativeViro.setProperty(runtime, "updateViroMaterial", updateViroMaterial);
}

#pragma mark - Animation Management Functions

- (void)installAnimationManagementFunctions:(Runtime &)runtime nativeViro:(Object &)nativeViro {
    // createViroAnimation - renamed to match JavaScript expectations
    auto createViroAnimation = Function::createFromHostFunction(
        runtime,
        PropNameID::forAscii(runtime, "createViroAnimation"),
        2,
        [self](Runtime &runtime, const Value &thisValue, const Value *arguments, size_t count) -> Value {
            if (count < 2) return Value::undefined();
            
            std::string animationIdStr = arguments[0].getString(runtime).utf8(runtime);
            Object propsObj = arguments[1].getObject(runtime);
            
            NSString *animationId = [NSString stringWithUTF8String:animationIdStr.c_str()];
            NSDictionary *props = [self convertJSObjectToNSDictionary:propsObj runtime:runtime];
            
            // Store animation in registry
            self.animationRegistry[animationId] = props;
            
            return Value(true);
        }
    );
    nativeViro.setProperty(runtime, "createViroAnimation", createViroAnimation);
    
    // executeViroAnimation - renamed to match JavaScript expectations
    auto executeViroAnimation = Function::createFromHostFunction(
        runtime,
        PropNameID::forAscii(runtime, "executeViroAnimation"),
        3,
        [self](Runtime &runtime, const Value &thisValue, const Value *arguments, size_t count) -> Value {
            if (count < 3) return Value::undefined();
            
            std::string nodeIdStr = arguments[0].getString(runtime).utf8(runtime);
            std::string animationIdStr = arguments[1].getString(runtime).utf8(runtime);
            Object optionsObj = arguments[2].getObject(runtime);
            
            NSString *nodeId = [NSString stringWithUTF8String:nodeIdStr.c_str()];
            NSString *animationId = [NSString stringWithUTF8String:animationIdStr.c_str()];
            NSDictionary *options = [self convertJSObjectToNSDictionary:optionsObj runtime:runtime];
            
            return [self executeNativeAnimation:nodeId animationId:animationId options:options] ? Value(true) : Value(false);
        }
    );
    nativeViro.setProperty(runtime, "executeViroAnimation", executeViroAnimation);
}

#pragma mark - Memory Management Functions

- (void)installMemoryManagementFunctions:(Runtime &)runtime nativeViro:(Object &)nativeViro {
    // getViroMemoryStats - renamed to match JavaScript expectations
    auto getViroMemoryStats = Function::createFromHostFunction(
        runtime,
        PropNameID::forAscii(runtime, "getViroMemoryStats"),
        0,
        [self](Runtime &runtime, const Value &thisValue, const Value *arguments, size_t count) -> Value {
            NSDictionary *stats = [self.sceneManager getMemoryStats];
            return [self convertNSDictionaryToJSObject:stats runtime:runtime];
        }
    );
    nativeViro.setProperty(runtime, "getViroMemoryStats", getViroMemoryStats);
    
    // performViroMemoryCleanup - renamed to match JavaScript expectations
    auto performViroMemoryCleanup = Function::createFromHostFunction(
        runtime,
        PropNameID::forAscii(runtime, "performViroMemoryCleanup"),
        0,
        [self](Runtime &runtime, const Value &thisValue, const Value *arguments, size_t count) -> Value {
            [self.sceneManager performMemoryCleanup];
            return Value(true);
        }
    );
    nativeViro.setProperty(runtime, "performViroMemoryCleanup", performViroMemoryCleanup);
}

#pragma mark - Utility Functions

- (void)installUtilityFunctions:(Runtime &)runtime nativeViro:(Object &)nativeViro {
    // initialize - initialize Viro with optional configuration
    auto initialize = Function::createFromHostFunction(
        runtime,
        PropNameID::forAscii(runtime, "initialize"),
        1,  // Optional config parameter
        [self](Runtime &runtime, const Value &thisValue, const Value *arguments, size_t count) -> Value {
            // Parse configuration options (optional)
            bool debug = false;
            bool arEnabled = false;
            std::string worldAlignment = "Gravity";
            
            if (count > 0 && arguments[0].isObject()) {
                auto config = arguments[0].getObject(runtime);
                
                if (config.hasProperty(runtime, "debug")) {
                    debug = config.getProperty(runtime, "debug").getBool();
                }
                if (config.hasProperty(runtime, "arEnabled")) {
                    arEnabled = config.getProperty(runtime, "arEnabled").getBool();
                }
                if (config.hasProperty(runtime, "worldAlignment")) {
                    worldAlignment = config.getProperty(runtime, "worldAlignment").getString(runtime).utf8(runtime);
                }
            }
            
            // Apply initialization with configuration if scene manager is available
            if (self.sceneManager) {
                NSDictionary *configDict = @{
                    @"debug": @(debug),
                    @"arEnabled": @(arEnabled),
                    @"worldAlignment": [NSString stringWithUTF8String:worldAlignment.c_str()]
                };
                
                [self.sceneManager initializeWithConfig:configDict];
                RCTLogInfo(@"[ViroFabricJSI] Viro initialized with config: debug=%@, arEnabled=%@, worldAlignment=%@", 
                          @(debug), @(arEnabled), [NSString stringWithUTF8String:worldAlignment.c_str()]);
            } else {
                RCTLogInfo(@"[ViroFabricJSI] Viro initialization called (scene manager not available)");
            }
            
            // Return a resolved promise
            auto promiseConstructor = runtime.global().getPropertyAsObject(runtime, "Promise");
            auto resolveMethod = promiseConstructor.getPropertyAsFunction(runtime, "resolve");
            return resolveMethod.callWithThis(runtime, promiseConstructor, Value(true));
        }
    );
    nativeViro.setProperty(runtime, "initialize", initialize);
    
    // setViroARPlaneDetection - configure AR plane detection
    auto setViroARPlaneDetection = Function::createFromHostFunction(
        runtime,
        PropNameID::forAscii(runtime, "setViroARPlaneDetection"),
        1,
        [self](Runtime &runtime, const Value &thisValue, const Value *arguments, size_t count) -> Value {
            if (count < 1) return Value::undefined();
            
            if (!arguments[0].isObject()) {
                RCTLogWarn(@"[ViroFabricJSI] setViroARPlaneDetection requires an object parameter");
                return Value(false);
            }
            
            auto config = arguments[0].getObject(runtime);
            
            // Parse configuration options
            bool enabled = true;
            bool horizontal = true;
            bool vertical = false;
            std::string alignment = "Gravity";
            
            if (config.hasProperty(runtime, "enabled")) {
                enabled = config.getProperty(runtime, "enabled").getBool();
            }
            if (config.hasProperty(runtime, "horizontal")) {
                horizontal = config.getProperty(runtime, "horizontal").getBool();
            }
            if (config.hasProperty(runtime, "vertical")) {
                vertical = config.getProperty(runtime, "vertical").getBool();
            }
            if (config.hasProperty(runtime, "alignment")) {
                alignment = config.getProperty(runtime, "alignment").getString(runtime).utf8(runtime);
            }
            
            // Call the scene manager to configure AR plane detection
            if (self.sceneManager) {
                NSDictionary *configDict = @{
                    @"enabled": @(enabled),
                    @"horizontal": @(horizontal),
                    @"vertical": @(vertical),
                    @"alignment": [NSString stringWithUTF8String:alignment.c_str()]
                };
                
                [self.sceneManager configureARPlaneDetection:configDict];
                RCTLogInfo(@"[ViroFabricJSI] AR plane detection configured: enabled=%@, horizontal=%@, vertical=%@, alignment=%@", 
                          @(enabled), @(horizontal), @(vertical), [NSString stringWithUTF8String:alignment.c_str()]);
                return Value(true);
            } else {
                RCTLogWarn(@"[ViroFabricJSI] Scene manager not available for AR plane detection");
                return Value(false);
            }
        }
    );
    nativeViro.setProperty(runtime, "setViroARPlaneDetection", setViroARPlaneDetection);
    
    // setViroARImageTargets - configure AR image targets
    auto setViroARImageTargets = Function::createFromHostFunction(
        runtime,
        PropNameID::forAscii(runtime, "setViroARImageTargets"),
        1,
        [self](Runtime &runtime, const Value &thisValue, const Value *arguments, size_t count) -> Value {
            if (count < 1) return Value::undefined();
            
            if (!arguments[0].isObject()) {
                RCTLogWarn(@"[ViroFabricJSI] setViroARImageTargets requires an object parameter");
                return Value(false);
            }
            
            auto targets = arguments[0].getObject(runtime);
            
            // Convert JSI object to NSDictionary
            NSMutableDictionary *targetDict = [NSMutableDictionary dictionary];
            
            auto propertyNames = targets.getPropertyNames(runtime);
            for (size_t i = 0; i < propertyNames.size(runtime); i++) {
                auto propName = propertyNames.getValueAtIndex(runtime, i).getString(runtime);
                auto propValue = targets.getProperty(runtime, propName);
                
                NSString *key = [NSString stringWithUTF8String:propName.utf8(runtime).c_str()];
                
                if (propValue.isObject()) {
                    auto targetObj = propValue.getObject(runtime);
                    NSMutableDictionary *targetInfo = [NSMutableDictionary dictionary];
                    
                    // Extract common AR image target properties
                    if (targetObj.hasProperty(runtime, "source")) {
                        auto source = targetObj.getProperty(runtime, "source");
                        if (source.isString()) {
                            targetInfo[@"source"] = [NSString stringWithUTF8String:source.getString(runtime).utf8(runtime).c_str()];
                        }
                    }
                    if (targetObj.hasProperty(runtime, "orientation")) {
                        auto orientation = targetObj.getProperty(runtime, "orientation");
                        if (orientation.isString()) {
                            targetInfo[@"orientation"] = [NSString stringWithUTF8String:orientation.getString(runtime).utf8(runtime).c_str()];
                        }
                    }
                    if (targetObj.hasProperty(runtime, "physicalWidth")) {
                        auto physicalWidth = targetObj.getProperty(runtime, "physicalWidth");
                        if (physicalWidth.isNumber()) {
                            targetInfo[@"physicalWidth"] = @(physicalWidth.getNumber());
                        }
                    }
                    
                    targetDict[key] = targetInfo;
                }
            }
            
            // Call the scene manager to configure AR image targets
            if (self.sceneManager) {
                [self.sceneManager configureARImageTargets:targetDict];
                RCTLogInfo(@"[ViroFabricJSI] AR image targets configured with %lu targets", (unsigned long)targetDict.count);
                return Value(true);
            } else {
                RCTLogWarn(@"[ViroFabricJSI] Scene manager not available for AR image targets");
                return Value(false);
            }
        }
    );
    nativeViro.setProperty(runtime, "setViroARImageTargets", setViroARImageTargets);
    
    // AR Utility Functions
    // recenterTracking - recenter AR tracking for a given node
    auto recenterTracking = Function::createFromHostFunction(
        runtime,
        PropNameID::forAscii(runtime, "recenterTracking"),
        1,
        [self](Runtime &runtime, const Value &thisValue, const Value *arguments, size_t count) -> Value {
            if (count < 1) return Value::undefined();
            
            NSString *nodeId = [NSString stringWithUTF8String:arguments[0].getString(runtime).utf8(runtime).c_str()];
            
            // Call the scene manager to recenter tracking
            if (self.sceneManager) {
                [self.sceneManager recenterTrackingForNode:nodeId];
                RCTLogInfo(@"[ViroFabricJSI] Recentered tracking for node: %@", nodeId);
            } else {
                RCTLogWarn(@"[ViroFabricJSI] Scene manager not available for recenterTracking");
            }
            
            return Value::undefined();
        }
    );
    nativeViro.setProperty(runtime, "recenterTracking", recenterTracking);
    
    // project - convert 3D world coordinates to 2D screen coordinates
    auto project = Function::createFromHostFunction(
        runtime,
        PropNameID::forAscii(runtime, "project"),
        2,
        [self](Runtime &runtime, const Value &thisValue, const Value *arguments, size_t count) -> Value {
            if (count < 2) {
                auto promiseConstructor = runtime.global().getPropertyAsObject(runtime, "Promise");
                auto rejectMethod = promiseConstructor.getPropertyAsFunction(runtime, "reject");
                auto error = Object(runtime);
                error.setProperty(runtime, "message", String::createFromUtf8(runtime, "project requires 2 arguments: nodeId and point"));
                return rejectMethod.callWithThis(runtime, promiseConstructor, error);
            }
            
            NSString *nodeId = [NSString stringWithUTF8String:arguments[0].getString(runtime).utf8(runtime).c_str()];
            
            // Parse the 3D point array
            auto pointArray = arguments[1].getObject(runtime).getArray(runtime);
            if (pointArray.size(runtime) < 3) {
                auto promiseConstructor = runtime.global().getPropertyAsObject(runtime, "Promise");
                auto rejectMethod = promiseConstructor.getPropertyAsFunction(runtime, "reject");
                auto error = Object(runtime);
                error.setProperty(runtime, "message", String::createFromUtf8(runtime, "point must be a 3-element array [x, y, z]"));
                return rejectMethod.callWithThis(runtime, promiseConstructor, error);
            }
            
            float x = pointArray.getValueAtIndex(runtime, 0).getNumber();
            float y = pointArray.getValueAtIndex(runtime, 1).getNumber();
            float z = pointArray.getValueAtIndex(runtime, 2).getNumber();
            
            // Call the scene manager to project the point
            if (self.sceneManager) {
                [self.sceneManager projectPoint:@[@(x), @(y), @(z)] 
                                         forNode:nodeId 
                                      completion:^(NSArray *screenPoint) {
                    dispatch_async(dispatch_get_main_queue(), ^{
                        // Create a resolved promise with the screen coordinates
                        auto promiseConstructor = runtime.global().getPropertyAsObject(runtime, "Promise");
                        auto resolveMethod = promiseConstructor.getPropertyAsFunction(runtime, "resolve");
                        
                        auto resultArray = Array(runtime, 3);
                        resultArray.setValueAtIndex(runtime, 0, Value([screenPoint[0] doubleValue]));
                        resultArray.setValueAtIndex(runtime, 1, Value([screenPoint[1] doubleValue]));
                        resultArray.setValueAtIndex(runtime, 2, Value([screenPoint[2] doubleValue]));
                        
                        resolveMethod.callWithThis(runtime, promiseConstructor, resultArray);
                    });
                }];
                
                // Return a pending promise (will be resolved in the completion block)
                auto promiseConstructor = runtime.global().getPropertyAsObject(runtime, "Promise");
                return promiseConstructor.callAsConstructor(runtime, 
                    Function::createFromHostFunction(runtime, PropNameID::forAscii(runtime, ""), 2,
                        [](Runtime &rt, const Value &thisVal, const Value *args, size_t count) -> Value {
                            // This executor will be called, but we handle resolution in the completion block
                            return Value::undefined();
                        }
                    )
                );
            } else {
                auto promiseConstructor = runtime.global().getPropertyAsObject(runtime, "Promise");
                auto rejectMethod = promiseConstructor.getPropertyAsFunction(runtime, "reject");
                auto error = Object(runtime);
                error.setProperty(runtime, "message", String::createFromUtf8(runtime, "Scene manager not available"));
                return rejectMethod.callWithThis(runtime, promiseConstructor, error);
            }
        }
    );
    nativeViro.setProperty(runtime, "project", project);
    
    // unproject - convert 2D screen coordinates to 3D world coordinates
    auto unproject = Function::createFromHostFunction(
        runtime,
        PropNameID::forAscii(runtime, "unproject"),
        2,
        [self](Runtime &runtime, const Value &thisValue, const Value *arguments, size_t count) -> Value {
            if (count < 2) {
                auto promiseConstructor = runtime.global().getPropertyAsObject(runtime, "Promise");
                auto rejectMethod = promiseConstructor.getPropertyAsFunction(runtime, "reject");
                auto error = Object(runtime);
                error.setProperty(runtime, "message", String::createFromUtf8(runtime, "unproject requires 2 arguments: nodeId and point"));
                return rejectMethod.callWithThis(runtime, promiseConstructor, error);
            }
            
            NSString *nodeId = [NSString stringWithUTF8String:arguments[0].getString(runtime).utf8(runtime).c_str()];
            
            // Parse the 2D/3D point array
            auto pointArray = arguments[1].getObject(runtime).getArray(runtime);
            if (pointArray.size(runtime) < 2) {
                auto promiseConstructor = runtime.global().getPropertyAsObject(runtime, "Promise");
                auto rejectMethod = promiseConstructor.getPropertyAsFunction(runtime, "reject");
                auto error = Object(runtime);
                error.setProperty(runtime, "message", String::createFromUtf8(runtime, "point must be at least a 2-element array [x, y] or [x, y, z]"));
                return rejectMethod.callWithThis(runtime, promiseConstructor, error);
            }
            
            float x = pointArray.getValueAtIndex(runtime, 0).getNumber();
            float y = pointArray.getValueAtIndex(runtime, 1).getNumber();
            float z = pointArray.size(runtime) > 2 ? pointArray.getValueAtIndex(runtime, 2).getNumber() : 0.0f;
            
            // Call the scene manager to unproject the point
            if (self.sceneManager) {
                [self.sceneManager unprojectPoint:@[@(x), @(y), @(z)] 
                                           forNode:nodeId 
                                        completion:^(NSArray *worldPoint) {
                    dispatch_async(dispatch_get_main_queue(), ^{
                        // Create a resolved promise with the world coordinates
                        auto promiseConstructor = runtime.global().getPropertyAsObject(runtime, "Promise");
                        auto resolveMethod = promiseConstructor.getPropertyAsFunction(runtime, "resolve");
                        
                        auto resultArray = Array(runtime, 3);
                        resultArray.setValueAtIndex(runtime, 0, Value([worldPoint[0] doubleValue]));
                        resultArray.setValueAtIndex(runtime, 1, Value([worldPoint[1] doubleValue]));
                        resultArray.setValueAtIndex(runtime, 2, Value([worldPoint[2] doubleValue]));
                        
                        resolveMethod.callWithThis(runtime, promiseConstructor, resultArray);
                    });
                }];
                
                // Return a pending promise (will be resolved in the completion block)
                auto promiseConstructor = runtime.global().getPropertyAsObject(runtime, "Promise");
                return promiseConstructor.callAsConstructor(runtime, 
                    Function::createFromHostFunction(runtime, PropNameID::forAscii(runtime, ""), 2,
                        [](Runtime &rt, const Value &thisVal, const Value *args, size_t count) -> Value {
                            // This executor will be called, but we handle resolution in the completion block
                            return Value::undefined();
                        }
                    )
                );
            } else {
                auto promiseConstructor = runtime.global().getPropertyAsObject(runtime, "Promise");
                auto rejectMethod = promiseConstructor.getPropertyAsFunction(runtime, "reject");
                auto error = Object(runtime);
                error.setProperty(runtime, "message", String::createFromUtf8(runtime, "Scene manager not available"));
                return rejectMethod.callWithThis(runtime, promiseConstructor, error);
            }
        }
    );
    nativeViro.setProperty(runtime, "unproject", unproject);
}

#pragma mark - Native Implementation Methods

- (BOOL)createNativeNode:(NSString *)nodeId nodeType:(NSString *)nodeType props:(NSDictionary *)props {
    @try {
        Class nodeClass = [self getNodeClassForType:nodeType];
        if (!nodeClass) {
            RCTLogError(@"[ViroFabricJSI] Unknown node type: %@", nodeType);
            return NO;
        }
        
        // Create the node instance
        id node = [[nodeClass alloc] initWithBridge:self.bridge];
        if (!node) {
            RCTLogError(@"[ViroFabricJSI] Failed to create node of type: %@", nodeType);
            return NO;
        }
        
        // Set properties
        [self applyPropsToNode:node props:props];
        
        // Register the node
        NSValue *nodeValue = [NSValue valueWithNonretainedObject:node];
        self.nodeRegistry[nodeId] = nodeValue;
        
        // Register with scene manager for memory management
        [self.sceneManager registerManagedNode:node];
        
        RCTLogInfo(@"[ViroFabricJSI] Created node %@ of type %@", nodeId, nodeType);
        return YES;
        
    } @catch (NSException *exception) {
        RCTLogError(@"[ViroFabricJSI] Error creating node %@: %@", nodeId, exception.reason);
        return NO;
    }
}

- (BOOL)updateNativeNode:(NSString *)nodeId props:(NSDictionary *)props {
    @try {
        NSValue *nodeValue = self.nodeRegistry[nodeId];
        if (!nodeValue) {
            RCTLogError(@"[ViroFabricJSI] Node not found for update: %@", nodeId);
            return NO;
        }
        
        __weak id node = [nodeValue nonretainedObjectValue];
        if (!node) {
            RCTLogError(@"[ViroFabricJSI] Node reference is nil: %@", nodeId);
            [self.nodeRegistry removeObjectForKey:nodeId];
            return NO;
        }
        
        [self applyPropsToNode:node props:props];
        
        RCTLogInfo(@"[ViroFabricJSI] Updated node %@", nodeId);
        return YES;
        
    } @catch (NSException *exception) {
        RCTLogError(@"[ViroFabricJSI] Error updating node %@: %@", nodeId, exception.reason);
        return NO;
    }
}

- (BOOL)deleteNativeNode:(NSString *)nodeId {
    @try {
        NSValue *nodeValue = self.nodeRegistry[nodeId];
        if (!nodeValue) {
            RCTLogWarn(@"[ViroFabricJSI] Node not found for deletion: %@", nodeId);
            return NO;
        }
        
        __weak id node = [nodeValue nonretainedObjectValue];
        if (node) {
            // Remove from parent if it has one
            if ([node respondsToSelector:@selector(removeFromSuperview)]) {
                [node performSelector:@selector(removeFromSuperview)];
            }
        }
        
        [self.nodeRegistry removeObjectForKey:nodeId];
        
        RCTLogInfo(@"[ViroFabricJSI] Deleted node %@", nodeId);
        return YES;
        
    } @catch (NSException *exception) {
        RCTLogError(@"[ViroFabricJSI] Error deleting node %@: %@", nodeId, exception.reason);
        return NO;
    }
}

- (BOOL)addChildNode:(NSString *)parentId childId:(NSString *)childId {
    @try {
        NSValue *parentValue = self.nodeRegistry[parentId];
        NSValue *childValue = self.nodeRegistry[childId];
        
        if (!parentValue || !childValue) {
            RCTLogError(@"[ViroFabricJSI] Parent or child node not found: %@ -> %@", parentId, childId);
            return NO;
        }
        
        __weak id parent = [parentValue nonretainedObjectValue];
        __weak id child = [childValue nonretainedObjectValue];
        
        if (!parent || !child) {
            RCTLogError(@"[ViroFabricJSI] Parent or child node reference is nil: %@ -> %@", parentId, childId);
            return NO;
        }
        
        if ([parent respondsToSelector:@selector(addSubview:)]) {
            [parent performSelector:@selector(addSubview:) withObject:child];
        } else if ([parent respondsToSelector:@selector(addChild:)]) {
            [parent performSelector:@selector(addChild:) withObject:child];
        }
        
        RCTLogInfo(@"[ViroFabricJSI] Added child %@ to parent %@", childId, parentId);
        return YES;
        
    } @catch (NSException *exception) {
        RCTLogError(@"[ViroFabricJSI] Error adding child %@ to parent %@: %@", childId, parentId, exception.reason);
        return NO;
    }
}

- (BOOL)removeChildNode:(NSString *)parentId childId:(NSString *)childId {
    @try {
        NSValue *childValue = self.nodeRegistry[childId];
        
        if (!childValue) {
            RCTLogError(@"[ViroFabricJSI] Child node not found: %@", childId);
            return NO;
        }
        
        __weak id child = [childValue nonretainedObjectValue];
        
        if (!child) {
            RCTLogError(@"[ViroFabricJSI] Child node reference is nil: %@", childId);
            return NO;
        }
        
        if ([child respondsToSelector:@selector(removeFromSuperview)]) {
            [child performSelector:@selector(removeFromSuperview)];
        }
        
        RCTLogInfo(@"[ViroFabricJSI] Removed child %@ from parent %@", childId, parentId);
        return YES;
        
    } @catch (NSException *exception) {
        RCTLogError(@"[ViroFabricJSI] Error removing child %@ from parent %@: %@", childId, parentId, exception.reason);
        return NO;
    }
}

- (void)registerNativeEventListener:(NSString *)nodeId eventName:(NSString *)eventName callbackId:(NSString *)callbackId {
    NSValue *nodeValue = self.nodeRegistry[nodeId];
    if (!nodeValue) return;
    
    __weak id node = [nodeValue nonretainedObjectValue];
    if (!node) return;
    
    // Set up event handler based on event name
    NSString *selectorName = [NSString stringWithFormat:@"set%@:", [eventName capitalizedString]];
    SEL selector = NSSelectorFromString(selectorName);
    
    if ([node respondsToSelector:selector]) {
        // Create event handler block
        void (^eventHandler)(NSDictionary *) = ^(NSDictionary *eventData) {
            [self triggerEventCallback:callbackId eventData:eventData];
        };
        
        // Set the event handler on the node
        [node performSelector:selector withObject:eventHandler];
    }
}

- (void)unregisterNativeEventListener:(NSString *)nodeId eventName:(NSString *)eventName callbackId:(NSString *)callbackId {
    NSValue *nodeValue = self.nodeRegistry[nodeId];
    if (!nodeValue) return;
    
    __weak id node = [nodeValue nonretainedObjectValue];
    if (!node) return;
    
    // Clear event handler
    NSString *selectorName = [NSString stringWithFormat:@"set%@:", [eventName capitalizedString]];
    SEL selector = NSSelectorFromString(selectorName);
    
    if ([node respondsToSelector:selector]) {
        [node performSelector:selector withObject:nil];
    }
}

- (BOOL)executeNativeAnimation:(NSString *)nodeId animationId:(NSString *)animationId options:(NSDictionary *)options {
    @try {
        NSValue *nodeValue = self.nodeRegistry[nodeId];
        if (!nodeValue) {
            RCTLogError(@"[ViroFabricJSI] Node not found for animation: %@", nodeId);
            return NO;
        }
        
        __weak id node = [nodeValue nonretainedObjectValue];
        if (!node) {
            RCTLogError(@"[ViroFabricJSI] Node reference is nil for animation: %@", nodeId);
            return NO;
        }
        
        NSDictionary *animationProps = self.animationRegistry[animationId];
        if (!animationProps) {
            RCTLogError(@"[ViroFabricJSI] Animation not found: %@", animationId);
            return NO;
        }
        
        // Execute animation on the node
        if ([node respondsToSelector:@selector(setAnimation:)]) {
            NSMutableDictionary *animationConfig = [animationProps mutableCopy];
            [animationConfig addEntriesFromDictionary:options];
            [node performSelector:@selector(setAnimation:) withObject:animationConfig];
        }
        
        RCTLogInfo(@"[ViroFabricJSI] Executed animation %@ on node %@", animationId, nodeId);
        return YES;
        
    } @catch (NSException *exception) {
        RCTLogError(@"[ViroFabricJSI] Error executing animation %@ on node %@: %@", animationId, nodeId, exception.reason);
        return NO;
    }
}

- (void)triggerEventCallback:(NSString *)callbackId eventData:(NSDictionary *)eventData {
    NSValue *callbackValue = self.eventCallbacks[callbackId];
    if (!callbackValue) return;
    
    Function *callback = (Function *)[callbackValue pointerValue];
    if (!callback) return;
    
    // Use ViroEventsTurboModule for proper event emission in React Native 0.76+
    // This provides New Architecture-compatible event handling
    
    @try {
        ViroEventsTurboModule *eventModule = [ViroEventsTurboModule sharedInstance];
        
        if ([eventModule isEventSystemReady]) {
            // Emit the JSI callback through the TurboModule
            [eventModule emitJSICallback:callbackId eventData:eventData];
            
            RCTLogInfo(@"[ViroFabricJSI] Event callback emitted via TurboModule: %@", callbackId);
        } else {
            // Fallback to logging if no listeners are active
            RCTLogWarn(@"[ViroFabricJSI] No active listeners, logging event callback: %@", callbackId);
            
            if (eventData && eventData.count > 0) {
                RCTLogInfo(@"[ViroFabricJSI] Event data: %@", eventData);
            }
        }
        
    } @catch (NSException *exception) {
        RCTLogError(@"[ViroFabricJSI] Error emitting event callback %@: %@", callbackId, exception.reason);
        
        // Fallback to logging on error
        RCTLogInfo(@"[ViroFabricJSI] Fallback logging for callback: %@ with data: %@", callbackId, eventData);
    }
}

- (Class)getNodeClassForType:(NSString *)nodeType {
    static NSDictionary *nodeClassMap = nil;
    static dispatch_once_t onceToken;
    dispatch_once(&onceToken, ^{
        nodeClassMap = @{
            @"box": NSClassFromString(@"VRTBox"),
            @"sphere": NSClassFromString(@"VRTSphere"),
            @"text": NSClassFromString(@"VRTText"),
            @"image": NSClassFromString(@"VRTImage"),
            @"quad": NSClassFromString(@"VRTQuad"),
            @"ambientLight": NSClassFromString(@"VRTAmbientLight"),
            @"directionalLight": NSClassFromString(@"VRTDirectionalLight"),
            @"sound": NSClassFromString(@"VRTSound"),
            @"node": NSClassFromString(@"VRTNode"),
        };
    });
    
    return nodeClassMap[nodeType];
}

- (void)applyPropsToNode:(id)node props:(NSDictionary *)props {
    for (NSString *key in props) {
        id value = props[key];
        
        @try {
            // Convert property name to setter method
            NSString *capitalizedKey = [key stringByReplacingCharactersInRange:NSMakeRange(0,1) 
                                                                    withString:[[key substringToIndex:1] uppercaseString]];
            NSString *selectorName = [NSString stringWithFormat:@"set%@:", capitalizedKey];
            SEL selector = NSSelectorFromString(selectorName);
            
            if ([node respondsToSelector:selector]) {
                // Handle special value types
                if ([value isKindOfClass:[NSArray class]]) {
                    // Convert arrays for position, rotation, scale, etc.
                    [node performSelector:selector withObject:value];
                } else if ([value isKindOfClass:[NSDictionary class]]) {
                    // Handle complex objects like materials, animations
                    [node performSelector:selector withObject:value];
                } else {
                    // Handle primitive values
                    [node performSelector:selector withObject:value];
                }
            } else {
                // Try direct property setting
                @try {
                    [node setValue:value forKey:key];
                } @catch (NSException *exception) {
                    RCTLogWarn(@"[ViroFabricJSI] Could not set property %@ on node: %@", key, exception.reason);
                }
            }
        } @catch (NSException *exception) {
            RCTLogError(@"[ViroFabricJSI] Error setting property %@ on node: %@", key, exception.reason);
        }
    }
}

- (NSDictionary *)convertJSObjectToNSDictionary:(Object &)jsObject runtime:(Runtime &)runtime {
    NSMutableDictionary *dict = [[NSMutableDictionary alloc] init];
    
    @try {
        Array propertyNames = jsObject.getPropertyNames(runtime);
        size_t length = propertyNames.size(runtime);
        
        for (size_t i = 0; i < length; i++) {
            Value propName = propertyNames.getValueAtIndex(runtime, i);
            std::string keyStr = propName.getString(runtime).utf8(runtime);
            NSString *key = [NSString stringWithUTF8String:keyStr.c_str()];
            
            Value propValue = jsObject.getProperty(runtime, PropNameID::forUtf8(runtime, keyStr));
            id value = [self convertJSValueToNSObject:propValue runtime:runtime];
            
            if (value) {
                dict[key] = value;
            }
        }
    } @catch (NSException *exception) {
        RCTLogError(@"[ViroFabricJSI] Error converting JS object to NSDictionary: %@", exception.reason);
    }
    
    return [dict copy];
}

- (Object)convertNSDictionaryToJSObject:(NSDictionary *)dict runtime:(Runtime &)runtime {
    Object jsObject = Object(runtime);
    
    @try {
        for (NSString *key in dict) {
            id value = dict[key];
            Value jsValue = [self convertNSObjectToJSValue:value runtime:runtime];
            jsObject.setProperty(runtime, PropNameID::forUtf8(runtime, [key UTF8String]), jsValue);
        }
    } @catch (NSException *exception) {
        RCTLogError(@"[ViroFabricJSI] Error converting NSDictionary to JS object: %@", exception.reason);
    }
    
    return jsObject;
}

- (id)convertJSValueToNSObject:(Value &)jsValue runtime:(Runtime &)runtime {
    @try {
        if (jsValue.isUndefined() || jsValue.isNull()) {
            return nil;
        } else if (jsValue.isBool()) {
            return @(jsValue.getBool());
        } else if (jsValue.isNumber()) {
            return @(jsValue.getNumber());
        } else if (jsValue.isString()) {
            std::string str = jsValue.getString(runtime).utf8(runtime);
            return [NSString stringWithUTF8String:str.c_str()];
        } else if (jsValue.isObject()) {
            Object obj = jsValue.getObject(runtime);
            if (obj.isArray(runtime)) {
                Array arr = obj.getArray(runtime);
                NSMutableArray *nsArray = [[NSMutableArray alloc] init];
                size_t length = arr.size(runtime);
                for (size_t i = 0; i < length; i++) {
                    Value element = arr.getValueAtIndex(runtime, i);
                    id nsElement = [self convertJSValueToNSObject:element runtime:runtime];
                    if (nsElement) {
                        [nsArray addObject:nsElement];
                    }
                }
                return [nsArray copy];
            } else {
                return [self convertJSObjectToNSDictionary:obj runtime:runtime];
            }
        }
    } @catch (NSException *exception) {
        RCTLogError(@"[ViroFabricJSI] Error converting JS value to NS object: %@", exception.reason);
    }
    
    return nil;
}

- (Value)convertNSObjectToJSValue:(id)nsObject runtime:(Runtime &)runtime {
    @try {
        if (!nsObject || nsObject == [NSNull null]) {
            return Value::null();
        } else if ([nsObject isKindOfClass:[NSNumber class]]) {
            NSNumber *number = (NSNumber *)nsObject;
            if (strcmp([number objCType], @encode(BOOL)) == 0) {
                return Value([number boolValue]);
            } else {
                return Value([number doubleValue]);
            }
        } else if ([nsObject isKindOfClass:[NSString class]]) {
            NSString *string = (NSString *)nsObject;
            return String::createFromUtf8(runtime, [string UTF8String]);
        } else if ([nsObject isKindOfClass:[NSArray class]]) {
            NSArray *array = (NSArray *)nsObject;
            Array jsArray = Array(runtime, array.count);
            for (NSUInteger i = 0; i < array.count; i++) {
                Value element = [self convertNSObjectToJSValue:array[i] runtime:runtime];
                jsArray.setValueAtIndex(runtime, i, element);
            }
            return jsArray;
        } else if ([nsObject isKindOfClass:[NSDictionary class]]) {
            NSDictionary *dict = (NSDictionary *)nsObject;
            return [self convertNSDictionaryToJSObject:dict runtime:runtime];
        }
    } @catch (NSException *exception) {
        RCTLogError(@"[ViroFabricJSI] Error converting NS object to JS value: %@", exception.reason);
    }
    
    return Value::undefined();
}

- (void)cleanup {
    RCTLogInfo(@"[ViroFabricJSI] Cleaning up JSI bridge");
    
    @try {
        // Clean up event callbacks
        for (NSValue *callbackValue in self.eventCallbacks.allValues) {
            Function *callback = (Function *)[callbackValue pointerValue];
            delete callback;
        }
        [self.eventCallbacks removeAllObjects];
        
        // Clean up node registry
        [self.nodeRegistry removeAllObjects];
        
        // Clean up material and animation registries
        [self.materialRegistry removeAllObjects];
        [self.animationRegistry removeAllObjects];
        
        RCTLogInfo(@"[ViroFabricJSI] JSI bridge cleanup completed");
        
    } @catch (NSException *exception) {
        RCTLogError(@"[ViroFabricJSI] Error during JSI bridge cleanup: %@", exception.reason);
    }
}

@end
