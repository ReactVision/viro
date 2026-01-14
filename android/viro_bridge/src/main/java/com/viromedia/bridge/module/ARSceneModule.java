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

import android.graphics.Point;
import android.view.View;

import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.ReadableArray;
import com.facebook.react.bridge.WritableArray;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.uimanager.IllegalViewOperationException;
import com.facebook.react.uimanager.UIManagerHelper;
import com.facebook.react.bridge.UIManager;
import com.facebook.react.fabric.FabricUIManager;
import com.facebook.react.module.annotations.ReactModule;
import com.viro.core.ARHitTestListener;
import com.viro.core.ARHitTestResult;
import com.viro.core.ARNode;
import com.viro.core.Matrix;
import com.viro.core.Renderer;
import com.viro.core.Vector;
import com.viro.core.ViroViewARCore;
import com.viromedia.bridge.component.VRTARSceneNavigator;
import com.viromedia.bridge.component.node.VRTARNode;
import com.viromedia.bridge.utility.ARUtils;

import java.util.HashMap;
import java.util.Iterator;
import java.util.Map;
import java.util.UUID;


@ReactModule(name = "VRTARSceneModule")
public class ARSceneModule extends ReactContextBaseJavaModule {

    // Storage for hit test results to enable anchor creation
    private final Map<String, ARHitTestResult> mStoredHitResults = new HashMap<>();
    private final Map<String, Long> mHitResultTimestamps = new HashMap<>();
    private static final long HIT_RESULT_TIMEOUT_MS = 30000; // 30 seconds

    public ARSceneModule(ReactApplicationContext context) {
        super(context);
    }
    // https://stackoverflow.com/a/44879687
    @Override
    public boolean canOverrideExistingModule() {
        return true;
    }
    @Override
    public String getName() {
        return "VRTARSceneModule";
    }

    /**
     * Cleanup old hit results periodically to prevent memory leaks.
     * Removes any hit results older than HIT_RESULT_TIMEOUT_MS.
     */
    private void cleanupExpiredHitResults() {
        long now = System.currentTimeMillis();
        Iterator<Map.Entry<String, Long>> it = mHitResultTimestamps.entrySet().iterator();
        while (it.hasNext()) {
            Map.Entry<String, Long> entry = it.next();
            if (now - entry.getValue() > HIT_RESULT_TIMEOUT_MS) {
                String id = entry.getKey();
                ARHitTestResult result = mStoredHitResults.remove(id);
                if (result != null) {
                    result.dispose();
                }
                it.remove();
            }
        }
    }

    /**
     * Store hit results with unique IDs and add the ID to each result map.
     * This allows the results to be referenced later for anchor creation.
     */
    private WritableArray storeHitResults(ARHitTestResult[] results) {
        cleanupExpiredHitResults();

        WritableArray resultArray = Arguments.createArray();
        long now = System.currentTimeMillis();

        for (ARHitTestResult result : results) {
            String hitResultId = UUID.randomUUID().toString();
            mStoredHitResults.put(hitResultId, result);
            mHitResultTimestamps.put(hitResultId, now);

            WritableMap resultMap = ARUtils.mapFromARHitTestResult(result);
            resultMap.putString("_hitResultId", hitResultId);
            resultArray.pushMap(resultMap);
        }

        return resultArray;
    }

    @ReactMethod
    public void performARHitTestWithRay(final int viewTag, final ReadableArray ray,
                                        final Promise promise) {
        UIManager uiManager = UIManagerHelper.getUIManager(getReactApplicationContext(), viewTag);
        if (uiManager == null) {
            promise.reject("ERROR", "UIManager not available");
            return;
        }

        ((FabricUIManager) uiManager).addUIBlock(new com.facebook.react.fabric.interop.UIBlock() {
            @Override
            public void execute(com.facebook.react.fabric.interop.UIBlockViewResolver viewResolver) {
                View sceneView = viewResolver.resolveView(viewTag);
                if (sceneView == null || sceneView.getParent() == null || !(sceneView.getParent() instanceof VRTARSceneNavigator)) {
                    promise.reject("ERROR", "Invalid view returned when calling performARHitTestWithRay: expected ViroARSceneNavigator as parent");
                    return;
                }

                VRTARSceneNavigator arSceneNavigator = (VRTARSceneNavigator) sceneView.getParent();
                ViroViewARCore arView = arSceneNavigator.getARView();

                if (ray.size() != 3) {
                    promise.resolve(Arguments.createArray());
                    return;
                }

                float[] rayArray = new float[ray.size()];
                rayArray[0] = (float) ray.getDouble(0);
                rayArray[1] = (float) ray.getDouble(1);
                rayArray[2] = (float) ray.getDouble(2);

                arView.performARHitTestWithRay(new Vector(rayArray), new ARHitTestListener() {
                    @Override
                    public void onHitTestFinished(ARHitTestResult[] arHitTestResults) {
                        WritableArray returnArray = storeHitResults(arHitTestResults);
                        promise.resolve(returnArray);
                    }
                });
            }
        });
    }

    @ReactMethod
    public void performARHitTestWithWorldPoints(final int viewTag, final ReadableArray origin, final ReadableArray destination,
                                        final Promise promise) {
        UIManager uiManager = UIManagerHelper.getUIManager(getReactApplicationContext(), viewTag);
        if (uiManager == null) {
            promise.reject("ERROR", "UIManager not available");
            return;
        }

        ((FabricUIManager) uiManager).addUIBlock(new com.facebook.react.fabric.interop.UIBlock() {
            @Override
            public void execute(com.facebook.react.fabric.interop.UIBlockViewResolver viewResolver) {
                View sceneView = viewResolver.resolveView(viewTag);
                if (sceneView == null || sceneView.getParent() == null || !(sceneView.getParent() instanceof VRTARSceneNavigator)) {
                    promise.reject("ERROR", "Invalid view returned when calling performARHitTestWithRay: expected ViroARSceneNavigator as parent");
                    return;
                }

                VRTARSceneNavigator arSceneNavigator = (VRTARSceneNavigator) sceneView.getParent();
                ViroViewARCore arView = arSceneNavigator.getARView();

                if ((origin.size() != 3) || (destination.size() != 3)) {
                    promise.resolve(Arguments.createArray());
                    return;
                }

                float[] originArray = new float[origin.size()];
                originArray[0] = (float) origin.getDouble(0);
                originArray[1] = (float) origin.getDouble(1);
                originArray[2] = (float) origin.getDouble(2);

                float[] destArray = new float[destination.size()];
                destArray[0] = (float) destination.getDouble(0);
                destArray[1] = (float) destination.getDouble(1);
                destArray[2] = (float) destination.getDouble(2);

                arView.performARHitTestWithRay(new Vector(originArray), new Vector(destArray), new ARHitTestListener() {
                    @Override
                    public void onHitTestFinished(ARHitTestResult[] arHitTestResults) {
                        WritableArray returnArray = storeHitResults(arHitTestResults);
                        promise.resolve(returnArray);
                    }
                });
            }
        });
    }

    @ReactMethod
    public void performARHitTestWithPosition(final int viewTag, final ReadableArray position,
                                        final Promise promise) {
        UIManager uiManager = UIManagerHelper.getUIManager(getReactApplicationContext(), viewTag);
        if (uiManager == null) {
            promise.reject("ERROR", "UIManager not available");
            return;
        }

        ((FabricUIManager) uiManager).addUIBlock(new com.facebook.react.fabric.interop.UIBlock() {
            @Override
            public void execute(com.facebook.react.fabric.interop.UIBlockViewResolver viewResolver) {
                View sceneView = viewResolver.resolveView(viewTag);
                if (sceneView == null || sceneView.getParent() == null || !(sceneView.getParent() instanceof VRTARSceneNavigator)) {
                    promise.reject("ERROR", "Invalid view returned when calling performARHitTestWithPosition: expected ViroARSceneNavigator as parent");
                    return;
                }

                VRTARSceneNavigator arSceneNavigator = (VRTARSceneNavigator) sceneView.getParent();
                ViroViewARCore arView = arSceneNavigator.getARView();

                if (position.size() != 3) {
                    promise.resolve(Arguments.createArray());
                    return;
                }

                float[] positionArray = new float[position.size()];
                positionArray[0] = (float) position.getDouble(0);
                positionArray[1] = (float) position.getDouble(1);
                positionArray[2] = (float) position.getDouble(2);

                arView.performARHitTestWithPosition(new Vector(positionArray), new ARHitTestListener() {
                    @Override
                    public void onHitTestFinished(ARHitTestResult[] arHitTestResults) {
                        WritableArray returnArray = storeHitResults(arHitTestResults);
                        promise.resolve(returnArray);
                    }
                });
            }
        });
    }

    @ReactMethod
    public void performARHitTestWithPoint(final int viewTag, final int x, final int y,
                                             final Promise promise) {
        UIManager uiManager = UIManagerHelper.getUIManager(getReactApplicationContext(), viewTag);
        if (uiManager == null) {
            promise.reject("ERROR", "UIManager not available");
            return;
        }

        ((FabricUIManager) uiManager).addUIBlock(new com.facebook.react.fabric.interop.UIBlock() {
            @Override
            public void execute(com.facebook.react.fabric.interop.UIBlockViewResolver viewResolver) {
                View sceneView = viewResolver.resolveView(viewTag);
                if (sceneView == null || sceneView.getParent() == null || !(sceneView.getParent() instanceof VRTARSceneNavigator)) {
                    promise.reject("ERROR", "Invalid view returned when calling performARHitTestWithPoint: expected ViroARSceneNavigator as parent");
                    return;
                }

                VRTARSceneNavigator arSceneNavigator = (VRTARSceneNavigator) sceneView.getParent();
                ViroViewARCore arView = arSceneNavigator.getARView();

                arView.performARHitTest(new Point(x, y), new ARHitTestListener() {
                    @Override
                    public void onHitTestFinished(ARHitTestResult[] arHitTestResults) {
                        WritableArray returnArray = storeHitResults(arHitTestResults);
                        promise.resolve(returnArray);
                    }
                });
            }
        });
    }

    /**
     * Create an anchored AR node from a previously stored hit test result.
     * The hit result ID comes from a prior hit test call and must be used within 30 seconds.
     *
     * @param hitResultId The ID of the stored hit test result
     * @param sceneViewTag The React tag of the AR scene view
     * @param promise Promise that resolves with node reference or rejects with error
     */
    @ReactMethod
    public void createAnchoredNodeFromHitResult(final String hitResultId,
                                                 final int sceneViewTag,
                                                 final Promise promise) {
        // Retrieve stored hit result
        ARHitTestResult hitResult = mStoredHitResults.get(hitResultId);

        if (hitResult == null) {
            promise.reject("HIT_RESULT_NOT_FOUND",
                "Hit result not found or expired. Hit results are only valid for 30 seconds.");
            return;
        }

        UIManager uiManager = UIManagerHelper.getUIManager(getReactApplicationContext(), sceneViewTag);
        if (uiManager == null) {
            promise.reject("ERROR", "UIManager not available");
            return;
        }

        ((FabricUIManager) uiManager).addUIBlock(new com.facebook.react.fabric.interop.UIBlock() {
            @Override
            public void execute(com.facebook.react.fabric.interop.UIBlockViewResolver viewResolver) {
                try {
                    // Create anchored node from hit result
                    ARNode arNode = hitResult.createAnchoredNode();

                    if (arNode == null) {
                        promise.reject("ANCHOR_CREATION_FAILED",
                            "Failed to create anchor. AR tracking may be limited or hit result type does not support anchors.");
                        return;
                    }

                    // Get AR scene navigator to access the scene
                    View sceneView = viewResolver.resolveView(sceneViewTag);
                    if (sceneView == null || sceneView.getParent() == null || !(sceneView.getParent() instanceof VRTARSceneNavigator)) {
                        promise.reject("AR_SCENE_NOT_FOUND", "ARScene view not found or invalid");
                        return;
                    }

                    VRTARSceneNavigator arSceneNavigator = (VRTARSceneNavigator) sceneView.getParent();

                    // Generate unique ID for the node
                    String nodeId = UUID.randomUUID().toString();

                    // Return node reference
                    WritableMap nodeRef = Arguments.createMap();
                    nodeRef.putString("nodeId", nodeId);
                    nodeRef.putInt("reactTag", sceneViewTag);

                    // Include anchor info if available
                    if (arNode.getAnchor() != null) {
                        nodeRef.putString("anchorId", arNode.getAnchor().getAnchorId());
                        nodeRef.putMap("transform", ARUtils.mapFromMatrix(arNode.getWorldTransformRealTime()));
                    }

                    promise.resolve(nodeRef);

                } catch (Exception e) {
                    promise.reject("ANCHOR_CREATION_ERROR", e.getMessage());
                }
            }
        });
    }
}
