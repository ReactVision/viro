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
#import <React/RCTLog.h>
#import <React/RCTBridge+Private.h>
#import <ViroReact/VRTNode.h>
#import <ViroReact/VRTBox.h>
#import <ViroReact/VRTSphere.h>
#import <ViroReact/VRTText.h>
#import <ViroReact/VRTImage.h>
#import <ViroReact/VRTQuad.h>
#import <ViroReact/VRTAmbientLight.h>
#import <ViroReact/VRTDirectionalLight.h>
#import <ViroReact/VRTSound.h>

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
    
    // Node Management Functions
    [self installNodeManagementFunctions:runtime];
    
    // Scene Management Functions
    [self installSceneManagementFunctions:runtime];
    
    // Event Management Functions
    [self installEventManagementFunctions:runtime];
    
    // Material Management Functions
    [self installMaterialManagementFunctions:runtime];
    
    // Animation Management Functions
    [self installAnimationManagementFunctions:runtime];
    
    // Memory Management Functions
    [self installMemoryManagementFunctions:runtime];
    
    // Utility Functions
    [self installUtilityFunctions:runtime];
    
    RCTLogInfo(@"[ViroFabricJSI] All JSI functions installed successfully");
}

#pragma mark - Node Management Functions

- (void)installNodeManagementFunctions:(Runtime &)runtime {
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
    runtime.global().setProperty(runtime, "generateNodeId", generateNodeId);
    
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
    runtime.global().setProperty(runtime, "generateCallbackId", generateCallbackId);
    
    // createNode
    auto createNode = Function::createFromHostFunction(
        runtime,
        PropNameID::forAscii(runtime, "createNode"),
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
    runtime.global().setProperty(runtime, "createNode", createNode);
    
    // updateNode
    auto updateNode = Function::createFromHostFunction(
        runtime,
        PropNameID::forAscii(runtime, "updateNode"),
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
    runtime.global().setProperty(runtime, "updateNode", updateNode);
    
    // deleteNode
    auto deleteNode = Function::createFromHostFunction(
        runtime,
        PropNameID::forAscii(runtime, "deleteNode"),
        1,
        [self](Runtime &runtime, const Value &thisValue, const Value *arguments, size_t count) -> Value {
            if (count < 1) return Value::undefined();
            
            std::string nodeIdStr = arguments[0].getString(runtime).utf8(runtime);
            NSString *nodeId = [NSString stringWithUTF8String:nodeIdStr.c_str()];
            
            return [self deleteNativeNode:nodeId] ? Value(true) : Value(false);
        }
    );
    runtime.global().setProperty(runtime, "deleteNode", deleteNode);
    
    // addChild
    auto addChild = Function::createFromHostFunction(
        runtime,
        PropNameID::forAscii(runtime, "addChild"),
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
    runtime.global().setProperty(runtime, "addChild", addChild);
    
    // removeChild
    auto removeChild = Function::createFromHostFunction(
        runtime,
        PropNameID::forAscii(runtime, "removeChild"),
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
    runtime.global().setProperty(runtime, "removeChild", removeChild);
}

#pragma mark - Scene Management Functions

- (void)installSceneManagementFunctions:(Runtime &)runtime {
    // createScene
    auto createScene = Function::createFromHostFunction(
        runtime,
        PropNameID::forAscii(runtime, "createScene"),
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
    runtime.global().setProperty(runtime, "createScene", createScene);
    
    // activateScene
    auto activateScene = Function::createFromHostFunction(
        runtime,
        PropNameID::forAscii(runtime, "activateScene"),
        1,
        [self](Runtime &runtime, const Value &thisValue, const Value *arguments, size_t count) -> Value {
            if (count < 1) return Value::undefined();
            
            std::string sceneIdStr = arguments[0].getString(runtime).utf8(runtime);
            NSString *sceneId = [NSString stringWithUTF8String:sceneIdStr.c_str()];
            
            return [self.sceneManager activateScene:sceneId] ? Value(true) : Value(false);
        }
    );
    runtime.global().setProperty(runtime, "activateScene", activateScene);
    
    // destroyScene
    auto destroyScene = Function::createFromHostFunction(
        runtime,
        PropNameID::forAscii(runtime, "destroyScene"),
        1,
        [self](Runtime &runtime, const Value &thisValue, const Value *arguments, size_t count) -> Value {
            if (count < 1) return Value::undefined();
            
            std::string sceneIdStr = arguments[0].getString(runtime).utf8(runtime);
            NSString *sceneId = [NSString stringWithUTF8String:sceneIdStr.c_str()];
            
            return [self.sceneManager destroyScene:sceneId] ? Value(true) : Value(false);
        }
    );
    runtime.global().setProperty(runtime, "destroyScene", destroyScene);
    
    // getActiveSceneId
    auto getActiveSceneId = Function::createFromHostFunction(
        runtime,
        PropNameID::forAscii(runtime, "getActiveSceneId"),
        0,
        [self](Runtime &runtime, const Value &thisValue, const Value *arguments, size_t count) -> Value {
            NSString *activeSceneId = [self.sceneManager getActiveSceneId];
            if (activeSceneId) {
                return String::createFromUtf8(runtime, [activeSceneId UTF8String]);
            }
            return Value::null();
        }
    );
    runtime.global().setProperty(runtime, "getActiveSceneId", getActiveSceneId);
}

#pragma mark - Event Management Functions

- (void)installEventManagementFunctions:(Runtime &)runtime {
    // registerEventListener
    auto registerEventListener = Function::createFromHostFunction(
        runtime,
        PropNameID::forAscii(runtime, "registerEventListener"),
        3,
        [self](Runtime &runtime, const Value &thisValue, const Value *arguments, size_t count) -> Value {
            if (count < 3) return Value::undefined();
            
            std::string nodeIdStr = arguments[0].getString(runtime).utf8(runtime);
            std::string eventNameStr = arguments[1].getString(runtime).utf8(runtime);
            Function callback = arguments[2].getObject(runtime).getFunction(runtime);
            
            NSString *nodeId = [NSString stringWithUTF8String:nodeIdStr.c_str()];
            NSString *eventName = [NSString stringWithUTF8String:eventNameStr.c_str()];
            
            // Store the callback function
            NSString *callbackId = [NSString stringWithFormat:@"%@_%@_%@", nodeId, eventName, [[NSUUID UUID] UUIDString]];
            NSValue *callbackValue = [NSValue valueWithPointer:new Function(std::move(callback))];
            self.eventCallbacks[callbackId] = callbackValue;
            
            // Register with native node
            [self registerNativeEventListener:nodeId eventName:eventName callbackId:callbackId];
            
            return String::createFromUtf8(runtime, [callbackId UTF8String]);
        }
    );
    runtime.global().setProperty(runtime, "registerEventListener", registerEventListener);
    
    // unregisterEventListener
    auto unregisterEventListener = Function::createFromHostFunction(
        runtime,
        PropNameID::forAscii(runtime, "unregisterEventListener"),
        3,
        [self](Runtime &runtime, const Value &thisValue, const Value *arguments, size_t count) -> Value {
            if (count < 3) return Value::undefined();
            
            std::string nodeIdStr = arguments[0].getString(runtime).utf8(runtime);
            std::string eventNameStr = arguments[1].getString(runtime).utf8(runtime);
            std::string callbackIdStr = arguments[2].getString(runtime).utf8(runtime);
            
            NSString *nodeId = [NSString stringWithUTF8String:nodeIdStr.c_str()];
            NSString *eventName = [NSString stringWithUTF8String:eventNameStr.c_str()];
            NSString *callbackId = [NSString stringWithUTF8String:callbackIdStr.c_str()];
            
            // Remove callback from registry
            NSValue *callbackValue = self.eventCallbacks[callbackId];
            if (callbackValue) {
                Function *callback = (Function *)[callbackValue pointerValue];
                delete callback;
                [self.eventCallbacks removeObjectForKey:callbackId];
            }
            
            // Unregister from native node
            [self unregisterNativeEventListener:nodeId eventName:eventName callbackId:callbackId];
            
            return Value(true);
        }
    );
    runtime.global().setProperty(runtime, "unregisterEventListener", unregisterEventListener);
}

#pragma mark - Material Management Functions

- (void)installMaterialManagementFunctions:(Runtime &)runtime {
    // createMaterial
    auto createMaterial = Function::createFromHostFunction(
        runtime,
        PropNameID::forAscii(runtime, "createMaterial"),
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
    runtime.global().setProperty(runtime, "createMaterial", createMaterial);
    
    // updateMaterial
    auto updateMaterial = Function::createFromHostFunction(
        runtime,
        PropNameID::forAscii(runtime, "updateMaterial"),
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
    runtime.global().setProperty(runtime, "updateMaterial", updateMaterial);
    
    // deleteMaterial
    auto deleteMaterial = Function::createFromHostFunction(
        runtime,
        PropNameID::forAscii(runtime, "deleteMaterial"),
        1,
        [self](Runtime &runtime, const Value &thisValue, const Value *arguments, size_t count) -> Value {
            if (count < 1) return Value::undefined();
            
            std::string materialIdStr = arguments[0].getString(runtime).utf8(runtime);
            NSString *materialId = [NSString stringWithUTF8String:materialIdStr.c_str()];
            
            [self.materialRegistry removeObjectForKey:materialId];
            
            return Value(true);
        }
    );
    runtime.global().setProperty(runtime, "deleteMaterial", deleteMaterial);
}

#pragma mark - Animation Management Functions

- (void)installAnimationManagementFunctions:(Runtime &)runtime {
    // createAnimation
    auto createAnimation = Function::createFromHostFunction(
        runtime,
        PropNameID::forAscii(runtime, "createAnimation"),
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
    runtime.global().setProperty(runtime, "createAnimation", createAnimation);
    
    // executeAnimation
    auto executeAnimation = Function::createFromHostFunction(
        runtime,
        PropNameID::forAscii(runtime, "executeAnimation"),
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
    runtime.global().setProperty(runtime, "executeAnimation", executeAnimation);
}

#pragma mark - Memory Management Functions

- (void)installMemoryManagementFunctions:(Runtime &)runtime {
    // getMemoryStats
    auto getMemoryStats = Function::createFromHostFunction(
        runtime,
        PropNameID::forAscii(runtime, "getMemoryStats"),
        0,
        [self](Runtime &runtime, const Value &thisValue, const Value *arguments, size_t count) -> Value {
            NSDictionary *stats = [self.sceneManager getMemoryStats];
            return [self convertNSDictionaryToJSObject:stats runtime:runtime];
        }
    );
    runtime.global().setProperty(runtime, "getMemoryStats", getMemoryStats);
    
    // performMemoryCleanup
    auto performMemoryCleanup = Function::createFromHostFunction(
        runtime,
        PropNameID::forAscii(runtime, "performMemoryCleanup"),
        0,
        [self](Runtime &runtime, const Value &thisValue, const Value *arguments, size_t count) -> Value {
            [self.sceneManager performMemoryCleanup];
            return Value(true);
        }
    );
    runtime.global().setProperty(runtime, "performMemoryCleanup", performMemoryCleanup);
}

#pragma mark - Utility Functions

- (void)installUtilityFunctions:(Runtime &)runtime {
    // isJSIAvailable
    auto isJSIAvailable = Function::createFromHostFunction(
        runtime,
        PropNameID::forAscii(runtime, "isJSIAvailable"),
        0,
        [](Runtime &runtime, const Value &thisValue, const Value *arguments, size_t count) -> Value {
            return Value(true);
        }
    );
    runtime.global().setProperty(runtime, "isJSIAvailable", isJSIAvailable);
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
    
    // Execute callback on JavaScript thread
    dispatch_async(dispatch_get_main_queue(), ^{
        @try {
            Runtime *runtime = &self.bridge.jsCallInvoker->getRuntime();
            if (runtime) {
                Object eventObj = [self convertNSDictionaryToJSObject:eventData runtime:*runtime];
                callback->call(*runtime, eventObj);
            }
        } @catch (NSException *exception) {
            RCTLogError(@"[ViroFabricJSI] Error triggering event callback %@: %@", callbackId, exception.reason);
        }
    });
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
