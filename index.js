"use strict";
/**
 * Copyright (c) 2016-present, Viro Media, Inc.
 * All rights reserved.
 *
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ViroMaterials = exports.ViroAnimations = exports.ViroSceneNavigator = exports.ViroScene = exports.Viro3DObject = void 0;
const ViroAnimations_1 = require("@components/Animation/ViroAnimations");
Object.defineProperty(exports, "ViroAnimations", { enumerable: true, get: function () { return ViroAnimations_1.ViroAnimations; } });
const ViroMaterials_1 = require("@components/Material/ViroMaterials");
Object.defineProperty(exports, "ViroMaterials", { enumerable: true, get: function () { return ViroMaterials_1.ViroMaterials; } });
const Viro3DObject_1 = require("@components/Viro3DObject");
Object.defineProperty(exports, "Viro3DObject", { enumerable: true, get: function () { return Viro3DObject_1.Viro3DObject; } });
const ViroScene_1 = require("@components/ViroScene");
Object.defineProperty(exports, "ViroScene", { enumerable: true, get: function () { return ViroScene_1.ViroScene; } });
const ViroSceneNavigator_1 = require("@components/ViroSceneNavigator");
Object.defineProperty(exports, "ViroSceneNavigator", { enumerable: true, get: function () { return ViroSceneNavigator_1.ViroSceneNavigator; } });
const ReactViro = {
    // Components
    get ViroSceneNavigator() {
        return require("./components/ViroSceneNavigator");
    },
    get ViroBox() {
        return require("./components/ViroBox");
    },
    get ViroMaterials() {
        return require("./components/Material/ViroMaterials");
    },
    get ViroMaterialVideo() {
        return require("./components/ViroMaterialVideo");
    },
    get ViroVideo() {
        return require("./components/ViroVideo");
    },
    get Viro360Video() {
        return require("./components/Viro360Video");
    },
    get ViroNode() {
        return require("./components/ViroNode");
    },
    get ViroPortal() {
        return require("./components/ViroPortal");
    },
    get ViroPortalScene() {
        return require("./components/ViroPortalScene");
    },
    get ViroCamera() {
        return require("./components/ViroCamera");
    },
    get ViroOrbitCamera() {
        return require("./components/ViroOrbitCamera");
    },
    get ViroSphere() {
        return require("./components/ViroSphere");
    },
    get ViroImage() {
        return require("./components/ViroImage");
    },
    get Viro360Image() {
        return require("./components/Viro360Image");
    },
    get ViroSkyBox() {
        return require("./components/ViroSkyBox");
    },
    get Viro3DObject() {
        return Viro3DObject_1.Viro3DObject;
    },
    get ViroAnimatedComponent() {
        return require("./components/ViroAnimatedComponent");
    },
    get ViroAnimations() {
        return require("./components/Animation/ViroAnimations");
    },
    get ViroDirectionalLight() {
        return require("./components/ViroDirectionalLight");
    },
    get ViroAmbientLight() {
        return require("./components/ViroAmbientLight");
    },
    get ViroOmniLight() {
        return require("./components/ViroOmniLight");
    },
    get ViroSpotLight() {
        return require("./components/ViroSpotLight");
    },
    get ViroFlexView() {
        return require("./components/ViroFlexView");
    },
    get ViroUtils() {
        return require("./components/Utilities/ViroUtils");
    },
    get ViroProps() {
        return require("./components/Utilities/ViroProps");
    },
    get ViroText() {
        return require("./components/ViroText");
    },
    get ViroGeometry() {
        return require("./components/ViroGeometry");
    },
    get ViroSurface() {
        return require("./components/ViroSurface");
    },
    get ViroQuad() {
        return require("./components/ViroQuad");
    },
    get ViroAnimatedImage() {
        return require("./components/ViroAnimatedImage");
    },
    get ViroPolygon() {
        return require("./components/ViroPolygon");
    },
    get ViroButton() {
        return require("./components/ViroButton");
    },
    get ViroSound() {
        return require("./components/ViroSound");
    },
    get ViroSoundField() {
        return require("./components/ViroSoundField");
    },
    get ViroSpatialSound() {
        return require("./components/ViroSpatialSound");
    },
    get ViroController() {
        return require("./components/ViroController");
    },
    get ViroSpinner() {
        return require("./components/ViroSpinner");
    },
    get ViroPolyline() {
        return require("./components/ViroPolyline");
    },
    get ViroConstants() {
        return require("./components/ViroConstants");
    },
    get ViroParticleEmitter() {
        return require("./components/ViroParticleEmitter");
    },
    get ViroLightingEnvironment() {
        return require("./components/ViroLightingEnvironment");
    },
    get Viro3DSceneNavigator() {
        return require("./components/Viro3DSceneNavigator");
    },
    get ViroVRSceneNavigator() {
        return require("./components/ViroVRSceneNavigator");
    },
    // AR Components
    get ViroARSceneNavigator() {
        return require("./components/AR/ViroARSceneNavigator");
    },
    get ViroARScene() {
        return require("./components/AR/ViroARScene");
    },
    get ViroARPlane() {
        return require("./components/AR/ViroARPlane");
    },
    get ViroARPlaneSelector() {
        return require("./components/AR/ViroARPlaneSelector");
    },
    get ViroARTrackingTargets() {
        return require("./components/AR/ViroARTrackingTargets");
    },
    get ViroARImageMarker() {
        return require("./components/AR/ViroARImageMarker");
    },
    get ViroARObjectMarker() {
        return require("./components/AR/ViroARObjectMarker");
    },
    get ViroARCamera() {
        return require("./components/AR/ViroARCamera");
    },
};
module.exports = ReactViro;
