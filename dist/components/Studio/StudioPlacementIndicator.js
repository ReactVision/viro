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
exports.StudioPlacementIndicator = StudioPlacementIndicator;
const React = __importStar(require("react"));
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
    return (<react_native_1.View style={styles.pill} pointerEvents="none">
      <react_native_1.Text style={styles.text}>
        {`Tap a surface to place${name ? `: ${name}` : ""}`}
      </react_native_1.Text>
      {showMiss && (<react_native_1.Text style={styles.hint}>
          Move your device to scan a surface, then tap.
        </react_native_1.Text>)}
    </react_native_1.View>);
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
