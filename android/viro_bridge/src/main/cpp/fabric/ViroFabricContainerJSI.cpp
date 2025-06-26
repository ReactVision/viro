// Use the Prefab-provided headers
#include <fbjni/fbjni.h>
#include <jsi/jsi.h>
#include <react/jni/ReadableNativeMap.h>
#include <react/jni/WritableNativeMap.h>
#include <react/jni/JMessageQueueThread.h>
#include <react/jni/NativeMap.h>
#include <react/nativemodule/core/ReactCommon/CallInvokerHolder.h>
#include <android/log.h>
#include <memory>
#include <string>
#include <map>
#include <mutex>
#include <thread>
#include <chrono>
#include <atomic>

using namespace facebook::jni;
using namespace facebook::jsi;
using namespace facebook::react;

class ViroFabricContainerJSI : public facebook::jni::HybridClass<ViroFabricContainerJSI> {
public:
    static constexpr auto kJavaDescriptor = "Lcom/viromedia/bridge/fabric/ViroFabricContainer;";

    static void registerNatives() {
        registerHybridClass({
            makeNativeMethod("initHybrid", ViroFabricContainerJSI::initHybrid),
            makeNativeMethod("dispatchEventToJS", ViroFabricContainerJSI::dispatchEventToJS),
            makeNativeMethod("resolvePromise", ViroFabricContainerJSI::resolvePromise),
            makeNativeMethod("rejectPromise", ViroFabricContainerJSI::rejectPromise),
        });
    }

    ViroFabricContainerJSI(
        jni::alias_ref<ViroFabricContainerJSI::javaobject> jThis,
        jsi::Runtime* runtime,
        std::shared_ptr<facebook::react::CallInvoker> jsCallInvoker)
        : javaPart_(jni::make_global(jThis)),
          runtime_(runtime),
          jsCallInvoker_(std::move(jsCallInvoker)),
          promiseCounter_(0) {}

private:
    friend HybridBase;

    static void initHybrid(
        jni::alias_ref<ViroFabricContainerJSI::javaobject> jThis) {
        
        __android_log_print(ANDROID_LOG_INFO, "ViroFabricJSI", "Initializing hybrid bridge");
        
        // Get the current React context from the Java side
        static const auto getReactContextMethod = 
            jThis->getClass()->getMethod<jobject()>("getReactContext");
        auto reactContext = getReactContextMethod(jThis);
        
        if (reactContext == nullptr) {
            __android_log_print(ANDROID_LOG_ERROR, "ViroFabricJSI", "React context is null");
            return;
        }
        
        // Get the CatalystInstance from ReactContext
        auto reactContextClass = jni::findClassLocal("com/facebook/react/bridge/ReactContext");
        auto getCatalystInstanceMethod = reactContextClass->getMethod<jobject()>("getCatalystInstance");
        auto catalystInstance = getCatalystInstanceMethod(reactContext);
        
        if (catalystInstance == nullptr) {
            __android_log_print(ANDROID_LOG_ERROR, "ViroFabricJSI", "CatalystInstance is null");
            return;
        }
        
        // Get the JSI Runtime from CatalystInstance
        auto catalystInstanceClass = jni::findClassLocal("com/facebook/react/bridge/CatalystInstance");
        auto getJSIRuntimeMethod = catalystInstanceClass->getMethod<jlong()>("getJSIRuntime");
        auto runtimePointer = getJSIRuntimeMethod(catalystInstance);
        
        if (runtimePointer == 0) {
            __android_log_print(ANDROID_LOG_ERROR, "ViroFabricJSI", "Runtime pointer is null");
            return;
        }
        
        auto runtime = reinterpret_cast<jsi::Runtime*>(runtimePointer);
        
        // Get the JS call invoker from CatalystInstance
        auto getJSCallInvokerMethod = catalystInstanceClass->getMethod<jlong()>("getJSCallInvoker");
        auto callInvokerPointer = getJSCallInvokerMethod(catalystInstance);
        
        if (callInvokerPointer == 0) {
            __android_log_print(ANDROID_LOG_ERROR, "ViroFabricJSI", "CallInvoker pointer is null");
            return;
        }
        
        auto callInvoker = reinterpret_cast<facebook::react::CallInvoker*>(callInvokerPointer);
        auto jsCallInvoker = std::shared_ptr<facebook::react::CallInvoker>(callInvoker, [](facebook::react::CallInvoker*) {
            // No-op deleter since we don't own the CallInvoker
        });
        
        // Create the C++ instance
        auto instance = std::make_shared<ViroFabricContainerJSI>(jThis, runtime, jsCallInvoker);
        
        // Install JSI bindings
        instance->installJSIBindings();
        
        // Store the instance in the Java object
        static const auto setHybridDataMethod = 
            jThis->getClass()->getMethod<void(jlong)>("setHybridData");
        setHybridDataMethod(jThis, reinterpret_cast<jlong>(instance.get()));
        
        __android_log_print(ANDROID_LOG_INFO, "ViroFabricJSI", "Hybrid bridge initialized successfully");
    }

    void installJSIBindings() {
        if (!runtime_) {
            __android_log_print(ANDROID_LOG_ERROR, "ViroFabricJSI", "Runtime is null, cannot install JSI bindings");
            return;
        }
        
        auto& runtime = *runtime_;
        
        __android_log_print(ANDROID_LOG_INFO, "ViroFabricJSI", "Installing JSI bindings");
        
        // Create the NativeViro object
        auto nativeViro = jsi::Object(runtime);
        
        // Node management functions
        nativeViro.setProperty(runtime, "createViroNode", jsi::Function::createFromHostFunction(
            runtime,
            jsi::PropNameID::forAscii(runtime, "createViroNode"),
            3,  // nodeId, nodeType, props
            [this](jsi::Runtime& rt, const jsi::Value& thisValue, const jsi::Value* args, size_t count) -> jsi::Value {
                if (count < 3) {
                    throw jsi::JSError(rt, "createViroNode requires 3 arguments");
                }
                
                auto nodeId = args[0].getString(rt).utf8(rt);
                auto nodeType = args[1].getString(rt).utf8(rt);
                
                // Convert props from JSI to ReadableMap
                auto propsValue = args[2];
                auto propsMap = convertJSIValueToReadableMap(rt, propsValue);
                
                // Call the Java method
                static const auto createNodeMethod = 
                    javaPart_->getClass()->getMethod<void(jstring, jstring, ReadableNativeMap::javaobject)>("createNode");
                createNodeMethod(
                    javaPart_.get(),
                    jni::make_jstring(nodeId).get(),
                    jni::make_jstring(nodeType).get(),
                    propsMap.get());
                
                return jsi::Value::undefined();
            }
        ));
        
        nativeViro.setProperty(runtime, "updateViroNode", jsi::Function::createFromHostFunction(
            runtime,
            jsi::PropNameID::forAscii(runtime, "updateViroNode"),
            2,  // nodeId, props
            [this](jsi::Runtime& rt, const jsi::Value& thisValue, const jsi::Value* args, size_t count) -> jsi::Value {
                if (count < 2) {
                    throw jsi::JSError(rt, "updateViroNode requires 2 arguments");
                }
                
                auto nodeId = args[0].getString(rt).utf8(rt);
                
                // Convert props from JSI to ReadableMap
                auto propsValue = args[1];
                auto propsMap = convertJSIValueToReadableMap(rt, propsValue);
                
                // Call the Java method
                static const auto updateNodeMethod = 
                    javaPart_->getClass()->getMethod<void(jstring, ReadableNativeMap::javaobject)>("updateNode");
                updateNodeMethod(
                    javaPart_.get(),
                    jni::make_jstring(nodeId).get(),
                    propsMap.get());
                
                return jsi::Value::undefined();
            }
        ));
        
        nativeViro.setProperty(runtime, "deleteViroNode", jsi::Function::createFromHostFunction(
            runtime,
            jsi::PropNameID::forAscii(runtime, "deleteViroNode"),
            1,  // nodeId
            [this](jsi::Runtime& rt, const jsi::Value& thisValue, const jsi::Value* args, size_t count) -> jsi::Value {
                if (count < 1) {
                    throw jsi::JSError(rt, "deleteViroNode requires 1 argument");
                }
                
                auto nodeId = args[0].getString(rt).utf8(rt);
                
                // Call the Java method
                static const auto deleteNodeMethod = 
                    javaPart_->getClass()->getMethod<void(jstring)>("deleteNode");
                deleteNodeMethod(
                    javaPart_.get(),
                    jni::make_jstring(nodeId).get());
                
                return jsi::Value::undefined();
            }
        ));
        
        // Scene hierarchy functions
        nativeViro.setProperty(runtime, "addViroNodeChild", jsi::Function::createFromHostFunction(
            runtime,
            jsi::PropNameID::forAscii(runtime, "addViroNodeChild"),
            2,  // parentId, childId
            [this](jsi::Runtime& rt, const jsi::Value& thisValue, const jsi::Value* args, size_t count) -> jsi::Value {
                if (count < 2) {
                    throw jsi::JSError(rt, "addViroNodeChild requires 2 arguments");
                }
                
                auto parentId = args[0].getString(rt).utf8(rt);
                auto childId = args[1].getString(rt).utf8(rt);
                
                // Call the Java method
                static const auto addChildMethod = 
                    javaPart_->getClass()->getMethod<void(jstring, jstring)>("addChild");
                addChildMethod(
                    javaPart_.get(),
                    jni::make_jstring(parentId).get(),
                    jni::make_jstring(childId).get());
                
                return jsi::Value::undefined();
            }
        ));
        
        nativeViro.setProperty(runtime, "removeViroNodeChild", jsi::Function::createFromHostFunction(
            runtime,
            jsi::PropNameID::forAscii(runtime, "removeViroNodeChild"),
            2,  // parentId, childId
            [this](jsi::Runtime& rt, const jsi::Value& thisValue, const jsi::Value* args, size_t count) -> jsi::Value {
                if (count < 2) {
                    throw jsi::JSError(rt, "removeViroNodeChild requires 2 arguments");
                }
                
                auto parentId = args[0].getString(rt).utf8(rt);
                auto childId = args[1].getString(rt).utf8(rt);
                
                // Call the Java method
                static const auto removeChildMethod = 
                    javaPart_->getClass()->getMethod<void(jstring, jstring)>("removeChild");
                removeChildMethod(
                    javaPart_.get(),
                    jni::make_jstring(parentId).get(),
                    jni::make_jstring(childId).get());
                
                return jsi::Value::undefined();
            }
        ));
        
        // Event handling functions
        nativeViro.setProperty(runtime, "registerEventCallback", jsi::Function::createFromHostFunction(
            runtime,
            jsi::PropNameID::forAscii(runtime, "registerEventCallback"),
            3,  // nodeId, eventName, callbackId
            [this](jsi::Runtime& rt, const jsi::Value& thisValue, const jsi::Value* args, size_t count) -> jsi::Value {
                if (count < 3) {
                    throw jsi::JSError(rt, "registerEventCallback requires 3 arguments");
                }
                
                auto nodeId = args[0].getString(rt).utf8(rt);
                auto eventName = args[1].getString(rt).utf8(rt);
                auto callbackId = args[2].getString(rt).utf8(rt);
                
                // Call the Java method
                static const auto registerEventCallbackMethod = 
                    javaPart_->getClass()->getMethod<void(jstring, jstring, jstring)>("registerEventCallback");
                registerEventCallbackMethod(
                    javaPart_.get(),
                    jni::make_jstring(nodeId).get(),
                    jni::make_jstring(eventName).get(),
                    jni::make_jstring(callbackId).get());
                
                return jsi::Value::undefined();
            }
        ));
        
        nativeViro.setProperty(runtime, "unregisterEventCallback", jsi::Function::createFromHostFunction(
            runtime,
            jsi::PropNameID::forAscii(runtime, "unregisterEventCallback"),
            3,  // nodeId, eventName, callbackId
            [this](jsi::Runtime& rt, const jsi::Value& thisValue, const jsi::Value* args, size_t count) -> jsi::Value {
                if (count < 3) {
                    throw jsi::JSError(rt, "unregisterEventCallback requires 3 arguments");
                }
                
                auto nodeId = args[0].getString(rt).utf8(rt);
                auto eventName = args[1].getString(rt).utf8(rt);
                auto callbackId = args[2].getString(rt).utf8(rt);
                
                // Call the Java method
                static const auto unregisterEventCallbackMethod = 
                    javaPart_->getClass()->getMethod<void(jstring, jstring, jstring)>("unregisterEventCallback");
                unregisterEventCallbackMethod(
                    javaPart_.get(),
                    jni::make_jstring(nodeId).get(),
                    jni::make_jstring(eventName).get(),
                    jni::make_jstring(callbackId).get());
                
                return jsi::Value::undefined();
            }
        ));
        
        // Initialize function
        nativeViro.setProperty(runtime, "initialize", jsi::Function::createFromHostFunction(
            runtime,
            jsi::PropNameID::forAscii(runtime, "initialize"),
            1,  // config
            [this](jsi::Runtime& rt, const jsi::Value& thisValue, const jsi::Value* args, size_t count) -> jsi::Value {
                // Initialize Viro
                bool debug = false;
                bool arEnabled = false;
                std::string worldAlignment = "Gravity";
                
                if (count > 0 && args[0].isObject()) {
                    auto config = args[0].getObject(rt);
                    
                    if (config.hasProperty(rt, "debug")) {
                        debug = config.getProperty(rt, "debug").getBool();
                    }
                    if (config.hasProperty(rt, "arEnabled")) {
                        arEnabled = config.getProperty(rt, "arEnabled").getBool();
                    }
                    if (config.hasProperty(rt, "worldAlignment")) {
                        worldAlignment = config.getProperty(rt, "worldAlignment").getString(rt).utf8(rt);
                    }
                }
                
                // Call the Java initialize method
                static const auto initializeMethod = 
                    javaPart_->getClass()->getMethod<void(jboolean, jboolean, jstring)>("initialize");
                initializeMethod(
                    javaPart_.get(),
                    debug,
                    arEnabled,
                    jni::make_jstring(worldAlignment).get());
                
                // Return a promise that resolves to true
                auto promiseConstructor = rt.global().getPropertyAsObject(rt, "Promise");
                auto resolveMethod = promiseConstructor.getPropertyAsFunction(rt, "resolve");
                auto promise = resolveMethod.callWithThis(rt, promiseConstructor, jsi::Value(true));
                
                return promise;
            }
        ));
        
        // Scene management functions
        nativeViro.setProperty(runtime, "createViroScene", jsi::Function::createFromHostFunction(
            runtime,
            jsi::PropNameID::forAscii(runtime, "createViroScene"),
            3,  // sceneId, sceneType, props
            [this](jsi::Runtime& rt, const jsi::Value& thisValue, const jsi::Value* args, size_t count) -> jsi::Value {
                if (count < 3) {
                    throw jsi::JSError(rt, "createViroScene requires 3 arguments");
                }
                
                auto sceneId = args[0].getString(rt).utf8(rt);
                auto sceneType = args[1].getString(rt).utf8(rt);
                auto propsValue = args[2];
                auto propsMap = convertJSIValueToReadableMap(rt, propsValue);
                
                // Call the Java method
                static const auto createSceneMethod = 
                    javaPart_->getClass()->getMethod<void(jstring, jstring, ReadableNativeMap::javaobject)>("createScene");
                createSceneMethod(
                    javaPart_.get(),
                    jni::make_jstring(sceneId).get(),
                    jni::make_jstring(sceneType).get(),
                    propsMap.get());
                
                return jsi::Value::undefined();
            }
        ));
        
        nativeViro.setProperty(runtime, "activateViroScene", jsi::Function::createFromHostFunction(
            runtime,
            jsi::PropNameID::forAscii(runtime, "activateViroScene"),
            1,  // sceneId
            [this](jsi::Runtime& rt, const jsi::Value& thisValue, const jsi::Value* args, size_t count) -> jsi::Value {
                if (count < 1) {
                    throw jsi::JSError(rt, "activateViroScene requires 1 argument");
                }
                
                auto sceneId = args[0].getString(rt).utf8(rt);
                
                // Call the Java method
                static const auto activateSceneMethod = 
                    javaPart_->getClass()->getMethod<void(jstring)>("activateScene");
                activateSceneMethod(
                    javaPart_.get(),
                    jni::make_jstring(sceneId).get());
                
                return jsi::Value::undefined();
            }
        ));
        
        nativeViro.setProperty(runtime, "deactivateViroScene", jsi::Function::createFromHostFunction(
            runtime,
            jsi::PropNameID::forAscii(runtime, "deactivateViroScene"),
            1,  // sceneId
            [this](jsi::Runtime& rt, const jsi::Value& thisValue, const jsi::Value* args, size_t count) -> jsi::Value {
                if (count < 1) {
                    throw jsi::JSError(rt, "deactivateViroScene requires 1 argument");
                }
                
                auto sceneId = args[0].getString(rt).utf8(rt);
                
                // Call the Java method
                static const auto deactivateSceneMethod = 
                    javaPart_->getClass()->getMethod<void(jstring)>("deactivateScene");
                deactivateSceneMethod(
                    javaPart_.get(),
                    jni::make_jstring(sceneId).get());
                
                return jsi::Value::undefined();
            }
        ));
        
        nativeViro.setProperty(runtime, "destroyViroScene", jsi::Function::createFromHostFunction(
            runtime,
            jsi::PropNameID::forAscii(runtime, "destroyViroScene"),
            1,  // sceneId
            [this](jsi::Runtime& rt, const jsi::Value& thisValue, const jsi::Value* args, size_t count) -> jsi::Value {
                if (count < 1) {
                    throw jsi::JSError(rt, "destroyViroScene requires 1 argument");
                }
                
                auto sceneId = args[0].getString(rt).utf8(rt);
                
                // Call the Java method
                static const auto destroySceneMethod = 
                    javaPart_->getClass()->getMethod<void(jstring)>("destroyScene");
                destroySceneMethod(
                    javaPart_.get(),
                    jni::make_jstring(sceneId).get());
                
                return jsi::Value::undefined();
            }
        ));
        
        nativeViro.setProperty(runtime, "getViroSceneState", jsi::Function::createFromHostFunction(
            runtime,
            jsi::PropNameID::forAscii(runtime, "getViroSceneState"),
            1,  // sceneId
            [this](jsi::Runtime& rt, const jsi::Value& thisValue, const jsi::Value* args, size_t count) -> jsi::Value {
                if (count < 1) {
                    return jsi::Value::null();
                }
                
                auto sceneId = args[0].getString(rt).utf8(rt);
                
                // Call the Java method
                static const auto getSceneStateMethod = 
                    javaPart_->getClass()->getMethod<jstring(jstring)>("getSceneState");
                auto state = getSceneStateMethod(
                    javaPart_.get(),
                    jni::make_jstring(sceneId).get());
                
                if (state) {
                    std::string stateStr = state->toStdString();
                    return jsi::String::createFromUtf8(rt, stateStr);
                }
                
                return jsi::Value::null();
            }
        ));
        
        // Memory management functions
        nativeViro.setProperty(runtime, "getViroMemoryStats", jsi::Function::createFromHostFunction(
            runtime,
            jsi::PropNameID::forAscii(runtime, "getViroMemoryStats"),
            0,  // no arguments
            [this](jsi::Runtime& rt, const jsi::Value& thisValue, const jsi::Value* args, size_t count) -> jsi::Value {
                // Call the Java method
                static const auto getMemoryStatsMethod = 
                    javaPart_->getClass()->getMethod<ReadableNativeMap::javaobject()>("getMemoryStats");
                auto stats = getMemoryStatsMethod(javaPart_.get());
                
                if (stats) {
                    // Convert ReadableMap to JSI Object
                    return convertReadableMapToJSIValue(rt, stats);
                }
                
                return jsi::Object(rt);
            }
        ));
        
        nativeViro.setProperty(runtime, "performViroMemoryCleanup", jsi::Function::createFromHostFunction(
            runtime,
            jsi::PropNameID::forAscii(runtime, "performViroMemoryCleanup"),
            0,  // no arguments
            [this](jsi::Runtime& rt, const jsi::Value& thisValue, const jsi::Value* args, size_t count) -> jsi::Value {
                // Call the Java method
                static const auto performMemoryCleanupMethod = 
                    javaPart_->getClass()->getMethod<void()>("performMemoryCleanup");
                performMemoryCleanupMethod(javaPart_.get());
                
                return jsi::Value::undefined();
            }
        ));
        
        // Material management functions
        nativeViro.setProperty(runtime, "createViroMaterial", jsi::Function::createFromHostFunction(
            runtime,
            jsi::PropNameID::forAscii(runtime, "createViroMaterial"),
            2,  // materialName, properties
            [this](jsi::Runtime& rt, const jsi::Value& thisValue, const jsi::Value* args, size_t count) -> jsi::Value {
                if (count < 2) {
                    throw jsi::JSError(rt, "createViroMaterial requires 2 arguments");
                }
                
                auto materialName = args[0].getString(rt).utf8(rt);
                auto propsValue = args[1];
                auto propsMap = convertJSIValueToReadableMap(rt, propsValue);
                
                // Call the Java method
                static const auto createMaterialMethod = 
                    javaPart_->getClass()->getMethod<void(jstring, ReadableNativeMap::javaobject)>("createMaterial");
                createMaterialMethod(
                    javaPart_.get(),
                    jni::make_jstring(materialName).get(),
                    propsMap.get());
                
                return jsi::Value::undefined();
            }
        ));
        
        nativeViro.setProperty(runtime, "updateViroMaterial", jsi::Function::createFromHostFunction(
            runtime,
            jsi::PropNameID::forAscii(runtime, "updateViroMaterial"),
            2,  // materialName, properties
            [this](jsi::Runtime& rt, const jsi::Value& thisValue, const jsi::Value* args, size_t count) -> jsi::Value {
                if (count < 2) {
                    throw jsi::JSError(rt, "updateViroMaterial requires 2 arguments");
                }
                
                auto materialName = args[0].getString(rt).utf8(rt);
                auto propsValue = args[1];
                auto propsMap = convertJSIValueToReadableMap(rt, propsValue);
                
                // Call the Java method
                static const auto updateMaterialMethod = 
                    javaPart_->getClass()->getMethod<void(jstring, ReadableNativeMap::javaobject)>("updateMaterial");
                updateMaterialMethod(
                    javaPart_.get(),
                    jni::make_jstring(materialName).get(),
                    propsMap.get());
                
                return jsi::Value::undefined();
            }
        ));
        
        // Animation functions
        nativeViro.setProperty(runtime, "createViroAnimation", jsi::Function::createFromHostFunction(
            runtime,
            jsi::PropNameID::forAscii(runtime, "createViroAnimation"),
            2,  // animationName, properties
            [this](jsi::Runtime& rt, const jsi::Value& thisValue, const jsi::Value* args, size_t count) -> jsi::Value {
                if (count < 2) {
                    throw jsi::JSError(rt, "createViroAnimation requires 2 arguments");
                }
                
                auto animationName = args[0].getString(rt).utf8(rt);
                auto propsValue = args[1];
                auto propsMap = convertJSIValueToReadableMap(rt, propsValue);
                
                // Call the Java method
                static const auto createAnimationMethod = 
                    javaPart_->getClass()->getMethod<void(jstring, ReadableNativeMap::javaobject)>("createAnimation");
                createAnimationMethod(
                    javaPart_.get(),
                    jni::make_jstring(animationName).get(),
                    propsMap.get());
                
                return jsi::Value::undefined();
            }
        ));
        
        nativeViro.setProperty(runtime, "executeViroAnimation", jsi::Function::createFromHostFunction(
            runtime,
            jsi::PropNameID::forAscii(runtime, "executeViroAnimation"),
            3,  // nodeId, animationName, options
            [this](jsi::Runtime& rt, const jsi::Value& thisValue, const jsi::Value* args, size_t count) -> jsi::Value {
                if (count < 3) {
                    throw jsi::JSError(rt, "executeViroAnimation requires 3 arguments");
                }
                
                auto nodeId = args[0].getString(rt).utf8(rt);
                auto animationName = args[1].getString(rt).utf8(rt);
                auto optionsValue = args[2];
                auto optionsMap = convertJSIValueToReadableMap(rt, optionsValue);
                
                // Call the Java method
                static const auto executeAnimationMethod = 
                    javaPart_->getClass()->getMethod<void(jstring, jstring, ReadableNativeMap::javaobject)>("executeAnimation");
                executeAnimationMethod(
                    javaPart_.get(),
                    jni::make_jstring(nodeId).get(),
                    jni::make_jstring(animationName).get(),
                    optionsMap.get());
                
                return jsi::Value::undefined();
            }
        ));
        
        // AR specific functions
        nativeViro.setProperty(runtime, "setViroARPlaneDetection", jsi::Function::createFromHostFunction(
            runtime,
            jsi::PropNameID::forAscii(runtime, "setViroARPlaneDetection"),
            1,  // config
            [this](jsi::Runtime& rt, const jsi::Value& thisValue, const jsi::Value* args, size_t count) -> jsi::Value {
                if (count < 1) {
                    throw jsi::JSError(rt, "setViroARPlaneDetection requires 1 argument");
                }
                
                auto configValue = args[0];
                auto configMap = convertJSIValueToReadableMap(rt, configValue);
                
                // Call the Java method
                static const auto setARPlaneDetectionMethod = 
                    javaPart_->getClass()->getMethod<void(ReadableNativeMap::javaobject)>("setARPlaneDetection");
                setARPlaneDetectionMethod(
                    javaPart_.get(),
                    configMap.get());
                
                return jsi::Value::undefined();
            }
        ));
        
        nativeViro.setProperty(runtime, "setViroARImageTargets", jsi::Function::createFromHostFunction(
            runtime,
            jsi::PropNameID::forAscii(runtime, "setViroARImageTargets"),
            1,  // targets
            [this](jsi::Runtime& rt, const jsi::Value& thisValue, const jsi::Value* args, size_t count) -> jsi::Value {
                if (count < 1) {
                    throw jsi::JSError(rt, "setViroARImageTargets requires 1 argument");
                }
                
                auto targetsValue = args[0];
                auto targetsMap = convertJSIValueToReadableMap(rt, targetsValue);
                
                // Call the Java method
                static const auto setARImageTargetsMethod = 
                    javaPart_->getClass()->getMethod<void(ReadableNativeMap::javaobject)>("setARImageTargets");
                setARImageTargetsMethod(
                    javaPart_.get(),
                    targetsMap.get());
                
                return jsi::Value::undefined();
            }
        ));
        
        // AR Utility Functions
        nativeViro.setProperty(runtime, "recenterTracking", jsi::Function::createFromHostFunction(
            runtime,
            jsi::PropNameID::forAscii(runtime, "recenterTracking"),
            1,  // nodeId
            [this](jsi::Runtime& rt, const jsi::Value& thisValue, const jsi::Value* args, size_t count) -> jsi::Value {
                if (count < 1) {
                    return jsi::Value::undefined();
                }
                
                auto nodeId = args[0].getString(rt).utf8(rt);
                
                // Call the Java method
                static const auto recenterTrackingMethod = 
                    javaPart_->getClass()->getMethod<void(jstring)>("recenterTracking");
                recenterTrackingMethod(
                    javaPart_.get(),
                    jni::make_jstring(nodeId).get());
                
                __android_log_print(ANDROID_LOG_INFO, "ViroFabricJSI", "Recentered tracking for node: %s", nodeId.c_str());
                
                return jsi::Value::undefined();
            }
        ));
        
        nativeViro.setProperty(runtime, "project", jsi::Function::createFromHostFunction(
            runtime,
            jsi::PropNameID::forAscii(runtime, "project"),
            2,  // nodeId, point
            [this](jsi::Runtime& rt, const jsi::Value& thisValue, const jsi::Value* args, size_t count) -> jsi::Value {
                if (count < 2) {
                    auto promiseConstructor = rt.global().getPropertyAsObject(rt, "Promise");
                    auto rejectMethod = promiseConstructor.getPropertyAsFunction(rt, "reject");
                    auto error = jsi::Object(rt);
                    error.setProperty(rt, "message", jsi::String::createFromUtf8(rt, "project requires 2 arguments: nodeId and point"));
                    return rejectMethod.callWithThis(rt, promiseConstructor, error);
                }
                
                auto nodeId = args[0].getString(rt).utf8(rt);
                
                // Parse the 3D point array
                if (!args[1].isObject() || !args[1].getObject(rt).isArray(rt)) {
                    auto promiseConstructor = rt.global().getPropertyAsObject(rt, "Promise");
                    auto rejectMethod = promiseConstructor.getPropertyAsFunction(rt, "reject");
                    auto error = jsi::Object(rt);
                    error.setProperty(rt, "message", jsi::String::createFromUtf8(rt, "point must be a 3-element array [x, y, z]"));
                    return rejectMethod.callWithThis(rt, promiseConstructor, error);
                }
                
                auto pointArray = args[1].getObject(rt).getArray(rt);
                if (pointArray.size(rt) < 3) {
                    auto promiseConstructor = rt.global().getPropertyAsObject(rt, "Promise");
                    auto rejectMethod = promiseConstructor.getPropertyAsFunction(rt, "reject");
                    auto error = jsi::Object(rt);
                    error.setProperty(rt, "message", jsi::String::createFromUtf8(rt, "point must be a 3-element array [x, y, z]"));
                    return rejectMethod.callWithThis(rt, promiseConstructor, error);
                }
                
                float x = pointArray.getValueAtIndex(rt, 0).getNumber();
                float y = pointArray.getValueAtIndex(rt, 1).getNumber();
                float z = pointArray.getValueAtIndex(rt, 2).getNumber();
                
                // Create a new Promise with proper async handling
                auto promiseConstructor = rt.global().getPropertyAsObject(rt, "Promise");
                return promiseConstructor.callAsConstructor(rt, jsi::Function::createFromHostFunction(
                    rt,
                    jsi::PropNameID::forAscii(rt, "projectPromiseExecutor"),
                    2,
                    [this, nodeId, x, y, z](jsi::Runtime& rt, const jsi::Value& thisValue, const jsi::Value* args, size_t count) -> jsi::Value {
                        if (count != 2) {
                            return jsi::Value::undefined();
                        }
                        
                        // Generate unique promise ID
                        std::string promiseId = generatePromiseId();
                        
                        // Store promise resolve/reject functions
                        {
                            std::lock_guard<std::mutex> lock(promisesMutex_);
                            pendingPromises_[promiseId] = {
                                std::shared_ptr<jsi::Runtime>(&rt, [](jsi::Runtime*){}), // Non-owning shared_ptr
                                std::make_shared<jsi::Function>(args[0].getObject(rt).getFunction(rt)),
                                std::make_shared<jsi::Function>(args[1].getObject(rt).getFunction(rt))
                            };
                        }
                        
                        // Call the Java method with promise ID for async resolution
                        static const auto projectPointAsyncMethod = 
                            javaPart_->getClass()->getMethod<void(jstring, jfloat, jfloat, jfloat, jstring)>("projectPointAsync");
                        projectPointAsyncMethod(
                            javaPart_.get(),
                            jni::make_jstring(nodeId).get(),
                            x, y, z,
                            jni::make_jstring(promiseId).get());
                        
                        return jsi::Value::undefined();
                    }
                ));
            }
        ));
        
        nativeViro.setProperty(runtime, "unproject", jsi::Function::createFromHostFunction(
            runtime,
            jsi::PropNameID::forAscii(runtime, "unproject"),
            2,  // nodeId, point
            [this](jsi::Runtime& rt, const jsi::Value& thisValue, const jsi::Value* args, size_t count) -> jsi::Value {
                if (count < 2) {
                    auto promiseConstructor = rt.global().getPropertyAsObject(rt, "Promise");
                    auto rejectMethod = promiseConstructor.getPropertyAsFunction(rt, "reject");
                    auto error = jsi::Object(rt);
                    error.setProperty(rt, "message", jsi::String::createFromUtf8(rt, "unproject requires 2 arguments: nodeId and point"));
                    return rejectMethod.callWithThis(rt, promiseConstructor, error);
                }
                
                auto nodeId = args[0].getString(rt).utf8(rt);
                
                // Parse the 2D/3D point array
                if (!args[1].isObject() || !args[1].getObject(rt).isArray(rt)) {
                    auto promiseConstructor = rt.global().getPropertyAsObject(rt, "Promise");
                    auto rejectMethod = promiseConstructor.getPropertyAsFunction(rt, "reject");
                    auto error = jsi::Object(rt);
                    error.setProperty(rt, "message", jsi::String::createFromUtf8(rt, "point must be at least a 2-element array [x, y] or [x, y, z]"));
                    return rejectMethod.callWithThis(rt, promiseConstructor, error);
                }
                
                auto pointArray = args[1].getObject(rt).getArray(rt);
                if (pointArray.size(rt) < 2) {
                    auto promiseConstructor = rt.global().getPropertyAsObject(rt, "Promise");
                    auto rejectMethod = promiseConstructor.getPropertyAsFunction(rt, "reject");
                    auto error = jsi::Object(rt);
                    error.setProperty(rt, "message", jsi::String::createFromUtf8(rt, "point must be at least a 2-element array [x, y] or [x, y, z]"));
                    return rejectMethod.callWithThis(rt, promiseConstructor, error);
                }
                
                float x = pointArray.getValueAtIndex(rt, 0).getNumber();
                float y = pointArray.getValueAtIndex(rt, 1).getNumber();
                float z = pointArray.size(rt) > 2 ? pointArray.getValueAtIndex(rt, 2).getNumber() : 0.0f;
                
                // Create a new Promise with proper async handling
                auto promiseConstructor = rt.global().getPropertyAsObject(rt, "Promise");
                return promiseConstructor.callAsConstructor(rt, jsi::Function::createFromHostFunction(
                    rt,
                    jsi::PropNameID::forAscii(rt, "unprojectPromiseExecutor"),
                    2,
                    [this, nodeId, x, y, z](jsi::Runtime& rt, const jsi::Value& thisValue, const jsi::Value* args, size_t count) -> jsi::Value {
                        if (count != 2) {
                            return jsi::Value::undefined();
                        }
                        
                        // Generate unique promise ID
                        std::string promiseId = generatePromiseId();
                        
                        // Store promise resolve/reject functions
                        {
                            std::lock_guard<std::mutex> lock(promisesMutex_);
                            pendingPromises_[promiseId] = {
                                std::shared_ptr<jsi::Runtime>(&rt, [](jsi::Runtime*){}), // Non-owning shared_ptr
                                std::make_shared<jsi::Function>(args[0].getObject(rt).getFunction(rt)),
                                std::make_shared<jsi::Function>(args[1].getObject(rt).getFunction(rt))
                            };
                        }
                        
                        // Call the Java method with promise ID for async resolution
                        static const auto unprojectPointAsyncMethod = 
                            javaPart_->getClass()->getMethod<void(jstring, jfloat, jfloat, jfloat, jstring)>("unprojectPointAsync");
                        unprojectPointAsyncMethod(
                            javaPart_.get(),
                            jni::make_jstring(nodeId).get(),
                            x, y, z,
                            jni::make_jstring(promiseId).get());
                        
                        return jsi::Value::undefined();
                    }
                ));
            }
        ));
        
        // Attach the NativeViro object to the global object
        runtime.global().setProperty(runtime, "NativeViro", std::move(nativeViro));
        
        // Add a method to register event callbacks
        runtime.global().setProperty(runtime, "registerViroEventCallback", jsi::Function::createFromHostFunction(
            runtime,
            jsi::PropNameID::forAscii(runtime, "registerViroEventCallback"),
            2,  // callbackId, callback
            [](jsi::Runtime& rt, const jsi::Value& thisValue, const jsi::Value* args, size_t count) -> jsi::Value {
                if (count < 2) {
                    return jsi::Value::undefined();
                }
                
                auto callbackId = args[0].getString(rt);
                auto callback = args[1];
                
                if (!callback.isObject() || !callback.getObject(rt).isFunction(rt)) {
                    return jsi::Value::undefined();
                }
                
                // Get or create the callback registry
                auto callbackRegistry = rt.global().getProperty(rt, "eventCallbacks");
                jsi::Object callbackRegistryObj(rt);
                
                if (!callbackRegistry.isObject()) {
                    callbackRegistryObj = jsi::Object(rt);
                    rt.global().setProperty(rt, "eventCallbacks", callbackRegistryObj);
                } else {
                    callbackRegistryObj = callbackRegistry.getObject(rt);
                }
                
                // Store the callback in the registry
                callbackRegistryObj.setProperty(rt, callbackId.utf8(rt).c_str(), callback);
                
                return jsi::Value::undefined();
            }
        ));
        
        // Test function for async Promise system
        nativeViro.setProperty(runtime, "testAsyncPromises", jsi::Function::createFromHostFunction(
            runtime,
            jsi::PropNameID::forAscii(runtime, "testAsyncPromises"),
            0,  // no arguments
            [this](jsi::Runtime& rt, const jsi::Value& thisValue, const jsi::Value* args, size_t count) -> jsi::Value {
                // Create a new Promise to test the async system
                auto promiseConstructor = rt.global().getPropertyAsObject(rt, "Promise");
                return promiseConstructor.callAsConstructor(rt, jsi::Function::createFromHostFunction(
                    rt,
                    jsi::PropNameID::forAscii(rt, "testPromiseExecutor"),
                    2,
                    [this](jsi::Runtime& rt, const jsi::Value& thisValue, const jsi::Value* args, size_t count) -> jsi::Value {
                        if (count != 2) {
                            return jsi::Value::undefined();
                        }
                        
                        // Generate unique promise ID for testing
                        std::string promiseId = generatePromiseId();
                        
                        // Store promise resolve/reject functions
                        {
                            std::lock_guard<std::mutex> lock(promisesMutex_);
                            pendingPromises_[promiseId] = {
                                std::shared_ptr<jsi::Runtime>(&rt, [](jsi::Runtime*){}), // Non-owning shared_ptr
                                std::make_shared<jsi::Function>(args[0].getObject(rt).getFunction(rt)),
                                std::make_shared<jsi::Function>(args[1].getObject(rt).getFunction(rt))
                            };
                        }
                        
                        // Call the Java test method
                        static const auto testAsyncPromiseSystemMethod = 
                            javaPart_->getClass()->getMethod<void(jstring)>("testAsyncPromiseSystem");
                        testAsyncPromiseSystemMethod(
                            javaPart_.get(),
                            jni::make_jstring(promiseId).get());
                        
                        return jsi::Value::undefined();
                    }
                ));
            }
        ));
        
        __android_log_print(ANDROID_LOG_INFO, "ViroFabricJSI", "JSI bindings installed successfully");
        __android_log_print(ANDROID_LOG_INFO, "ViroFabricJSI", "Async Promise system ready for testing");
    }

    // Helper method to convert JSI values to ReadableMap
    jni::local_ref<ReadableNativeMap::javaobject> convertJSIValueToReadableMap(jsi::Runtime& runtime, const jsi::Value& value) {
        if (!value.isObject()) {
            // Create an empty map for non-object values
            return ReadableNativeMap::newObjectCxxArgs();
        }
        
        auto obj = value.getObject(runtime);
        return ReadableNativeMap::createWithContents(runtime, std::move(obj));
    }
    
    // Helper method to convert ReadableMap to JSI value
    jsi::Value convertReadableMapToJSIValue(jsi::Runtime& runtime, jni::local_ref<ReadableNativeMap::javaobject> map) {
        if (!map) {
            return jsi::Object(runtime);
        }
        
        // Convert ReadableMap to JSI Object
        return ReadableNativeMap::convertToValue(runtime, map);
    }

    // Method to dispatch events to JavaScript using TurboModule
    void dispatchEventToJS(jni::alias_ref<jstring> callbackId, jni::alias_ref<ReadableNativeMap::javaobject> data) {
        std::string callbackIdStr = callbackId->toStdString();
        
        try {
            // Get the ViroEventsTurboModule instance
            auto turboModuleClass = jni::findClassLocal("com/viromedia/bridge/fabric/ViroEventsTurboModule");
            auto getInstanceMethod = turboModuleClass->getStaticMethod<jobject()>("getInstance");
            auto turboModuleInstance = getInstanceMethod(turboModuleClass);
            
            if (turboModuleInstance != nullptr) {
                // Check if the event system is ready
                auto isReadyMethod = turboModuleClass->getMethod<jboolean()>("isEventSystemReady");
                bool isReady = isReadyMethod(turboModuleInstance);
                
                if (isReady) {
                    // Emit the JSI callback through the TurboModule
                    auto emitCallbackMethod = turboModuleClass->getMethod<void(jstring, ReadableNativeMap::javaobject)>("emitJSICallbackInternal");
                    emitCallbackMethod(turboModuleInstance, callbackId, data);
                    
                    __android_log_print(ANDROID_LOG_INFO, "ViroFabricJSI", "Event callback emitted via TurboModule: %s", callbackIdStr.c_str());
                } else {
                    // Fallback to logging if no listeners are active
                    __android_log_print(ANDROID_LOG_WARN, "ViroFabricJSI", "No active listeners, logging event callback: %s", callbackIdStr.c_str());
                }
            } else {
                // Fallback to logging if TurboModule is not available
                __android_log_print(ANDROID_LOG_WARN, "ViroFabricJSI", "TurboModule not available, logging event callback: %s", callbackIdStr.c_str());
            }
            
        } catch (const std::exception& e) {
            __android_log_print(ANDROID_LOG_ERROR, "ViroFabricJSI", "Error emitting event callback %s: %s", callbackIdStr.c_str(), e.what());
            
            // Final fallback to logging
            __android_log_print(ANDROID_LOG_INFO, "ViroFabricJSI", "Fallback logging for callback: %s", callbackIdStr.c_str());
        }
    }

    // Promise callback handling
    void resolvePromise(jni::alias_ref<jstring> promiseId, jni::alias_ref<jstring> result) {
        std::string promiseIdStr = promiseId->toStdString();
        std::string resultStr = result->toStdString();
        
        __android_log_print(ANDROID_LOG_INFO, "ViroFabricJSI", "Resolving promise: %s with result: %s", promiseIdStr.c_str(), resultStr.c_str());
        
        std::lock_guard<std::mutex> lock(promisesMutex_);
        auto it = pendingPromises_.find(promiseIdStr);
        if (it != pendingPromises_.end()) {
            auto& promiseData = it->second;
            
            if (jsCallInvoker_) {
                jsCallInvoker_->invokeAsync([promiseData, resultStr]() {
                    try {
                        // Parse result as JSON array for projection coordinates
                        auto& runtime = *promiseData.runtime;
                        
                        if (resultStr.front() == '[' && resultStr.back() == ']') {
                            // Parse as coordinate array
                            std::string content = resultStr.substr(1, resultStr.length() - 2);
                            std::vector<double> coords;
                            std::stringstream ss(content);
                            std::string item;
                            
                            while (std::getline(ss, item, ',')) {
                                coords.push_back(std::stod(item));
                            }
                            
                            auto resultArray = jsi::Array(runtime, coords.size());
                            for (size_t i = 0; i < coords.size(); i++) {
                                resultArray.setValueAtIndex(runtime, i, jsi::Value(coords[i]));
                            }
                            
                            promiseData.resolve->call(runtime, resultArray);
                        } else {
                            // Parse as simple string
                            promiseData.resolve->call(runtime, jsi::String::createFromUtf8(runtime, resultStr));
                        }
                    } catch (const std::exception& e) {
                        __android_log_print(ANDROID_LOG_ERROR, "ViroFabricJSI", "Error resolving promise: %s", e.what());
                    }
                });
            }
            
            pendingPromises_.erase(it);
        }
    }
    
    void rejectPromise(jni::alias_ref<jstring> promiseId, jni::alias_ref<jstring> error) {
        std::string promiseIdStr = promiseId->toStdString();
        std::string errorStr = error->toStdString();
        
        __android_log_print(ANDROID_LOG_ERROR, "ViroFabricJSI", "Rejecting promise: %s with error: %s", promiseIdStr.c_str(), errorStr.c_str());
        
        std::lock_guard<std::mutex> lock(promisesMutex_);
        auto it = pendingPromises_.find(promiseIdStr);
        if (it != pendingPromises_.end()) {
            auto& promiseData = it->second;
            
            if (jsCallInvoker_) {
                jsCallInvoker_->invokeAsync([promiseData, errorStr]() {
                    try {
                        auto& runtime = *promiseData.runtime;
                        auto error = jsi::Object(runtime);
                        error.setProperty(runtime, "message", jsi::String::createFromUtf8(runtime, errorStr));
                        promiseData.reject->call(runtime, error);
                    } catch (const std::exception& e) {
                        __android_log_print(ANDROID_LOG_ERROR, "ViroFabricJSI", "Error rejecting promise: %s", e.what());
                    }
                });
            }
            
            pendingPromises_.erase(it);
        }
    }
    
    std::string generatePromiseId() {
        return "promise_" + std::to_string(++promiseCounter_) + "_" + std::to_string(std::chrono::duration_cast<std::chrono::milliseconds>(std::chrono::steady_clock::now().time_since_epoch()).count());
    }

    // Promise management structures
    struct PromiseData {
        std::shared_ptr<jsi::Runtime> runtime;
        std::shared_ptr<jsi::Function> resolve;
        std::shared_ptr<jsi::Function> reject;
    };
    
    std::map<std::string, PromiseData> pendingPromises_;
    std::mutex promisesMutex_;
    std::atomic<uint64_t> promiseCounter_;

    jni::global_ref<ViroFabricContainerJSI::javaobject> javaPart_;
    jsi::Runtime* runtime_;
    std::shared_ptr<facebook::react::CallInvoker> jsCallInvoker_;
};

JNIEXPORT jint JNI_OnLoad(JavaVM* vm, void*) {
    return facebook::jni::initialize(vm, [] {
        ViroFabricContainerJSI::registerNatives();
    });
}
