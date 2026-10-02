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
exports.StudioColocationIndicator = StudioColocationIndicator;
const jsx_runtime_1 = require("react/jsx-runtime");
const React = __importStar(require("react"));
const react_native_1 = require("react-native");
const ViroPlatform_1 = require("../Utilities/ViroPlatform");
const indicatorContent_1 = require("./colocation/indicatorContent");
const colocationStore_1 = require("./domain/colocationStore");
const useStudioColocation_1 = require("./useStudioColocation");
/**
 * Shared-space status pill: scan guidance with a Done button for the host,
 * progress while hosting or resolving, then the join code and how many other
 * devices are in the room. Position-agnostic (it lays out no absolute position
 * of its own) so the embedding host controls placement.
 *
 * StudioSceneNavigator renders this by default (see its `colocationIndicator`
 * prop). Hosts with their own chrome can set that prop to false and render this
 * where it fits, or build a custom UI from useStudioColocation().
 */
const subscribe = (onChange) => colocationStore_1.studioColocationStore.subscribe(onChange);
const getOriginPrompt = () => colocationStore_1.studioColocationStore.getOriginPrompt();
const noOriginPrompt = () => null;
function StudioColocationIndicator() {
    const state = (0, useStudioColocation_1.useStudioColocation)();
    const originPrompt = React.useSyncExternalStore(subscribe, getOriginPrompt, noOriginPrompt);
    const content = (0, indicatorContent_1.studioColocationIndicatorContent)(state, originPrompt, ViroPlatform_1.isQuest ? "headset" : "phone");
    if (!content)
        return null;
    return ((0, jsx_runtime_1.jsxs)(react_native_1.View, { style: styles.pill, pointerEvents: "box-none", children: [(0, jsx_runtime_1.jsx)(react_native_1.Text, { style: [styles.title, content.tone === "error" && styles.error], children: content.title }), content.code && (0, jsx_runtime_1.jsx)(react_native_1.Text, { style: styles.code, children: content.code }), content.detail && (0, jsx_runtime_1.jsx)(react_native_1.Text, { style: styles.detail, children: content.detail }), content.done && ((0, jsx_runtime_1.jsx)(react_native_1.Pressable, { accessibilityRole: "button", accessibilityState: { disabled: !content.done.enabled }, disabled: !content.done.enabled, onPress: () => colocationStore_1.studioColocationStore.finishScan(), style: [
                    styles.button,
                    !content.done.enabled && styles.buttonDisabled,
                ], children: (0, jsx_runtime_1.jsx)(react_native_1.Text, { style: styles.buttonLabel, children: "Done" }) }))] }));
}
const styles = react_native_1.StyleSheet.create({
    pill: {
        backgroundColor: "rgba(0,0,0,0.7)",
        borderRadius: 8,
        paddingHorizontal: 16,
        paddingVertical: 10,
        alignItems: "center",
        maxWidth: "100%",
    },
    title: {
        color: "#FFFFFF",
        fontSize: 15,
        fontWeight: "600",
        textAlign: "center",
    },
    error: {
        color: "#FF8A80",
    },
    code: {
        color: "#FFFFFF",
        fontSize: 28,
        fontWeight: "700",
        letterSpacing: 4,
        marginTop: 4,
        textAlign: "center",
    },
    detail: {
        color: "#E0E0E0",
        fontSize: 13,
        marginTop: 4,
        textAlign: "center",
    },
    button: {
        backgroundColor: "#FFFFFF",
        borderRadius: 6,
        marginTop: 8,
        paddingHorizontal: 20,
        paddingVertical: 6,
    },
    buttonDisabled: {
        opacity: 0.4,
    },
    buttonLabel: {
        color: "#000000",
        fontSize: 14,
        fontWeight: "600",
    },
});
