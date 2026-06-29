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
/** Clamps Z to -2 for non-trigger assets to guarantee visibility. */
function createNodeConfig(asset, sceneNavigator, animations, scene, onAnimationTrigger, animationStates, onSceneChange, runtimeCtx) {
    const hasTriggerImage = !!asset.trigger_image_url;
    let posZ = asset.position_z ?? -2;
    if (!hasTriggerImage && posZ > -0.5) {
        console.warn(`[Studio/NodeFactory] Asset "${asset.name}" Z=${posZ} too close, clamping to -2`);
        posZ = -2;
    }
    const position = [
        asset.position_x ?? 0,
        asset.position_y ?? 0,
        posZ,
    ];
    // Apply trigger image orientation offset to rotation Z
    let rotationZ = asset.rotation_z ?? 0;
    if (hasTriggerImage && asset.trigger_image_orientation) {
        const offsets = {
            Left: -90,
            Right: 90,
            Down: 180,
            Up: 0,
        };
        rotationZ += offsets[asset.trigger_image_orientation] ?? 0;
    }
    const rotation = [
        asset.rotation_x ?? 0,
        asset.rotation_y ?? 0,
        rotationZ,
    ];
    let scaleValue = asset.scale ?? 1;
    if (scaleValue < 0.01)
        scaleValue = 0.1;
    if (scaleValue > 10)
        scaleValue = 2;
    const scale = [scaleValue, scaleValue, scaleValue];
    const dragType = dragConfiguration_1.DragConfiguration.getDragType(asset, scene);
    let dragPlane;
    if (dragType === "FixedToPlane") {
        dragPlane = dragConfiguration_1.DragConfiguration.getDragPlane(scene?.plane_direction ?? "Horizontal", position);
    }
    const parsedPhysics = (0, physicsConfig_1.parsePhysicsBodyConfig)(asset.physics_config);
    const physicsBody = parsedPhysics
        ? (0, physicsConfig_1.buildViroPhysicsBody)(parsedPhysics)
        : undefined;
    const viroTag = parsedPhysics ? asset.id : undefined;
    const onClick = createOnClickHandler(asset, sceneNavigator, animations, onAnimationTrigger, onSceneChange, runtimeCtx);
    const animation = animationStates?.[asset.id];
    return {
        position,
        rotation,
        scale,
        dragType,
        dragPlane,
        physicsBody,
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
function create3DObject(asset, config, onAssetLoaded, onCollision) {
    if (!asset.file_url) {
        console.warn(`[Studio] 3D model "${asset.name}" has no file_url`);
        return null;
    }
    const modelType = inferModelType(asset.file_url);
    // Android: slightly reduce scale for stability
    const scale = react_native_1.Platform.OS === "android"
        ? [
            config.scale[0] * 0.8,
            config.scale[1] * 0.8,
            config.scale[2] * 0.8,
        ]
        : config.scale;
    const hasMaterialConfig = (0, materialConfig_1.parseMaterialConfig)(asset.material_config) !== null;
    const shaderOverrides = hasMaterialConfig
        ? [(0, materialConfig_1.studioMaterialName)(asset.id)]
        : undefined;
    return (<Viro3DObject_1.Viro3DObject key={asset.id} source={{ uri: asset.file_url }} position={config.position} rotation={config.rotation} scale={scale} type={modelType} dragType={config.dragType} dragPlane={config.dragPlane} animation={config.animation} onClick={config.onClick} renderingOrder={react_native_1.Platform.OS === "android" ? 1 : 0} onLoadEnd={() => onAssetLoaded?.(asset.id)} onError={(e) => console.error(`[Studio] 3D model "${asset.name}" error:`, e)} 
    // Viro derives native canDrag from `onDrag != undefined`; without this prop
    // the drag recognizer is never attached, even when dragType is set.
    {...(config.dragType ? { onDrag: () => { } } : {})} {...(shaderOverrides ? { shaderOverrides } : {})} {...(config.physicsBody
        ? { physicsBody: config.physicsBody, viroTag: config.viroTag }
        : {})} {...(onCollision ? { onCollision: onCollision } : {})}/>);
}
function createImage(asset, config, onAssetLoaded) {
    if (!asset.file_url) {
        console.warn(`[Studio] Image "${asset.name}" has no file_url`);
        return null;
    }
    return (<ViroImage_1.ViroImage key={asset.id} source={{ uri: asset.file_url }} position={config.position} rotation={config.rotation} scale={config.scale} dragType={config.dragType} animation={config.animation} onClick={config.onClick} onLoadEnd={() => onAssetLoaded?.(asset.id)} onError={(e) => console.error(`[Studio] Image "${asset.name}" error:`, e)} {...(config.dragType ? { onDrag: () => { } } : {})}/>);
}
/**
 * TEXT node whose content is a {{variable}} template (the asset name). It
 * re-interpolates and repaints whenever a referenced variable changes (and only
 * subscribes when the template actually has placeholders). Resolution is
 * fail-soft: unknown names stay literal.
 */
const VariableText = ({ asset, config, store, visible }) => {
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
    return (<ViroText_1.ViroText text={text} position={config.position} rotation={config.rotation} scale={config.scale} dragType={config.dragType} animation={config.animation} onClick={config.onClick} {...(visible === undefined ? {} : { visible })} style={{
            fontFamily: "Arial",
            fontSize: 20,
            color: "#FFFFFF",
            textAlign: "center",
        }} {...(config.dragType ? { onDrag: () => { } } : {})}/>);
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
function createText(asset, config, store) {
    return (<VariableText key={asset.id} asset={asset} config={config} store={store}/>);
}
function createVideo(asset, config) {
    if (!asset.file_url) {
        console.warn(`[Studio] Video "${asset.name}" has no file_url`);
        return null;
    }
    return (<ViroVideo_1.ViroVideo key={asset.id} source={{ uri: asset.file_url }} position={config.position} rotation={config.rotation} scale={config.scale} dragType={config.dragType} animation={config.animation} onClick={config.onClick} loop={true} muted={false} onError={(e) => console.error(`[Studio] Video "${asset.name}" error:`, e)} {...(config.dragType ? { onDrag: () => { } } : {})}/>);
}
function createNode(asset, sceneNavigator, animations, scene, onAnimationTrigger, animationStates, onAssetLoaded, onCollision, onSceneChange, runtimeCtx) {
    const type = resolveType(asset);
    const config = createNodeConfig(asset, sceneNavigator, animations, scene, onAnimationTrigger, animationStates, onSceneChange, runtimeCtx);
    let node;
    switch (type) {
        case "3D-MODEL":
            node = create3DObject(asset, config, onAssetLoaded, onCollision);
            break;
        case "IMAGE":
            node = createImage(asset, config, onAssetLoaded);
            break;
        case "TEXT":
            node = createText(asset, config, runtimeCtx?.variableStore);
            break;
        case "VIDEO":
            node = createVideo(asset, config);
            break;
        default:
            console.warn(`[Studio] Unknown asset type "${type}" for "${asset.name}"`);
            return null;
    }
    if (!node)
        return null;
    // Drive show/hide/toggle from the visibility store (Set Visibility actions);
    // seeded from the asset's author-time hidden_on_load default.
    return (<VisibleNode key={asset.id} assetId={asset.id} store={runtimeCtx?.visibilityStore}>
      {node}
    </VisibleNode>);
}
