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
const materialConfig_1 = require("./materialConfig");
const dragConfiguration_1 = require("./dragConfiguration");
const physicsConfig_1 = require("./physicsConfig");
/**
 * Derives the transform config for an asset.
 * Clamps Z to -2 for non-trigger assets to guarantee visibility.
 */
function createNodeConfig(asset, sceneNavigator, animations, scene, onAnimationTrigger, animationStates) {
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
    const physicsBody = parsedPhysics ? (0, physicsConfig_1.buildViroPhysicsBody)(parsedPhysics) : undefined;
    const viroTag = parsedPhysics ? asset.id : undefined;
    const onClick = createOnClickHandler(asset, sceneNavigator, animations, onAnimationTrigger);
    const animation = animationStates?.[asset.id];
    return { position, rotation, scale, dragType, dragPlane, physicsBody, viroTag, onClick, animation };
}
function createOnClickHandler(asset, sceneNavigator, animations, onAnimationTrigger) {
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
    return () => (0, sceneNavigationHandler_1.executeFunctionWithRelations)(fn, sceneNavigator, animations, onAnimationTrigger);
}
/** Resolves asset type from asset_type_name. */
function resolveType(asset) {
    return asset.asset_type_name ?? null;
}
/** Infers 3D model format from file extension. */
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
function create3DObject(asset, config, onAssetLoaded) {
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
    const shaderOverrides = hasMaterialConfig ? [(0, materialConfig_1.studioMaterialName)(asset.id)] : undefined;
    return (<Viro3DObject_1.Viro3DObject key={asset.id} source={{ uri: asset.file_url }} position={config.position} rotation={config.rotation} scale={scale} type={modelType} dragType={config.dragType} dragPlane={config.dragPlane} animation={config.animation} onClick={config.onClick} renderingOrder={react_native_1.Platform.OS === "android" ? 1 : 0} onLoadEnd={() => onAssetLoaded?.(asset.id)} onError={(e) => console.error(`[Studio] 3D model "${asset.name}" error:`, e)} {...(shaderOverrides ? { shaderOverrides } : {})} {...(config.physicsBody ? { physicsBody: config.physicsBody, viroTag: config.viroTag } : {})}/>);
}
function createImage(asset, config, onAssetLoaded) {
    if (!asset.file_url) {
        console.warn(`[Studio] Image "${asset.name}" has no file_url`);
        return null;
    }
    return (<ViroImage_1.ViroImage key={asset.id} source={{ uri: asset.file_url }} position={config.position} rotation={config.rotation} scale={config.scale} dragType={config.dragType} animation={config.animation} onClick={config.onClick} onLoadEnd={() => onAssetLoaded?.(asset.id)} onError={(e) => console.error(`[Studio] Image "${asset.name}" error:`, e)}/>);
}
function createText(asset, config) {
    return (<ViroText_1.ViroText key={asset.id} text={asset.name ?? ""} position={config.position} rotation={config.rotation} scale={config.scale} dragType={config.dragType} animation={config.animation} onClick={config.onClick} style={{
            fontFamily: "Arial",
            fontSize: 20,
            color: "#FFFFFF",
            textAlign: "center",
        }}/>);
}
function createVideo(asset, config) {
    if (!asset.file_url) {
        console.warn(`[Studio] Video "${asset.name}" has no file_url`);
        return null;
    }
    return (<ViroVideo_1.ViroVideo key={asset.id} source={{ uri: asset.file_url }} position={config.position} rotation={config.rotation} scale={config.scale} dragType={config.dragType} animation={config.animation} onClick={config.onClick} loop={true} muted={false} onError={(e) => console.error(`[Studio] Video "${asset.name}" error:`, e)}/>);
}
/**
 * Creates the appropriate Viro component for a StudioAsset.
 */
function createNode(asset, sceneNavigator, animations, scene, onAnimationTrigger, animationStates, onAssetLoaded) {
    const type = resolveType(asset);
    const config = createNodeConfig(asset, sceneNavigator, animations, scene, onAnimationTrigger, animationStates);
    switch (type) {
        case "3D-MODEL":
            return create3DObject(asset, config, onAssetLoaded);
        case "IMAGE":
            return createImage(asset, config, onAssetLoaded);
        case "TEXT":
            return createText(asset, config);
        case "VIDEO":
            return createVideo(asset, config);
        default:
            console.warn(`[Studio] Unknown asset type "${type}" for "${asset.name}"`);
            return null;
    }
}
