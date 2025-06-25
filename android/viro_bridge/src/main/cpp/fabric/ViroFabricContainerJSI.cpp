// Use the Prefab-provided headers
#include <fbjni/fbjni.h>
#include <jsi/jsi.h>
#include <react/jni/ReadableNativeMap.h>
#include <react/jni/WritableNativeMap.h>
#include <react/jni/JMessageQueueThread.h>
#include <react/jni/NativeMap.h>
#include <react/nativemodule/core/ReactCommon/CallInvokerHolder.h>
#include <android/log.h>

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
        });
    }

    ViroFabricContainerJSI(
        jni::alias_ref<ViroFabricContainerJSI::javaobject> jThis,
        jsi::Runtime* runtime,
        std::shared_ptr<facebook::react::CallInvoker> jsCallInvoker)
        : javaPart_(jni::make_global(jThis)),
          runtime_(runtime),
          jsCallInvoker_(std::move(jsCallInvoker)) {}

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
                    jni::make_jstring(childId).get(),
                    jni::make_jstring(parentId).get());
                
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
                    jni::make_jstring(childId).get(),
                    jni::make_jstring(parentId).get());
                
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
                    jni::make_jstring(callbackId).get(),
                    jni::make_jstring(eventName).get(),
                    jni::make_jstring(nodeId).get());
                
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
                    jni::make_jstring(callbackId).get(),
                    jni::make_jstring(eventName).get(),
                    jni::make_jstring(nodeId).get());
                
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
        
        __android_log_print(ANDROID_LOG_INFO, "ViroFabricJSI", "JSI bindings installed successfully");
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

    // Method to dispatch events to JavaScript
    void dispatchEventToJS(jni::alias_ref<jstring> callbackId, jni::alias_ref<ReadableNativeMap::javaobject> data) {
        if (!runtime_ || !jsCallInvoker_) {
            __android_log_print(ANDROID_LOG_ERROR, "ViroFabricJSI", "Cannot dispatch event: runtime or call invoker is null");
            return;
        }
        
        std::string callbackIdStr = callbackId->toStdString();
        
        // Convert ReadableMap to JSI value
        auto dataMap = data->cthis()->consume();
        
        // Use the jsCallInvoker to ensure we're on the JS thread
        jsCallInvoker_->invokeAsync([this, callbackIdStr, dataMap = std::move(dataMap)]() {
            if (!runtime_) return;
            
            auto& rt = *runtime_;
            
            try {
                // Find the callback in the global registry
                auto callbackRegistry = rt.global().getProperty(rt, "eventCallbacks");
                if (!callbackRegistry.isObject()) {
                    return;
                }
                
                auto callbackRegistryObj = callbackRegistry.getObject(rt);
                auto callback = callbackRegistryObj.getProperty(rt, callbackIdStr.c_str());
                
                if (!callback.isObject() || !callback.getObject(rt).isFunction(rt)) {
                    return;
                }
                
                // Convert the data map to a JSI object
                auto eventData = jsi::valueFromDynamic(rt, dataMap);
                
                // Call the callback with the event
                auto callbackFunc = callback.getObject(rt).getFunction(rt);
                callbackFunc.call(rt, eventData);
            } catch (const std::exception& e) {
                __android_log_print(ANDROID_LOG_ERROR, "ViroFabricJSI", "Error dispatching event: %s", e.what());
            }
        });
    }

    jni::global_ref<ViroFabricContainerJSI::javaobject> javaPart_;
    jsi::Runtime* runtime_;
    std::shared_ptr<facebook::react::CallInvoker> jsCallInvoker_;
};

JNIEXPORT jint JNI_OnLoad(JavaVM* vm, void*) {
    return facebook::jni::initialize(vm, [] {
        ViroFabricContainerJSI::registerNatives();
    });
}
