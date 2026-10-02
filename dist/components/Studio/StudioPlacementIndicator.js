"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StudioPlacementIndicator = StudioPlacementIndicator;
const jsx_runtime_1 = require("react/jsx-runtime");
const react_native_1 = require("react-native");
const useStudioPlacement_1 = require("./useStudioPlacement");
/**
 * Tap-to-place prompt pill, shown only while a mobile AR asset awaits placement.
 * Position-agnostic (it lays out no absolute position of its own) so the
 * embedding host controls placement.
 *
 * StudioSceneNavigator renders this by default (see its `placementIndicator`
 * prop). Hosts with their own top-of-screen chrome can set that prop to false
 * and render this where it fits, or build a custom UI from useStudioPlacement().
 */
function StudioPlacementIndicator() {
    const { isPlacing, name, showMiss } = (0, useStudioPlacement_1.useStudioPlacement)();
    if (!isPlacing)
        return null;
    return ((0, jsx_runtime_1.jsxs)(react_native_1.View, { style: styles.pill, pointerEvents: "none", children: [(0, jsx_runtime_1.jsx)(react_native_1.Text, { style: styles.text, children: `Tap a surface to place${name ? `: ${name}` : ""}` }), showMiss && ((0, jsx_runtime_1.jsx)(react_native_1.Text, { style: styles.hint, children: "Move your device to scan a surface, then tap." }))] }));
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
    text: {
        color: "#FFFFFF",
        fontSize: 15,
        fontWeight: "600",
        textAlign: "center",
    },
    hint: {
        color: "#FFD27F",
        fontSize: 13,
        marginTop: 4,
        textAlign: "center",
    },
});
