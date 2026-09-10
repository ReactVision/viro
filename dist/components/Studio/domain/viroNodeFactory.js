"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.createNodeConfig = createNodeConfig;
exports.createNode = createNode;
const React = __importStar(require("react"));
const react_native_1 = require("react-native");
const Viro3DObject_1 = require("../../Viro3DObject");
const ViroImage_1 = require("../../ViroImage");
const ViroText_1 = require("../../ViroText");
const ViroVideo_1 = require("../../ViroVideo");
const sceneNavigationHandler_1 = require("./sceneNavigationHandler");
const apiRequestHelpers_1 = require("./apiRequestHelpers");
const materialConfig_1 = require("./materialConfig");
const dragConfiguration_1 = require("./dragConfiguration");
const physicsConfig_1 = require("./physicsConfig");
const placementStore_1 = require("./placementStore");
/** Clamps Z to -2 for non-trigger assets to guarantee visibility. */
function createNodeConfig(asset, sceneNavigator, animations, scene, onAnimationTrigger, animationStates, isDragActive, onSceneChange, runtimeCtx, 
// The detected plane this asset is anchored to, once the session has found
// one. Only the assets under the plane wrapper have it.
dragSurface) {
    const hasTriggerImage = !!asset.trigger_image_url;
    // Tap-to-place stores the author position as an OFFSET from the runtime tap
    // point (PlaceableNode adds it), so the camera-relative -2 default and the
    // "too close" clamp — both meant for camera/plane assets — must not apply.
    const isTapToPlace = (0, placementStore_1.isTapToPlaceAsset)(asset);
    // `world_placement` means the coordinates are a point in the world, not a
    // camera-relative offset an author typed. The clamp below exists to stop an
    // author putting an object inside the user's face, and it cannot tell the two
    // apart: applied to a world coordinate it silently rewrites it to -2, which
    // pins the object in front of the view. That reads as "the anchor does not
    // stay fixed", and the only notice is the warning below.
    const isWorldPlacement = !!asset
        .world_placement;
    let posZ = asset.position_z ?? (isTapToPlace ? 0 : -2);
    if (!hasTriggerImage && !isTapToPlace && !isWorldPlacement && posZ > -0.5) {
        console.warn(`[Studio/NodeFactory] Asset "${asset.name}" Z=${posZ} too close, clamping to -2`);
        posZ = -2;
    }
    const position = [
        asset.position_x ?? 0,
        asset.position_y ?? 0,
        posZ,
    ];
    // A trigger image's orientation describes the uploaded FILE, not the surface
    // it is printed on and not a rotation for the content: it says where the top
    // of that file is, so a sideways or upside-down file is still recognised.
    // virocore acts on it by correcting the pixels before the tracker sees them
    // (VROARSessionARCore rotates the grayscale buffer, VROARImageTargetiOS passes
    // a CGImagePropertyOrientation to ARReferenceImage), so the anchor frame comes
    // back the same whatever it is set to. This used to add Left -90, Right 90 and
    // Down 180 to rotation Z, which nothing cancelled: content on any non-Up
    // marker was drawn turned, upside down in the Down case.
    const rotation = [
        asset.rotation_x ?? 0,
        asset.rotation_y ?? 0,
        asset.rotation_z ?? 0,
    ];
    // Zero, negative and non-finite scales are degenerate transforms rather than
    // small ones, so they fall back to 1. Everything else passes through, large
    // values included: scale doubles as compensation for a model's own units, so a
    // mesh authored in centimetres legitimately needs about 100. This replaced a
    // pair of rules that substituted 0.1 below 0.01 and 2 above 10, which rendered
    // an asset authored at 13 more than six times too small with no way to tell.
    // Editors that author these scenes apply the same rule, and hold their own
    // copy of it since this package does not depend on them.
    let scaleValue = asset.scale ?? 1;
    if (!Number.isFinite(scaleValue) || scaleValue <= 0)
        scaleValue = 1;
    const scale = [scaleValue, scaleValue, scaleValue];
    const dragType = dragConfiguration_1.DragConfiguration.getDragType(asset, scene);
    let dragPlane;
    if (dragType === "FixedToPlane") {
        dragPlane = dragConfiguration_1.DragConfiguration.getDragPlane(scene?.plane_direction ?? "Horizontal", position, dragSurface);
    }
    // Both the body and its collision tag hang off the scene's physics switch
    // (isPhysicsWorldEnabled), which is what the Studio UI, its editor preview and
    // the apply_physics tool all treat as the switch.
    const parsedPhysics = (0, physicsConfig_1.isPhysicsWorldEnabled)(scene)
        ? (0, physicsConfig_1.parsePhysicsBodyConfig)(asset.physics_config)
        : null;
    const dragActive = isDragActive?.(asset.id) ?? false;
    const physicsBody = parsedPhysics
        ? (0, physicsConfig_1.buildViroPhysicsBody)(parsedPhysics, {
            kinematicDragOverride: dragActive && (0, physicsConfig_1.shouldUseKinematicPhysicsDrag)(asset, parsedPhysics),
            scale: scaleValue,
        })
        : undefined;
    const viroTag = parsedPhysics ? asset.id : undefined;
    const launchVelocity = parsedPhysics?.velocity
        ? [...parsedPhysics.velocity]
        : undefined;
    const onClick = createOnClickHandler(asset, sceneNavigator, animations, onAnimationTrigger, onSceneChange, runtimeCtx);
    const animation = animationStates?.[asset.id];
    return {
        position,
        rotation,
        scale,
        dragType,
        dragPlane,
        physicsBody,
        launchVelocity,
        viroTag,
        onClick,
        animation,
    };
}
function createOnClickHandler(asset, sceneNavigator, animations, onAnimationTrigger, onSceneChange, runtimeCtx) {
    const fn = asset.scene_function;
    if (!fn)
        return undefined;
    if (fn.function_type === "NAVIGATION" && !fn.scene_navigation?.navigate_to) {
        console.warn(`[Studio] Asset "${asset.name}" has NAVIGATION but no target scene`);
        return undefined;
    }
    if (fn.function_type === "ALERT" && !fn.scene_alert) {
        console.warn(`[Studio] Asset "${asset.name}" has ALERT but no alert data`);
        return undefined;
    }
    if (fn.function_type === "ANIMATION" && !fn.scene_animation) {
        console.warn(`[Studio] Asset "${asset.name}" has ANIMATION but no animation data`);
        return undefined;
    }
    return () => (0, sceneNavigationHandler_1.executeFunctionWithRelations)(fn, sceneNavigator, animations, onAnimationTrigger, 0, onSceneChange, runtimeCtx);
}
function resolveType(asset) {
    return asset.asset_type_name ?? null;
}
function inferModelType(url) {
    const ext = url.toLowerCase().split(".").pop();
    if (ext === "gltf")
        return "GLTF";
    if (ext === "obj")
        return "OBJ";
    if (ext === "vrx")
        return "VRX";
    return "GLB";
}
function create3DObject(asset, config, onAssetLoaded, notifyPhysicsDrag, onCollision, nodeRef) {
    if (!asset.file_url) {
        console.warn(`[Studio] 3D model "${asset.name}" has no file_url`);
        return null;
    }
    const modelType = inferModelType(asset.file_url);
    const hasMaterialConfig = (0, materialConfig_1.parseMaterialConfig)(asset.material_config) !== null;
    const shaderOverrides = hasMaterialConfig
        ? [(0, materialConfig_1.studioMaterialName)(asset.id)]
        : undefined;
    return (<Viro3DObject_1.Viro3DObject key={asset.id} {...(nodeRef ? { ref: nodeRef } : {})} source={{ uri: asset.file_url }} position={config.position} rotation={config.rotation} scale={config.scale} type={modelType} dragType={config.dragType} dragPlane={config.dragPlane} animation={config.animation} onClick={config.onClick} renderingOrder={react_native_1.Platform.OS === "android" ? 1 : 0} onLoadEnd={() => onAssetLoaded?.(asset.id)} onError={(e) => console.error(`[Studio] 3D model "${asset.name}" error:`, e)} 
    // Viro derives native canDrag from `onDrag != undefined`; without this prop
    // the drag recognizer is never attached, even when dragType is set.
    {...(config.dragType
        ? { onDrag: () => notifyPhysicsDrag?.(asset.id) }
        : {})} {...(shaderOverrides ? { shaderOverrides } : {})} {...(config.physicsBody
        ? { physicsBody: config.physicsBody, viroTag: config.viroTag }
        : {})} {...(onCollision ? { onCollision: onCollision } : {})} {...(config.onGaze ? { onGaze: config.onGaze } : {})}/>);
}
function createImage(asset, config, onAssetLoaded, notifyPhysicsDrag, onCollision, nodeRef) {
    if (!asset.file_url) {
        console.warn(`[Studio] Image "${asset.name}" has no file_url`);
        return null;
    }
    return (<ViroImage_1.ViroImage key={asset.id} {...(nodeRef ? { ref: nodeRef } : {})} source={{ uri: asset.file_url }} 
    // No width or height props, so the bridges derive the height from the
    // image's own aspect on load, but only build the quad from it under
    // ScaleToFill; the default StretchToFill keeps the 1x1 quad and squashes
    // the picture. The crop this mode also selects needs explicit size props,
    // so the UVs stay 0 to 1.
    resizeMode="ScaleToFill" position={config.position} rotation={config.rotation} scale={config.scale} dragType={config.dragType} animation={config.animation} onClick={config.onClick} onLoadEnd={() => onAssetLoaded?.(asset.id)} onError={(e) => console.error(`[Studio] Image "${asset.name}" error:`, e)} {...(config.dragType
        ? { onDrag: () => notifyPhysicsDrag?.(asset.id) }
        : {})} {...(config.physicsBody
        ? { physicsBody: config.physicsBody, viroTag: config.viroTag }
        : {})} {...(onCollision ? { onCollision: onCollision } : {})} {...(config.onGaze ? { onGaze: config.onGaze } : {})}/>);
}
/**
 * TEXT node whose content is a {{variable}} template (the asset name). It
 * re-interpolates and repaints whenever a referenced variable changes (and only
 * subscribes when the template actually has placeholders). Resolution is
 * fail-soft: unknown names stay literal.
 */
const VariableText = ({ asset, config, store, notifyPhysicsDrag, onCollision, nodeRef, visible, position, rotation, }) => {
    const template = asset.name ?? "";
    const compute = () => store
        ? (0, apiRequestHelpers_1.interpolateDisplayTemplate)(template, (n) => store.get(n))
        : template;
    const [text, setText] = React.useState(compute);
    React.useEffect(() => {
        if (!store || (0, apiRequestHelpers_1.extractPlaceholders)(template).length === 0)
            return;
        // Resync any write that landed between first render and subscribe.
        setText(compute());
        return store.subscribe(() => setText(compute()));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [store, template]);
    return (<ViroText_1.ViroText {...(nodeRef ? { ref: nodeRef } : {})} text={text} position={position ?? config.position} rotation={rotation ?? config.rotation} scale={config.scale} dragType={config.dragType} animation={config.animation} onClick={config.onClick} {...(visible === undefined ? {} : { visible })} style={{
            fontFamily: "Arial",
            fontSize: 20,
            color: "#FFFFFF",
            textAlign: "center",
            // Centred on the node rather than hung from the top of its box, so the
            // authored position is where the text is at any scale.
            textAlignVertical: "center",
        }} {...(config.dragType
        ? { onDrag: () => notifyPhysicsDrag?.(asset.id) }
        : {})} {...(config.physicsBody
        ? { physicsBody: config.physicsBody, viroTag: config.viroTag }
        : {})} {...(onCollision ? { onCollision: onCollision } : {})} {...(config.onGaze ? { onGaze: config.onGaze } : {})}/>);
};
/**
 * Wraps a created node and drives its `visible` prop from the per-scene
 * visibility store, subscribing to its own asset so a Set Visibility action
 * repaints only this node. Without a store, the node stays visible.
 */
const VisibleNode = ({ assetId, store, children }) => {
    const [visible, setVisible] = React.useState(() => store?.isVisible(assetId) ?? true);
    React.useEffect(() => {
        if (!store)
            return;
        // Resync any write that landed between first render and subscribe.
        setVisible(store.isVisible(assetId));
        return store.subscribe(assetId, () => setVisible(store.isVisible(assetId)));
    }, [store, assetId]);
    return React.cloneElement(children, { visible });
};
/**
 * Gates a tap-to-place node: renders nothing until the end user places the
 * asset, then mounts it at the tap point with the author position AND rotation
 * applied relative to where the user was facing when they tapped (see
 * StudioPlacementStore.resolvePlacedPosition / resolvePlacedRotation), and hands
 * off to VisibleNode so Set Visibility still applies. Rendered at scene root
 * (world space), never inside a plane wrapper.
 */
const PlaceableNode = ({ assetId, store, authorPosition, authorRotation, visibilityStore, children, }) => {
    const [placed, setPlaced] = React.useState(() => store.isPlaced(assetId));
    React.useEffect(() => {
        setPlaced(store.isPlaced(assetId));
        return store.subscribe(assetId, () => setPlaced(store.isPlaced(assetId)));
    }, [store, assetId]);
    if (!placed)
        return null;
    const position = store.resolvePlacedPosition(assetId, authorPosition) ?? authorPosition;
    const rotation = store.resolvePlacedRotation(assetId, authorRotation) ?? authorRotation;
    return (<VisibleNode assetId={assetId} store={visibilityStore}>
      {React.cloneElement(children, { position, rotation })}
    </VisibleNode>);
};
/**
 * Sends an authored velocity once, as a launch.
 *
 * `physicsBody.velocity` is a CONSTANT velocity on the device: both bridges pass
 * `isConstant` true and `VROPhysicsBody::applyPresetVelocity` reasserts it on the
 * rigid body every frame, so gravity never gets a turn and the node runs in a
 * straight line for as long as the scene lives. virocore's other slot,
 * `_instantVelocity`, is applied once and then cleared, which is what an author
 * means by a velocity and what the editors preview. Only
 * `VRTNodeModule.setVelocity` reaches it, so the value is sent through the node's
 * own ref here instead of being declared on the body.
 *
 * The node is built by `render` rather than cloned, so the ref arrives through
 * the `nodeRef` prop each creator already forwards: TEXT renders a function
 * component, which a cloned `ref` would miss. That ref is the node's only one,
 * hence `forwardRef` for the proximity registration that would otherwise own it.
 */
const LaunchNode = ({ velocity, forwardRef, render }) => {
    const nodeRef = React.useRef(null);
    const setRef = React.useCallback((ref) => {
        nodeRef.current = ref;
        forwardRef?.(ref);
    }, [forwardRef]);
    // Keyed on the numbers, since `config` hands back a new array every render.
    const signature = velocity.join(",");
    React.useEffect(() => {
        // Both platforms resolve the view inside a UI block, which runs after this
        // mount's own view operations, so the physics body exists by then.
        nodeRef.current?.setVelocity?.([...velocity]);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [signature]);
    return render(setRef);
};
function createText(asset, config, notifyPhysicsDrag, store, onCollision, nodeRef) {
    return (<VariableText key={asset.id} asset={asset} config={config} store={store} notifyPhysicsDrag={notifyPhysicsDrag} onCollision={onCollision} nodeRef={nodeRef}/>);
}
function createVideo(asset, config, notifyPhysicsDrag, onCollision, nodeRef) {
    if (!asset.file_url) {
        console.warn(`[Studio] Video "${asset.name}" has no file_url`);
        return null;
    }
    return (<ViroVideo_1.ViroVideo key={asset.id} {...(nodeRef ? { ref: nodeRef } : {})} source={{ uri: asset.file_url }} position={config.position} rotation={config.rotation} scale={config.scale} dragType={config.dragType} animation={config.animation} onClick={config.onClick} loop={true} muted={false} onError={(e) => console.error(`[Studio] Video "${asset.name}" error:`, e)} {...(config.dragType
        ? { onDrag: () => notifyPhysicsDrag?.(asset.id) }
        : {})} {...(config.physicsBody
        ? { physicsBody: config.physicsBody, viroTag: config.viroTag }
        : {})} {...(onCollision ? { onCollision: onCollision } : {})} {...(config.onGaze ? { onGaze: config.onGaze } : {})}/>);
}
function createNode(asset, sceneNavigator, animations, scene, onAnimationTrigger, animationStates, onAssetLoaded, onCollision, isDragActive, notifyPhysicsDrag, onSceneChange, runtimeCtx, 
// When set (proximity-target assets), captures the live Viro node so the host
// can read its world transform for the distance check.
registerProximityTarget, 
// When set (gaze-target assets on a headset), the node's native onGaze handler.
onGaze, 
// See createNodeConfig.
dragSurface) {
    const type = resolveType(asset);
    const config = createNodeConfig(asset, sceneNavigator, animations, scene, onAnimationTrigger, animationStates, isDragActive, onSceneChange, runtimeCtx, dragSurface);
    config.onGaze = onGaze;
    const proximityRef = registerProximityTarget
        ? (ref) => registerProximityTarget(asset.id, ref)
        : undefined;
    const buildNode = (nodeRef) => {
        switch (type) {
            case "3D-MODEL":
                // NOTE: notifyPhysicsDrag and onCollision are distinct wirings — keep
                // both; a drag-only merge here once silently killed collisions.
                return create3DObject(asset, config, onAssetLoaded, notifyPhysicsDrag, onCollision, nodeRef);
            case "IMAGE":
                return createImage(asset, config, onAssetLoaded, notifyPhysicsDrag, onCollision, nodeRef);
            case "TEXT":
                return createText(asset, config, notifyPhysicsDrag, runtimeCtx?.variableStore, onCollision, nodeRef);
            case "VIDEO":
                return createVideo(asset, config, notifyPhysicsDrag, onCollision, nodeRef);
            default:
                console.warn(`[Studio] Unknown asset type "${type}" for "${asset.name}"`);
                return null;
        }
    };
    const node = config.launchVelocity ? (<LaunchNode velocity={config.launchVelocity} forwardRef={proximityRef} render={buildNode}/>) : (buildNode(proximityRef));
    if (!node)
        return null;
    // Tap-to-place assets are withheld until placed; PlaceableNode then mounts the
    // node at the tap point with the author position and rotation applied relative
    // to the user's facing, and wraps it in VisibleNode itself. A marker asset is
    // never gated this way, whatever the flag says (isTapToPlaceAsset).
    if ((0, placementStore_1.isTapToPlaceAsset)(asset) && runtimeCtx?.placementStore) {
        return (<PlaceableNode key={asset.id} assetId={asset.id} store={runtimeCtx.placementStore} authorPosition={config.position} authorRotation={config.rotation} visibilityStore={runtimeCtx?.visibilityStore}>
        {node}
      </PlaceableNode>);
    }
    // Drive show/hide/toggle from the visibility store (Set Visibility actions);
    // seeded from the asset's author-time hidden_on_load default.
    return (<VisibleNode key={asset.id} assetId={asset.id} store={runtimeCtx?.visibilityStore}>
      {node}
    </VisibleNode>);
}
