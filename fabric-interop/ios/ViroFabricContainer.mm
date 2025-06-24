//
//  ViroFabricContainer.mm
//  ViroReact
//
//  Created for ReactVision.
//  Copyright © 2025 ReactVision. All rights reserved.
//

#import "ViroFabricContainer.h"
#import "ViroFabricManager.h"
#import <React/RCTLog.h>
#import <React/RCTUIManager.h>
#import <React/RCTUtils.h>
#import <React/RCTBridge+Private.h>
#import <ReactCommon/RCTTurboModule.h>
#import <ReactCommon/RCTTurboModuleManager.h>
#import <ReactCommon/RuntimeExecutor.h>
#import <jsi/jsi.h>

// Import existing Viro headers
#import <ViroReact/VRTSceneNavigator.h>
#import <ViroReact/VRTARSceneNavigator.h>

using namespace facebook::jsi;

@interface ViroFabricContainer () {
    // Reference to the existing Viro navigator
    VRTSceneNavigator *_sceneNavigator;
    VRTARSceneNavigator *_arSceneNavigator;
    
    // Node registry
    NSMutableDictionary<NSString *, id> *_nodeRegistry;
    
    // Event callback registry
    NSMutableDictionary<NSString *, NSString *> *_eventCallbackRegistry;
    
    // Flag to track if we're using AR
    BOOL _isAR;
    
    // Bridge reference
    __weak RCTBridge *_bridge;
    
    // Runtime executor for JSI
    facebook::react::RuntimeExecutor _runtimeExecutor;
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

@implementation ViroFabricContainer

- (instancetype)initWithBridge:(RCTBridge *)bridge {
    if (self = [super init]) {
        _bridge = bridge;
        _nodeRegistry = [NSMutableDictionary new];
        _eventCallbackRegistry = [NSMutableDictionary new];
        _isAR = NO;
        
        // Set up the runtime when the bridge is ready
        [[NSNotificationCenter defaultCenter] addObserver:self
                                                 selector:@selector(bridgeDidFinishLaunch:)
                                                     name:RCTJavaScriptDidLoadNotification
                                                   object:bridge];
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
    
    // Minimalist approach - don't try to get direct JSI access
    RCTLogInfo(@"Using event emitter approach for communication with JavaScript");
    
    // Set runtime executor to nullptr - we'll use the event emitter instead
    _runtimeExecutor = nullptr;
    
    // We're not using JSI directly, so we don't need to install JSI bindings
    RCTLogInfo(@"Using event emitter for communication with JavaScript");
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
            0,  // no parameters
            [weakContainer = _container](facebook::jsi::Runtime& rt, const facebook::jsi::Value& thisValue, const facebook::jsi::Value* args, size_t count) -> facebook::jsi::Value {
                __strong ViroFabricContainer *container = weakContainer;
                if (!container) return facebook::jsi::Value::undefined();
                
                // Initialize Viro (this is a placeholder - actual initialization happens in the initialize: method)
                
                // Return a promise that resolves to true using Promise.resolve()
                auto promiseConstructor = rt.global().getPropertyAsObject(rt, "Promise");
                auto resolveMethod = promiseConstructor.getPropertyAsFunction(rt, "resolve");
                auto promise = resolveMethod.callWithThis(rt, promiseConstructor, facebook::jsi::Value(true));
                
                return promise;
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
            
            // Instead of using setProps:, set properties individually or use a different method
            // Check if the scene responds to specific property setters
            if ([scene respondsToSelector:@selector(setProperties:)]) {
                [scene performSelector:@selector(setProperties:) withObject:props];
            }
            
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
        // This would delegate to the existing VRT node creation logic
        // For example, for a box:
        if ([nodeType isEqualToString:@"box"]) {
            Class boxClass = NSClassFromString(@"VRTBox");
            if (!boxClass) {
                RCTLogError(@"VRTBox class not found");
                return;
            }
            
            id box = [[boxClass alloc] initWithBridge:_bridge];
            
            // Instead of using setProps:, set properties individually or use a different method
            if ([box respondsToSelector:@selector(setProperties:)]) {
                [box performSelector:@selector(setProperties:) withObject:props];
            }
            
            _nodeRegistry[nodeId] = box;
        }
        // Similar implementations for other node types
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
            // Fallback to using the VRONode directly
            // Get the node property from the parent and child using proper type handling
            std::shared_ptr<VRONode> parentVRONode = nullptr;
            std::shared_ptr<VRONode> childVRONode = nullptr;
            
            if ([parent respondsToSelector:@selector(node)]) {
                NSInvocation *invocation = [NSInvocation invocationWithMethodSignature:
                                           [parent methodSignatureForSelector:@selector(node)]];
                [invocation setSelector:@selector(node)];
                [invocation setTarget:parent];
                [invocation invoke];
                [invocation getReturnValue:&parentVRONode];
            }
            
            if ([child respondsToSelector:@selector(node)]) {
                NSInvocation *invocation = [NSInvocation invocationWithMethodSignature:
                                           [child methodSignatureForSelector:@selector(node)]];
                [invocation setSelector:@selector(node)];
                [invocation setTarget:child];
                [invocation invoke];
                [invocation getReturnValue:&childVRONode];
            }
            
            if (parentVRONode && childVRONode) {
                parentVRONode->addChildNode(childVRONode);
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
            // Fallback to using the VRONode directly
            // Get the node property from the child using proper type handling
            std::shared_ptr<VRONode> childVRONode = nullptr;
            
            if ([child respondsToSelector:@selector(node)]) {
                NSInvocation *invocation = [NSInvocation invocationWithMethodSignature:
                                           [child methodSignatureForSelector:@selector(node)]];
                [invocation setSelector:@selector(node)];
                [invocation setTarget:child];
                [invocation invoke];
                [invocation getReturnValue:&childVRONode];
            }
            
            if (childVRONode) {
                childVRONode->removeFromParentNode();
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

@end
