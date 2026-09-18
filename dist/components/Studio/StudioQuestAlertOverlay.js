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
exports.StudioQuestAlertOverlay = StudioQuestAlertOverlay;
const React = __importStar(require("react"));
const react_1 = require("react");
const ViroNode_1 = require("../ViroNode");
const ViroFlexView_1 = require("../ViroFlexView");
const ViroText_1 = require("../ViroText");
const questAlertStore_1 = require("./domain/questAlertStore");
const questHeadLockedTransform_1 = require("./domain/questHeadLockedTransform");
/**
 * Quest-only in-scene replacement for Alert.alert (invisible in the VR
 * compositor). Renders questAlertStore's active message as a head-locked
 * panel; dismiss is a controller click anywhere on the panel, mirroring how
 * tapping "OK" dismisses the native dialog on phones.
 */
function StudioQuestAlertOverlay({ cameraPose }) {
    const [, forceUpdate] = (0, react_1.useState)(0);
    (0, react_1.useEffect)(() => questAlertStore_1.questAlertStore.subscribe(() => forceUpdate((n) => n + 1)), []);
    if (!questAlertStore_1.questAlertStore.isActive() || !cameraPose)
        return null;
    const { position, rotation } = (0, questHeadLockedTransform_1.computeHeadLockedTransform)(cameraPose);
    const title = questAlertStore_1.questAlertStore.title();
    const message = questAlertStore_1.questAlertStore.message();
    return (<ViroNode_1.ViroNode position={position} rotation={rotation}>
      <ViroFlexView_1.ViroFlexView width={2} height={1} onClick={() => questAlertStore_1.questAlertStore.dismiss()} style={{
            backgroundColor: "rgba(0,0,0,0.85)",
            justifyContent: "center",
            alignItems: "center",
            padding: 0.06,
        }}>
        {title && (<ViroText_1.ViroText text={title} width={1.8} height={0.3} style={{
                fontFamily: "Arial",
                fontSize: 22,
                fontWeight: "bold",
                color: "#FFFFFF",
                textAlign: "center",
            }}/>)}
        <ViroText_1.ViroText text={message ?? ""} width={1.8} height={0.5} style={{
            fontFamily: "Arial",
            fontSize: 16,
            color: "#FFFFFF",
            textAlign: "center",
        }}/>
      </ViroFlexView_1.ViroFlexView>
    </ViroNode_1.ViroNode>);
}
