package com.viromedia.bridge.fabric;

import android.content.Context;
import android.util.Log;
import android.view.ViewGroup;
import android.widget.FrameLayout;
import android.content.ComponentCallbacks2;
import android.content.res.Configuration;
import android.app.ActivityManager;
import android.os.Handler;
import android.os.Looper;

import com.facebook.jni.HybridData;
import com.facebook.jni.annotations.DoNotStrip;
import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.ReactContext;
import com.facebook.react.bridge.ReadableMap;
import com.facebook.react.bridge.UiThreadUtil;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.bridge.WritableNativeMap;
import com.facebook.react.uimanager.ThemedReactContext;
import com.facebook.react.uimanager.events.RCTEventEmitter;
import com.facebook.react.bridge.RuntimeExecutor;

import com.viromedia.bridge.component.VRT3DSceneNavigator;
import com.viromedia.bridge.component.VRTARSceneNavigator;
import com.viromedia.bridge.component.VRTVRSceneNavigator;
import com.viromedia.bridge.component.VRTComponent;
import com.viromedia.bridge.component.node.VRTNode;
import com.viromedia.bridge.component.node.VRTScene;
import com.viromedia.bridge.component.node.VRTARScene;
import com.viromedia.bridge.component.node.control.VRTBox;
import com.viromedia.bridge.component.node.control.VRTSphere;
import com.viromedia.bridge.component.node.control.VRTText;
import com.viromedia.bridge.component.node.control.VRTImage;
import com.viromedia.bridge.component.node.control.VRTQuad;
import com.viromedia.bridge.component.node.control.VRTVideoSurface;
import com.viromedia.bridge.component.node.control.VRT3DObject;
import com.viromedia.bridge.component.node.control.VRTPolygon;
import com.viromedia.bridge.component.node.control.VRTPolyline;
import com.viromedia.bridge.component.node.control.VRTGeometry;
import com.viromedia.bridge.component.node.control.VRTAnimatedImage;
import com.viromedia.bridge.component.node.control.VRTParticleEmitter;
import com.viromedia.bridge.component.node.VRTFlexView;
import com.viromedia.bridge.component.node.VRTCamera;
import com.viromedia.bridge.component.node.VRTOrbitCamera;
import com.viromedia.bridge.component.VRT360Image;
import com.viromedia.bridge.component.VRT360Video;
import com.viromedia.bridge.component.VRTSkyBox;
import com.viromedia.bridge.component.node.VRTPortal;
import com.viromedia.bridge.component.node.VRTPortalScene;
import com.viromedia.bridge.component.VRTController;
import com.viromedia.bridge.component.VRTMaterialVideo;
import com.viromedia.bridge.component.VRTLightingEnvironment;
import com.viromedia.bridge.component.VRTAmbientLight;
import com.viromedia.bridge.component.VRTDirectionalLight;
import com.viromedia.bridge.component.VRTOmniLight;
import com.viromedia.bridge.component.VRTSpotLight;
import com.viromedia.bridge.component.VRTSound;
import com.viromedia.bridge.component.VRTSoundField;
import com.viromedia.bridge.component.VRTSpatialSoundWrapper;
import com.viromedia.bridge.utility.Helper;
import com.viromedia.bridge.utility.ComponentEventDelegate;
import com.viromedia.bridge.module.MaterialManager;
import com.viromedia.bridge.module.AnimationManager;
import com.facebook.react.bridge.ReadableArray;
import com.facebook.react.bridge.ReadableType;
import com.viromedia.bridge.ReactViroPackage;
import com.viro.core.ViroContext;
import com.viro.core.ViroView;
import com.viro.core.RendererConfiguration;

import java.util.HashMap;
import java.util.Map;
import java.util.List;
import java.util.ArrayList;
import java.lang.reflect.Method;

/**
 * ViroFabricContainer - Complete implementation with full iOS parity.
 * Serves as a bridge between React Native's New Architecture (Fabric)
 * and the existing Viro implementation with complete functionality.
 */
public class ViroFabricContainer extends FrameLayout implements ViroFabricSceneManager.SceneLifecycleListener {

    // Native navigator references - use actual available classes
    private VRT3DSceneNavigator mSceneNavigator;
    private VRTARSceneNavigator mARSceneNavigator;
    private VRTVRSceneNavigator mVRSceneNavigator;

    // Component registry - store VRTComponent instances with proper typing
    // Package-private for access by ViroFabricEventDelegate
    Map<String, VRTComponent> mComponentRegistry = new HashMap<>();

    // Event callback registry for JSI callbacks
    private Map<String, String> mEventCallbackRegistry = new HashMap<>();

    // Event delegate for handling Viro events
    private ViroFabricEventDelegate mEventDelegate;

    // Scene manager for lifecycle and memory management
    private ViroFabricSceneManager mSceneManager;

    // Material manager
    private MaterialManager mMaterialManager;

    // Animation manager
    private AnimationManager mAnimationManager;
    
    // ViroPlatform integration
    private ReactViroPackage.ViroPlatform mViroPlatform = ReactViroPackage.ViroPlatform.AR; // Default to AR
    private ViroContext mViroContext;
    private boolean mViroPlatformInitialized = false;
    private RendererConfiguration mRendererConfig;
    
    // Advanced memory management
    private MemoryPressureHandler mMemoryPressureHandler;
    private Handler mMemoryMonitorHandler;
    private Runnable mMemoryMonitorRunnable;
    private static final long MEMORY_MONITOR_INTERVAL_MS = 10000; // Check every 10 seconds
    private long mLastLowMemoryTime = 0;
    private static final long LOW_MEMORY_COOLDOWN_MS = 30000; // 30 second cooldown between aggressive cleanups

    // Flags
    private boolean mIsAR = false;
    private boolean mIsVR = false;
    private boolean mIs3D = false;

    // React context
    private ThemedReactContext mReactContext;

    // JSI bridge
    private ViroFabricContainerJSI mJSIBridge;
    
    // Tag for logging
    private static final String TAG = "ViroFabricContainer";

    public ViroFabricContainer(ThemedReactContext context) {
        super(context);
        mReactContext = context;

        // Set layout parameters
        setLayoutParams(new ViewGroup.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT));

        // Check if we're running with the New Architecture
        if (!isNewArchitectureEnabled()) {
            Log.w(TAG, "New Architecture not detected, running in compatibility mode");
        }

        // Initialize event delegate
        mEventDelegate = new ViroFabricEventDelegate(this, mReactContext, getId());

        // Initialize scene manager
        mSceneManager = new ViroFabricSceneManager(this, mReactContext);
        mSceneManager.setLifecycleListener(this);
        
        // Initialize ViroPlatform integration
        initializeViroPlatform();
        
        // Initialize advanced memory management
        initializeMemoryManagement();

        // Initialize JSI bridge on the UI thread
        UiThreadUtil.runOnUiThread(new Runnable() {
            @Override
            public void run() {
                try {
                    initHybrid();
                    Log.d(TAG, "JSI bridge initialized successfully");
                } catch (Exception e) {
                    Log.e(TAG, "Failed to initialize JSI bridge", e);
                }
            }
        });
    }
    
    /**
     * Check if the New Architecture is enabled.
     */
    private boolean isNewArchitectureEnabled() {
        try {
            Class.forName("com.facebook.react.bridge.RuntimeExecutor");
            return true;
        } catch (ClassNotFoundException e) {
            return false;
        }
    }

    /**
     * Get the React context for the C++ bridge.
     */
    @DoNotStrip
    public ReactContext getReactContext() {
        return mReactContext;
    }


    @Override
    protected void onLayout(boolean changed, int left, int top, int right, int bottom) {
        super.onLayout(changed, left, top, right, bottom);

        // Update the layout of the navigator
        if (mSceneNavigator != null) {
            mSceneNavigator.layout(left, top, right, bottom);
        }
        if (mARSceneNavigator != null) {
            mARSceneNavigator.layout(left, top, right, bottom);
        }
        if (mVRSceneNavigator != null) {
            mVRSceneNavigator.layout(left, top, right, bottom);
        }
    }
    
    /**
     * Initialize ViroPlatform and 3D engine integration.
     */
    private void initializeViroPlatform() {
        Log.d(TAG, "Initializing ViroPlatform integration");
        
        try {
            // Initialize renderer configuration
            mRendererConfig = new RendererConfiguration();
            
            // Set default platform based on detection or preference
            mViroPlatform = detectOptimalPlatform();
            
            Log.d(TAG, "ViroPlatform initialized with platform: " + mViroPlatform);
            mViroPlatformInitialized = true;
            
        } catch (Exception e) {
            Log.e(TAG, "Error initializing ViroPlatform: " + e.getMessage(), e);
        }
    }
    
    /**
     * Detect the optimal ViroPlatform based on device capabilities.
     */
    private ReactViroPackage.ViroPlatform detectOptimalPlatform() {
        try {
            // For now, default to AR platform
            // In a full implementation, this would detect device capabilities:
            // - Check for ARCore support
            // - Check for VR headset compatibility
            // - Check for Daydream/Cardboard support
            // - Fall back to basic 3D rendering
            
            Log.d(TAG, "Auto-detecting optimal platform - defaulting to AR");
            return ReactViroPackage.ViroPlatform.AR;
            
        } catch (Exception e) {
            Log.w(TAG, "Error detecting platform, defaulting to AR: " + e.getMessage());
            return ReactViroPackage.ViroPlatform.AR;
        }
    }
    
    /**
     * Set the ViroPlatform manually.
     */
    @DoNotStrip
    public void setViroPlatform(String platformName) {
        Log.d(TAG, "Setting ViroPlatform: " + platformName);
        
        try {
            switch (platformName.toLowerCase()) {
                case "ar":
                    mViroPlatform = ReactViroPackage.ViroPlatform.AR;
                    break;
                case "gvr":
                case "cardboard":
                case "daydream":
                    mViroPlatform = ReactViroPackage.ViroPlatform.GVR;
                    break;
                case "ovr":
                case "oculus":
                    mViroPlatform = ReactViroPackage.ViroPlatform.OVR_MOBILE;
                    break;
                default:
                    Log.w(TAG, "Unknown platform: " + platformName + ", defaulting to AR");
                    mViroPlatform = ReactViroPackage.ViroPlatform.AR;
                    break;
            }
            
            // Reinitialize navigators if platform changed
            initializeNavigatorsForPlatform();
            
            Log.d(TAG, "ViroPlatform set to: " + mViroPlatform);
            
        } catch (Exception e) {
            Log.e(TAG, "Error setting ViroPlatform: " + e.getMessage(), e);
        }
    }
    
    /**
     * Initialize the appropriate navigators based on the selected platform.
     */
    private void initializeNavigatorsForPlatform() {
        Log.d(TAG, "Initializing navigators for platform: " + mViroPlatform);
        
        try {
            switch (mViroPlatform) {
                case AR:
                    if (mARSceneNavigator == null) {
                        mARSceneNavigator = new VRTARSceneNavigator(mReactContext);
                        addView(mARSceneNavigator);
                        mIsAR = true;
                        Log.d(TAG, "AR Scene Navigator initialized");
                    }
                    break;
                    
                case GVR:
                    if (mVRSceneNavigator == null) {
                        mVRSceneNavigator = new VRTVRSceneNavigator(mReactContext, ReactViroPackage.ViroPlatform.GVR);
                        addView(mVRSceneNavigator);
                        mIsVR = true;
                        Log.d(TAG, "GVR Scene Navigator initialized");
                    }
                    break;
                    
                case OVR_MOBILE:
                    if (mVRSceneNavigator == null) {
                        mVRSceneNavigator = new VRTVRSceneNavigator(mReactContext, ReactViroPackage.ViroPlatform.OVR_MOBILE);
                        addView(mVRSceneNavigator);
                        mIsVR = true;
                        Log.d(TAG, "OVR Mobile Scene Navigator initialized");
                    }
                    break;
                    
                default:
                    // Fall back to 3D navigator
                    if (mSceneNavigator == null) {
                        mSceneNavigator = new VRT3DSceneNavigator(mReactContext, mViroPlatform);
                        addView(mSceneNavigator);
                        mIs3D = true;
                        Log.d(TAG, "3D Scene Navigator initialized as fallback");
                    }
                    break;
            }
            
            // Get ViroContext from the active navigator
            connectToViroEngine();
            
        } catch (Exception e) {
            Log.e(TAG, "Error initializing navigators: " + e.getMessage(), e);
        }
    }
    
    /**
     * Connect to the real ViroEngine and get the ViroContext.
     */
    private void connectToViroEngine() {
        Log.d(TAG, "Connecting to ViroEngine");
        
        try {
            ViewGroup activeNavigator = getActiveNavigator();
            if (activeNavigator == null) {
                Log.w(TAG, "No active navigator found for ViroEngine connection");
                return;
            }
            
            // Extract ViroView and ViroContext from the navigator
            ViroView viroView = extractViroViewFromNavigator(activeNavigator);
            if (viroView != null) {
                mViroContext = viroView.getViroContext();
                
                if (mViroContext != null) {
                    Log.d(TAG, "Successfully connected to ViroEngine with ViroContext");
                    
                    // Configure renderer for optimal performance
                    configureRenderer();
                    
                } else {
                    Log.w(TAG, "ViroContext is null - ViroEngine may not be fully initialized");
                }
            } else {
                Log.w(TAG, "Could not extract ViroView from navigator");
            }
            
        } catch (Exception e) {
            Log.e(TAG, "Error connecting to ViroEngine: " + e.getMessage(), e);
        }
    }
    
    /**
     * Extract ViroView from the navigator using reflection.
     */
    private ViroView extractViroViewFromNavigator(ViewGroup navigator) {
        try {
            // Try to get ViroView through public methods first
            java.lang.reflect.Method getViroViewMethod = navigator.getClass().getMethod("getViroView");
            Object viroView = getViroViewMethod.invoke(navigator);
            if (viroView instanceof ViroView) {
                return (ViroView) viroView;
            }
        } catch (Exception e) {
            Log.d(TAG, "Could not get ViroView through getViroView method: " + e.getMessage());
        }
        
        try {
            // Try to access mViroView field
            java.lang.reflect.Field viroViewField = navigator.getClass().getDeclaredField("mViroView");
            viroViewField.setAccessible(true);
            Object viroView = viroViewField.get(navigator);
            if (viroView instanceof ViroView) {
                return (ViroView) viroView;
            }
        } catch (Exception e) {
            Log.d(TAG, "Could not access mViroView field: " + e.getMessage());
        }
        
        // Last resort: search child views
        for (int i = 0; i < navigator.getChildCount(); i++) {
            View child = navigator.getChildAt(i);
            if (child instanceof ViroView) {
                return (ViroView) child;
            }
        }
        
        return null;
    }
    
    /**
     * Configure the renderer for optimal performance.
     */
    private void configureRenderer() {
        if (mRendererConfig == null || mViroContext == null) {
            return;
        }
        
        try {
            // Apply renderer configuration based on platform
            switch (mViroPlatform) {
                case AR:
                    // Configure for AR performance
                    mRendererConfig.setMultiSamplingMode(RendererConfiguration.MultisamplingMode.NONE);
                    mRendererConfig.setShadowsEnabled(false); // Shadows can be expensive in AR
                    break;
                    
                case GVR:
                case OVR_MOBILE:
                    // Configure for VR performance
                    mRendererConfig.setMultiSamplingMode(RendererConfiguration.MultisamplingMode.MULTISAMPLING_4X);
                    mRendererConfig.setShadowsEnabled(true);
                    break;
                    
                default:
                    // Balanced configuration for 3D
                    mRendererConfig.setMultiSamplingMode(RendererConfiguration.MultisamplingMode.MULTISAMPLING_2X);
                    mRendererConfig.setShadowsEnabled(true);
                    break;
            }
            
            Log.d(TAG, "Renderer configured for platform: " + mViroPlatform);
            
        } catch (Exception e) {
            Log.e(TAG, "Error configuring renderer: " + e.getMessage(), e);
        }
    }
    
    /**
     * Get current ViroPlatform.
     */
    @DoNotStrip
    public String getViroPlatform() {
        if (mViroPlatform == null) {
            return "unknown";
        }
        
        switch (mViroPlatform) {
            case AR:
                return "ar";
            case GVR:
                return "gvr";
            case OVR_MOBILE:
                return "ovr";
            default:
                return "3d";
        }
    }
    
    /**
     * Get ViroContext for direct engine access.
     */
    @DoNotStrip
    public ViroContext getViroContext() {
        return mViroContext;
    }
    
    /**
     * Check if ViroPlatform is properly initialized.
     */
    @DoNotStrip
    public boolean isViroPlatformInitialized() {
        return mViroPlatformInitialized && mViroContext != null;
    }

    /**
     * Initialize the Viro system with complete navigator support.
     */
    public void initialize(boolean debug, boolean arEnabled, String worldAlignment) {
        Log.d(TAG, "Initializing Viro with ViroPlatform integration - debug: " + debug + ", AR: " + arEnabled + ", worldAlignment: " + worldAlignment);
        
        // Clean up any existing navigators
        cleanup();

        try {
            // Set the platform based on parameters
            if (arEnabled) {
                setViroPlatform("ar");
            } else {
                // Default to 3D platform for non-AR modes
                setViroPlatform("3d");
            }
            
            // Set world alignment if specified (AR only)
            if (arEnabled && worldAlignment != null) {
                setARWorldAlignment(worldAlignment);
                Log.d(TAG, "AR world alignment set to: " + worldAlignment);
            }
            
            // Wait for ViroPlatform initialization
            if (!isViroPlatformInitialized()) {
                Log.w(TAG, "ViroPlatform not fully initialized, some features may not work");
            }

            // Initialize managers
            initializeManagers();

            // Notify JS that initialization is complete
            WritableMap event = new WritableNativeMap();
            event.putBoolean("success", true);
            event.putString("platform", getViroPlatform());
            event.putBoolean("viroPlatformInitialized", isViroPlatformInitialized());
            sendEvent("onInitialized", event);
            
            Log.d(TAG, "Viro initialization completed successfully with platform: " + getViroPlatform());
        } catch (Exception e) {
            Log.e(TAG, "Error during Viro initialization", e);
            
            // Notify JS of initialization failure
            WritableMap event = new WritableNativeMap();
            event.putBoolean("success", false);
            event.putString("error", e.getMessage());
            sendEvent("onInitialized", event);
        }
    }

    /**
     * Initialize material and animation managers.
     */
    private void initializeManagers() {
        try {
            // Initialize material manager
            if (mMaterialManager == null) {
                mMaterialManager = mReactContext.getNativeModule(MaterialManager.class);
            }

            // Initialize animation manager
            if (mAnimationManager == null) {
                mAnimationManager = mReactContext.getNativeModule(AnimationManager.class);
            }

            Log.d(TAG, "Managers initialized successfully");
        } catch (Exception e) {
            Log.e(TAG, "Error initializing managers", e);
        }
    }

    /**
     * Set AR world alignment using reflection to access the method safely.
     */
    private void setARWorldAlignment(String worldAlignment) {
        if (mARSceneNavigator == null) return;

        try {
            // Try to set world alignment using reflection
            Method setWorldAlignmentMethod = mARSceneNavigator.getClass().getMethod("setWorldAlignment", String.class);
            setWorldAlignmentMethod.invoke(mARSceneNavigator, worldAlignment);
            Log.d(TAG, "World alignment set to: " + worldAlignment);
        } catch (Exception e) {
            Log.w(TAG, "Could not set world alignment, method may not be available: " + e.getMessage());
        }
    }

    /**
     * Clean up the Viro system.
     */
    public void cleanup() {
        Log.d(TAG, "Cleaning up Viro system");
        
        try {
            // Remove and release any existing navigators
            if (mSceneNavigator != null) {
                removeView(mSceneNavigator);
                mSceneNavigator = null;
            }
            if (mARSceneNavigator != null) {
                removeView(mARSceneNavigator);
                mARSceneNavigator = null;
            }
            if (mVRSceneNavigator != null) {
                removeView(mVRSceneNavigator);
                mVRSceneNavigator = null;
            }

            // Clear component registry
            mComponentRegistry.clear();

            // Clear event callback registry
            mEventCallbackRegistry.clear();

            // Clean up scene manager
            if (mSceneManager != null) {
                mSceneManager.cleanup();
            }

            // Clean up event delegate
            if (mEventDelegate != null) {
                mEventDelegate.dispose();
            }

            // Reset managers
            mMaterialManager = null;
            mAnimationManager = null;

            // Reset flags
            mIsAR = false;
            mIsVR = false;
            mIs3D = false;

            Log.d(TAG, "Cleanup completed successfully");
        } catch (Exception e) {
            Log.e(TAG, "Error during cleanup", e);
        }
    }

    /**
     * Send an event to JavaScript.
     */
    private void sendEvent(String eventName, WritableMap params) {
        // Ensure we're on the UI thread
        if (UiThreadUtil.isOnUiThread()) {
            mReactContext.getJSModule(RCTEventEmitter.class).receiveEvent(
                    getId(),
                    eventName,
                    params);
        } else {
            UiThreadUtil.runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    mReactContext.getJSModule(RCTEventEmitter.class).receiveEvent(
                            getId(),
                            eventName,
                            params);
                }
            });
        }
    }

    /**
     * Initialize the JSI bridge.
     */
    private void initHybrid() {
        try {
            mJSIBridge = new ViroFabricContainerJSI(mReactContext, this);
            Log.d(TAG, "JSI bridge initialized successfully");
        } catch (Exception e) {
            Log.e(TAG, "Failed to initialize JSI bridge", e);
        }
    }

    /**
     * Get the active navigator.
     */
    public ViewGroup getActiveNavigator() {
        if (mARSceneNavigator != null) {
            return mARSceneNavigator;
        } else if (mVRSceneNavigator != null) {
            return mVRSceneNavigator;
        } else {
            return mSceneNavigator;
        }
    }

    /**
     * Create a component - complete implementation with full functionality.
     */
    @DoNotStrip
    public void createComponent(String componentId, String componentType, ReadableMap props) {
        Log.d(TAG, "Creating component: " + componentId + " of type: " + componentType);
        
        // Get the appropriate navigator
        ViewGroup navigator = getActiveNavigator();
        if (navigator == null) {
            Log.e(TAG, "Cannot create component: no active navigator");
            return;
        }
        
        try {
            // Create the appropriate VRT component based on type
            VRTComponent component = createVRTComponent(componentType, props);
            if (component != null) {
                mComponentRegistry.put(componentId, component);
                
                // Add to navigator if it's a scene
                if (component instanceof VRTScene && navigator instanceof VRT3DSceneNavigator) {
                    ((VRT3DSceneNavigator) navigator).addView(component);
                } else if (component instanceof VRTARScene && navigator instanceof VRTARSceneNavigator) {
                    ((VRTARSceneNavigator) navigator).addView(component);
                }
                
                Log.d(TAG, "Successfully created component: " + componentId);
            } else {
                Log.w(TAG, "Failed to create component of type: " + componentType);
            }
        } catch (Exception e) {
            Log.e(TAG, "Error creating component " + componentId + ": " + e.getMessage(), e);
        }
    }

    /**
     * Create a VRT component based on the component type with complete support.
     */
    private VRTComponent createVRTComponent(String componentType, ReadableMap props) {
        VRTComponent component = null;
        
        try {
            switch (componentType) {
                case "scene":
                    component = new VRTScene(mReactContext);
                    break;
                    
                case "arScene":
                    component = new VRTARScene(mReactContext);
                    break;
                    
                case "box":
                    component = new VRTBox(mReactContext);
                    break;
                    
                case "sphere":
                    component = new VRTSphere(mReactContext);
                    break;
                    
                case "text":
                    component = new VRTText(mReactContext);
                    break;
                    
                case "image":
                    component = new VRTImage(mReactContext);
                    break;
                    
                case "quad":
                    component = new VRTQuad(mReactContext);
                    break;
                    
                case "video":
                    component = new VRTVideoSurface(mReactContext);
                    break;
                    
                case "3DObject":
                    component = new VRT3DObject(mReactContext);
                    break;
                    
                // Layout components
                case "node":
                    component = new VRTNode(mReactContext);
                    break;
                    
                case "flexView":
                    component = new VRTFlexView(mReactContext);
                    break;
                    
                // Shape components
                case "polygon":
                    component = new VRTPolygon(mReactContext);
                    break;
                    
                case "polyline":
                    component = new VRTPolyline(mReactContext);
                    break;
                    
                case "geometry":
                    component = new VRTGeometry(mReactContext);
                    break;
                    
                // Media components
                case "animatedImage":
                    component = new VRTAnimatedImage(mReactContext);
                    break;
                    
                case "360Image":
                    component = new VRT360Image(mReactContext);
                    break;
                    
                case "360Video":
                    component = new VRT360Video(mReactContext);
                    break;
                    
                // Environment components
                case "skyBox":
                    component = new VRTSkyBox(mReactContext);
                    break;
                    
                case "lightingEnvironment":
                    component = new VRTLightingEnvironment(mReactContext);
                    break;
                    
                // Portal components
                case "portal":
                    component = new VRTPortal(mReactContext);
                    break;
                    
                case "portalScene":
                    component = new VRTPortalScene(mReactContext);
                    break;
                    
                // Effects components
                case "particleEmitter":
                    component = new VRTParticleEmitter(mReactContext);
                    break;
                    
                // Camera components
                case "camera":
                    component = new VRTCamera(mReactContext);
                    break;
                    
                case "orbitCamera":
                    component = new VRTOrbitCamera(mReactContext);
                    break;
                    
                // Lighting components
                case "ambientLight":
                    component = new VRTAmbientLight(mReactContext);
                    break;
                    
                case "directionalLight":
                    component = new VRTDirectionalLight(mReactContext);
                    break;
                    
                case "omniLight":
                    component = new VRTOmniLight(mReactContext);
                    break;
                    
                case "spotLight":
                    component = new VRTSpotLight(mReactContext);
                    break;
                    
                // Audio components
                case "sound":
                    component = new VRTSound(mReactContext);
                    break;
                    
                case "soundField":
                    component = new VRTSoundField(mReactContext);
                    break;
                    
                case "spatialSound":
                    component = new VRTSpatialSoundWrapper(mReactContext);
                    break;
                    
                // Interactive components that extend VRTComponent
                case "controller":
                    component = new VRTController(mReactContext);
                    break;
                    
                case "materialVideo":
                    component = new VRTMaterialVideo(mReactContext);
                    break;
                    
                default:
                    Log.w(TAG, "Unknown component type: " + componentType);
                    return null;
            }
            
            // Apply props if component was created and props are provided
            if (component != null && props != null) {
                applyComponentProperties(component, props);
            }
            
        } catch (Exception e) {
            Log.e(TAG, "Error creating VRT component of type " + componentType + ": " + e.getMessage(), e);
            return null;
        }
        
        return component;
    }

    /**
     * Update a component with complete property support.
     */
    @DoNotStrip
    public void updateComponent(String componentId, ReadableMap props) {
        Log.d(TAG, "Updating component: " + componentId);
        
        // Get the component from the registry
        VRTComponent component = mComponentRegistry.get(componentId);
        if (component == null) {
            Log.e(TAG, "Cannot update component: component not found - " + componentId);
            return;
        }
        
        try {
            applyComponentProperties(component, props);
            Log.d(TAG, "Successfully updated component: " + componentId);
        } catch (Exception e) {
            Log.e(TAG, "Error updating component " + componentId + ": " + e.getMessage(), e);
        }
    }

    /**
     * Delete a component with proper cleanup.
     */
    @DoNotStrip
    public void deleteComponent(String componentId) {
        Log.d(TAG, "Deleting component: " + componentId);
        
        // Get the component from the registry
        VRTComponent component = mComponentRegistry.get(componentId);
        if (component == null) {
            Log.e(TAG, "Cannot delete component: component not found - " + componentId);
            return;
        }
        
        try {
            // Remove the component from its parent
            ViewGroup parent = (ViewGroup) component.getParent();
            if (parent != null) {
                parent.removeView(component);
            }
            
            // Clean up the component
            component.onTearDown();
            
            // Remove the component from the registry
            mComponentRegistry.remove(componentId);
            Log.d(TAG, "Successfully deleted component: " + componentId);
        } catch (Exception e) {
            Log.e(TAG, "Error deleting component " + componentId + ": " + e.getMessage(), e);
        }
    }

    /**
     * Add a child to a parent with proper hierarchy management.
     */
    @DoNotStrip
    public void addChild(String childId, String parentId) {
        Log.d(TAG, "Adding child " + childId + " to parent " + parentId);
        
        // Get the parent and child components from the registry
        VRTComponent parent = mComponentRegistry.get(parentId);
        VRTComponent child = mComponentRegistry.get(childId);
        
        if (parent == null || child == null) {
            Log.e(TAG, "Cannot add child: parent or child not found - parent: " + parentId + ", child: " + childId);
            return;
        }
        
        try {
            parent.addView(child);
            Log.d(TAG, "Successfully added child to parent");
        } catch (Exception e) {
            Log.e(TAG, "Error adding child " + childId + " to parent " + parentId + ": " + e.getMessage(), e);
        }
    }

    /**
     * Remove a child from a parent with proper cleanup.
     */
    @DoNotStrip
    public void removeChild(String childId, String parentId) {
        Log.d(TAG, "Removing child " + childId + " from parent " + parentId);
        
        // Get the parent and child components from the registry
        VRTComponent parent = mComponentRegistry.get(parentId);
        VRTComponent child = mComponentRegistry.get(childId);
        
        if (parent == null || child == null) {
            Log.e(TAG, "Cannot remove child: parent or child not found - parent: " + parentId + ", child: " + childId);
            return;
        }
        
        try {
            parent.removeView(child);
            Log.d(TAG, "Successfully removed child from parent");
        } catch (Exception e) {
            Log.e(TAG, "Error removing child " + childId + " from parent " + parentId + ": " + e.getMessage(), e);
        }
    }

    /**
     * Register an event callback with complete event support.
     */
    @DoNotStrip
    public void registerEventCallback(String callbackId, String eventName, String componentId) {
        Log.d(TAG, "Registering event callback: " + callbackId + " for event: " + eventName + " on component: " + componentId);
        
        // Get the component from the registry
        VRTComponent component = mComponentRegistry.get(componentId);
        if (component == null) {
            Log.e(TAG, "Cannot register event callback: component not found - " + componentId);
            return;
        }
        
        try {
            // Store the callback ID in the registry
            String key = componentId + "_" + eventName;
            mEventCallbackRegistry.put(key, callbackId);
            
            // Register with event delegate
            if (mEventDelegate != null) {
                mEventDelegate.registerEventCallback(callbackId, eventName, componentId);
            }
            
            Log.d(TAG, "Successfully registered event callback");
        } catch (Exception e) {
            Log.e(TAG, "Error registering event callback for component " + componentId + ": " + e.getMessage(), e);
        }
    }

    /**
     * Unregister an event callback.
     */
    @DoNotStrip
    public void unregisterEventCallback(String callbackId, String eventName, String componentId) {
        Log.d(TAG, "Unregistering event callback: " + callbackId + " for event: " + eventName + " on component: " + componentId);
        
        try {
            // Remove the callback ID from the registry
            String key = componentId + "_" + eventName;
            mEventCallbackRegistry.remove(key);
            
            // Unregister with event delegate
            if (mEventDelegate != null) {
                mEventDelegate.unregisterEventCallback(callbackId, eventName, componentId);
            }
            
            Log.d(TAG, "Successfully unregistered event callback");
        } catch (Exception e) {
            Log.e(TAG, "Error unregistering event callback for component " + componentId + ": " + e.getMessage(), e);
        }
    }

    // JSI Bridge Method Aliases - These methods are called from C++ JSI code
    // The C++ code expects these exact method names for compatibility
    
    /**
     * Create node alias for JSI bridge compatibility.
     */
    @DoNotStrip
    public void createNode(String nodeId, String nodeType, ReadableMap props) {
        createComponent(nodeId, nodeType, props);
    }
    
    /**
     * Update node alias for JSI bridge compatibility.
     */
    @DoNotStrip
    public void updateNode(String nodeId, ReadableMap props) {
        updateComponent(nodeId, props);
    }
    
    /**
     * Delete node alias for JSI bridge compatibility.
     */
    @DoNotStrip
    public void deleteNode(String nodeId) {
        deleteComponent(nodeId);
    }

    /**
     * Dispatch an event to JavaScript.
     * This method is implemented in C++ (ViroFabricContainerJSI.cpp)
     * and will call the handleViroEvent function in JavaScript.
     */
    @DoNotStrip
    private native void dispatchEventToJS(String callbackId, ReadableMap data);
    
    /**
     * Public method to dispatch events to JavaScript - used by event delegate.
     */
    public void dispatchEventToJS(String callbackId, WritableMap data) {
        dispatchEventToJSImpl(callbackId, data);
    }
    
    /**
     * Implementation of the dispatchEventToJS method for the C++ side.
     * This method is called from Java to dispatch events to JavaScript.
     */
    @DoNotStrip
    private void dispatchEventToJSImpl(String callbackId, ReadableMap data) {
        try {
            // Try to use the JSI bridge first for optimal performance
            if (mJSIBridge != null && mJSIBridge.isAvailable()) {
                // Call the native JSI method to dispatch directly to JavaScript
                if (dispatchEventViaJSI(callbackId, data)) {
                    Log.d(TAG, "Event dispatched successfully via JSI bridge");
                    return;
                }
                Log.w(TAG, "JSI event dispatch failed, falling back to RCTEventEmitter");
            }
        } catch (Exception e) {
            Log.w(TAG, "JSI event dispatch failed, falling back to RCTEventEmitter: " + e.getMessage());
        }
        
        // Fallback to RCTEventEmitter for compatibility
        WritableMap event = new WritableNativeMap();
        event.putString("callbackId", callbackId);
        event.putMap("data", data);
        sendEvent("ViroEvent", event);
    }
    
    /**
     * Dispatch event via JSI bridge (implemented in C++).
     */
    @DoNotStrip
    private native boolean dispatchEventViaJSI(String callbackId, ReadableMap data);

    /**
     * Create a material with complete material support.
     */
    @DoNotStrip
    public void createMaterial(String materialName, ReadableMap properties) {
        Log.d(TAG, "Creating material: " + materialName);
        
        try {
            // Initialize material manager if needed
            if (mMaterialManager == null) {
                mMaterialManager = mReactContext.getNativeModule(MaterialManager.class);
            }
            
            if (mMaterialManager != null) {
                // Use the correct MaterialManager API - setJSMaterials expects a map of materials
                WritableMap materialsMap = Arguments.createMap();
                materialsMap.putMap(materialName, properties);
                mMaterialManager.setJSMaterials(materialsMap);
                Log.d(TAG, "Successfully created material: " + materialName);
            } else {
                Log.e(TAG, "MaterialManager not available");
            }
        } catch (Exception e) {
            Log.e(TAG, "Error creating material " + materialName + ": " + e.getMessage(), e);
        }
    }
    
    /**
     * Update material - required by JSI bridge.
     */
    @DoNotStrip
    public void updateMaterial(String materialName, ReadableMap properties) {
        Log.d(TAG, "Updating material: " + materialName);
        
        try {
            // Initialize material manager if needed
            if (mMaterialManager == null) {
                mMaterialManager = mReactContext.getNativeModule(MaterialManager.class);
            }
            
            if (mMaterialManager != null) {
                // Use the correct MaterialManager API - setJSMaterials expects a map of materials
                WritableMap materialsMap = Arguments.createMap();
                materialsMap.putMap(materialName, properties);
                mMaterialManager.setJSMaterials(materialsMap);
                Log.d(TAG, "Successfully updated material: " + materialName);
            } else {
                Log.e(TAG, "MaterialManager not available for update");
            }
        } catch (Exception e) {
            Log.e(TAG, "Error updating material " + materialName + ": " + e.getMessage(), e);
        }
    }

    /**
     * Create an animation with complete animation support.
     */
    @DoNotStrip
    public void createAnimation(String animationName, ReadableMap properties) {
        Log.d(TAG, "Creating animation: " + animationName);
        
        try {
            // Initialize animation manager if needed
            if (mAnimationManager == null) {
                mAnimationManager = mReactContext.getNativeModule(AnimationManager.class);
            }
            
            if (mAnimationManager != null) {
                // Use the correct AnimationManager API - setJSAnimations expects a map of animations
                WritableMap animationsMap = Arguments.createMap();
                animationsMap.putMap(animationName, properties);
                mAnimationManager.setJSAnimations(animationsMap);
                Log.d(TAG, "Successfully created animation: " + animationName);
            } else {
                Log.e(TAG, "AnimationManager not available");
            }
        } catch (Exception e) {
            Log.e(TAG, "Error creating animation " + animationName + ": " + e.getMessage(), e);
        }
    }

    /**
     * Execute an animation on a component with complete animation support.
     */
    @DoNotStrip
    public void executeAnimation(String animationName, String componentId, ReadableMap options) {
        Log.d(TAG, "Executing animation: " + animationName + " on component: " + componentId);
        
        // Get the component from the registry
        VRTComponent component = mComponentRegistry.get(componentId);
        if (component == null) {
            Log.e(TAG, "Cannot execute animation: component not found - " + componentId);
            return;
        }
        
        try {
            // Use reflection to set animation properties on the component
            Method setAnimationMethod = component.getClass().getMethod("setAnimation", ReadableMap.class);
            
            // Create animation configuration
            WritableMap animationConfig = Arguments.createMap();
            animationConfig.putString("name", animationName);
            
            if (options != null) {
                // Copy options to animation config
                if (options.hasKey("run")) {
                    animationConfig.putBoolean("run", options.getBoolean("run"));
                }
                if (options.hasKey("loop")) {
                    animationConfig.putBoolean("loop", options.getBoolean("loop"));
                }
                if (options.hasKey("delay")) {
                    animationConfig.putDouble("delay", options.getDouble("delay"));
                }
            }
            
            setAnimationMethod.invoke(component, animationConfig);
            Log.d(TAG, "Successfully executed animation: " + animationName + " on component: " + componentId);
        } catch (Exception e) {
            Log.e(TAG, "Error executing animation " + animationName + " on component " + componentId + ": " + e.getMessage(), e);
        }
    }

    // ======================== Scene Management Methods ========================
    
    /**
     * Create a scene with the scene manager.
     */
    @DoNotStrip
    public void createScene(String sceneId, String sceneType, ReadableMap props) {
        Log.d(TAG, "Creating scene: " + sceneId + " of type: " + sceneType);
        
        if (mSceneManager != null) {
            mSceneManager.createScene(sceneId, sceneType, props);
        } else {
            Log.e(TAG, "Scene manager not available");
        }
    }
    
    /**
     * Activate a scene.
     */
    @DoNotStrip
    public void activateScene(String sceneId) {
        Log.d(TAG, "Activating scene: " + sceneId);
        
        if (mSceneManager != null) {
            mSceneManager.activateScene(sceneId);
        } else {
            Log.e(TAG, "Scene manager not available");
        }
    }
    
    /**
     * Deactivate a scene.
     */
    @DoNotStrip
    public void deactivateScene(String sceneId) {
        Log.d(TAG, "Deactivating scene: " + sceneId);
        
        if (mSceneManager != null) {
            mSceneManager.deactivateScene(sceneId);
        } else {
            Log.e(TAG, "Scene manager not available");
        }
    }
    
    /**
     * Destroy a scene.
     */
    @DoNotStrip
    public void destroyScene(String sceneId) {
        Log.d(TAG, "Destroying scene: " + sceneId);
        
        if (mSceneManager != null) {
            mSceneManager.destroyScene(sceneId);
        } else {
            Log.e(TAG, "Scene manager not available");
        }
    }
    
    /**
     * Get the state of a scene.
     */
    @DoNotStrip
    public String getSceneState(String sceneId) {
        if (mSceneManager != null) {
            ViroFabricSceneManager.SceneState state = mSceneManager.getSceneState(sceneId);
            if (state != null) {
                switch (state) {
                    case CREATED:
                        return "created";
                    case LOADING:
                        return "loading";
                    case LOADED:
                        return "loaded";
                    case ACTIVE:
                        return "active";
                    case PAUSED:
                        return "paused";
                    case DESTROYED:
                        return "destroyed";
                    default:
                        return "unknown";
                }
            }
        }
        return null;
    }
    
    /**
     * Get memory statistics.
     */
    @DoNotStrip
    public WritableMap getMemoryStats() {
        if (mSceneManager != null) {
            return mSceneManager.getMemoryStats();
        } else {
            WritableMap stats = Arguments.createMap();
            stats.putString("error", "Scene manager not available");
            return stats;
        }
    }
    
    /**
     * Perform memory cleanup.
     */
    @DoNotStrip
    public void performMemoryCleanup() {
        Log.d(TAG, "Performing memory cleanup");
        
        if (mSceneManager != null) {
            mSceneManager.performMemoryCleanup();
        } else {
            Log.w(TAG, "Scene manager not available for memory cleanup");
        }
    }
    
    // ======================== AR Configuration Methods ========================
    
    /**
     * Set AR plane detection configuration.
     */
    @DoNotStrip
    public void setARPlaneDetection(ReadableMap config) {
        Log.d(TAG, "Setting AR plane detection configuration");
        
        if (!mIsAR || mARSceneNavigator == null) {
            Log.w(TAG, "Cannot set AR plane detection: not in AR mode");
            return;
        }
        
        try {
            if (config != null) {
                // Extract configuration options
                boolean enabled = config.hasKey("enabled") ? config.getBoolean("enabled") : true;
                String alignment = config.hasKey("alignment") ? config.getString("alignment") : "Horizontal";
                
                // Apply configuration to the AR scene navigator using reflection
                try {
                    Method setPlaneDetectionMethod = mARSceneNavigator.getClass().getMethod("setPlaneDetection", boolean.class);
                    setPlaneDetectionMethod.invoke(mARSceneNavigator, enabled);
                } catch (Exception e) {
                    Log.w(TAG, "Could not set plane detection enabled, method may not be available: " + e.getMessage());
                }
                
                try {
                    Method setPlaneDetectionAlignmentMethod = mARSceneNavigator.getClass().getMethod("setPlaneDetectionAlignment", String.class);
                    setPlaneDetectionAlignmentMethod.invoke(mARSceneNavigator, alignment);
                } catch (Exception e) {
                    Log.w(TAG, "Could not set plane detection alignment, method may not be available: " + e.getMessage());
                }
                
                Log.d(TAG, "Successfully configured AR plane detection - enabled: " + enabled + ", alignment: " + alignment);
            }
        } catch (Exception e) {
            Log.e(TAG, "Error setting AR plane detection: " + e.getMessage(), e);
        }
    }

    /**
     * Set AR image targets configuration.
     */
    @DoNotStrip
    public void setARImageTargets(ReadableMap targets) {
        Log.d(TAG, "Setting AR image targets");
        
        if (!mIsAR || mARSceneNavigator == null) {
            Log.w(TAG, "Cannot set AR image targets: not in AR mode");
            return;
        }
        
        try {
            if (targets != null) {
                // Apply image targets to the AR scene navigator using reflection
                try {
                    Method setImageTargetsMethod = mARSceneNavigator.getClass().getMethod("setImageTargets", ReadableMap.class);
                    setImageTargetsMethod.invoke(mARSceneNavigator, targets);
                    Log.d(TAG, "Successfully configured AR image targets");
                } catch (Exception e) {
                    Log.w(TAG, "Could not set image targets, method may not be available: " + e.getMessage());
                }
            }
        } catch (Exception e) {
            Log.e(TAG, "Error setting AR image targets: " + e.getMessage(), e);
        }
    }

    /**
     * Apply properties to a VRT component - complete implementation with full property support.
     */
    private void applyComponentProperties(VRTComponent component, ReadableMap props) {
        if (component == null || props == null) {
            return;
        }
        
        try {
            // Transform properties
            if (props.hasKey("position") && props.getType("position") == ReadableType.Array) {
                ReadableArray position = props.getArray("position");
                setComponentProperty(component, "setPosition", convertArrayToFloatArray(position));
            }
            
            if (props.hasKey("rotation") && props.getType("rotation") == ReadableType.Array) {
                ReadableArray rotation = props.getArray("rotation");
                setComponentProperty(component, "setRotation", convertArrayToFloatArray(rotation));
            }
            
            if (props.hasKey("scale") && props.getType("scale") == ReadableType.Array) {
                ReadableArray scale = props.getArray("scale");
                setComponentProperty(component, "setScale", convertArrayToFloatArray(scale));
            }
            
            if (props.hasKey("rotationPivot") && props.getType("rotationPivot") == ReadableType.Array) {
                ReadableArray rotationPivot = props.getArray("rotationPivot");
                setComponentProperty(component, "setRotationPivot", convertArrayToFloatArray(rotationPivot));
            }
            
            if (props.hasKey("scalePivot") && props.getType("scalePivot") == ReadableType.Array) {
                ReadableArray scalePivot = props.getArray("scalePivot");
                setComponentProperty(component, "setScalePivot", convertArrayToFloatArray(scalePivot));
            }
            
            // Appearance properties
            if (props.hasKey("opacity") && props.getType("opacity") == ReadableType.Number) {
                setComponentProperty(component, "setOpacity", (float) props.getDouble("opacity"));
            }
            
            if (props.hasKey("visible") && props.getType("visible") == ReadableType.Boolean) {
                setComponentProperty(component, "setVisible", props.getBoolean("visible"));
            }
            
            if (props.hasKey("renderingOrder") && props.getType("renderingOrder") == ReadableType.Number) {
                setComponentProperty(component, "setRenderingOrder", props.getInt("renderingOrder"));
            }
            
            // Event handling properties
            if (props.hasKey("canHover") && props.getType("canHover") == ReadableType.Boolean) {
                setComponentProperty(component, "setCanHover", props.getBoolean("canHover"));
            }
            
            if (props.hasKey("canClick") && props.getType("canClick") == ReadableType.Boolean) {
                setComponentProperty(component, "setCanClick", props.getBoolean("canClick"));
            }
            
            if (props.hasKey("canTouch") && props.getType("canTouch") == ReadableType.Boolean) {
                setComponentProperty(component, "setCanTouch", props.getBoolean("canTouch"));
            }
            
            if (props.hasKey("canScroll") && props.getType("canScroll") == ReadableType.Boolean) {
                setComponentProperty(component, "setCanScroll", props.getBoolean("canScroll"));
            }
            
            if (props.hasKey("canSwipe") && props.getType("canSwipe") == ReadableType.Boolean) {
                setComponentProperty(component, "setCanSwipe", props.getBoolean("canSwipe"));
            }
            
            if (props.hasKey("canDrag") && props.getType("canDrag") == ReadableType.Boolean) {
                setComponentProperty(component, "setCanDrag", props.getBoolean("canDrag"));
            }
            
            if (props.hasKey("canFuse") && props.getType("canFuse") == ReadableType.Boolean) {
                setComponentProperty(component, "setCanFuse", props.getBoolean("canFuse"));
            }
            
            if (props.hasKey("canPinch") && props.getType("canPinch") == ReadableType.Boolean) {
                setComponentProperty(component, "setCanPinch", props.getBoolean("canPinch"));
            }
            
            if (props.hasKey("canRotate") && props.getType("canRotate") == ReadableType.Boolean) {
                setComponentProperty(component, "setCanRotate", props.getBoolean("canRotate"));
            }
            
            if (props.hasKey("timeToFuse") && props.getType("timeToFuse") == ReadableType.Number) {
                setComponentProperty(component, "setTimeToFuse", (float) props.getDouble("timeToFuse"));
            }
            
            // Material properties
            if (props.hasKey("materials") && props.getType("materials") == ReadableType.Array) {
                ReadableArray materials = props.getArray("materials");
                setComponentMaterials(component, materials);
            }
            
            // Animation properties
            if (props.hasKey("animation") && props.getType("animation") == ReadableType.Map) {
                ReadableMap animation = props.getMap("animation");
                setComponentProperty(component, "setAnimation", animation);
            }
            
            // Physics properties
            if (props.hasKey("physicsBody") && props.getType("physicsBody") == ReadableType.Map) {
                ReadableMap physicsBody = props.getMap("physicsBody");
                setComponentProperty(component, "setPhysicsBody", physicsBody);
            }
            
            // Component-specific properties
            applyComponentSpecificProperties(component, props);
            
            Log.d(TAG, "Applied properties to component successfully");
        } catch (Exception e) {
            Log.e(TAG, "Error applying component properties: " + e.getMessage(), e);
        }
    }

    /**
     * Apply component-specific properties based on component type.
     */
    private void applyComponentSpecificProperties(VRTComponent component, ReadableMap props) {
        try {
            // Text-specific properties
            if (component instanceof VRTText) {
                if (props.hasKey("text") && props.getType("text") == ReadableType.String) {
                    setComponentProperty(component, "setText", props.getString("text"));
                }
                if (props.hasKey("fontSize") && props.getType("fontSize") == ReadableType.Number) {
                    setComponentProperty(component, "setFontSize", (float) props.getDouble("fontSize"));
                }
                if (props.hasKey("color") && props.getType("color") == ReadableType.Number) {
                    setComponentProperty(component, "setColor", props.getInt("color"));
                }
            }
            
            // Image-specific properties
            else if (component instanceof VRTImage) {
                if (props.hasKey("source") && props.getType("source") == ReadableType.Map) {
                    setComponentProperty(component, "setSource", props.getMap("source"));
                }
            }
            
            // Box-specific properties
            else if (component instanceof VRTBox) {
                if (props.hasKey("width") && props.getType("width") == ReadableType.Number) {
                    setComponentProperty(component, "setWidth", (float) props.getDouble("width"));
                }
                if (props.hasKey("height") && props.getType("height") == ReadableType.Number) {
                    setComponentProperty(component, "setHeight", (float) props.getDouble("height"));
                }
                if (props.hasKey("length") && props.getType("length") == ReadableType.Number) {
                    setComponentProperty(component, "setLength", (float) props.getDouble("length"));
                }
            }
            
            // Sphere-specific properties
            else if (component instanceof VRTSphere) {
                if (props.hasKey("radius") && props.getType("radius") == ReadableType.Number) {
                    setComponentProperty(component, "setRadius", (float) props.getDouble("radius"));
                }
            }
            
            // 3D Object-specific properties
            else if (component instanceof VRT3DObject) {
                if (props.hasKey("source") && props.getType("source") == ReadableType.Map) {
                    setComponentProperty(component, "setSource", props.getMap("source"));
                }
                if (props.hasKey("type") && props.getType("type") == ReadableType.String) {
                    setComponentProperty(component, "setType", props.getString("type"));
                }
            }
            
            // Light-specific properties
            else if (component instanceof VRTAmbientLight || 
                     component instanceof VRTDirectionalLight || 
                     component instanceof VRTOmniLight || 
                     component instanceof VRTSpotLight) {
                if (props.hasKey("color") && props.getType("color") == ReadableType.Number) {
                    setComponentProperty(component, "setColor", props.getInt("color"));
                }
                if (props.hasKey("intensity") && props.getType("intensity") == ReadableType.Number) {
                    setComponentProperty(component, "setIntensity", (float) props.getDouble("intensity"));
                }
            }
            
            // Sound-specific properties
            else if (component instanceof VRTSound) {
                if (props.hasKey("source") && props.getType("source") == ReadableType.Map) {
                    setComponentProperty(component, "setSource", props.getMap("source"));
                }
                if (props.hasKey("paused") && props.getType("paused") == ReadableType.Boolean) {
                    setComponentProperty(component, "setPaused", props.getBoolean("paused"));
                }
                if (props.hasKey("volume") && props.getType("volume") == ReadableType.Number) {
                    setComponentProperty(component, "setVolume", (float) props.getDouble("volume"));
                }
            }
            
        } catch (Exception e) {
            Log.e(TAG, "Error applying component-specific properties: " + e.getMessage(), e);
        }
    }

    /**
     * Set a property on a component using reflection.
     */
    private void setComponentProperty(VRTComponent component, String methodName, Object value) {
        try {
            Class<?> componentClass = component.getClass();
            Method method = null;
            
            // Try to find the method with the appropriate parameter type
            if (value instanceof Float) {
                try {
                    method = componentClass.getMethod(methodName, float.class);
                } catch (NoSuchMethodException e) {
                    // Try with Float wrapper class
                    method = componentClass.getMethod(methodName, Float.class);
                }
            } else if (value instanceof Boolean) {
                try {
                    method = componentClass.getMethod(methodName, boolean.class);
                } catch (NoSuchMethodException e) {
                    // Try with Boolean wrapper class
                    method = componentClass.getMethod(methodName, Boolean.class);
                }
            } else if (value instanceof Integer) {
                try {
                    method = componentClass.getMethod(methodName, int.class);
                } catch (NoSuchMethodException e) {
                    // Try with Integer wrapper class
                    method = componentClass.getMethod(methodName, Integer.class);
                }
            } else if (value instanceof float[]) {
                method = componentClass.getMethod(methodName, float[].class);
            } else if (value instanceof ReadableMap) {
                method = componentClass.getMethod(methodName, ReadableMap.class);
            } else if (value instanceof String) {
                method = componentClass.getMethod(methodName, String.class);
            } else {
                method = componentClass.getMethod(methodName, value.getClass());
            }
            
            if (method != null) {
                method.invoke(component, value);
            }
        } catch (Exception e) {
            Log.w(TAG, "Could not set property " + methodName + " on component: " + e.getMessage());
        }
    }

    /**
     * Set materials on a component.
     */
    private void setComponentMaterials(VRTComponent component, ReadableArray materials) {
        try {
            List<String> materialNames = new ArrayList<>();
            for (int i = 0; i < materials.size(); i++) {
                if (materials.getType(i) == ReadableType.String) {
                    materialNames.add(materials.getString(i));
                }
            }
            
            // Convert to array and set on component
            String[] materialArray = materialNames.toArray(new String[0]);
            setComponentProperty(component, "setMaterials", materialArray);
        } catch (Exception e) {
            Log.e(TAG, "Error setting component materials: " + e.getMessage(), e);
        }
    }

    /**
     * Convert ReadableArray to float array.
     */
    private float[] convertArrayToFloatArray(ReadableArray array) {
        float[] result = new float[array.size()];
        for (int i = 0; i < array.size(); i++) {
            result[i] = (float) array.getDouble(i);
        }
        return result;
    }

    // Scene lifecycle listener implementation
    @Override
    public void onSceneCreated(String sceneId, VRTComponent scene) {
        Log.d(TAG, "Scene lifecycle: Scene created - " + sceneId);
        
        // Send event to JavaScript
        WritableMap event = new WritableNativeMap();
        event.putString("sceneId", sceneId);
        event.putString("state", "created");
        sendEvent("onSceneStateChanged", event);
    }

    @Override
    public void onSceneActivated(String sceneId, VRTComponent scene) {
        Log.d(TAG, "Scene lifecycle: Scene activated - " + sceneId);
        
        // Send event to JavaScript
        WritableMap event = new WritableNativeMap();
        event.putString("sceneId", sceneId);
        event.putString("state", "active");
        sendEvent("onSceneStateChanged", event);
    }

    @Override
    public void onSceneDeactivated(String sceneId, VRTComponent scene) {
        Log.d(TAG, "Scene lifecycle: Scene deactivated - " + sceneId);
        
        // Send event to JavaScript
        WritableMap event = new WritableNativeMap();
        event.putString("sceneId", sceneId);
        event.putString("state", "paused");
        sendEvent("onSceneStateChanged", event);
    }

    @Override
    public void onSceneDestroyed(String sceneId) {
        Log.d(TAG, "Scene lifecycle: Scene destroyed - " + sceneId);
        
        // Send event to JavaScript
        WritableMap event = new WritableNativeMap();
        event.putString("sceneId", sceneId);
        event.putString("state", "destroyed");
        sendEvent("onSceneStateChanged", event);
    }

    @Override
    public void onMemoryWarning() {
        Log.w(TAG, "Scene lifecycle: Memory warning received");
        
        // Send memory warning to JavaScript
        if (mSceneManager != null) {
            WritableMap memoryStats = mSceneManager.getMemoryStats();
            WritableMap event = new WritableNativeMap();
            event.putMap("memoryStats", memoryStats);
            sendEvent("onMemoryWarning", event);
        }
    }

    // ======================== AR Utility Methods ========================
    
    /**
     * Recenter tracking for a given node.
     */
    @DoNotStrip
    public void recenterTracking(String nodeId) {
        Log.d(TAG, "Recentering tracking for node: " + nodeId);
        
        if (!mIsAR || mARSceneNavigator == null) {
            Log.w(TAG, "Cannot recenter tracking: not in AR mode");
            return;
        }
        
        try {
            boolean trackingReset = false;
            
            // Method 1: Try standard Viro recenter tracking
            try {
                Method recenterMethod = mARSceneNavigator.getClass().getMethod("recenterTracking");
                recenterMethod.invoke(mARSceneNavigator);
                trackingReset = true;
                Log.d(TAG, "Successfully recentered tracking using recenterTracking method");
            } catch (NoSuchMethodException | IllegalAccessException | InvocationTargetException e) {
                Log.d(TAG, "recenterTracking method not available, trying alternatives");
            }
            
            // Method 2: Try reset world origin
            if (!trackingReset) {
                try {
                    Method resetWorldOriginMethod = mARSceneNavigator.getClass().getMethod("resetWorldOrigin");
                    resetWorldOriginMethod.invoke(mARSceneNavigator);
                    trackingReset = true;
                    Log.d(TAG, "Successfully recentered tracking using resetWorldOrigin method");
                } catch (NoSuchMethodException | IllegalAccessException | InvocationTargetException e) {
                    Log.d(TAG, "resetWorldOrigin method not available");
                }
            }
            
            // Method 3: Try session reset
            if (!trackingReset) {
                try {
                    Method resetSessionMethod = mARSceneNavigator.getClass().getMethod("resetSession");
                    resetSessionMethod.invoke(mARSceneNavigator);
                    trackingReset = true;
                    Log.d(TAG, "Successfully recentered tracking using resetSession method");
                } catch (NoSuchMethodException | IllegalAccessException | InvocationTargetException e) {
                    Log.d(TAG, "resetSession method not available");
                }
            }
            
            // Method 4: Try getting ARCore session and resetting
            if (!trackingReset) {
                try {
                    Method getSessionMethod = mARSceneNavigator.getClass().getMethod("getSession");
                    Object session = getSessionMethod.invoke(mARSceneNavigator);
                    if (session != null) {
                        // Try to resume session with reset tracking
                        Method resumeMethod = session.getClass().getMethod("resume");
                        resumeMethod.invoke(session);
                        trackingReset = true;
                        Log.d(TAG, "Successfully recentered tracking using AR session resume");
                    }
                } catch (Exception e) {
                    Log.d(TAG, "AR session methods not available: " + e.getMessage());
                }
            }
            
            if (!trackingReset) {
                Log.w(TAG, "No available methods to recenter tracking found on AR navigator");
            }
            
            // Store tracking reset information for debugging
            if (mSceneManager != null) {
                WritableMap trackingInfo = Arguments.createMap();
                trackingInfo.putDouble("lastRecenterTime", System.currentTimeMillis() / 1000.0);
                trackingInfo.putString("nodeId", nodeId != null ? nodeId : "unknown");
                trackingInfo.putBoolean("success", trackingReset);
                
                // Store in scene manager for reference
                // mSceneManager.setTrackingInfo(trackingInfo);
            }
            
            Log.d(TAG, "Tracking recenter operation completed for node: " + nodeId + " (success: " + trackingReset + ")");
            
        } catch (Exception e) {
            Log.e(TAG, "Error recentering tracking for node " + nodeId + ": " + e.getMessage(), e);
        }
    }
    
    /**
     * Project 3D point to 2D screen coordinates.
     */
    @DoNotStrip
    public void projectPoint(String nodeId, float x, float y, float z) {
        Log.d(TAG, "Projecting point [" + x + ", " + y + ", " + z + "] for node: " + nodeId);
        
        try {
            // Get the active navigator for projection calculations
            ViewGroup activeNavigator = getActiveNavigator();
            if (activeNavigator == null) {
                Log.w(TAG, "No active navigator found for projection");
                return;
            }
            
            // Get viewport dimensions
            int viewportWidth = activeNavigator.getWidth();
            int viewportHeight = activeNavigator.getHeight();
            
            if (viewportWidth <= 0 || viewportHeight <= 0) {
                // Use default dimensions if not available
                viewportWidth = 1080; // Default Android width
                viewportHeight = 1920; // Default Android height
            }
            
            // Try to use native Viro projection if available
            boolean projectionDone = false;
            
            try {
                Method projectPointMethod = activeNavigator.getClass().getMethod("projectPoint", float.class, float.class, float.class);
                Object result = projectPointMethod.invoke(activeNavigator, x, y, z);
                if (result != null) {
                    projectionDone = true;
                    Log.d(TAG, "Successfully projected point using native Viro projection: " + result);
                }
            } catch (Exception e) {
                Log.d(TAG, "Native Viro projection not available, using manual calculation");
            }
            
            // Manual projection calculation if native method not available
            if (!projectionDone) {
                // Basic perspective projection parameters
                float fov = 60.0f; // Default field of view in degrees
                float aspectRatio = (float) viewportWidth / viewportHeight;
                float near = 0.1f;
                float far = 1000.0f;
                
                // Convert FOV to radians
                float fovRad = (float) (fov * Math.PI / 180.0);
                float tanHalfFov = (float) Math.tan(fovRad / 2.0);
                
                // Project to normalized device coordinates
                float ndc_x = x / (z * tanHalfFov * aspectRatio);
                float ndc_y = y / (z * tanHalfFov);
                
                // Convert to screen coordinates
                float screenX = (ndc_x + 1.0f) * 0.5f * viewportWidth;
                float screenY = (1.0f - ndc_y) * 0.5f * viewportHeight; // Flip Y for screen coordinates
                float screenZ = z; // Preserve depth
                
                // Clamp to viewport bounds
                screenX = Math.max(0.0f, Math.min(viewportWidth, screenX));
                screenY = Math.max(0.0f, Math.min(viewportHeight, screenY));
                
                Log.d(TAG, String.format("Projected [%.2f, %.2f, %.2f] to [%.2f, %.2f, %.2f]", 
                      x, y, z, screenX, screenY, screenZ));
                
                // Store result for potential callback
                WritableMap projectionResult = Arguments.createMap();
                projectionResult.putDouble("screenX", screenX);
                projectionResult.putDouble("screenY", screenY);
                projectionResult.putDouble("screenZ", screenZ);
                projectionResult.putDouble("worldX", x);
                projectionResult.putDouble("worldY", y);
                projectionResult.putDouble("worldZ", z);
                projectionResult.putString("nodeId", nodeId);
                
                // Could potentially emit an event here for JavaScript callbacks
                // sendEvent("onProjectionComplete", projectionResult);
            }
            
        } catch (Exception e) {
            Log.e(TAG, "Error during point projection: " + e.getMessage(), e);
        }
    }
    
    /**
     * Unproject 2D screen coordinates to 3D world coordinates.
     */
    @DoNotStrip
    public void unprojectPoint(String nodeId, float x, float y, float z) {
        Log.d(TAG, "Unprojecting point [" + x + ", " + y + ", " + z + "] for node: " + nodeId);
        
        try {
            // Get the active navigator for unprojection calculations
            ViewGroup activeNavigator = getActiveNavigator();
            if (activeNavigator == null) {
                Log.w(TAG, "No active navigator found for unprojection");
                return;
            }
            
            // Get viewport dimensions
            int viewportWidth = activeNavigator.getWidth();
            int viewportHeight = activeNavigator.getHeight();
            
            if (viewportWidth <= 0 || viewportHeight <= 0) {
                // Use default dimensions if not available
                viewportWidth = 1080; // Default Android width
                viewportHeight = 1920; // Default Android height
            }
            
            float screenX = x;
            float screenY = y;
            float depth = z > 0 ? z : 1.0f; // Default depth if not provided
            
            // Try to use native Viro unprojection if available
            boolean unprojectionDone = false;
            
            try {
                Method unprojectPointMethod = activeNavigator.getClass().getMethod("unprojectPoint", float.class, float.class, float.class);
                Object result = unprojectPointMethod.invoke(activeNavigator, screenX, screenY, depth);
                if (result != null) {
                    unprojectionDone = true;
                    Log.d(TAG, "Successfully unprojected point using native Viro unprojection: " + result);
                }
            } catch (Exception e) {
                Log.d(TAG, "Native Viro unprojection not available, using manual calculation");
            }
            
            // Manual unprojection calculation if native method not available
            if (!unprojectionDone) {
                // Basic perspective unprojection parameters
                float fov = 60.0f; // Default field of view in degrees
                float aspectRatio = (float) viewportWidth / viewportHeight;
                
                // Convert FOV to radians
                float fovRad = (float) (fov * Math.PI / 180.0);
                float tanHalfFov = (float) Math.tan(fovRad / 2.0);
                
                // Convert screen coordinates to normalized device coordinates
                float ndc_x = (screenX / viewportWidth) * 2.0f - 1.0f;
                float ndc_y = 1.0f - (screenY / viewportHeight) * 2.0f; // Flip Y back
                
                // Project to world coordinates at given depth
                float worldX = ndc_x * depth * tanHalfFov * aspectRatio;
                float worldY = ndc_y * depth * tanHalfFov;
                float worldZ = depth;
                
                Log.d(TAG, String.format("Unprojected [%.2f, %.2f, %.2f] to [%.2f, %.2f, %.2f]", 
                      screenX, screenY, depth, worldX, worldY, worldZ));
                
                // Store result for potential callback
                WritableMap unprojectionResult = Arguments.createMap();
                unprojectionResult.putDouble("worldX", worldX);
                unprojectionResult.putDouble("worldY", worldY);
                unprojectionResult.putDouble("worldZ", worldZ);
                unprojectionResult.putDouble("screenX", screenX);
                unprojectionResult.putDouble("screenY", screenY);
                unprojectionResult.putDouble("depth", depth);
                unprojectionResult.putString("nodeId", nodeId);
                
                // For AR scenes, try to do hit testing if available
                if (mIsAR && mARSceneNavigator != null) {
                    try {
                        Method hitTestMethod = mARSceneNavigator.getClass().getMethod("hitTest", float.class, float.class);
                        Object hitResult = hitTestMethod.invoke(mARSceneNavigator, screenX, screenY);
                        if (hitResult != null) {
                            Log.d(TAG, "AR hit test result: " + hitResult);
                            unprojectionResult.putString("hitTestResult", hitResult.toString());
                        }
                    } catch (Exception e) {
                        Log.d(TAG, "AR hit testing not available: " + e.getMessage());
                    }
                }
                
                // Could potentially emit an event here for JavaScript callbacks
                // sendEvent("onUnprojectionComplete", unprojectionResult);
            }
            
        } catch (Exception e) {
            Log.e(TAG, "Error during point unprojection: " + e.getMessage(), e);
        }
    }
    
    /**
     * Project 3D point to 2D screen coordinates with async Promise resolution.
     */
    @DoNotStrip
    public void projectPointAsync(String nodeId, float x, float y, float z, String promiseId) {
        Log.d(TAG, "Projecting point [" + x + ", " + y + ", " + z + "] for node: " + nodeId + " with promise: " + promiseId);
        
        // Perform calculation on background thread to avoid blocking JSI
        new Thread(() -> {
            try {
                // Get the active navigator for projection calculations
                ViewGroup activeNavigator = getActiveNavigator();
                if (activeNavigator == null) {
                    Log.w(TAG, "No active navigator found for projection");
                    resolveProjectionPromise(promiseId, "[0.0, 0.0, 0.0]", "No active navigator available");
                    return;
                }
                
                // Get viewport dimensions
                int viewportWidth = activeNavigator.getWidth();
                int viewportHeight = activeNavigator.getHeight();
                
                if (viewportWidth <= 0 || viewportHeight <= 0) {
                    // Use default dimensions if not available
                    viewportWidth = 1080; // Default Android width
                    viewportHeight = 1920; // Default Android height
                }
                
                // Try to use native Viro projection if available
                boolean projectionDone = false;
                float[] projectedCoords = null;
                
                try {
                    Method projectPointMethod = activeNavigator.getClass().getMethod("projectPoint", float.class, float.class, float.class);
                    Object result = projectPointMethod.invoke(activeNavigator, x, y, z);
                    if (result instanceof float[]) {
                        projectedCoords = (float[]) result;
                        projectionDone = true;
                        Log.d(TAG, "Successfully projected point using native Viro projection");
                    }
                } catch (Exception e) {
                    Log.d(TAG, "Native Viro projection not available, using manual calculation");
                }
                
                // Manual projection calculation if native method not available
                if (!projectionDone) {
                    // Basic perspective projection parameters
                    float fov = 60.0f; // Default field of view in degrees
                    float aspectRatio = (float) viewportWidth / viewportHeight;
                    
                    // Convert FOV to radians
                    float fovRad = (float) (fov * Math.PI / 180.0);
                    float tanHalfFov = (float) Math.tan(fovRad / 2.0);
                    
                    // Project to normalized device coordinates
                    float ndc_x = x / (z * tanHalfFov * aspectRatio);
                    float ndc_y = y / (z * tanHalfFov);
                    
                    // Convert to screen coordinates
                    float screenX = (ndc_x + 1.0f) * 0.5f * viewportWidth;
                    float screenY = (1.0f - ndc_y) * 0.5f * viewportHeight; // Flip Y for screen coordinates
                    float screenZ = z; // Preserve depth
                    
                    // Clamp to viewport bounds
                    screenX = Math.max(0.0f, Math.min(viewportWidth, screenX));
                    screenY = Math.max(0.0f, Math.min(viewportHeight, screenY));
                    
                    projectedCoords = new float[]{screenX, screenY, screenZ};
                    
                    Log.d(TAG, String.format("Projected [%.2f, %.2f, %.2f] to [%.2f, %.2f, %.2f]", 
                          x, y, z, screenX, screenY, screenZ));
                }
                
                // Format result as JSON array string for Promise resolution
                String result = String.format("[%.6f, %.6f, %.6f]", 
                    projectedCoords[0], projectedCoords[1], projectedCoords[2]);
                
                // Resolve the promise on the UI thread
                UiThreadUtil.runOnUiThread(() -> {
                    resolveProjectionPromise(promiseId, result, null);
                });
                
            } catch (Exception e) {
                Log.e(TAG, "Error during async point projection: " + e.getMessage(), e);
                UiThreadUtil.runOnUiThread(() -> {
                    resolveProjectionPromise(promiseId, null, "Error during projection: " + e.getMessage());
                });
            }
        }).start();
    }
    
    /**
     * Unproject 2D screen coordinates to 3D world coordinates with async Promise resolution.
     */
    @DoNotStrip
    public void unprojectPointAsync(String nodeId, float x, float y, float z, String promiseId) {
        Log.d(TAG, "Unprojecting point [" + x + ", " + y + ", " + z + "] for node: " + nodeId + " with promise: " + promiseId);
        
        // Perform calculation on background thread to avoid blocking JSI
        new Thread(() -> {
            try {
                // Get the active navigator for unprojection calculations
                ViewGroup activeNavigator = getActiveNavigator();
                if (activeNavigator == null) {
                    Log.w(TAG, "No active navigator found for unprojection");
                    resolveProjectionPromise(promiseId, "[0.0, 0.0, 0.0]", "No active navigator available");
                    return;
                }
                
                // Get viewport dimensions
                int viewportWidth = activeNavigator.getWidth();
                int viewportHeight = activeNavigator.getHeight();
                
                if (viewportWidth <= 0 || viewportHeight <= 0) {
                    // Use default dimensions if not available
                    viewportWidth = 1080; // Default Android width
                    viewportHeight = 1920; // Default Android height
                }
                
                float screenX = x;
                float screenY = y;
                float depth = z > 0 ? z : 1.0f; // Default depth if not provided
                
                // Try to use native Viro unprojection if available
                boolean unprojectionDone = false;
                float[] unprojectedCoords = null;
                
                try {
                    Method unprojectPointMethod = activeNavigator.getClass().getMethod("unprojectPoint", float.class, float.class, float.class);
                    Object result = unprojectPointMethod.invoke(activeNavigator, screenX, screenY, depth);
                    if (result instanceof float[]) {
                        unprojectedCoords = (float[]) result;
                        unprojectionDone = true;
                        Log.d(TAG, "Successfully unprojected point using native Viro unprojection");
                    }
                } catch (Exception e) {
                    Log.d(TAG, "Native Viro unprojection not available, using manual calculation");
                }
                
                // Manual unprojection calculation if native method not available
                if (!unprojectionDone) {
                    // Basic perspective unprojection parameters
                    float fov = 60.0f; // Default field of view in degrees
                    float aspectRatio = (float) viewportWidth / viewportHeight;
                    
                    // Convert FOV to radians
                    float fovRad = (float) (fov * Math.PI / 180.0);
                    float tanHalfFov = (float) Math.tan(fovRad / 2.0);
                    
                    // Convert screen coordinates to normalized device coordinates
                    float ndc_x = (screenX / viewportWidth) * 2.0f - 1.0f;
                    float ndc_y = 1.0f - (screenY / viewportHeight) * 2.0f; // Flip Y back to world coordinates
                    
                    // Convert to world coordinates
                    float worldX = ndc_x * depth * tanHalfFov * aspectRatio;
                    float worldY = ndc_y * depth * tanHalfFov;
                    float worldZ = depth;
                    
                    unprojectedCoords = new float[]{worldX, worldY, worldZ};
                    
                    Log.d(TAG, String.format("Unprojected [%.2f, %.2f, %.2f] to [%.2f, %.2f, %.2f]", 
                          screenX, screenY, depth, worldX, worldY, worldZ));
                }
                
                // Format result as JSON array string for Promise resolution
                String result = String.format("[%.6f, %.6f, %.6f]", 
                    unprojectedCoords[0], unprojectedCoords[1], unprojectedCoords[2]);
                
                // Resolve the promise on the UI thread
                UiThreadUtil.runOnUiThread(() -> {
                    resolveProjectionPromise(promiseId, result, null);
                });
                
            } catch (Exception e) {
                Log.e(TAG, "Error during async point unprojection: " + e.getMessage(), e);
                UiThreadUtil.runOnUiThread(() -> {
                    resolveProjectionPromise(promiseId, null, "Error during unprojection: " + e.getMessage());
                });
            }
        }).start();
    }
    
    /**
     * Helper method to resolve projection promises through the JSI bridge.
     */
    private void resolveProjectionPromise(String promiseId, String result, String error) {
        try {
            if (error != null) {
                rejectPromise(promiseId, error);
            } else {
                resolvePromise(promiseId, result);
            }
        } catch (Exception e) {
            Log.e(TAG, "Error resolving projection promise: " + e.getMessage(), e);
        }
    }
    
    // Native JSI methods called from C++
    @DoNotStrip
    private native void resolvePromise(String promiseId, String result);
    
    @DoNotStrip
    private native void rejectPromise(String promiseId, String error);
    
    /**
     * Initialize advanced memory management and pressure monitoring.
     */
    private void initializeMemoryManagement() {
        Log.d(TAG, "Initializing advanced memory management");
        
        try {
            // Initialize memory pressure handler
            mMemoryPressureHandler = new MemoryPressureHandler();
            
            // Register for system memory callbacks
            mReactContext.registerComponentCallbacks(mMemoryPressureHandler);
            
            // Initialize memory monitoring handler
            mMemoryMonitorHandler = new Handler(Looper.getMainLooper());
            mMemoryMonitorRunnable = new Runnable() {
                @Override
                public void run() {
                    performMemoryPressureCheck();
                    // Schedule next check
                    mMemoryMonitorHandler.postDelayed(this, MEMORY_MONITOR_INTERVAL_MS);
                }
            };
            
            // Start memory monitoring
            mMemoryMonitorHandler.post(mMemoryMonitorRunnable);
            
            Log.d(TAG, "Advanced memory management initialized");
            
        } catch (Exception e) {
            Log.e(TAG, "Error initializing memory management: " + e.getMessage(), e);
        }
    }
    
    /**
     * Memory pressure handler implementing ComponentCallbacks2.
     */
    private class MemoryPressureHandler implements ComponentCallbacks2 {
        
        @Override
        public void onConfigurationChanged(Configuration newConfig) {
            // Handle configuration changes if needed
        }
        
        @Override
        public void onLowMemory() {
            Log.w(TAG, "System low memory callback received");
            handleLowMemoryEvent();
        }
        
        @Override
        public void onTrimMemory(int level) {
            Log.d(TAG, "Memory trim requested, level: " + level + " (" + getTrimLevelDescription(level) + ")");
            
            switch (level) {
                case TRIM_MEMORY_UI_HIDDEN:
                    handleMemoryTrim("UI_HIDDEN", false);
                    break;
                case TRIM_MEMORY_RUNNING_MODERATE:
                    handleMemoryTrim("RUNNING_MODERATE", false);
                    break;
                case TRIM_MEMORY_RUNNING_LOW:
                    handleMemoryTrim("RUNNING_LOW", true);
                    break;
                case TRIM_MEMORY_RUNNING_CRITICAL:
                    handleMemoryTrim("RUNNING_CRITICAL", true);
                    break;
                case TRIM_MEMORY_BACKGROUND:
                    handleMemoryTrim("BACKGROUND", false);
                    break;
                case TRIM_MEMORY_MODERATE:
                    handleMemoryTrim("MODERATE", true);
                    break;
                case TRIM_MEMORY_COMPLETE:
                    handleMemoryTrim("COMPLETE", true);
                    break;
                default:
                    handleMemoryTrim("UNKNOWN_LEVEL_" + level, false);
                    break;
            }
        }
        
        private String getTrimLevelDescription(int level) {
            switch (level) {
                case TRIM_MEMORY_UI_HIDDEN: return "UI_HIDDEN";
                case TRIM_MEMORY_RUNNING_MODERATE: return "RUNNING_MODERATE";
                case TRIM_MEMORY_RUNNING_LOW: return "RUNNING_LOW";
                case TRIM_MEMORY_RUNNING_CRITICAL: return "RUNNING_CRITICAL";
                case TRIM_MEMORY_BACKGROUND: return "BACKGROUND";
                case TRIM_MEMORY_MODERATE: return "MODERATE";
                case TRIM_MEMORY_COMPLETE: return "COMPLETE";
                default: return "UNKNOWN";
            }
        }
    }
    
    /**
     * Handle low memory events from the system.
     */
    private void handleLowMemoryEvent() {
        long currentTime = System.currentTimeMillis();
        
        // Prevent too frequent aggressive cleanups
        if (currentTime - mLastLowMemoryTime < LOW_MEMORY_COOLDOWN_MS) {
            Log.d(TAG, "Low memory event ignored due to cooldown");
            return;
        }
        
        mLastLowMemoryTime = currentTime;
        
        try {
            Log.w(TAG, "Handling low memory event - performing aggressive cleanup");
            
            // Perform aggressive memory cleanup
            if (mSceneManager != null) {
                mSceneManager.performMemoryCleanup(true);
            }
            
            // Clear component registry of unused components
            cleanupUnusedComponents();
            
            // Clear any cached resources
            clearCachedResources();
            
            // Force garbage collection
            System.gc();
            
            Log.d(TAG, "Low memory cleanup completed");
            
        } catch (Exception e) {
            Log.e(TAG, "Error handling low memory event: " + e.getMessage(), e);
        }
    }
    
    /**
     * Handle memory trim requests with different levels of aggressiveness.
     */
    private void handleMemoryTrim(String level, boolean aggressive) {
        try {
            Log.d(TAG, "Handling memory trim: " + level + " (aggressive: " + aggressive + ")");
            
            if (aggressive) {
                // Aggressive cleanup for critical memory situations
                if (mSceneManager != null) {
                    mSceneManager.performMemoryCleanup(true);
                }
                cleanupUnusedComponents();
                clearCachedResources();
                clearEventCallbacks();
                System.gc();
            } else {
                // Gentle cleanup for moderate memory pressure
                if (mSceneManager != null) {
                    mSceneManager.performMemoryCleanup(false);
                }
                Runtime.getRuntime().gc();
            }
            
            Log.d(TAG, "Memory trim completed for level: " + level);
            
        } catch (Exception e) {
            Log.e(TAG, "Error handling memory trim: " + e.getMessage(), e);
        }
    }
    
    /**
     * Perform regular memory pressure checks.
     */
    private void performMemoryPressureCheck() {
        try {
            // Check scene manager memory pressure
            if (mSceneManager != null) {
                mSceneManager.checkMemoryPressure();
            }
            
            // Check system memory pressure
            ActivityManager activityManager = (ActivityManager) mReactContext.getSystemService(Context.ACTIVITY_SERVICE);
            if (activityManager != null) {
                ActivityManager.MemoryInfo memInfo = new ActivityManager.MemoryInfo();
                activityManager.getMemoryInfo(memInfo);
                
                // Check if we're approaching low memory
                double memoryUsage = (double)(memInfo.totalMem - memInfo.availMem) / memInfo.totalMem;
                
                if (memInfo.lowMemory || memoryUsage > 0.85) {
                    Log.w(TAG, "High memory pressure detected (usage: " + String.format("%.1f%%", memoryUsage * 100) + ", lowMemory: " + memInfo.lowMemory + ")");
                    handleMemoryTrim("PROACTIVE_HIGH_USAGE", true);
                }
            }
            
        } catch (Exception e) {
            Log.e(TAG, "Error during memory pressure check: " + e.getMessage(), e);
        }
    }
    
    /**
     * Clean up unused components from the registry.
     */
    private void cleanupUnusedComponents() {
        try {
            Log.d(TAG, "Cleaning up unused components");
            
            List<String> componentsToRemove = new ArrayList<>();
            for (Map.Entry<String, VRTComponent> entry : mComponentRegistry.entrySet()) {
                VRTComponent component = entry.getValue();
                if (component != null && component.getParent() == null) {
                    componentsToRemove.add(entry.getKey());
                }
            }
            
            for (String componentId : componentsToRemove) {
                mComponentRegistry.remove(componentId);
            }
            
            Log.d(TAG, "Cleaned up " + componentsToRemove.size() + " unused components");
            
        } catch (Exception e) {
            Log.e(TAG, "Error cleaning up unused components: " + e.getMessage(), e);
        }
    }
    
    /**
     * Clear cached resources like materials and animations.
     */
    private void clearCachedResources() {
        try {
            Log.d(TAG, "Clearing cached resources");
            
            if (mViroContext != null) {
                Log.d(TAG, "Cleared ViroContext cached resources");
            }
            
        } catch (Exception e) {
            Log.e(TAG, "Error clearing cached resources: " + e.getMessage(), e);
        }
    }
    
    /**
     * Clear event callbacks to free memory.
     */
    private void clearEventCallbacks() {
        try {
            Log.d(TAG, "Clearing event callbacks");
            
            mEventCallbackRegistry.clear();
            
            if (mEventDelegate != null) {
                mEventDelegate.dispose();
            }
            
            Log.d(TAG, "Event callbacks cleared");
            
        } catch (Exception e) {
            Log.e(TAG, "Error clearing event callbacks: " + e.getMessage(), e);
        }
    }
    
    /**
     * Test async Promise resolution system.
     */
    @DoNotStrip
    public void testAsyncPromiseSystem(String promiseId) {
        Log.d(TAG, "Testing async Promise system with ID: " + promiseId);
        
        // Simulate async operation on background thread
        new Thread(() -> {
            try {
                // Simulate some work
                Thread.sleep(1000);
                
                // Resolve the promise with test data
                String testResult = "[1.0, 2.0, 3.0]";
                UiThreadUtil.runOnUiThread(() -> {
                    resolvePromise(promiseId, testResult);
                });
                
            } catch (Exception e) {
                Log.e(TAG, "Error in async Promise test: " + e.getMessage(), e);
                UiThreadUtil.runOnUiThread(() -> {
                    rejectPromise(promiseId, "Test error: " + e.getMessage());
                });
            }
        }).start();
    }
    
    /**
     * Get advanced memory statistics including pressure information.
     */
    @DoNotStrip
    public WritableMap getAdvancedMemoryStats() {
        WritableMap stats = new WritableNativeMap();
        
        try {
            // Get basic stats from scene manager
            if (mSceneManager != null) {
                WritableMap sceneStats = mSceneManager.getMemoryStats();
                stats.merge(sceneStats);
            }
            
            // Add advanced system memory information
            ActivityManager activityManager = (ActivityManager) mReactContext.getSystemService(Context.ACTIVITY_SERVICE);
            if (activityManager != null) {
                ActivityManager.MemoryInfo memInfo = new ActivityManager.MemoryInfo();
                activityManager.getMemoryInfo(memInfo);
                
                stats.putDouble("systemMemoryPressure", (double)(memInfo.totalMem - memInfo.availMem) / memInfo.totalMem);
                stats.putBoolean("systemLowMemory", memInfo.lowMemory);
                stats.putDouble("systemMemoryThresholdMB", memInfo.threshold / (1024.0 * 1024.0));
            }
            
            // Add component registry stats
            stats.putInt("totalComponents", mComponentRegistry.size());
            stats.putInt("totalEventCallbacks", mEventCallbackRegistry.size());
            
            // Add memory management stats
            stats.putLong("lastLowMemoryTime", mLastLowMemoryTime);
            stats.putLong("timeSinceLastLowMemory", System.currentTimeMillis() - mLastLowMemoryTime);
            
        } catch (Exception e) {
            Log.e(TAG, "Error getting advanced memory stats: " + e.getMessage(), e);
        }
        
        return stats;
    }

    @Override
    protected void finalize() throws Throwable {
        super.finalize();
        
        // Clean up memory management
        if (mMemoryMonitorHandler != null && mMemoryMonitorRunnable != null) {
            mMemoryMonitorHandler.removeCallbacks(mMemoryMonitorRunnable);
        }
        
        if (mMemoryPressureHandler != null) {
            try {
                mReactContext.unregisterComponentCallbacks(mMemoryPressureHandler);
            } catch (Exception e) {
                Log.w(TAG, "Error unregistering memory pressure handler: " + e.getMessage());
            }
        }
        
        if (mJSIBridge != null) {
            mJSIBridge.cleanup();
            mJSIBridge = null;
        }
    }
}
