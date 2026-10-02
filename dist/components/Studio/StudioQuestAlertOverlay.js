"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StudioQuestAlertOverlay = StudioQuestAlertOverlay;
const jsx_runtime_1 = require("react/jsx-runtime");
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
    return ((0, jsx_runtime_1.jsx)(ViroNode_1.ViroNode, { position: position, rotation: rotation, children: (0, jsx_runtime_1.jsxs)(ViroFlexView_1.ViroFlexView, { width: 2, height: 1, onClick: () => questAlertStore_1.questAlertStore.dismiss(), style: {
                backgroundColor: "rgba(0,0,0,0.85)",
                justifyContent: "center",
                alignItems: "center",
                padding: 0.06,
            }, children: [title && ((0, jsx_runtime_1.jsx)(ViroText_1.ViroText, { text: title, width: 1.8, height: 0.3, style: {
                        fontFamily: "Arial",
                        fontSize: 22,
                        fontWeight: "bold",
                        color: "#FFFFFF",
                        textAlign: "center",
                    } })), (0, jsx_runtime_1.jsx)(ViroText_1.ViroText, { text: message ?? "", width: 1.8, height: 0.5, style: {
                        fontFamily: "Arial",
                        fontSize: 16,
                        color: "#FFFFFF",
                        textAlign: "center",
                    } })] }) }));
}
