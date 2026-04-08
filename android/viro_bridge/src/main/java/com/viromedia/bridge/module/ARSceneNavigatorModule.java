//  Copyright © 2017 Viro Media. All rights reserved.
//
//  Permission is hereby granted, free of charge, to any person obtaining
//  a copy of this software and associated documentation files (the
//  "Software"), to deal in the Software without restriction, including
//  without limitation the rights to use, copy, modify, merge, publish,
//  distribute, sublicense, and/or sell copies of the Software, and to
//  permit persons to whom the Software is furnished to do so, subject to
//  the following conditions:
//
//  The above copyright notice and this permission notice shall be included
//  in all copies or substantial portions of the Software.
//
//  THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
//  EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
//  MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
//  IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
//  CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
//  TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
//  SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

package com.viromedia.bridge.module;

import android.Manifest;
import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ApplicationInfo;
import android.graphics.Bitmap;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import androidx.core.content.ContextCompat;
import android.util.Log;
import android.view.PixelCopy;
import android.view.View;

import com.facebook.react.ReactActivity;
import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.Callback;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.Dynamic;
import com.facebook.react.bridge.ReadableArray;
import com.facebook.react.bridge.ReadableMap;
import com.facebook.react.bridge.ReadableType;
import com.facebook.react.bridge.WritableArray;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.modules.core.PermissionListener;
import com.facebook.react.uimanager.IllegalViewOperationException;
import com.facebook.react.bridge.UIManager;
import com.facebook.react.fabric.FabricUIManager;
import com.facebook.react.uimanager.UIManagerHelper;
import com.facebook.react.module.annotations.ReactModule;
import com.viro.core.Vector;
import com.viro.core.ViroMediaRecorder;
import com.viro.core.ViroMediaRecorder.Error;
import com.viro.core.ViroViewARCore;
import com.viromedia.bridge.component.VRTARSceneNavigator;

import java.io.BufferedOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import org.json.JSONArray;
import org.json.JSONObject;

@ReactModule(name = "VRTARSceneNavigatorModule")
public class ARSceneNavigatorModule extends ReactContextBaseJavaModule {
    private static final int UNSUPPORTED_PLATFORM_ERROR = 6;
    private static final String RECORDING_SUCCESS_KEY = "success";
    private static final String RECORDING_URL_KEY = "url";
    private static final String RECORDING_ERROR_KEY = "errorCode";
    private static final int PERMISSION_REQ_CODE_AUDIO = 1;
    private static final int PERMISSION_REQ_CODE_STORAGE = 2;
    private static final int PERMISSION_REQ_CODE_CAMERA = 3;

    private ReactApplicationContext mContext;
    // https://stackoverflow.com/a/44879687
    @Override
    public boolean canOverrideExistingModule() {
        return true;
    }
    public ARSceneNavigatorModule(ReactApplicationContext context) {
        super(context);
        mContext = context;
    }

    @Override
    public String getName() {
        return "VRTARSceneNavigatorModule";
    }

    @ReactMethod
    public void startVideoRecording(final int sceneNavTag, final String fileName,
                                    final boolean saveToCameraRool, final Callback reactErrorDelegate) {
        UIManager uiManager = UIManagerHelper.getUIManager(getReactApplicationContext(), sceneNavTag);
        if (uiManager == null) {
            reactErrorDelegate.invoke(UNSUPPORTED_PLATFORM_ERROR);
            return;
        }
        ((FabricUIManager) uiManager).addUIBlock(new com.facebook.react.fabric.interop.UIBlock() {
            @Override
            public void execute(com.facebook.react.fabric.interop.UIBlockViewResolver viewResolver) {
                View sceneView = viewResolver.resolveView(sceneNavTag);
                if (!(sceneView instanceof VRTARSceneNavigator)) {
                    throw new IllegalViewOperationException("Viro: Attempted to call startVideoRecording on a non-ARSceneNav view!");
                }
                VRTARSceneNavigator scene = (VRTARSceneNavigator) sceneView;

                // Grab the recorder from the ar scene view
                final ViroMediaRecorder recorder = scene.getARView().getRecorder();
                if (recorder == null){
                    reactErrorDelegate.invoke(UNSUPPORTED_PLATFORM_ERROR);
                    return;
                }

                // Construct an error listener callback that may be triggered during recording.
                final ViroMediaRecorder.RecordingErrorListener viroErrorDelegate = new ViroMediaRecorder.RecordingErrorListener() {
                    @Override
                    public void onRecordingFailed(Error error) {
                        reactErrorDelegate.invoke(error.toInt());
                    }
                };

                // Start recording if we have the right permissions
                checkPermissionsAndRun(new PermissionListener() {
                    @Override
                    public boolean onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
                        recorder.startRecordingAsync(fileName, saveToCameraRool, viroErrorDelegate);
                        return true;
                    }
                }, true);
            }
        });
    }

    @ReactMethod
    public void stopVideoRecording(final int sceneNavTag, final Promise promise) {
        UIManager uiManager = UIManagerHelper.getUIManager(getReactApplicationContext(), sceneNavTag);
        if (uiManager == null) {
            WritableMap returnMap = Arguments.createMap();
            returnMap.putBoolean(RECORDING_SUCCESS_KEY, false);
            returnMap.putInt(RECORDING_ERROR_KEY, UNSUPPORTED_PLATFORM_ERROR);
            returnMap.putString(RECORDING_URL_KEY, null);
            promise.resolve(returnMap);
            return;
        }
        ((FabricUIManager) uiManager).addUIBlock(new com.facebook.react.fabric.interop.UIBlock() {
            @Override
            public void execute(com.facebook.react.fabric.interop.UIBlockViewResolver viewResolver) {
                View sceneView = viewResolver.resolveView(sceneNavTag);
                if (!(sceneView instanceof VRTARSceneNavigator)) {
                    throw new IllegalViewOperationException("Viro: Attempted to call startVideoRecording on a non-ARSceneNav view!");
                }
                VRTARSceneNavigator scene = (VRTARSceneNavigator) sceneView;

                // Grab the recorder from the ar scene view
                final ViroMediaRecorder recorder = scene.getARView().getRecorder();
                if (recorder == null){
                    WritableMap returnMap = Arguments.createMap();
                    returnMap.putBoolean(RECORDING_SUCCESS_KEY, false);
                    returnMap.putInt(RECORDING_ERROR_KEY, UNSUPPORTED_PLATFORM_ERROR);
                    returnMap.putString(RECORDING_URL_KEY, null);
                    promise.resolve(returnMap);
                    return;
                }

                // Construct a completion delegate callback to be notified of the result of the recording.
                final ViroMediaRecorder.VideoRecordingFinishListener completionCallback =
                        new ViroMediaRecorder.VideoRecordingFinishListener() {
                    @Override
                    public void onError(Error error) {
                        WritableMap returnMap = Arguments.createMap();
                        returnMap.putBoolean(RECORDING_SUCCESS_KEY, false);
                        returnMap.putInt(RECORDING_ERROR_KEY, error.toInt());
                        returnMap.putString(RECORDING_URL_KEY, null);
                        promise.resolve(returnMap);
                    }

                    @Override
                    public void onSuccess(String url) {
                        WritableMap returnMap = Arguments.createMap();
                        returnMap.putBoolean(RECORDING_SUCCESS_KEY, true);
                        returnMap.putInt(RECORDING_ERROR_KEY, Error.NONE.toInt());
                        returnMap.putString(RECORDING_URL_KEY, url);
                        promise.resolve(returnMap);
                    }
                };

                // Stop recording if we have the right permissions
                checkPermissionsAndRun(new PermissionListener() {
                    @Override
                    public boolean onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
                        recorder.stopRecordingAsync(completionCallback);
                        return true;
                    }
                }, true);
            }
        });
    }

    @ReactMethod
    public void takeScreenshot(final int sceneNavTag, final String fileName,
                               final boolean saveToCameraRoll, final Promise promise) {
        UIManager uiManager = UIManagerHelper.getUIManager(getReactApplicationContext(), sceneNavTag);
        if (uiManager == null) {
            WritableMap returnMap = Arguments.createMap();
            returnMap.putBoolean(RECORDING_SUCCESS_KEY, false);
            returnMap.putInt(RECORDING_ERROR_KEY, UNSUPPORTED_PLATFORM_ERROR);
            returnMap.putString(RECORDING_URL_KEY, null);
            promise.resolve(returnMap);
            return;
        }
        ((FabricUIManager) uiManager).addUIBlock(new com.facebook.react.fabric.interop.UIBlock() {
            @Override
            public void execute(com.facebook.react.fabric.interop.UIBlockViewResolver viewResolver) {
                View sceneView = viewResolver.resolveView(sceneNavTag);
                if (!(sceneView instanceof VRTARSceneNavigator)) {
                    throw new IllegalViewOperationException("Viro: Attempted to call takeScreenshot on a non-ARSceneNav view!");
                }
                VRTARSceneNavigator scene = (VRTARSceneNavigator) sceneView;
                final ViroViewARCore arView = scene.getARView();

                if (arView == null) {
                    WritableMap returnMap = Arguments.createMap();
                    returnMap.putBoolean(RECORDING_SUCCESS_KEY, false);
                    returnMap.putInt(RECORDING_ERROR_KEY, UNSUPPORTED_PLATFORM_ERROR);
                    returnMap.putString(RECORDING_URL_KEY, null);
                    promise.resolve(returnMap);
                    return;
                }

                // Use PixelCopy-based screenshot which properly captures the camera background
                arView.takeScreenshotWithPixelCopy(new ViroViewARCore.PixelCopyScreenshotListener() {
                    @Override
                    public void onSuccess(Bitmap bitmap) {
                        // Save the bitmap to file
                        String filePath = saveScreenshotToFile(bitmap, fileName, saveToCameraRoll);

                        WritableMap returnMap = Arguments.createMap();
                        if (filePath != null) {
                            returnMap.putBoolean(RECORDING_SUCCESS_KEY, true);
                            returnMap.putInt(RECORDING_ERROR_KEY, Error.NONE.toInt());
                            returnMap.putString(RECORDING_URL_KEY, filePath);
                        } else {
                            returnMap.putBoolean(RECORDING_SUCCESS_KEY, false);
                            returnMap.putInt(RECORDING_ERROR_KEY, Error.WRITE_TO_FILE.toInt());
                            returnMap.putString(RECORDING_URL_KEY, null);
                        }
                        bitmap.recycle();
                        promise.resolve(returnMap);
                    }

                    @Override
                    public void onError(int errorCode) {
                        WritableMap returnMap = Arguments.createMap();
                        returnMap.putBoolean(RECORDING_SUCCESS_KEY, false);
                        returnMap.putInt(RECORDING_ERROR_KEY, Error.UNKNOWN.toInt());
                        returnMap.putString(RECORDING_URL_KEY, null);
                        promise.resolve(returnMap);
                    }
                });
            }
        });
    }

    /**
     * Saves a bitmap to a file and returns the file path.
     */
    private String saveScreenshotToFile(Bitmap bitmap, String fileName, boolean saveToCameraRoll) {
        if (fileName == null || fileName.trim().isEmpty()) {
            return null;
        }

        String dirPath = getMediaStorageDirectory(mContext, saveToCameraRoll);
        if (dirPath == null) {
            return null;
        }

        File dir = new File(dirPath);
        if (!dir.exists() && !dir.mkdirs()) {
            Log.e("Viro", "Failed to create directory: " + dirPath);
            return null;
        }

        File outputFile = new File(dir, fileName + ".jpg");
        BufferedOutputStream bos = null;
        try {
            bos = new BufferedOutputStream(new FileOutputStream(outputFile));
            bitmap.compress(Bitmap.CompressFormat.JPEG, 100, bos);
            bos.flush();
        } catch (IOException e) {
            Log.e("Viro", "Failed to save screenshot: " + e.getMessage());
            return null;
        } finally {
            if (bos != null) {
                try {
                    bos.close();
                } catch (IOException e) {
                    Log.e("Viro", "Failed to close output stream: " + e.getMessage());
                }
            }
        }

        // Notify media scanner if saving to camera roll
        if (saveToCameraRoll) {
            Intent mediaScanIntent = new Intent(Intent.ACTION_MEDIA_SCANNER_SCAN_FILE);
            Uri contentUri = Uri.fromFile(outputFile);
            mediaScanIntent.setData(contentUri);
            mContext.sendBroadcast(mediaScanIntent);
        }

        return outputFile.getAbsolutePath();
    }

    /**
     * Gets the directory path for saving media files.
     */
    private static String getMediaStorageDirectory(Context context, boolean saveToCameraRoll) {
        ApplicationInfo appInfo = context.getApplicationInfo();
        CharSequence appLabel = context.getPackageManager().getApplicationLabel(appInfo);
        String appName = (appLabel != null && appLabel.length() > 0)
                ? appLabel.toString()
                : context.getPackageName();

        if (saveToCameraRoll) {
            File picturesDir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_PICTURES);
            if (picturesDir != null) {
                return picturesDir.getAbsolutePath() + "/" + appName;
            }
            File externalDir = Environment.getExternalStorageDirectory();
            if (externalDir != null) {
                return externalDir.getAbsolutePath() + "/" + appName;
            }
            Log.e("Viro", "Unable to access camera roll directory");
            return null;
        } else {
            return context.getFilesDir().getAbsolutePath();
        }
    }

    @ReactMethod
    public void resetARSession(final int sceneNavTag, final boolean resetTracking, final boolean removeAnchors) {
        UIManager uiManager = UIManagerHelper.getUIManager(getReactApplicationContext(), sceneNavTag);
        if (uiManager == null) {
            return;
        }
        ((FabricUIManager) uiManager).addUIBlock(new com.facebook.react.fabric.interop.UIBlock() {
            @Override
            public void execute(com.facebook.react.fabric.interop.UIBlockViewResolver viewResolver) {
                View view = viewResolver.resolveView(sceneNavTag);
                if (view instanceof VRTARSceneNavigator) {
                    VRTARSceneNavigator sceneNavigator = (VRTARSceneNavigator) view;
                    sceneNavigator.resetARSession();
                }
            }
        });
    }

    @ReactMethod
    public void setWorldOrigin(final int sceneNavTag, final ReadableMap worldOrigin) {
        // no-op
    }

    @ReactMethod
    public void project(final int sceneNavTag, final ReadableArray point, final Promise promise) {
        UIManager uiManager = UIManagerHelper.getUIManager(getReactApplicationContext(), sceneNavTag);
        if (uiManager == null) {
            promise.reject("ERROR", "UIManager not available");
            return;
        }
        ((FabricUIManager) uiManager).addUIBlock(new com.facebook.react.fabric.interop.UIBlock() {
            @Override
            public void execute(com.facebook.react.fabric.interop.UIBlockViewResolver viewResolver) {
                View view = viewResolver.resolveView(sceneNavTag);
                if (view instanceof VRTARSceneNavigator) {
                    VRTARSceneNavigator sceneNavigator = (VRTARSceneNavigator) view;
                    float[] projectPoint = {0,0,0};
                    projectPoint[0] = (float)point.getDouble(0);
                    projectPoint[1] = (float)point.getDouble(1);
                    projectPoint[2] = (float)point.getDouble(2);
                    Vector projectedPoint = sceneNavigator.projectPoint(new Vector(projectPoint[0], projectPoint[1], projectPoint[2]));

                    WritableMap returnMap = Arguments.createMap();
                    WritableArray writablePosArray = Arguments.createArray();
                    writablePosArray.pushDouble(projectedPoint.x);
                    writablePosArray.pushDouble(projectedPoint.y);
                    returnMap.putArray("screenPosition", writablePosArray);
                    promise.resolve(returnMap);
                }
            }
        });
    }

    @ReactMethod
    public void unproject(final int sceneNavTag, final ReadableArray point, final Promise promise) {
        UIManager uiManager = UIManagerHelper.getUIManager(getReactApplicationContext(), sceneNavTag);
        if (uiManager == null) {
            promise.reject("ERROR", "UIManager not available");
            return;
        }
        ((FabricUIManager) uiManager).addUIBlock(new com.facebook.react.fabric.interop.UIBlock() {
            @Override
            public void execute(com.facebook.react.fabric.interop.UIBlockViewResolver viewResolver) {
                View view = viewResolver.resolveView(sceneNavTag);
                if (view instanceof VRTARSceneNavigator) {
                    VRTARSceneNavigator sceneNavigator = (VRTARSceneNavigator) view;
                    float[] unprojectPoint = {0,0,0};
                    unprojectPoint[0] = (float)point.getDouble(0);
                    unprojectPoint[1] = (float)point.getDouble(1);
                    unprojectPoint[2] = (float)point.getDouble(2);
                    Vector unProjectedPoint = sceneNavigator.unprojectPoint(new Vector(unprojectPoint[0], unprojectPoint[1], unprojectPoint[2]));

                    WritableMap returnMap = Arguments.createMap();
                    WritableArray writablePosArray = Arguments.createArray();
                    writablePosArray.pushDouble(unProjectedPoint.x);
                    writablePosArray.pushDouble(unProjectedPoint.y);
                    writablePosArray.pushDouble(unProjectedPoint.z);
                    returnMap.putArray("position", writablePosArray);
                    promise.resolve(returnMap);
                }
            }
        });
    }

    @ReactMethod()
    public void isARSupportedOnDevice(final Callback successCallback) {
        ViroViewARCore.ARCoreAvailability availability = ViroViewARCore.isARSupportedOnDevice(getReactApplicationContext());
        successCallback.invoke(availability.toString());
    }

    @ReactMethod
    public void hostCloudAnchor(final int sceneNavTag, final String anchorId,
                                final int ttlDays, final Promise promise) {
        UIManager uiManager = UIManagerHelper.getUIManager(getReactApplicationContext(), sceneNavTag);
        if (uiManager == null) {
            WritableMap result = Arguments.createMap();
            result.putBoolean("success", false);
            result.putString("error", "UIManager not available");
            result.putString("state", "ErrorInternal");
            promise.resolve(result);
            return;
        }

        ((FabricUIManager) uiManager).addUIBlock(new com.facebook.react.fabric.interop.UIBlock() {
            @Override
            public void execute(com.facebook.react.fabric.interop.UIBlockViewResolver viewResolver) {
                View view = viewResolver.resolveView(sceneNavTag);
                if (!(view instanceof VRTARSceneNavigator)) {
                    WritableMap result = Arguments.createMap();
                    result.putBoolean("success", false);
                    result.putString("error", "Invalid view type");
                    result.putString("state", "ErrorInternal");
                    promise.resolve(result);
                    return;
                }

                VRTARSceneNavigator sceneNavigator = (VRTARSceneNavigator) view;
                sceneNavigator.hostCloudAnchor(anchorId, ttlDays, new CloudAnchorCallback() {
                    @Override
                    public void onSuccess(String cloudAnchorId) {
                        WritableMap result = Arguments.createMap();
                        result.putBoolean("success", true);
                        result.putString("cloudAnchorId", cloudAnchorId);
                        result.putString("state", "Success");
                        promise.resolve(result);
                    }

                    @Override
                    public void onFailure(String error, String state) {
                        WritableMap result = Arguments.createMap();
                        result.putBoolean("success", false);
                        result.putString("error", error);
                        result.putString("state", state);
                        promise.resolve(result);
                    }
                });
            }
        });
    }

    @ReactMethod
    public void resolveCloudAnchor(final int sceneNavTag, final String cloudAnchorId,
                                   final Promise promise) {
        UIManager uiManager = UIManagerHelper.getUIManager(getReactApplicationContext(), sceneNavTag);
        if (uiManager == null) {
            WritableMap result = Arguments.createMap();
            result.putBoolean("success", false);
            result.putString("error", "UIManager not available");
            result.putString("state", "ErrorInternal");
            promise.resolve(result);
            return;
        }

        ((FabricUIManager) uiManager).addUIBlock(new com.facebook.react.fabric.interop.UIBlock() {
            @Override
            public void execute(com.facebook.react.fabric.interop.UIBlockViewResolver viewResolver) {
                View view = viewResolver.resolveView(sceneNavTag);
                if (!(view instanceof VRTARSceneNavigator)) {
                    WritableMap result = Arguments.createMap();
                    result.putBoolean("success", false);
                    result.putString("error", "Invalid view type");
                    result.putString("state", "ErrorInternal");
                    promise.resolve(result);
                    return;
                }

                VRTARSceneNavigator sceneNavigator = (VRTARSceneNavigator) view;
                sceneNavigator.resolveCloudAnchor(cloudAnchorId, new CloudAnchorResolveCallback() {
                    @Override
                    public void onSuccess(WritableMap anchorData) {
                        WritableMap result = Arguments.createMap();
                        result.putBoolean("success", true);
                        result.putMap("anchor", anchorData);
                        result.putString("state", "Success");
                        promise.resolve(result);
                    }

                    @Override
                    public void onFailure(String error, String state) {
                        WritableMap result = Arguments.createMap();
                        result.putBoolean("success", false);
                        result.putString("error", error);
                        result.putString("state", state);
                        promise.resolve(result);
                    }
                });
            }
        });
    }

    @ReactMethod
    public void cancelCloudAnchorOperations(final int sceneNavTag) {
        UIManager uiManager = UIManagerHelper.getUIManager(getReactApplicationContext(), sceneNavTag);
        if (uiManager == null) {
            return;
        }

        ((FabricUIManager) uiManager).addUIBlock(new com.facebook.react.fabric.interop.UIBlock() {
            @Override
            public void execute(com.facebook.react.fabric.interop.UIBlockViewResolver viewResolver) {
                View view = viewResolver.resolveView(sceneNavTag);
                if (view instanceof VRTARSceneNavigator) {
                    VRTARSceneNavigator sceneNavigator = (VRTARSceneNavigator) view;
                    sceneNavigator.cancelCloudAnchorOperations();
                }
            }
        });
    }

    /**
     * Callback interface for cloud anchor hosting operations.
     */
    public interface CloudAnchorCallback {
        void onSuccess(String cloudAnchorId);
        void onFailure(String error, String state);
    }

    /**
     * Callback interface for cloud anchor resolve operations.
     */
    public interface CloudAnchorResolveCallback {
        void onSuccess(WritableMap anchorData);
        void onFailure(String error, String state);
    }

    /**
     * Callback interface for geospatial pose retrieval.
     */
    public interface GeospatialPoseCallback {
        void onSuccess(com.viro.core.ARScene.GeospatialPose pose);
        void onFailure(String error);
    }

    /**
     * Callback interface for VPS availability checks.
     */
    public interface VPSAvailabilityCallback {
        void onResult(String availability);
    }

    /**
     * Callback interface for geospatial anchor creation.
     */
    public interface GeospatialAnchorCallback {
        void onSuccess(com.viro.core.ARScene.GeospatialAnchor anchor);
        void onFailure(String error);
    }

    public interface HostGeospatialAnchorCallback {
        void onSuccess(String platformUuid);
        void onFailure(String error);
    }

    // ========================================================================
    // Debugging & Validation Methods
    // ========================================================================

    @ReactMethod
    public void isDepthOcclusionSupported(final int sceneNavTag, final Promise promise) {
        UIManager uiManager = UIManagerHelper.getUIManager(getReactApplicationContext(), sceneNavTag);
        if (uiManager == null) {
            WritableMap result = Arguments.createMap();
            result.putBoolean("supported", false);
            result.putString("error", "UIManager not available");
            promise.resolve(result);
            return;
        }

        ((FabricUIManager) uiManager).addUIBlock(new com.facebook.react.fabric.interop.UIBlock() {
            @Override
            public void execute(com.facebook.react.fabric.interop.UIBlockViewResolver viewResolver) {
                try {
                    WritableMap result = Arguments.createMap();
                    
                    // On Android, depth-based occlusion requires ARCore 1.18+
                    // We report supported=true if ARCore is available, but note the requirement
                    View view = viewResolver.resolveView(sceneNavTag);
                    if (!(view instanceof VRTARSceneNavigator)) {
                        result.putBoolean("supported", false);
                        result.putString("error", "Invalid view type");
                        promise.resolve(result);
                        return;
                    }

                    // Depth occlusion support depends on device having ARCore 1.18+
                    // Most modern Android devices support this
                    result.putBoolean("supported", true);
                    result.putString("minARCoreVersion", "1.18");
                    promise.resolve(result);
                } catch (Exception e) {
                    WritableMap result = Arguments.createMap();
                    result.putBoolean("supported", false);
                    result.putString("error", e.getMessage());
                    promise.resolve(result);
                }
            }
        });
    }

    @ReactMethod
    public void getGeospatialSetupStatus(final int sceneNavTag, final Promise promise) {
        UIManager uiManager = UIManagerHelper.getUIManager(getReactApplicationContext(), sceneNavTag);
        if (uiManager == null) {
            WritableMap result = Arguments.createMap();
            result.putBoolean("geospatialSupported", false);
            result.putBoolean("locationServicesAvailable", false);
            result.putBoolean("apiKeyConfigured", false);
            result.putString("error", "UIManager not available");
            promise.resolve(result);
            return;
        }

        ((FabricUIManager) uiManager).addUIBlock(new com.facebook.react.fabric.interop.UIBlock() {
            @Override
            public void execute(com.facebook.react.fabric.interop.UIBlockViewResolver viewResolver) {
                try {
                    WritableMap result = Arguments.createMap();
                    
                    View view = viewResolver.resolveView(sceneNavTag);
                    if (!(view instanceof VRTARSceneNavigator)) {
                        result.putBoolean("geospatialSupported", false);
                        result.putBoolean("locationServicesAvailable", false);
                        result.putBoolean("apiKeyConfigured", false);
                        result.putString("error", "Invalid view type");
                        promise.resolve(result);
                        return;
                    }

                    VRTARSceneNavigator sceneNavigator = (VRTARSceneNavigator) view;
                    
                    // Check geospatial support (requires ARCore and play-services-location)
                    boolean geospatialSupported = sceneNavigator.isGeospatialModeSupported();
                    
                    // Check if location services are enabled
                    android.content.Context context = getReactApplicationContext();
                    boolean locationServicesAvailable = isLocationServicesEnabled(context);
                    
                    // Check if Google Cloud API key is configured in AndroidManifest.xml
                    // This is a basic check - a missing key will cause geospatial to fail
                    String apiKey = getGoogleCloudApiKey(context);
                    boolean apiKeyConfigured = apiKey != null && !apiKey.isEmpty();
                    
                    result.putBoolean("geospatialSupported", geospatialSupported);
                    result.putBoolean("locationServicesAvailable", locationServicesAvailable);
                    result.putBoolean("apiKeyConfigured", apiKeyConfigured);
                    
                    if (!geospatialSupported) {
                        result.putString("error", "Geospatial mode not supported. Ensure play-services-location is included in build.gradle");
                    }
                    if (!apiKeyConfigured) {
                        result.putString("error", "Google Cloud API key not configured. Add com.google.android.geo.API_KEY meta-data to AndroidManifest.xml");
                    }
                    
                    promise.resolve(result);
                } catch (Exception e) {
                    WritableMap result = Arguments.createMap();
                    result.putBoolean("geospatialSupported", false);
                    result.putBoolean("locationServicesAvailable", false);
                    result.putBoolean("apiKeyConfigured", false);
                    result.putString("error", e.getMessage());
                    promise.resolve(result);
                }
            }
        });
    }

    /**
     * Check if location services are enabled on this device.
     */
    private boolean isLocationServicesEnabled(android.content.Context context) {
        try {
            android.location.LocationManager locationManager = 
                (android.location.LocationManager) context.getSystemService(android.content.Context.LOCATION_SERVICE);
            if (locationManager == null) {
                return false;
            }
            boolean gpsEnabled = locationManager.isProviderEnabled(android.location.LocationManager.GPS_PROVIDER);
            boolean networkEnabled = locationManager.isProviderEnabled(android.location.LocationManager.NETWORK_PROVIDER);
            return gpsEnabled || networkEnabled;
        } catch (Exception e) {
            return false;
        }
    }

    /**
     * Get the Google Cloud API key from AndroidManifest.xml metadata.
     */
    private String getGoogleCloudApiKey(android.content.Context context) {
        try {
            android.content.pm.PackageManager pm = context.getPackageManager();
            android.content.pm.ApplicationInfo ai = pm.getApplicationInfo(
                context.getPackageName(), android.content.pm.PackageManager.GET_META_DATA);
            if (ai != null && ai.metaData != null) {
                return ai.metaData.getString("com.google.android.geo.API_KEY");
            }
        } catch (Exception e) {
            // Ignore errors
        }
        return null;
    }

    // ========================================================================
    // Geospatial API Methods
    // ========================================================================

    @ReactMethod
    public void isGeospatialModeSupported(final int sceneNavTag, final Promise promise) {
        UIManager uiManager = UIManagerHelper.getUIManager(getReactApplicationContext(), sceneNavTag);
        if (uiManager == null) {
            WritableMap result = Arguments.createMap();
            result.putBoolean("supported", false);
            result.putString("error", "UIManager not available");
            promise.resolve(result);
            return;
        }

        ((FabricUIManager) uiManager).addUIBlock(new com.facebook.react.fabric.interop.UIBlock() {
            @Override
            public void execute(com.facebook.react.fabric.interop.UIBlockViewResolver viewResolver) {
                try {
                    View view = viewResolver.resolveView(sceneNavTag);
                    if (!(view instanceof VRTARSceneNavigator)) {
                        WritableMap result = Arguments.createMap();
                        result.putBoolean("supported", false);
                        result.putString("error", "Invalid view type");
                        promise.resolve(result);
                        return;
                    }

                    VRTARSceneNavigator sceneNavigator = (VRTARSceneNavigator) view;
                    boolean supported = sceneNavigator.isGeospatialModeSupported();

                    WritableMap result = Arguments.createMap();
                    result.putBoolean("supported", supported);
                    promise.resolve(result);
                } catch (Exception e) {
                    WritableMap result = Arguments.createMap();
                    result.putBoolean("supported", false);
                    result.putString("error", e.getMessage());
                    promise.resolve(result);
                }
            }
        });
    }

    @ReactMethod
    public void setGeospatialModeEnabled(final int sceneNavTag, final boolean enabled) {
        UIManager uiManager = UIManagerHelper.getUIManager(getReactApplicationContext(), sceneNavTag);
        if (uiManager == null) {
            return;
        }

        ((FabricUIManager) uiManager).addUIBlock(new com.facebook.react.fabric.interop.UIBlock() {
            @Override
            public void execute(com.facebook.react.fabric.interop.UIBlockViewResolver viewResolver) {
                View view = viewResolver.resolveView(sceneNavTag);
                if (view instanceof VRTARSceneNavigator) {
                    VRTARSceneNavigator sceneNavigator = (VRTARSceneNavigator) view;
                    sceneNavigator.setGeospatialModeEnabled(enabled);
                }
            }
        });
    }

    @ReactMethod
    public void getEarthTrackingState(final int sceneNavTag, final Promise promise) {
        UIManager uiManager = UIManagerHelper.getUIManager(getReactApplicationContext(), sceneNavTag);
        if (uiManager == null) {
            WritableMap result = Arguments.createMap();
            result.putString("state", "Stopped");
            result.putString("error", "UIManager not available");
            promise.resolve(result);
            return;
        }

        ((FabricUIManager) uiManager).addUIBlock(new com.facebook.react.fabric.interop.UIBlock() {
            @Override
            public void execute(com.facebook.react.fabric.interop.UIBlockViewResolver viewResolver) {
                try {
                    View view = viewResolver.resolveView(sceneNavTag);
                    if (!(view instanceof VRTARSceneNavigator)) {
                        WritableMap result = Arguments.createMap();
                        result.putString("state", "Stopped");
                        result.putString("error", "Invalid view type");
                        promise.resolve(result);
                        return;
                    }

                    VRTARSceneNavigator sceneNavigator = (VRTARSceneNavigator) view;
                    String state = sceneNavigator.getEarthTrackingState();

                    WritableMap result = Arguments.createMap();
                    result.putString("state", state);
                    promise.resolve(result);
                } catch (Exception e) {
                    WritableMap result = Arguments.createMap();
                    result.putString("state", "Stopped");
                    result.putString("error", e.getMessage());
                    promise.resolve(result);
                }
            }
        });
    }

    @ReactMethod
    public void getCameraGeospatialPose(final int sceneNavTag, final Promise promise) {
        UIManager uiManager = UIManagerHelper.getUIManager(getReactApplicationContext(), sceneNavTag);
        if (uiManager == null) {
            WritableMap result = Arguments.createMap();
            result.putBoolean("success", false);
            result.putString("error", "UIManager not available");
            promise.resolve(result);
            return;
        }

        ((FabricUIManager) uiManager).addUIBlock(new com.facebook.react.fabric.interop.UIBlock() {
            @Override
            public void execute(com.facebook.react.fabric.interop.UIBlockViewResolver viewResolver) {
                try {
                    View view = viewResolver.resolveView(sceneNavTag);
                    if (!(view instanceof VRTARSceneNavigator)) {
                        WritableMap result = Arguments.createMap();
                        result.putBoolean("success", false);
                        result.putString("error", "Invalid view type");
                        promise.resolve(result);
                        return;
                    }

                    VRTARSceneNavigator sceneNavigator = (VRTARSceneNavigator) view;
                    sceneNavigator.getCameraGeospatialPose(new GeospatialPoseCallback() {
                        @Override
                        public void onSuccess(com.viro.core.ARScene.GeospatialPose pose) {
                            WritableMap result = Arguments.createMap();
                            result.putBoolean("success", true);

                            WritableMap poseData = Arguments.createMap();
                            poseData.putDouble("latitude", pose.latitude);
                            poseData.putDouble("longitude", pose.longitude);
                            poseData.putDouble("altitude", pose.altitude);
                            poseData.putDouble("heading", pose.heading);

                            WritableArray quaternion = Arguments.createArray();
                            quaternion.pushDouble(pose.quaternion[0]);
                            quaternion.pushDouble(pose.quaternion[1]);
                            quaternion.pushDouble(pose.quaternion[2]);
                            quaternion.pushDouble(pose.quaternion[3]);
                            poseData.putArray("quaternion", quaternion);

                            poseData.putDouble("horizontalAccuracy", pose.horizontalAccuracy);
                            poseData.putDouble("verticalAccuracy", pose.verticalAccuracy);
                            poseData.putDouble("headingAccuracy", pose.headingAccuracy);
                            poseData.putDouble("orientationYawAccuracy", pose.orientationYawAccuracy);

                            result.putMap("pose", poseData);
                            promise.resolve(result);
                        }

                        @Override
                        public void onFailure(String error) {
                            WritableMap result = Arguments.createMap();
                            result.putBoolean("success", false);
                            result.putString("error", error);
                            promise.resolve(result);
                        }
                    });
                } catch (Exception e) {
                    WritableMap result = Arguments.createMap();
                    result.putBoolean("success", false);
                    result.putString("error", e.getMessage());
                    promise.resolve(result);
                }
            }
        });
    }

    @ReactMethod
    public void checkVPSAvailability(final int sceneNavTag, final double latitude,
                                      final double longitude, final Promise promise) {
        UIManager uiManager = UIManagerHelper.getUIManager(getReactApplicationContext(), sceneNavTag);
        if (uiManager == null) {
            WritableMap result = Arguments.createMap();
            result.putString("availability", "Unknown");
            result.putString("error", "UIManager not available");
            promise.resolve(result);
            return;
        }

        ((FabricUIManager) uiManager).addUIBlock(new com.facebook.react.fabric.interop.UIBlock() {
            @Override
            public void execute(com.facebook.react.fabric.interop.UIBlockViewResolver viewResolver) {
                try {
                    View view = viewResolver.resolveView(sceneNavTag);
                    if (!(view instanceof VRTARSceneNavigator)) {
                        WritableMap result = Arguments.createMap();
                        result.putString("availability", "Unknown");
                        result.putString("error", "Invalid view type");
                        promise.resolve(result);
                        return;
                    }

                    VRTARSceneNavigator sceneNavigator = (VRTARSceneNavigator) view;
                    sceneNavigator.checkVPSAvailability(latitude, longitude, new VPSAvailabilityCallback() {
                        @Override
                        public void onResult(String availability) {
                            WritableMap result = Arguments.createMap();
                            result.putString("availability", availability);
                            promise.resolve(result);
                        }
                    });
                } catch (Exception e) {
                    WritableMap result = Arguments.createMap();
                    result.putString("availability", "Unknown");
                    result.putString("error", e.getMessage());
                    promise.resolve(result);
                }
            }
        });
    }

    @ReactMethod
    public void createGeospatialAnchor(final int sceneNavTag, final double latitude,
                                        final double longitude, final double altitude,
                                        final Dynamic quaternion, final Promise promise) {
        UIManager uiManager = UIManagerHelper.getUIManager(getReactApplicationContext(), sceneNavTag);
        if (uiManager == null) {
            WritableMap result = Arguments.createMap();
            result.putBoolean("success", false);
            result.putString("error", "UIManager not available");
            promise.resolve(result);
            return;
        }

        // Parse quaternion upfront (accepts both array [x,y,z,w] and object {x,y,z,w})
        final float[] quat = parseQuaternion(quaternion);

        ((FabricUIManager) uiManager).addUIBlock(new com.facebook.react.fabric.interop.UIBlock() {
            @Override
            public void execute(com.facebook.react.fabric.interop.UIBlockViewResolver viewResolver) {
                try {
                    View view = viewResolver.resolveView(sceneNavTag);
                    if (!(view instanceof VRTARSceneNavigator)) {
                        WritableMap result = Arguments.createMap();
                        result.putBoolean("success", false);
                        result.putString("error", "Invalid view type");
                        promise.resolve(result);
                        return;
                    }

                    VRTARSceneNavigator sceneNavigator = (VRTARSceneNavigator) view;

                    sceneNavigator.createGeospatialAnchor(latitude, longitude, altitude, quat,
                        new GeospatialAnchorCallback() {
                            @Override
                            public void onSuccess(com.viro.core.ARScene.GeospatialAnchor anchor) {
                                WritableMap result = Arguments.createMap();
                                result.putBoolean("success", true);
                                result.putMap("anchor", mapFromGeospatialAnchor(anchor));
                                promise.resolve(result);
                            }

                            @Override
                            public void onFailure(String error) {
                                WritableMap result = Arguments.createMap();
                                result.putBoolean("success", false);
                                result.putString("error", error);
                                promise.resolve(result);
                            }
                        });
                } catch (Exception e) {
                    WritableMap result = Arguments.createMap();
                    result.putBoolean("success", false);
                    result.putString("error", e.getMessage());
                    promise.resolve(result);
                }
            }
        });
    }

    @ReactMethod
    public void hostGeospatialAnchor(final int sceneNavTag, final double latitude,
                                      final double longitude, final double altitude,
                                      final String altitudeMode, final Promise promise) {
        UIManager uiManager = UIManagerHelper.getUIManager(getReactApplicationContext(), sceneNavTag);
        if (uiManager == null) {
            WritableMap result = Arguments.createMap();
            result.putBoolean("success", false);
            result.putString("error", "UIManager not available");
            promise.resolve(result);
            return;
        }
        ((FabricUIManager) uiManager).addUIBlock(new com.facebook.react.fabric.interop.UIBlock() {
            @Override
            public void execute(com.facebook.react.fabric.interop.UIBlockViewResolver viewResolver) {
                try {
                    View view = viewResolver.resolveView(sceneNavTag);
                    if (!(view instanceof VRTARSceneNavigator)) {
                        WritableMap result = Arguments.createMap();
                        result.putBoolean("success", false);
                        result.putString("error", "Invalid view type");
                        promise.resolve(result);
                        return;
                    }
                    VRTARSceneNavigator sceneNavigator = (VRTARSceneNavigator) view;
                    sceneNavigator.hostGeospatialAnchor(latitude, longitude, altitude, altitudeMode,
                        new HostGeospatialAnchorCallback() {
                            @Override
                            public void onSuccess(String platformUuid) {
                                WritableMap result = Arguments.createMap();
                                result.putBoolean("success", true);
                                result.putString("anchorId", platformUuid);
                                promise.resolve(result);
                            }
                            @Override
                            public void onFailure(String error) {
                                WritableMap result = Arguments.createMap();
                                result.putBoolean("success", false);
                                result.putString("error", error);
                                promise.resolve(result);
                            }
                        });
                } catch (Exception e) {
                    WritableMap result = Arguments.createMap();
                    result.putBoolean("success", false);
                    result.putString("error", e.getMessage());
                    promise.resolve(result);
                }
            }
        });
    }

    @ReactMethod
    public void resolveGeospatialAnchor(final int sceneNavTag, final String platformUuid,
                                         final Dynamic quaternion, final Promise promise) {
        UIManager uiManager = UIManagerHelper.getUIManager(getReactApplicationContext(), sceneNavTag);
        if (uiManager == null) {
            WritableMap result = Arguments.createMap();
            result.putBoolean("success", false);
            result.putString("error", "UIManager not available");
            promise.resolve(result);
            return;
        }
        final float[] quat = parseQuaternion(quaternion);
        ((FabricUIManager) uiManager).addUIBlock(new com.facebook.react.fabric.interop.UIBlock() {
            @Override
            public void execute(com.facebook.react.fabric.interop.UIBlockViewResolver viewResolver) {
                try {
                    View view = viewResolver.resolveView(sceneNavTag);
                    if (!(view instanceof VRTARSceneNavigator)) {
                        WritableMap result = Arguments.createMap();
                        result.putBoolean("success", false);
                        result.putString("error", "Invalid view type");
                        promise.resolve(result);
                        return;
                    }
                    VRTARSceneNavigator sceneNavigator = (VRTARSceneNavigator) view;
                    sceneNavigator.resolveGeospatialAnchor(platformUuid, quat,
                        new GeospatialAnchorCallback() {
                            @Override
                            public void onSuccess(com.viro.core.ARScene.GeospatialAnchor anchor) {
                                WritableMap result = Arguments.createMap();
                                result.putBoolean("success", true);
                                result.putMap("anchor", mapFromGeospatialAnchor(anchor));
                                promise.resolve(result);
                            }
                            @Override
                            public void onFailure(String error) {
                                WritableMap result = Arguments.createMap();
                                result.putBoolean("success", false);
                                result.putString("error", error);
                                promise.resolve(result);
                            }
                        });
                } catch (Exception e) {
                    WritableMap result = Arguments.createMap();
                    result.putBoolean("success", false);
                    result.putString("error", e.getMessage());
                    promise.resolve(result);
                }
            }
        });
    }

    @ReactMethod
    public void createTerrainAnchor(final int sceneNavTag, final double latitude,
                                     final double longitude, final double altitudeAboveTerrain,
                                     final Dynamic quaternion, final Promise promise) {
        UIManager uiManager = UIManagerHelper.getUIManager(getReactApplicationContext(), sceneNavTag);
        if (uiManager == null) {
            WritableMap result = Arguments.createMap();
            result.putBoolean("success", false);
            result.putString("error", "UIManager not available");
            promise.resolve(result);
            return;
        }

        // Parse quaternion upfront (accepts both array [x,y,z,w] and object {x,y,z,w})
        final float[] quat = parseQuaternion(quaternion);

        ((FabricUIManager) uiManager).addUIBlock(new com.facebook.react.fabric.interop.UIBlock() {
            @Override
            public void execute(com.facebook.react.fabric.interop.UIBlockViewResolver viewResolver) {
                try {
                    View view = viewResolver.resolveView(sceneNavTag);
                    if (!(view instanceof VRTARSceneNavigator)) {
                        WritableMap result = Arguments.createMap();
                        result.putBoolean("success", false);
                        result.putString("error", "Invalid view type");
                        promise.resolve(result);
                        return;
                    }

                    VRTARSceneNavigator sceneNavigator = (VRTARSceneNavigator) view;

                    sceneNavigator.createTerrainAnchor(latitude, longitude, altitudeAboveTerrain, quat,
                        new GeospatialAnchorCallback() {
                            @Override
                            public void onSuccess(com.viro.core.ARScene.GeospatialAnchor anchor) {
                                WritableMap result = Arguments.createMap();
                                result.putBoolean("success", true);
                                result.putMap("anchor", mapFromGeospatialAnchor(anchor));
                                promise.resolve(result);
                            }

                            @Override
                            public void onFailure(String error) {
                                WritableMap result = Arguments.createMap();
                                result.putBoolean("success", false);
                                result.putString("error", error);
                                promise.resolve(result);
                            }
                        });
                } catch (Exception e) {
                    WritableMap result = Arguments.createMap();
                    result.putBoolean("success", false);
                    result.putString("error", e.getMessage());
                    promise.resolve(result);
                }
            }
        });
    }

    @ReactMethod
    public void createRooftopAnchor(final int sceneNavTag, final double latitude,
                                     final double longitude, final double altitudeAboveRooftop,
                                     final Dynamic quaternion, final Promise promise) {
        UIManager uiManager = UIManagerHelper.getUIManager(getReactApplicationContext(), sceneNavTag);
        if (uiManager == null) {
            WritableMap result = Arguments.createMap();
            result.putBoolean("success", false);
            result.putString("error", "UIManager not available");
            promise.resolve(result);
            return;
        }

        // Parse quaternion upfront (accepts both array [x,y,z,w] and object {x,y,z,w})
        final float[] quat = parseQuaternion(quaternion);

        ((FabricUIManager) uiManager).addUIBlock(new com.facebook.react.fabric.interop.UIBlock() {
            @Override
            public void execute(com.facebook.react.fabric.interop.UIBlockViewResolver viewResolver) {
                try {
                    View view = viewResolver.resolveView(sceneNavTag);
                    if (!(view instanceof VRTARSceneNavigator)) {
                        WritableMap result = Arguments.createMap();
                        result.putBoolean("success", false);
                        result.putString("error", "Invalid view type");
                        promise.resolve(result);
                        return;
                    }

                    VRTARSceneNavigator sceneNavigator = (VRTARSceneNavigator) view;

                    sceneNavigator.createRooftopAnchor(latitude, longitude, altitudeAboveRooftop, quat,
                        new GeospatialAnchorCallback() {
                            @Override
                            public void onSuccess(com.viro.core.ARScene.GeospatialAnchor anchor) {
                                WritableMap result = Arguments.createMap();
                                result.putBoolean("success", true);
                                result.putMap("anchor", mapFromGeospatialAnchor(anchor));
                                promise.resolve(result);
                            }

                            @Override
                            public void onFailure(String error) {
                                WritableMap result = Arguments.createMap();
                                result.putBoolean("success", false);
                                result.putString("error", error);
                                promise.resolve(result);
                            }
                        });
                } catch (Exception e) {
                    WritableMap result = Arguments.createMap();
                    result.putBoolean("success", false);
                    result.putString("error", e.getMessage());
                    promise.resolve(result);
                }
            }
        });
    }

    @ReactMethod
    public void removeGeospatialAnchor(final int sceneNavTag, final String anchorId) {
        UIManager uiManager = UIManagerHelper.getUIManager(getReactApplicationContext(), sceneNavTag);
        if (uiManager == null) {
            return;
        }

        ((FabricUIManager) uiManager).addUIBlock(new com.facebook.react.fabric.interop.UIBlock() {
            @Override
            public void execute(com.facebook.react.fabric.interop.UIBlockViewResolver viewResolver) {
                View view = viewResolver.resolveView(sceneNavTag);
                if (view instanceof VRTARSceneNavigator) {
                    VRTARSceneNavigator sceneNavigator = (VRTARSceneNavigator) view;
                    sceneNavigator.removeGeospatialAnchor(anchorId);
                }
            }
        });
    }

    // ========================================================================
    // ReactVision Geospatial CRUD API Methods
    // ========================================================================

    /** Convert a JSON object string into a WritableMap for React. */
    private WritableMap rvJsonObjectToMap(String json) {
        WritableMap map = Arguments.createMap();
        if (json == null || json.isEmpty()) return map;
        try {
            JSONObject obj = new JSONObject(json);
            java.util.Iterator<String> keys = obj.keys();
            while (keys.hasNext()) {
                String k = keys.next();
                Object v = obj.get(k);
                if (v instanceof Boolean)    map.putBoolean(k, (Boolean) v);
                else if (v instanceof Integer) map.putInt(k, (Integer) v);
                else if (v instanceof Double)  map.putDouble(k, (Double) v);
                else if (v instanceof JSONObject) map.putMap(k, rvJsonObjectToMap(v.toString()));
                else map.putString(k, v.toString());
            }
        } catch (Exception e) {
            map.putString("parseError", e.getMessage());
        }
        return map;
    }

    /** Convert a JSON array string of objects into a WritableArray for React. */
    private WritableArray rvJsonArrayToArray(String json) {
        WritableArray arr = Arguments.createArray();
        if (json == null || json.isEmpty()) return arr;
        try {
            JSONArray jArr = new JSONArray(json);
            for (int i = 0; i < jArr.length(); i++) {
                arr.pushMap(rvJsonObjectToMap(jArr.getJSONObject(i).toString()));
            }
        } catch (Exception e) {
            // Return empty array on parse error
        }
        return arr;
    }

    @ReactMethod
    public void rvGetGeospatialAnchor(final int sceneNavTag, final String anchorId,
                                       final Promise promise) {
        UIManager uiManager = UIManagerHelper.getUIManager(getReactApplicationContext(), sceneNavTag);
        if (uiManager == null) {
            WritableMap r = Arguments.createMap();
            r.putBoolean("success", false); r.putString("error", "UIManager not available");
            promise.resolve(r); return;
        }
        ((FabricUIManager) uiManager).addUIBlock(new com.facebook.react.fabric.interop.UIBlock() {
            @Override
            public void execute(com.facebook.react.fabric.interop.UIBlockViewResolver viewResolver) {
                try {
                    View view = viewResolver.resolveView(sceneNavTag);
                    if (!(view instanceof VRTARSceneNavigator)) {
                        WritableMap r = Arguments.createMap();
                        r.putBoolean("success", false); r.putString("error", "Invalid view type");
                        promise.resolve(r); return;
                    }
                    ((VRTARSceneNavigator) view).rvGetGeospatialAnchor(anchorId, (success, jsonData, error) -> {
                        WritableMap r = Arguments.createMap();
                        r.putBoolean("success", success);
                        if (success) r.putMap("anchor", rvJsonObjectToMap(jsonData));
                        else         r.putString("error", error);
                        promise.resolve(r);
                    });
                } catch (Exception e) {
                    WritableMap r = Arguments.createMap();
                    r.putBoolean("success", false); r.putString("error", e.getMessage());
                    promise.resolve(r);
                }
            }
        });
    }

    @ReactMethod
    public void rvFindNearbyGeospatialAnchors(final int sceneNavTag,
                                               final double latitude, final double longitude,
                                               final double radius, final int limit,
                                               final Promise promise) {
        UIManager uiManager = UIManagerHelper.getUIManager(getReactApplicationContext(), sceneNavTag);
        if (uiManager == null) {
            WritableMap r = Arguments.createMap();
            r.putBoolean("success", false); r.putString("error", "UIManager not available");
            promise.resolve(r); return;
        }
        ((FabricUIManager) uiManager).addUIBlock(new com.facebook.react.fabric.interop.UIBlock() {
            @Override
            public void execute(com.facebook.react.fabric.interop.UIBlockViewResolver viewResolver) {
                try {
                    View view = viewResolver.resolveView(sceneNavTag);
                    if (!(view instanceof VRTARSceneNavigator)) {
                        WritableMap r = Arguments.createMap();
                        r.putBoolean("success", false); r.putString("error", "Invalid view type");
                        promise.resolve(r); return;
                    }
                    ((VRTARSceneNavigator) view).rvFindNearbyGeospatialAnchors(
                            latitude, longitude, radius, limit, (success, jsonData, error) -> {
                        WritableMap r = Arguments.createMap();
                        r.putBoolean("success", success);
                        r.putArray("anchors", rvJsonArrayToArray(jsonData));
                        if (!success) r.putString("error", error);
                        promise.resolve(r);
                    });
                } catch (Exception e) {
                    WritableMap r = Arguments.createMap();
                    r.putBoolean("success", false); r.putString("error", e.getMessage());
                    promise.resolve(r);
                }
            }
        });
    }

    @ReactMethod
    public void rvUpdateGeospatialAnchor(final int sceneNavTag, final String anchorId,
                                          final String sceneAssetId, final String sceneId,
                                          final String name, final String userAssetId,
                                          final Promise promise) {
        UIManager uiManager = UIManagerHelper.getUIManager(getReactApplicationContext(), sceneNavTag);
        if (uiManager == null) {
            WritableMap r = Arguments.createMap();
            r.putBoolean("success", false); r.putString("error", "UIManager not available");
            promise.resolve(r); return;
        }
        ((FabricUIManager) uiManager).addUIBlock(new com.facebook.react.fabric.interop.UIBlock() {
            @Override
            public void execute(com.facebook.react.fabric.interop.UIBlockViewResolver viewResolver) {
                try {
                    View view = viewResolver.resolveView(sceneNavTag);
                    if (!(view instanceof VRTARSceneNavigator)) {
                        WritableMap r = Arguments.createMap();
                        r.putBoolean("success", false); r.putString("error", "Invalid view type");
                        promise.resolve(r); return;
                    }
                    ((VRTARSceneNavigator) view).rvUpdateGeospatialAnchor(
                            anchorId, sceneAssetId, sceneId, name, userAssetId, (success, jsonData, error) -> {
                        WritableMap r = Arguments.createMap();
                        r.putBoolean("success", success);
                        if (success) r.putMap("anchor", rvJsonObjectToMap(jsonData));
                        else         r.putString("error", error);
                        promise.resolve(r);
                    });
                } catch (Exception e) {
                    WritableMap r = Arguments.createMap();
                    r.putBoolean("success", false); r.putString("error", e.getMessage());
                    promise.resolve(r);
                }
            }
        });
    }

    @ReactMethod
    public void rvUploadAsset(final int sceneNavTag, final String filePath,
                               final String assetType, final String fileName,
                               final String appUserId, final Promise promise) {
        UIManager uiManager = UIManagerHelper.getUIManager(getReactApplicationContext(), sceneNavTag);
        if (uiManager == null) { WritableMap r = Arguments.createMap(); r.putBoolean("success", false); r.putString("error", "UIManager not available"); promise.resolve(r); return; }
        ((FabricUIManager) uiManager).addUIBlock(new com.facebook.react.fabric.interop.UIBlock() {
            @Override public void execute(com.facebook.react.fabric.interop.UIBlockViewResolver viewResolver) {
                try {
                    View view = viewResolver.resolveView(sceneNavTag);
                    if (!(view instanceof VRTARSceneNavigator)) { WritableMap r = Arguments.createMap(); r.putBoolean("success", false); r.putString("error", "Invalid view type"); promise.resolve(r); return; }
                    ((VRTARSceneNavigator) view).rvUploadAsset(filePath, assetType, fileName, appUserId,
                            (success, userAssetId, fileUrl, error) -> {
                        WritableMap r = Arguments.createMap();
                        r.putBoolean("success", success);
                        if (success) {
                            r.putString("userAssetId", userAssetId);
                            r.putString("fileUrl", fileUrl);
                        } else {
                            r.putString("error", error);
                        }
                        promise.resolve(r);
                    });
                } catch (Exception e) { WritableMap r = Arguments.createMap(); r.putBoolean("success", false); r.putString("error", e.getMessage()); promise.resolve(r); }
            }
        });
    }

    @ReactMethod
    public void rvDeleteGeospatialAnchor(final int sceneNavTag, final String anchorId,
                                          final Promise promise) {
        UIManager uiManager = UIManagerHelper.getUIManager(getReactApplicationContext(), sceneNavTag);
        if (uiManager == null) {
            WritableMap r = Arguments.createMap();
            r.putBoolean("success", false); r.putString("error", "UIManager not available");
            promise.resolve(r); return;
        }
        ((FabricUIManager) uiManager).addUIBlock(new com.facebook.react.fabric.interop.UIBlock() {
            @Override
            public void execute(com.facebook.react.fabric.interop.UIBlockViewResolver viewResolver) {
                try {
                    View view = viewResolver.resolveView(sceneNavTag);
                    if (!(view instanceof VRTARSceneNavigator)) {
                        WritableMap r = Arguments.createMap();
                        r.putBoolean("success", false); r.putString("error", "Invalid view type");
                        promise.resolve(r); return;
                    }
                    ((VRTARSceneNavigator) view).rvDeleteGeospatialAnchor(anchorId, (success, jsonData, error) -> {
                        WritableMap r = Arguments.createMap();
                        r.putBoolean("success", success);
                        if (!success) r.putString("error", error);
                        promise.resolve(r);
                    });
                } catch (Exception e) {
                    WritableMap r = Arguments.createMap();
                    r.putBoolean("success", false); r.putString("error", e.getMessage());
                    promise.resolve(r);
                }
            }
        });
    }

    @ReactMethod
    public void rvListGeospatialAnchors(final int sceneNavTag, final int limit, final int offset,
                                         final Promise promise) {
        UIManager uiManager = UIManagerHelper.getUIManager(getReactApplicationContext(), sceneNavTag);
        if (uiManager == null) { WritableMap r = Arguments.createMap(); r.putBoolean("success", false); r.putString("error", "UIManager not available"); promise.resolve(r); return; }
        ((FabricUIManager) uiManager).addUIBlock(new com.facebook.react.fabric.interop.UIBlock() {
            @Override public void execute(com.facebook.react.fabric.interop.UIBlockViewResolver viewResolver) {
                try {
                    View view = viewResolver.resolveView(sceneNavTag);
                    if (!(view instanceof VRTARSceneNavigator)) { WritableMap r = Arguments.createMap(); r.putBoolean("success", false); r.putString("error", "Invalid view type"); promise.resolve(r); return; }
                    ((VRTARSceneNavigator) view).rvListGeospatialAnchors(limit, offset, (success, jsonData, error) -> {
                        WritableMap r = Arguments.createMap();
                        r.putBoolean("success", success);
                        r.putArray("anchors", rvJsonArrayToArray(jsonData));
                        if (!success) r.putString("error", error);
                        promise.resolve(r);
                    });
                } catch (Exception e) { WritableMap r = Arguments.createMap(); r.putBoolean("success", false); r.putString("error", e.getMessage()); promise.resolve(r); }
            }
        });
    }

    // ── Cloud anchor management ───────────────────────────────────────────────

    @ReactMethod
    public void rvGetCloudAnchor(final int sceneNavTag, final String anchorId, final Promise promise) {
        UIManager uiManager = UIManagerHelper.getUIManager(getReactApplicationContext(), sceneNavTag);
        if (uiManager == null) { WritableMap r = Arguments.createMap(); r.putBoolean("success", false); r.putString("error", "UIManager not available"); promise.resolve(r); return; }
        ((FabricUIManager) uiManager).addUIBlock(new com.facebook.react.fabric.interop.UIBlock() {
            @Override public void execute(com.facebook.react.fabric.interop.UIBlockViewResolver viewResolver) {
                try {
                    View view = viewResolver.resolveView(sceneNavTag);
                    if (!(view instanceof VRTARSceneNavigator)) { WritableMap r = Arguments.createMap(); r.putBoolean("success", false); r.putString("error", "Invalid view type"); promise.resolve(r); return; }
                    ((VRTARSceneNavigator) view).rvGetCloudAnchor(anchorId, (success, jsonData, error) -> {
                        WritableMap r = Arguments.createMap();
                        r.putBoolean("success", success);
                        if (success) r.putMap("anchor", rvJsonObjectToMap(jsonData));
                        else         r.putString("error", error);
                        promise.resolve(r);
                    });
                } catch (Exception e) { WritableMap r = Arguments.createMap(); r.putBoolean("success", false); r.putString("error", e.getMessage()); promise.resolve(r); }
            }
        });
    }

    @ReactMethod
    public void rvListCloudAnchors(final int sceneNavTag, final int limit, final int offset,
                                    final Promise promise) {
        UIManager uiManager = UIManagerHelper.getUIManager(getReactApplicationContext(), sceneNavTag);
        if (uiManager == null) { WritableMap r = Arguments.createMap(); r.putBoolean("success", false); r.putString("error", "UIManager not available"); promise.resolve(r); return; }
        ((FabricUIManager) uiManager).addUIBlock(new com.facebook.react.fabric.interop.UIBlock() {
            @Override public void execute(com.facebook.react.fabric.interop.UIBlockViewResolver viewResolver) {
                try {
                    View view = viewResolver.resolveView(sceneNavTag);
                    if (!(view instanceof VRTARSceneNavigator)) { WritableMap r = Arguments.createMap(); r.putBoolean("success", false); r.putString("error", "Invalid view type"); promise.resolve(r); return; }
                    ((VRTARSceneNavigator) view).rvListCloudAnchors(limit, offset, (success, jsonData, error) -> {
                        WritableMap r = Arguments.createMap();
                        r.putBoolean("success", success);
                        r.putArray("anchors", rvJsonArrayToArray(jsonData));
                        if (!success) r.putString("error", error);
                        promise.resolve(r);
                    });
                } catch (Exception e) { WritableMap r = Arguments.createMap(); r.putBoolean("success", false); r.putString("error", e.getMessage()); promise.resolve(r); }
            }
        });
    }

    @ReactMethod
    public void rvUpdateCloudAnchor(final int sceneNavTag, final String anchorId,
                                     final String name, final String description,
                                     final boolean isPublic, final Promise promise) {
        UIManager uiManager = UIManagerHelper.getUIManager(getReactApplicationContext(), sceneNavTag);
        if (uiManager == null) { WritableMap r = Arguments.createMap(); r.putBoolean("success", false); r.putString("error", "UIManager not available"); promise.resolve(r); return; }
        ((FabricUIManager) uiManager).addUIBlock(new com.facebook.react.fabric.interop.UIBlock() {
            @Override public void execute(com.facebook.react.fabric.interop.UIBlockViewResolver viewResolver) {
                try {
                    View view = viewResolver.resolveView(sceneNavTag);
                    if (!(view instanceof VRTARSceneNavigator)) { WritableMap r = Arguments.createMap(); r.putBoolean("success", false); r.putString("error", "Invalid view type"); promise.resolve(r); return; }
                    ((VRTARSceneNavigator) view).rvUpdateCloudAnchor(anchorId, name, description, isPublic, (success, jsonData, error) -> {
                        WritableMap r = Arguments.createMap();
                        r.putBoolean("success", success);
                        if (success) r.putMap("anchor", rvJsonObjectToMap(jsonData));
                        else         r.putString("error", error);
                        promise.resolve(r);
                    });
                } catch (Exception e) { WritableMap r = Arguments.createMap(); r.putBoolean("success", false); r.putString("error", e.getMessage()); promise.resolve(r); }
            }
        });
    }

    @ReactMethod
    public void rvDeleteCloudAnchor(final int sceneNavTag, final String anchorId,
                                     final Promise promise) {
        UIManager uiManager = UIManagerHelper.getUIManager(getReactApplicationContext(), sceneNavTag);
        if (uiManager == null) { WritableMap r = Arguments.createMap(); r.putBoolean("success", false); r.putString("error", "UIManager not available"); promise.resolve(r); return; }
        ((FabricUIManager) uiManager).addUIBlock(new com.facebook.react.fabric.interop.UIBlock() {
            @Override public void execute(com.facebook.react.fabric.interop.UIBlockViewResolver viewResolver) {
                try {
                    View view = viewResolver.resolveView(sceneNavTag);
                    if (!(view instanceof VRTARSceneNavigator)) { WritableMap r = Arguments.createMap(); r.putBoolean("success", false); r.putString("error", "Invalid view type"); promise.resolve(r); return; }
                    ((VRTARSceneNavigator) view).rvDeleteCloudAnchor(anchorId, (success, jsonData, error) -> {
                        WritableMap r = Arguments.createMap();
                        r.putBoolean("success", success);
                        if (!success) r.putString("error", error);
                        promise.resolve(r);
                    });
                } catch (Exception e) { WritableMap r = Arguments.createMap(); r.putBoolean("success", false); r.putString("error", e.getMessage()); promise.resolve(r); }
            }
        });
    }

    @ReactMethod
    public void rvFindNearbyCloudAnchors(final int sceneNavTag, final double latitude,
                                          final double longitude, final double radius,
                                          final int limit, final Promise promise) {
        UIManager uiManager = UIManagerHelper.getUIManager(getReactApplicationContext(), sceneNavTag);
        if (uiManager == null) { WritableMap r = Arguments.createMap(); r.putBoolean("success", false); r.putString("error", "UIManager not available"); promise.resolve(r); return; }
        ((FabricUIManager) uiManager).addUIBlock(new com.facebook.react.fabric.interop.UIBlock() {
            @Override public void execute(com.facebook.react.fabric.interop.UIBlockViewResolver viewResolver) {
                try {
                    View view = viewResolver.resolveView(sceneNavTag);
                    if (!(view instanceof VRTARSceneNavigator)) { WritableMap r = Arguments.createMap(); r.putBoolean("success", false); r.putString("error", "Invalid view type"); promise.resolve(r); return; }
                    ((VRTARSceneNavigator) view).rvFindNearbyCloudAnchors(latitude, longitude, radius, limit, (success, jsonData, error) -> {
                        WritableMap r = Arguments.createMap();
                        r.putBoolean("success", success);
                        r.putArray("anchors", rvJsonArrayToArray(jsonData));
                        if (!success) r.putString("error", error);
                        promise.resolve(r);
                    });
                } catch (Exception e) { WritableMap r = Arguments.createMap(); r.putBoolean("success", false); r.putString("error", e.getMessage()); promise.resolve(r); }
            }
        });
    }

    @ReactMethod
    public void rvGetSceneAssets(final int sceneNavTag, final String sceneId, final Promise promise) {
        UIManager uiManager = UIManagerHelper.getUIManager(getReactApplicationContext(), sceneNavTag);
        if (uiManager == null) { WritableMap r = Arguments.createMap(); r.putBoolean("success", false); r.putString("error", "UIManager not available"); promise.resolve(r); return; }
        ((FabricUIManager) uiManager).addUIBlock(new com.facebook.react.fabric.interop.UIBlock() {
            @Override public void execute(com.facebook.react.fabric.interop.UIBlockViewResolver viewResolver) {
                try {
                    View view = viewResolver.resolveView(sceneNavTag);
                    if (!(view instanceof VRTARSceneNavigator)) { WritableMap r = Arguments.createMap(); r.putBoolean("success", false); r.putString("error", "Invalid view type"); promise.resolve(r); return; }
                    ((VRTARSceneNavigator) view).rvGetSceneAssets(sceneId, (success, jsonData, error) -> {
                        WritableMap r = Arguments.createMap();
                        r.putBoolean("success", success);
                        r.putArray("assets", rvJsonArrayToArray(jsonData));
                        if (!success) r.putString("error", error);
                        promise.resolve(r);
                    });
                } catch (Exception e) { WritableMap r = Arguments.createMap(); r.putBoolean("success", false); r.putString("error", e.getMessage()); promise.resolve(r); }
            }
        });
    }

    @ReactMethod
    public void rvGetScene(final int sceneNavTag, final String sceneId, final Promise promise) {
        UIManager uiManager = UIManagerHelper.getUIManager(getReactApplicationContext(), sceneNavTag);
        if (uiManager == null) { WritableMap r = Arguments.createMap(); r.putBoolean("success", false); r.putString("error", "UIManager not available"); promise.resolve(r); return; }
        ((FabricUIManager) uiManager).addUIBlock(new com.facebook.react.fabric.interop.UIBlock() {
            @Override public void execute(com.facebook.react.fabric.interop.UIBlockViewResolver viewResolver) {
                try {
                    View view = viewResolver.resolveView(sceneNavTag);
                    if (!(view instanceof VRTARSceneNavigator)) { WritableMap r = Arguments.createMap(); r.putBoolean("success", false); r.putString("error", "Invalid view type"); promise.resolve(r); return; }
                    ((VRTARSceneNavigator) view).rvGetScene(sceneId, (success, jsonData, error) -> {
                        WritableMap r = Arguments.createMap();
                        r.putBoolean("success", success);
                        if (success) r.putString("data", jsonData);
                        if (!success) r.putString("error", error);
                        promise.resolve(r);
                    });
                } catch (Exception e) { WritableMap r = Arguments.createMap(); r.putBoolean("success", false); r.putString("error", e.getMessage()); promise.resolve(r); }
            }
        });
    }

    @ReactMethod
    public void rvAttachAssetToCloudAnchor(final int sceneNavTag, final String anchorId,
                                            final String fileUrl, final double fileSize,
                                            final String name, final String assetType,
                                            final String externalUserId, final Promise promise) {
        UIManager uiManager = UIManagerHelper.getUIManager(getReactApplicationContext(), sceneNavTag);
        if (uiManager == null) { WritableMap r = Arguments.createMap(); r.putBoolean("success", false); r.putString("error", "UIManager not available"); promise.resolve(r); return; }
        ((FabricUIManager) uiManager).addUIBlock(new com.facebook.react.fabric.interop.UIBlock() {
            @Override public void execute(com.facebook.react.fabric.interop.UIBlockViewResolver viewResolver) {
                try {
                    View view = viewResolver.resolveView(sceneNavTag);
                    if (!(view instanceof VRTARSceneNavigator)) { WritableMap r = Arguments.createMap(); r.putBoolean("success", false); r.putString("error", "Invalid view type"); promise.resolve(r); return; }
                    ((VRTARSceneNavigator) view).rvAttachAssetToCloudAnchor(anchorId, fileUrl, (long)fileSize,
                            name, assetType, externalUserId, (success, jsonData, error) -> {
                        WritableMap r = Arguments.createMap();
                        r.putBoolean("success", success);
                        if (!success) r.putString("error", error);
                        promise.resolve(r);
                    });
                } catch (Exception e) { WritableMap r = Arguments.createMap(); r.putBoolean("success", false); r.putString("error", e.getMessage()); promise.resolve(r); }
            }
        });
    }

    @ReactMethod
    public void rvRemoveAssetFromCloudAnchor(final int sceneNavTag, final String anchorId,
                                              final String assetId, final Promise promise) {
        UIManager uiManager = UIManagerHelper.getUIManager(getReactApplicationContext(), sceneNavTag);
        if (uiManager == null) { WritableMap r = Arguments.createMap(); r.putBoolean("success", false); r.putString("error", "UIManager not available"); promise.resolve(r); return; }
        ((FabricUIManager) uiManager).addUIBlock(new com.facebook.react.fabric.interop.UIBlock() {
            @Override public void execute(com.facebook.react.fabric.interop.UIBlockViewResolver viewResolver) {
                try {
                    View view = viewResolver.resolveView(sceneNavTag);
                    if (!(view instanceof VRTARSceneNavigator)) { WritableMap r = Arguments.createMap(); r.putBoolean("success", false); r.putString("error", "Invalid view type"); promise.resolve(r); return; }
                    ((VRTARSceneNavigator) view).rvRemoveAssetFromCloudAnchor(anchorId, assetId, (success, jsonData, error) -> {
                        WritableMap r = Arguments.createMap();
                        r.putBoolean("success", success);
                        if (!success) r.putString("error", error);
                        promise.resolve(r);
                    });
                } catch (Exception e) { WritableMap r = Arguments.createMap(); r.putBoolean("success", false); r.putString("error", e.getMessage()); promise.resolve(r); }
            }
        });
    }

    @ReactMethod
    public void rvTrackCloudAnchorResolution(final int sceneNavTag, final String anchorId,
                                              final boolean success, final double confidence,
                                              final int matchCount, final int inlierCount,
                                              final int processingTimeMs, final String platform,
                                              final String externalUserId, final Promise promise) {
        UIManager uiManager = UIManagerHelper.getUIManager(getReactApplicationContext(), sceneNavTag);
        if (uiManager == null) { WritableMap r = Arguments.createMap(); r.putBoolean("success", false); r.putString("error", "UIManager not available"); promise.resolve(r); return; }
        ((FabricUIManager) uiManager).addUIBlock(new com.facebook.react.fabric.interop.UIBlock() {
            @Override public void execute(com.facebook.react.fabric.interop.UIBlockViewResolver viewResolver) {
                try {
                    View view = viewResolver.resolveView(sceneNavTag);
                    if (!(view instanceof VRTARSceneNavigator)) { WritableMap r = Arguments.createMap(); r.putBoolean("success", false); r.putString("error", "Invalid view type"); promise.resolve(r); return; }
                    ((VRTARSceneNavigator) view).rvTrackCloudAnchorResolution(anchorId, success, confidence,
                            matchCount, inlierCount, processingTimeMs, platform, externalUserId,
                            (ok, jsonData, error) -> {
                        WritableMap r = Arguments.createMap();
                        r.putBoolean("success", ok);
                        if (!ok) r.putString("error", error);
                        promise.resolve(r);
                    });
                } catch (Exception e) { WritableMap r = Arguments.createMap(); r.putBoolean("success", false); r.putString("error", e.getMessage()); promise.resolve(r); }
            }
        });
    }

    // ========================================================================
    // Scene Semantics API Methods
    // ========================================================================

    @ReactMethod
    public void isSemanticModeSupported(final int sceneNavTag, final Promise promise) {
        UIManager uiManager = UIManagerHelper.getUIManager(getReactApplicationContext(), sceneNavTag);
        if (uiManager == null) {
            WritableMap result = Arguments.createMap();
            result.putBoolean("supported", false);
            result.putString("error", "UIManager not available");
            promise.resolve(result);
            return;
        }

        ((FabricUIManager) uiManager).addUIBlock(new com.facebook.react.fabric.interop.UIBlock() {
            @Override
            public void execute(com.facebook.react.fabric.interop.UIBlockViewResolver viewResolver) {
                try {
                    View view = viewResolver.resolveView(sceneNavTag);
                    if (!(view instanceof VRTARSceneNavigator)) {
                        WritableMap result = Arguments.createMap();
                        result.putBoolean("supported", false);
                        result.putString("error", "Invalid view type");
                        promise.resolve(result);
                        return;
                    }

                    VRTARSceneNavigator sceneNavigator = (VRTARSceneNavigator) view;
                    boolean supported = sceneNavigator.isSemanticModeSupported();

                    WritableMap result = Arguments.createMap();
                    result.putBoolean("supported", supported);
                    promise.resolve(result);
                } catch (Exception e) {
                    WritableMap result = Arguments.createMap();
                    result.putBoolean("supported", false);
                    result.putString("error", e.getMessage());
                    promise.resolve(result);
                }
            }
        });
    }

    @ReactMethod
    public void setSemanticModeEnabled(final int sceneNavTag, final boolean enabled) {
        UIManager uiManager = UIManagerHelper.getUIManager(getReactApplicationContext(), sceneNavTag);
        if (uiManager == null) {
            return;
        }

        ((FabricUIManager) uiManager).addUIBlock(new com.facebook.react.fabric.interop.UIBlock() {
            @Override
            public void execute(com.facebook.react.fabric.interop.UIBlockViewResolver viewResolver) {
                View view = viewResolver.resolveView(sceneNavTag);
                if (view instanceof VRTARSceneNavigator) {
                    VRTARSceneNavigator sceneNavigator = (VRTARSceneNavigator) view;
                    sceneNavigator.setSemanticModeEnabled(enabled);
                }
            }
        });
    }

    @ReactMethod
    public void getSemanticLabelFractions(final int sceneNavTag, final Promise promise) {
        UIManager uiManager = UIManagerHelper.getUIManager(getReactApplicationContext(), sceneNavTag);
        if (uiManager == null) {
            WritableMap result = Arguments.createMap();
            result.putBoolean("success", false);
            result.putString("error", "UIManager not available");
            promise.resolve(result);
            return;
        }

        ((FabricUIManager) uiManager).addUIBlock(new com.facebook.react.fabric.interop.UIBlock() {
            @Override
            public void execute(com.facebook.react.fabric.interop.UIBlockViewResolver viewResolver) {
                try {
                    View view = viewResolver.resolveView(sceneNavTag);
                    if (!(view instanceof VRTARSceneNavigator)) {
                        WritableMap result = Arguments.createMap();
                        result.putBoolean("success", false);
                        result.putString("error", "Invalid view type");
                        promise.resolve(result);
                        return;
                    }

                    VRTARSceneNavigator sceneNavigator = (VRTARSceneNavigator) view;
                    WritableMap fractions = sceneNavigator.getSemanticLabelFractions();

                    WritableMap result = Arguments.createMap();
                    result.putBoolean("success", true);
                    result.putMap("fractions", fractions);
                    promise.resolve(result);
                } catch (Exception e) {
                    WritableMap result = Arguments.createMap();
                    result.putBoolean("success", false);
                    result.putString("error", e.getMessage());
                    promise.resolve(result);
                }
            }
        });
    }

    @ReactMethod
    public void getSemanticLabelFraction(final int sceneNavTag, final String label, final Promise promise) {
        UIManager uiManager = UIManagerHelper.getUIManager(getReactApplicationContext(), sceneNavTag);
        if (uiManager == null) {
            WritableMap result = Arguments.createMap();
            result.putBoolean("success", false);
            result.putDouble("fraction", 0.0);
            result.putString("error", "UIManager not available");
            promise.resolve(result);
            return;
        }

        ((FabricUIManager) uiManager).addUIBlock(new com.facebook.react.fabric.interop.UIBlock() {
            @Override
            public void execute(com.facebook.react.fabric.interop.UIBlockViewResolver viewResolver) {
                try {
                    View view = viewResolver.resolveView(sceneNavTag);
                    if (!(view instanceof VRTARSceneNavigator)) {
                        WritableMap result = Arguments.createMap();
                        result.putBoolean("success", false);
                        result.putDouble("fraction", 0.0);
                        result.putString("error", "Invalid view type");
                        promise.resolve(result);
                        return;
                    }

                    VRTARSceneNavigator sceneNavigator = (VRTARSceneNavigator) view;
                    float fraction = sceneNavigator.getSemanticLabelFraction(label);

                    WritableMap result = Arguments.createMap();
                    result.putBoolean("success", true);
                    result.putDouble("fraction", fraction);
                    promise.resolve(result);
                } catch (Exception e) {
                    WritableMap result = Arguments.createMap();
                    result.putBoolean("success", false);
                    result.putDouble("fraction", 0.0);
                    result.putString("error", e.getMessage());
                    promise.resolve(result);
                }
            }
        });
    }

    /**
     * Helper method to parse a quaternion from either an array [x, y, z, w] or an object {x, y, z, w}.
     * Returns identity quaternion [0, 0, 0, 1] if input is null or invalid.
     */
    private float[] parseQuaternion(Dynamic quaternion) {
        float[] quat = new float[]{0, 0, 0, 1}; // Default identity quaternion

        if (quaternion == null || quaternion.isNull()) {
            return quat;
        }

        try {
            if (quaternion.getType() == ReadableType.Array) {
                ReadableArray arr = quaternion.asArray();
                if (arr.size() >= 4) {
                    quat[0] = (float) arr.getDouble(0);
                    quat[1] = (float) arr.getDouble(1);
                    quat[2] = (float) arr.getDouble(2);
                    quat[3] = (float) arr.getDouble(3);
                }
            } else if (quaternion.getType() == ReadableType.Map) {
                ReadableMap map = quaternion.asMap();
                if (map.hasKey("x")) quat[0] = (float) map.getDouble("x");
                if (map.hasKey("y")) quat[1] = (float) map.getDouble("y");
                if (map.hasKey("z")) quat[2] = (float) map.getDouble("z");
                if (map.hasKey("w")) quat[3] = (float) map.getDouble("w");
            }
        } catch (Exception e) {
            Log.w("ARSceneNavigatorModule", "Failed to parse quaternion, using identity: " + e.getMessage());
        }

        return quat;
    }

    /**
     * Helper method to convert a GeospatialAnchor to a WritableMap.
     */
    private WritableMap mapFromGeospatialAnchor(com.viro.core.ARScene.GeospatialAnchor anchor) {
        WritableMap anchorData = Arguments.createMap();
        anchorData.putString("anchorId", anchor.anchorId);

        String typeStr = "WGS84";
        if (anchor.type == com.viro.core.ARScene.GeospatialAnchorType.TERRAIN) {
            typeStr = "Terrain";
        } else if (anchor.type == com.viro.core.ARScene.GeospatialAnchorType.ROOFTOP) {
            typeStr = "Rooftop";
        }
        anchorData.putString("type", typeStr);

        anchorData.putDouble("latitude", anchor.latitude);
        anchorData.putDouble("longitude", anchor.longitude);
        anchorData.putDouble("altitude", anchor.altitude);
        anchorData.putDouble("heading", anchor.heading);

        WritableArray position = Arguments.createArray();
        position.pushDouble(anchor.position[0]);
        position.pushDouble(anchor.position[1]);
        position.pushDouble(anchor.position[2]);
        anchorData.putArray("position", position);

        return anchorData;
    }

    @ReactMethod
    public void requestRequiredPermissions(final ReadableArray permissions, final Promise promise) {
        final String[] required = toManifestPermissions(permissions);

        boolean allGranted = true;
        for (String perm : required) {
            if (ContextCompat.checkSelfPermission(mContext, perm) != 0) {
                allGranted = false;
                break;
            }
        }
        if (allGranted) {
            promise.resolve(buildPermissionsResult(permissions));
            return;
        }

        Activity activity = mContext.getCurrentActivity();
        if (activity == null) {
            promise.reject("E_NO_ACTIVITY", "No current activity available");
            return;
        }
        if (!(activity instanceof ReactActivity)) {
            promise.reject("E_NO_REACT_ACTIVITY", "Missing ReactActivity for requesting permissions");
            return;
        }

        ((ReactActivity) activity).requestPermissions(required, PERMISSION_REQ_CODE_CAMERA, new PermissionListener() {
            @Override
            public boolean onRequestPermissionsResult(int requestCode, String[] perms, int[] grantResults) {
                if (requestCode != PERMISSION_REQ_CODE_CAMERA) return false;
                promise.resolve(buildPermissionsResult(permissions));
                return true;
            }
        });
    }

    @ReactMethod
    public void checkPermissions(ReadableArray permissions, final Promise promise) {
        promise.resolve(buildPermissionsResult(permissions));
    }

    private String[] toManifestPermissions(ReadableArray permissions) {
        java.util.List<String> list = new java.util.ArrayList<>();
        for (int i = 0; i < permissions.size(); i++) {
            switch (permissions.getString(i)) {
                case "camera":     list.add(Manifest.permission.CAMERA); break;
                case "microphone": list.add(Manifest.permission.RECORD_AUDIO); break;
                case "storage":    list.add(Manifest.permission.WRITE_EXTERNAL_STORAGE); break;
                case "location":   list.add(Manifest.permission.ACCESS_FINE_LOCATION); break;
            }
        }
        return list.toArray(new String[0]);
    }

    private WritableMap buildPermissionsResult(ReadableArray permissions) {
        WritableMap result = Arguments.createMap();
        for (int i = 0; i < permissions.size(); i++) {
            switch (permissions.getString(i)) {
                case "camera":
                    result.putBoolean("camera", ContextCompat.checkSelfPermission(mContext, Manifest.permission.CAMERA) == 0);
                    break;
                case "microphone":
                    result.putBoolean("microphone", ContextCompat.checkSelfPermission(mContext, Manifest.permission.RECORD_AUDIO) == 0);
                    break;
                case "storage":
                    result.putBoolean("storage", ContextCompat.checkSelfPermission(mContext, Manifest.permission.WRITE_EXTERNAL_STORAGE) == 0);
                    break;
                case "location":
                    result.putBoolean("location", ContextCompat.checkSelfPermission(mContext, Manifest.permission.ACCESS_FINE_LOCATION) == 0);
                    break;
            }
        }
        return result;
    }

    private void checkPermissionsAndRun(PermissionListener listener, boolean audioAndRecordingPerm){
        Activity activity = mContext.getCurrentActivity();

        // return if we already have permissions
        if (audioAndRecordingPerm && hasAudioAndRecordingPermissions(mContext)) {
            listener.onRequestPermissionsResult(0, null, null);
            return;
        } else if (!audioAndRecordingPerm && hasRecordingPermissions(mContext)) {
            listener.onRequestPermissionsResult(0, null, null);
            return;
        }

        if (!(activity instanceof ReactActivity)){
            Log.e("Viro","Error: Missing ReactActivity required for checking recording permissions!");

            // Trigger a permission failure callback.
            listener.onRequestPermissionsResult(0, null, null);
            return;
        }

        ReactActivity reactActivity = (ReactActivity) activity;
        if (audioAndRecordingPerm){
            reactActivity.requestPermissions(new String[]{Manifest.permission.WRITE_EXTERNAL_STORAGE,
                    Manifest.permission.RECORD_AUDIO}, PERMISSION_REQ_CODE_AUDIO, listener);
        } else {
            reactActivity.requestPermissions(new String[]{Manifest.permission.WRITE_EXTERNAL_STORAGE},
                    PERMISSION_REQ_CODE_STORAGE, listener);
        }
    }

    private static boolean hasAudioAndRecordingPermissions(Context context) {
        boolean hasRecordPermissions = ContextCompat.checkSelfPermission(context, "android.permission.RECORD_AUDIO") == 0;
        boolean hasExternalStoragePerm = ContextCompat.checkSelfPermission(context, "android.permission.WRITE_EXTERNAL_STORAGE") == 0;
        return hasRecordPermissions && hasExternalStoragePerm;
    }

    private static boolean hasRecordingPermissions(Context context) {
        return ContextCompat.checkSelfPermission(context, "android.permission.WRITE_EXTERNAL_STORAGE") == 0;
    }

    // ========================================================================
    // Monocular Depth Estimation Methods (iOS Only)
    // ========================================================================

    /**
     * Check if monocular depth estimation is supported.
     * Note: Monocular depth estimation is iOS-only (requires Apple CoreML).
     * On Android, use ARCore Depth API instead.
     */
    @ReactMethod
    public void isMonocularDepthSupported(final int sceneNavTag, final Promise promise) {
        WritableMap result = Arguments.createMap();
        result.putBoolean("supported", false);
        result.putString("error", "Monocular depth estimation is iOS-only (requires Apple CoreML). " +
                "Use ARCore Depth API for depth sensing on Android.");
        promise.resolve(result);
    }

    /**
     * Check if monocular depth model is available.
     * Note: Monocular depth estimation is iOS-only.
     */
    @ReactMethod
    public void isMonocularDepthModelAvailable(final int sceneNavTag, final Promise promise) {
        WritableMap result = Arguments.createMap();
        result.putBoolean("available", false);
        result.putString("error", "Monocular depth estimation is iOS-only (requires DepthPro CoreML model). " +
                "Use ARCore Depth API for depth sensing on Android.");
        promise.resolve(result);
    }

    /**
     * Enable/disable monocular depth estimation.
     * Note: No-op on Android (iOS-only feature).
     */
    @ReactMethod
    public void setMonocularDepthEnabled(final int sceneNavTag, final boolean enabled) {
        // No-op on Android
        Log.w("ARSceneNavigatorModule", "setMonocularDepthEnabled is iOS-only. Use ARCore Depth API on Android.");
    }

    /**
     * Set whether to prefer monocular depth over LiDAR.
     * Note: No-op on Android (iOS-only feature).
     */
    @ReactMethod
    public void setPreferMonocularDepth(final int sceneNavTag, final boolean prefer) {
        // No-op on Android
        Log.w("ARSceneNavigatorModule", "setPreferMonocularDepth is iOS-only.");
    }

    /**
     * Check if monocular depth is preferred over LiDAR.
     * Note: Monocular depth estimation is iOS-only.
     */
    @ReactMethod
    public void isPreferMonocularDepth(final int sceneNavTag, final Promise promise) {
        WritableMap result = Arguments.createMap();
        result.putBoolean("preferred", false);
        result.putString("error", "Monocular depth estimation is iOS-only.");
        promise.resolve(result);
    }

    // ========================================================================
    // Cleanup Methods
    // ========================================================================

    /**
     * Explicitly cleanup AR resources when React component unmounts.
     * This ensures proper disposal of AR session and GL resources even if
     * onDetachedFromWindow is not called or delayed.
     */
    @ReactMethod
    public void cleanup(final int sceneNavTag) {
        UIManager uiManager = UIManagerHelper.getUIManager(getReactApplicationContext(), sceneNavTag);
        if (uiManager == null) {
            return;
        }

        ((FabricUIManager) uiManager).addUIBlock(new com.facebook.react.fabric.interop.UIBlock() {
            @Override
            public void execute(com.facebook.react.fabric.interop.UIBlockViewResolver viewResolver) {
                try {
                    View view = viewResolver.resolveView(sceneNavTag);
                    if (view instanceof VRTARSceneNavigator) {
                        VRTARSceneNavigator sceneNavigator = (VRTARSceneNavigator) view;
                        // Trigger explicit cleanup to prevent memory leaks
                        // This ensures ARSession is paused and resources are released
                        sceneNavigator.dispose();
                    }
                } catch (Exception e) {
                    Log.w("ARSceneNavigatorModule", "Error during cleanup: " + e.getMessage());
                }
            }
        });
    }
}
