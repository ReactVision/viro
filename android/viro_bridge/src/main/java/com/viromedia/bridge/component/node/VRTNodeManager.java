//  Copyright © 2016 Viro Media. All rights reserved.
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

package com.viromedia.bridge.component.node;

import android.provider.MediaStore;

import com.facebook.react.bridge.Dynamic;
import com.facebook.react.bridge.JavaOnlyMap;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReadableArray;
import com.facebook.react.bridge.ReadableMap;
import com.facebook.react.bridge.ReadableType;
import com.facebook.react.uimanager.LayoutShadowNode;
import com.facebook.react.uimanager.ViewProps;
import com.facebook.react.common.MapBuilder;
import com.facebook.react.uimanager.annotations.ReactProp;
import com.facebook.react.uimanager.annotations.ReactPropGroup;
import com.facebook.react.uimanager.ReactStylesDiffMap;
import com.facebook.yoga.YogaConstants;
import com.viro.core.Material;
import com.viro.core.VideoTexture;
import com.viromedia.bridge.component.VRTComponent;
import com.viromedia.bridge.component.VRTViroViewGroupManager;
import com.viromedia.bridge.module.MaterialManager;
import com.viromedia.bridge.module.MaterialManager.MaterialWrapper;
import com.viromedia.bridge.utility.DynamicUtil;
import com.viromedia.bridge.utility.Helper;
import com.viromedia.bridge.utility.ViroEvents;
import com.viromedia.bridge.utility.ViroLog;

import java.util.ArrayList;
import java.util.Map;

import javax.annotation.Nullable;

/**
 * Abstract NodeManager for setting {@link VRTNode} Control properties.
 * NOTE: Always extend from this class for all Node Viro controls.
 */
public abstract class VRTNodeManager<T extends VRTNode> extends VRTViroViewGroupManager<T> {

    private static String TAG = VRTNodeManager.class.getSimpleName();

    public static final float s2DUnitPer3DUnit = 1000;
    private static final String WIDTH_NAME = "width";
    private static final String HEIGHT_NAME = "height";
    private static final String PADDING_NAME = "padding";
    private static final float[] DEFAULT_ZERO_VEC = new float[]{0,0,0};

    public VRTNodeManager(ReactApplicationContext context) {
        super(context);
    }

    @Override
    public void updateProperties(T viewToUpdate, ReactStylesDiffMap props) {
        super.updateProperties(viewToUpdate, props);
        // Force immediate commit of props for React Native 0.79+ compatibility
        if (viewToUpdate != null && !viewToUpdate.isTornDown()) {
            viewToUpdate.post(() -> {
                viewToUpdate.requestLayout();
                viewToUpdate.invalidate();
            });
        }
    }

    /**
     * Safely apply a prop update with Fabric-aware error handling.
     * This method provides automatic retry on transient failures (e.g., GL context not ready)
     * and consistent error logging across all props.
     *
     * @param view The view to update
     * @param propName The name of the property (for logging)
     * @param setter The lambda that applies the property
     */
    protected void safelyApplyProp(T view, String propName, PropSetter<T> setter) {
        if (view == null || view.isTornDown()) {
            return;
        }

        try {
            setter.apply(view);
        } catch (IllegalStateException e) {
            // View state not ready (e.g., GL context initializing) - retry on next frame
            ViroLog.warn(TAG, "Deferring " + propName + " update - view not ready: " + e.getMessage());
            view.post(() -> {
                if (!view.isTornDown()) {
                    try {
                        setter.apply(view);
                    } catch (Exception retryError) {
                        ViroLog.error(TAG, "Failed to apply " + propName + " after retry: " + retryError.getMessage());
                    }
                }
            });
        } catch (Exception e) {
            ViroLog.error(TAG, "Error applying " + propName + ": " + e.getMessage());
        }
    }

    /**
     * Functional interface for applying a prop to a view.
     * Allows passing prop application logic as a lambda to safelyApplyProp().
     */
    @FunctionalInterface
    protected interface PropSetter<T> {
        void apply(T view) throws Exception;
    }

    @ReactProp(name = "position")
    public void setPosition(T view, ReadableArray position) {
        safelyApplyProp(view, "position", v ->
            v.setPosition(Helper.toFloatArray(position, DEFAULT_ZERO_VEC))
        );
    }

    @ReactProp(name = "rotation")
    public void setRotation(T view, ReadableArray rotation) {
        safelyApplyProp(view, "rotation", v ->
            v.setRotation(Helper.toFloatArray(rotation, DEFAULT_ZERO_VEC))
        );
    }

    @ReactProp(name = "scale")
    public void setScale(T view, ReadableArray scale) {
        safelyApplyProp(view, "scale", v ->
            v.setScale(Helper.toFloatArray(scale, new float[]{1,1,1}))
        );
    }

    @ReactProp(name = "rotationPivot")
    public void setRotationPivot(T view, ReadableArray scale) {
        safelyApplyProp(view, "rotationPivot", v ->
            v.setRotationPivot(Helper.toFloatArray(scale, DEFAULT_ZERO_VEC))
        );
    }

    @ReactProp(name = "scalePivot")
    public void setScalePivot(T view, ReadableArray scale) {
        safelyApplyProp(view, "scalePivot", v ->
            v.setScalePivot(Helper.toFloatArray(scale, DEFAULT_ZERO_VEC))
        );
    }

    @ReactProp(name = "opacity", defaultFloat = 1f)
    public void setOpacity(T view, float opacity) {
        safelyApplyProp(view, "opacity", v -> v.setOpacity(opacity));
    }

    @ReactProp(name = "visible", defaultBoolean = true)
    public void setVisible(T view, boolean visibility) {
        safelyApplyProp(view, "visible", v -> v.setVisible(visibility));
    }

    @ReactProp(name = "renderingOrder", defaultInt = 0)
    public void setRenderingOrder(T view, int renderingOrder) {
        safelyApplyProp(view, "renderingOrder", v -> v.setRenderingOrder(renderingOrder));
    }

    @ReactProp(name = "canHover", defaultBoolean = VRTNode.DEFAULT_CAN_HOVER)
    public void setCanHover(T view, boolean canHover) {
        safelyApplyProp(view, "canHover", v -> v.setCanHover(canHover));
    }

    @ReactProp(name = "canClick", defaultBoolean = VRTNode.DEFAULT_CAN_CLICK)
    public void setCanClick(T view, boolean canClick) {
        safelyApplyProp(view, "canClick", v -> v.setCanClick(canClick));
    }

    @ReactProp(name = "canTouch", defaultBoolean = VRTNode.DEFAULT_CAN_TOUCH)
    public void setCanTouch(T view, boolean canTouch) {
        safelyApplyProp(view, "canTouch", v -> v.setCanTouch(canTouch));
    }

    @ReactProp(name = "canScroll", defaultBoolean = VRTNode.DEFAULT_CAN_SCROLL)
    public void setCanScroll(T view, boolean canScroll) {
        safelyApplyProp(view, "canScroll", v -> v.setCanScroll(canScroll));
    }

    @ReactProp(name = "canSwipe", defaultBoolean = VRTNode.DEFAULT_CAN_SWIPE)
    public void setCanSwipe(T view, boolean canSwipe) {
        safelyApplyProp(view, "canSwipe", v -> v.setCanSwipe(canSwipe));
    }

    @ReactProp(name = "canDrag", defaultBoolean = VRTNode.DEFAULT_CAN_DRAG)
    public void setCanDrag(T view, boolean canDrag) {
        safelyApplyProp(view, "canDrag", v -> v.setCanDrag(canDrag));
    }

    @ReactProp(name = "canFuse", defaultBoolean = VRTNode.DEFAULT_CAN_FUSE)
    public void setCanFuse(T view, boolean canFuse) {
        safelyApplyProp(view, "canFuse", v -> v.setCanFuse(canFuse));
    }

    @ReactProp(name = "canPinch", defaultBoolean = VRTNode.DEFAULT_CAN_PINCH)
    public void setCanPinch(T view, boolean canPinch) {
        safelyApplyProp(view, "canPinch", v -> v.setCanPinch(canPinch));
    }

    @ReactProp(name = "canRotate", defaultBoolean = VRTNode.DEFAULT_CAN_ROTATE)
    public void setCanRotate(T view, boolean canRotate) {
        safelyApplyProp(view, "canRotate", v -> v.setCanRotate(canRotate));
    }

    @ReactProp(name = "timeToFuse", defaultFloat = VRTNode.DEFAULT_TIME_TO_FUSE_MILLIS)
    public void setTimeToFuse(T view, float durationMillis) {
        safelyApplyProp(view, "timeToFuse", v -> v.setTimeToFuse(durationMillis));
    }

    @ReactProp(name = "dragType")
    public void setDragType(T view, String dragType) {
        safelyApplyProp(view, "dragType", v -> v.setDragType(dragType));
    }

    @ReactProp(name = "dragPlane")
    public void setDragPlane(T view, ReadableMap dragPlane) {
        safelyApplyProp(view, "dragPlane", v -> v.setDragPlane(dragPlane));
    }

    @ReactProp(name = "animation")
    public void setAnimation(T view, @androidx.annotation.Nullable ReadableMap map) {
        safelyApplyProp(view, "animation", v -> v.setAnimation(map));
    }

    @ReactProp(name = "ignoreEventHandling", defaultBoolean = VRTNode.DEFAULT_IGNORE_EVENT_HANDLING)
    public void setIgnoreEventHandling(T view, boolean ignore) {
        safelyApplyProp(view, "ignoreEventHandling", v -> v.setIgnoreEventHandling(ignore));
    }

    @ReactProp(name = "materials")
    public void setMaterials(T view, @Nullable ReadableArray materials) {
        safelyApplyProp(view, "materials", v -> {
            // get material manager
            MaterialManager materialManager = getContext().getNativeModule(MaterialManager.class);

            ArrayList<Material> nativeMaterials = new ArrayList<>();
            if (materials != null) {
                for (int i = 0; i < materials.size(); i++) {
                    Material nativeMaterial = materialManager.getMaterial(materials.getString(i));
                    if (materialManager.isVideoMaterial(materials.getString(i))) {
                        if (!(nativeMaterial.getDiffuseTexture() instanceof VideoTexture)) {
                            // Recreate the material with the proper context.
                            if (v.getViroContext() != null) {
                                MaterialWrapper materialWrapper = materialManager.getMaterialWrapper(materials.getString(i));
                                VideoTexture videoTexture = new VideoTexture(v.getViroContext(), materialWrapper.getVideoTextureURI());
                                materialWrapper.recreate(videoTexture);
                                nativeMaterial = materialWrapper.getNativeMaterial();
                            }
                        }
                    }

                    if (nativeMaterial == null) {
                        throw new IllegalArgumentException("Material [" + materials.getString(i) + "] not found. Did you create it?");
                    }

                    nativeMaterials.add(nativeMaterial);
                }
            }
            v.setMaterials(nativeMaterials);
        });
    }

    @ReactProp(name = "transformBehaviors")
    public void setTransformBehaviors(T view, @Nullable ReadableArray transformBehaviors) {
        safelyApplyProp(view, "transformBehaviors", v -> {
            String[] behaviors = new String[0];
            if (transformBehaviors != null) {
                behaviors = new String[transformBehaviors.size()];
                for (int i = 0; i < transformBehaviors.size(); i++) {
                    behaviors[i] = transformBehaviors.getString(i);
                }
            }
            v.setTransformBehaviors(behaviors);
        });
    }

    @Override
    public LayoutShadowNode createShadowNodeInstance() {
        return new FlexEnabledShadowNode();
    }

    @Override
    public Class<? extends LayoutShadowNode> getShadowNodeClass() {
        return FlexEnabledShadowNode.class;
    }

    /**
     * This shadow node is so that views associated with FlexViews (and FlexViews themselves) have
     * their properties properly converted from 3D to 2D units. It's easiest if we just make all Nodes
     * have FlexEnabledShadowNodes, and the components can choose whether or not
     */
    protected class FlexEnabledShadowNode extends ViroLayoutShadowNode {
        private final String TAG = ViroLog.getTag(VRTNodeManager.class);

        @ReactProp(name = "width", defaultFloat = 1)
        public void setWidth(Dynamic width) {
            if (width.getType() == ReadableType.String) {
                super.setWidth(width);
            } else if (width.getType() == ReadableType.Number){
                JavaOnlyMap map = JavaOnlyMap.of(WIDTH_NAME, width.asDouble() * s2DUnitPer3DUnit);
                Dynamic newWidth = DynamicUtil.create(map, WIDTH_NAME);
                super.setWidth(newWidth);
            } else {
                ViroLog.warn(TAG, "Width is not of type Number or String. Doing nothing.");
            }
        }

        @ReactProp(name = "height", defaultFloat = 1)
        public void setHeight(Dynamic height) {
            if (height.getType() == ReadableType.String) {
                super.setHeight(height);
            } else if (height.getType() == ReadableType.Number) {
                JavaOnlyMap map = JavaOnlyMap.of(HEIGHT_NAME, height.asDouble() * s2DUnitPer3DUnit);
                Dynamic newHeight = DynamicUtil.create(map, HEIGHT_NAME);
                super.setHeight(newHeight);
            } else {
                ViroLog.warn(TAG, "Height is not of type Number or String. Doing nothing.");
            }
        }

        @ReactPropGroup(names = {
                ViewProps.PADDING,
                ViewProps.PADDING_VERTICAL,
                ViewProps.PADDING_HORIZONTAL,
                ViewProps.PADDING_LEFT,
                ViewProps.PADDING_RIGHT,
                ViewProps.PADDING_TOP,
                ViewProps.PADDING_BOTTOM,
        }, defaultFloat = YogaConstants.UNDEFINED)
        public void setPaddings(int index, Dynamic padding) {
            if (padding.getType() == ReadableType.String) {
                super.setPaddings(index, padding);
            } else if (padding.getType() == ReadableType.Number) {
                JavaOnlyMap map = JavaOnlyMap.of(PADDING_NAME, padding.asDouble() * s2DUnitPer3DUnit);
                Dynamic newPadding = DynamicUtil.create(map, PADDING_NAME);
                super.setPaddings(index, newPadding);
            } else {
                ViroLog.warn(TAG, "Padding is not of type Number of String. Doing nothing.");
            }
        }

        @ReactPropGroup(names = {
                ViewProps.BORDER_WIDTH,
                ViewProps.BORDER_LEFT_WIDTH,
                ViewProps.BORDER_RIGHT_WIDTH,
                ViewProps.BORDER_TOP_WIDTH,
                ViewProps.BORDER_BOTTOM_WIDTH,
        }, defaultFloat = YogaConstants.UNDEFINED)
        public void setBorderWidths(int index, float borderWidth) {
            super.setBorderWidths(index, borderWidth * s2DUnitPer3DUnit);
        }
    }

    /*
     The only evnets that should be defined in here are input/touch events that bubble up, that way
     we don't have to "nativePropOnly" a ton of events...
     */
    @Override
    public Map getExportedCustomDirectEventTypeConstants() {
        Map events = super.getExportedCustomDirectEventTypeConstants();

        events.put(ViroEvents.ON_HOVER, MapBuilder.of("registrationName", ViroEvents.ON_HOVER));
        events.put(ViroEvents.ON_CLICK, MapBuilder.of("registrationName", ViroEvents.ON_CLICK));
        events.put(ViroEvents.ON_TOUCH, MapBuilder.of("registrationName", ViroEvents.ON_TOUCH));
        events.put(ViroEvents.ON_SWIPE, MapBuilder.of("registrationName", ViroEvents.ON_SWIPE));
        events.put(ViroEvents.ON_SCROLL, MapBuilder.of("registrationName", ViroEvents.ON_SCROLL));
        events.put(ViroEvents.ON_FUSE, MapBuilder.of("registrationName", ViroEvents.ON_FUSE));
        events.put(ViroEvents.ON_PINCH, MapBuilder.of("registrationName", ViroEvents.ON_PINCH));
        events.put(ViroEvents.ON_ROTATE, MapBuilder.of("registrationName", ViroEvents.ON_ROTATE));
        events.put(ViroEvents.ON_DRAG, MapBuilder.of("registrationName", ViroEvents.ON_DRAG));
        events.put(ViroEvents.ON_COLLIDED, MapBuilder.of("registrationName", ViroEvents.ON_COLLIDED));
        events.put(ViroEvents.ON_TRANSFORM_DELEGATE, MapBuilder.of("registrationName", ViroEvents.ON_TRANSFORM_DELEGATE));
        events.put(ViroEvents.ON_ANIMATION_START, MapBuilder.of("registrationName", ViroEvents.ON_ANIMATION_START));
        events.put(ViroEvents.ON_ANIMATION_FINISH, MapBuilder.of("registrationName", ViroEvents.ON_ANIMATION_FINISH));

        return events;
    }

    @ReactProp(name = "physicsBody")
    public void setPhysicsBody(T view, ReadableMap map) {
        safelyApplyProp(view, "physicsBody", v -> v.setPhysicsBody(map));
    }

    @ReactProp(name = "canCollide", defaultBoolean = VRTNode.DEFAULT_CAN_FUSE)
    public void setCanCollide(T view, boolean canCollide) {
        safelyApplyProp(view, "canCollide", v -> v.setCanCollide(canCollide));
    }

    @ReactProp(name = "viroTag")
    public void setViroTag(T view, String tag) {
        safelyApplyProp(view, "viroTag", v -> v.setViroTag(tag));
    }

    @ReactProp(name = "hasTransformDelegate", defaultBoolean = false)
    public void setHasTransformDelegate(T view, boolean hasDelegate) {
        safelyApplyProp(view, "hasTransformDelegate", v -> v.setOnNativeTransformDelegate(hasDelegate));
    }

}
