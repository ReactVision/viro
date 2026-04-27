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
exports.ViroXRSceneNavigator = void 0;
const React = __importStar(require("react"));
const ViroARSceneNavigator_1 = require("./AR/ViroARSceneNavigator");
const ViroVRSceneNavigator_1 = require("./ViroVRSceneNavigator");
const ViroPlatform_1 = require("./Utilities/ViroPlatform");
/**
 * Cross-reality scene navigator. Picks the right underlying navigator at runtime:
 *
 *  - **Meta Quest** → `ViroVRSceneNavigator`
 *  - **iOS / non-Quest Android** → `ViroARSceneNavigator`
 *
 * Pass `arInitialScene` / `vrInitialScene` when the AR and VR scenes differ.
 * When only `initialScene` is provided it is used for both modes.
 */
exports.ViroXRSceneNavigator = React.forwardRef(function ViroXRSceneNavigator(props, ref) {
    const { initialScene, arInitialScene, vrInitialScene, ...rest } = props;
    if (ViroPlatform_1.isQuest) {
        const scene = vrInitialScene ?? initialScene;
        if (!scene) {
            console.warn("[Viro] ViroXRSceneNavigator on Quest requires `vrInitialScene` or `initialScene`.");
            return null;
        }
        return (<ViroVRSceneNavigator_1.ViroVRSceneNavigator ref={ref} initialScene={scene} {...rest}/>);
    }
    const scene = arInitialScene ?? initialScene;
    if (!scene) {
        console.warn("[Viro] ViroXRSceneNavigator requires `arInitialScene` or `initialScene`.");
        return null;
    }
    return (<ViroARSceneNavigator_1.ViroARSceneNavigator ref={ref} initialScene={scene} {...rest}/>);
});
