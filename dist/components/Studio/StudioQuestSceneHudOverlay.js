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
exports.StudioQuestSceneHudOverlay = StudioQuestSceneHudOverlay;
const React = __importStar(require("react"));
const ViroNode_1 = require("../ViroNode");
const ViroFlexView_1 = require("../ViroFlexView");
const ViroText_1 = require("../ViroText");
const VRModuleOpenXR_1 = require("../Utilities/VRModuleOpenXR");
const VRQuestNavigatorBridge_1 = require("../Utilities/VRQuestNavigatorBridge");
const questHeadLockedTransform_1 = require("./domain/questHeadLockedTransform");
// Same exit path as the hardware back button (ViroQuestEntryPoint's
// BackHandler, see roadmap task 2): invoke the current intent's onExitViro
// before finishing VRActivity.
function handleExitClick() {
    VRQuestNavigatorBridge_1.VRQuestNavigatorBridge.getIntent()?.rendererConfig?.onExitViro?.();
    (0, VRModuleOpenXR_1.exitVRScene)();
}
/**
 * Quest has no 2D chrome (header, back, plane banner) — StudioGo's is stuck
 * in MainActivity, out of view once VRActivity takes the display (see
 * ViroXRSceneNavigator, which renders null on Quest). This is the in-scene
 * replacement: a small persistent head-locked HUD with the scene name, plane
 * status, and an in-scene "Exit" the hardware back button already covers,
 * but this makes it discoverable and provides a scene name / plane status
 * that has no other Quest-visible equivalent.
 *
 * Sits below StudioQuestAlertOverlay's position (verticalOffsetM) so an
 * ALERT firing at the same time doesn't render on top of it.
 */
function StudioQuestSceneHudOverlay({ cameraPose, sceneName, planeDetectionMode, hasFoundPlane, }) {
    if (!cameraPose)
        return null;
    const { position, rotation } = (0, questHeadLockedTransform_1.computeHeadLockedTransform)(cameraPose, {
        distanceM: 1.2,
        verticalOffsetM: -0.4,
    });
    return (<ViroNode_1.ViroNode position={position} rotation={rotation}>
      <ViroFlexView_1.ViroFlexView width={1.6} height={0.5} style={{
            backgroundColor: "rgba(0,0,0,0.6)",
            justifyContent: "center",
            alignItems: "center",
            padding: 0.04,
        }}>
        <ViroText_1.ViroText text={sceneName ?? "Untitled scene"} width={1.5} height={0.15} style={{
            fontFamily: "Arial",
            fontSize: 14,
            color: "#FFFFFF",
            textAlign: "center",
        }}/>
        {planeDetectionMode !== "NONE" && (<ViroText_1.ViroText text={hasFoundPlane ? "Plane found" : "Scanning for planes…"} width={1.5} height={0.12} style={{
                fontFamily: "Arial",
                fontSize: 11,
                color: "#CCCCCC",
                textAlign: "center",
            }}/>)}
        <ViroText_1.ViroText text="[ Exit ]" width={1.5} height={0.15} onClick={handleExitClick} style={{
            fontFamily: "Arial",
            fontSize: 13,
            color: "#7FCBFF",
            textAlign: "center",
        }}/>
      </ViroFlexView_1.ViroFlexView>
    </ViroNode_1.ViroNode>);
}
