"use strict";
/**
 * Viro Component Wrappers
 *
 * This module exports React components that maintain the same API as the original
 * Viro components but use the Fabric interop layer internally.
 */
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
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ViroARTrackingTargets = exports.ViroMaterials = exports.ViroAnimations = exports.ViroARObjectMarker = exports.ViroARImageMarker = exports.ViroARPlaneSelector = exports.ViroARPlane = exports.ViroARCamera = exports.Viro3DSceneNavigator = exports.ViroARSceneNavigator = exports.ViroVRSceneNavigator = exports.ViroSceneNavigator = exports.ViroMaterialVideo = exports.ViroAnimatedComponent = exports.ViroParticleEmitter = exports.ViroSpinner = exports.ViroController = exports.ViroButton = exports.ViroSpatialSound = exports.ViroSoundField = exports.ViroSound = exports.ViroOrbitCamera = exports.ViroCamera = exports.ViroLightingEnvironment = exports.ViroOmniLight = exports.ViroSpotLight = exports.ViroDirectionalLight = exports.ViroAmbientLight = exports.ViroPortalScene = exports.ViroPortal = exports.ViroSkyBox = exports.Viro360Video = exports.Viro360Image = exports.ViroAnimatedImage = exports.ViroVideo = exports.ViroImage = exports.ViroText = exports.ViroSurface = exports.ViroPolyline = exports.ViroPolygon = exports.ViroQuad = exports.ViroGeometry = exports.Viro3DObject = exports.ViroSphere = exports.ViroBox = exports.ViroFlexView = exports.ViroARScene = exports.ViroScene = exports.ViroNode = void 0;
// Basic components
var ViroNode_1 = require("./ViroNode");
Object.defineProperty(exports, "ViroNode", { enumerable: true, get: function () { return ViroNode_1.ViroNode; } });
var ViroScene_1 = require("./ViroScene");
Object.defineProperty(exports, "ViroScene", { enumerable: true, get: function () { return ViroScene_1.ViroScene; } });
var ViroARScene_1 = require("./ViroARScene");
Object.defineProperty(exports, "ViroARScene", { enumerable: true, get: function () { return ViroARScene_1.ViroARScene; } });
var ViroFlexView_1 = require("./ViroFlexView");
Object.defineProperty(exports, "ViroFlexView", { enumerable: true, get: function () { return ViroFlexView_1.ViroFlexView; } });
// 3D primitives
var ViroBox_1 = require("./ViroBox");
Object.defineProperty(exports, "ViroBox", { enumerable: true, get: function () { return ViroBox_1.ViroBox; } });
var ViroSphere_1 = require("./ViroSphere");
Object.defineProperty(exports, "ViroSphere", { enumerable: true, get: function () { return ViroSphere_1.ViroSphere; } });
var Viro3DObject_1 = require("./Viro3DObject");
Object.defineProperty(exports, "Viro3DObject", { enumerable: true, get: function () { return Viro3DObject_1.Viro3DObject; } });
var ViroGeometry_1 = require("./ViroGeometry");
Object.defineProperty(exports, "ViroGeometry", { enumerable: true, get: function () { return ViroGeometry_1.ViroGeometry; } });
var ViroQuad_1 = require("./ViroQuad");
Object.defineProperty(exports, "ViroQuad", { enumerable: true, get: function () { return ViroQuad_1.ViroQuad; } });
var ViroPolygon_1 = require("./ViroPolygon");
Object.defineProperty(exports, "ViroPolygon", { enumerable: true, get: function () { return ViroPolygon_1.ViroPolygon; } });
var ViroPolyline_1 = require("./ViroPolyline");
Object.defineProperty(exports, "ViroPolyline", { enumerable: true, get: function () { return ViroPolyline_1.ViroPolyline; } });
var ViroSurface_1 = require("./ViroSurface");
Object.defineProperty(exports, "ViroSurface", { enumerable: true, get: function () { return ViroSurface_1.ViroSurface; } });
// 2D components
var ViroText_1 = require("./ViroText");
Object.defineProperty(exports, "ViroText", { enumerable: true, get: function () { return ViroText_1.ViroText; } });
var ViroImage_1 = require("./ViroImage");
Object.defineProperty(exports, "ViroImage", { enumerable: true, get: function () { return ViroImage_1.ViroImage; } });
var ViroVideo_1 = require("./ViroVideo");
Object.defineProperty(exports, "ViroVideo", { enumerable: true, get: function () { return ViroVideo_1.ViroVideo; } });
var ViroAnimatedImage_1 = require("./ViroAnimatedImage");
Object.defineProperty(exports, "ViroAnimatedImage", { enumerable: true, get: function () { return ViroAnimatedImage_1.ViroAnimatedImage; } });
// 360 components
var Viro360Image_1 = require("./Viro360Image");
Object.defineProperty(exports, "Viro360Image", { enumerable: true, get: function () { return Viro360Image_1.Viro360Image; } });
var Viro360Video_1 = require("./Viro360Video");
Object.defineProperty(exports, "Viro360Video", { enumerable: true, get: function () { return Viro360Video_1.Viro360Video; } });
var ViroSkyBox_1 = require("./ViroSkyBox");
Object.defineProperty(exports, "ViroSkyBox", { enumerable: true, get: function () { return ViroSkyBox_1.ViroSkyBox; } });
// Portal components
var ViroPortal_1 = require("./ViroPortal");
Object.defineProperty(exports, "ViroPortal", { enumerable: true, get: function () { return ViroPortal_1.ViroPortal; } });
var ViroPortalScene_1 = require("./ViroPortalScene");
Object.defineProperty(exports, "ViroPortalScene", { enumerable: true, get: function () { return ViroPortalScene_1.ViroPortalScene; } });
// Lights
var ViroAmbientLight_1 = require("./ViroAmbientLight");
Object.defineProperty(exports, "ViroAmbientLight", { enumerable: true, get: function () { return ViroAmbientLight_1.ViroAmbientLight; } });
var ViroDirectionalLight_1 = require("./ViroDirectionalLight");
Object.defineProperty(exports, "ViroDirectionalLight", { enumerable: true, get: function () { return ViroDirectionalLight_1.ViroDirectionalLight; } });
var ViroSpotLight_1 = require("./ViroSpotLight");
Object.defineProperty(exports, "ViroSpotLight", { enumerable: true, get: function () { return ViroSpotLight_1.ViroSpotLight; } });
var ViroOmniLight_1 = require("./ViroOmniLight");
Object.defineProperty(exports, "ViroOmniLight", { enumerable: true, get: function () { return ViroOmniLight_1.ViroOmniLight; } });
var ViroLightingEnvironment_1 = require("./ViroLightingEnvironment");
Object.defineProperty(exports, "ViroLightingEnvironment", { enumerable: true, get: function () { return ViroLightingEnvironment_1.ViroLightingEnvironment; } });
// Cameras
var ViroCamera_1 = require("./ViroCamera");
Object.defineProperty(exports, "ViroCamera", { enumerable: true, get: function () { return ViroCamera_1.ViroCamera; } });
var ViroOrbitCamera_1 = require("./ViroOrbitCamera");
Object.defineProperty(exports, "ViroOrbitCamera", { enumerable: true, get: function () { return ViroOrbitCamera_1.ViroOrbitCamera; } });
// Audio
var ViroSound_1 = require("./ViroSound");
Object.defineProperty(exports, "ViroSound", { enumerable: true, get: function () { return ViroSound_1.ViroSound; } });
var ViroSoundField_1 = require("./ViroSoundField");
Object.defineProperty(exports, "ViroSoundField", { enumerable: true, get: function () { return ViroSoundField_1.ViroSoundField; } });
var ViroSpatialSound_1 = require("./ViroSpatialSound");
Object.defineProperty(exports, "ViroSpatialSound", { enumerable: true, get: function () { return ViroSpatialSound_1.ViroSpatialSound; } });
// Interactive components
var ViroButton_1 = require("./ViroButton");
Object.defineProperty(exports, "ViroButton", { enumerable: true, get: function () { return ViroButton_1.ViroButton; } });
var ViroController_1 = require("./ViroController");
Object.defineProperty(exports, "ViroController", { enumerable: true, get: function () { return ViroController_1.ViroController; } });
var ViroSpinner_1 = require("./ViroSpinner");
Object.defineProperty(exports, "ViroSpinner", { enumerable: true, get: function () { return ViroSpinner_1.ViroSpinner; } });
// Effects
var ViroParticleEmitter_1 = require("./ViroParticleEmitter");
Object.defineProperty(exports, "ViroParticleEmitter", { enumerable: true, get: function () { return ViroParticleEmitter_1.ViroParticleEmitter; } });
var ViroAnimatedComponent_1 = require("./ViroAnimatedComponent");
Object.defineProperty(exports, "ViroAnimatedComponent", { enumerable: true, get: function () { return ViroAnimatedComponent_1.ViroAnimatedComponent; } });
var ViroMaterialVideo_1 = require("./ViroMaterialVideo");
Object.defineProperty(exports, "ViroMaterialVideo", { enumerable: true, get: function () { return ViroMaterialVideo_1.ViroMaterialVideo; } });
// Scene navigators
var ViroSceneNavigator_1 = require("./ViroSceneNavigator");
Object.defineProperty(exports, "ViroSceneNavigator", { enumerable: true, get: function () { return ViroSceneNavigator_1.ViroSceneNavigator; } });
var ViroVRSceneNavigator_1 = require("./ViroVRSceneNavigator");
Object.defineProperty(exports, "ViroVRSceneNavigator", { enumerable: true, get: function () { return ViroVRSceneNavigator_1.ViroVRSceneNavigator; } });
var ViroARSceneNavigator_1 = require("./ViroARSceneNavigator");
Object.defineProperty(exports, "ViroARSceneNavigator", { enumerable: true, get: function () { return ViroARSceneNavigator_1.ViroARSceneNavigator; } });
var Viro3DSceneNavigator_1 = require("./Viro3DSceneNavigator");
Object.defineProperty(exports, "Viro3DSceneNavigator", { enumerable: true, get: function () { return Viro3DSceneNavigator_1.Viro3DSceneNavigator; } });
// AR components
var ViroARCamera_1 = require("./ViroARCamera");
Object.defineProperty(exports, "ViroARCamera", { enumerable: true, get: function () { return ViroARCamera_1.ViroARCamera; } });
var ViroARPlane_1 = require("./AR/ViroARPlane");
Object.defineProperty(exports, "ViroARPlane", { enumerable: true, get: function () { return ViroARPlane_1.ViroARPlane; } });
var ViroARPlaneSelector_1 = require("./AR/ViroARPlaneSelector");
Object.defineProperty(exports, "ViroARPlaneSelector", { enumerable: true, get: function () { return ViroARPlaneSelector_1.ViroARPlaneSelector; } });
var ViroARImageMarker_1 = require("./ViroARImageMarker");
Object.defineProperty(exports, "ViroARImageMarker", { enumerable: true, get: function () { return ViroARImageMarker_1.ViroARImageMarker; } });
var ViroARObjectMarker_1 = require("./ViroARObjectMarker");
Object.defineProperty(exports, "ViroARObjectMarker", { enumerable: true, get: function () { return ViroARObjectMarker_1.ViroARObjectMarker; } });
// Utilities
__exportStar(require("./ViroUtils"), exports);
// Animation utilities
__exportStar(require("./Animation/ViroAnimations"), exports);
const ViroAnimations_1 = __importDefault(require("./Animation/ViroAnimations"));
exports.ViroAnimations = ViroAnimations_1.default;
// Material utilities
__exportStar(require("./Material/ViroMaterials"), exports);
const ViroMaterials_1 = __importDefault(require("./Material/ViroMaterials"));
exports.ViroMaterials = ViroMaterials_1.default;
// AR utilities
__exportStar(require("./AR/ViroARTrackingTargets"), exports);
const ViroARTrackingTargets_1 = __importDefault(require("./AR/ViroARTrackingTargets"));
exports.ViroARTrackingTargets = ViroARTrackingTargets_1.default;
