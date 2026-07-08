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
exports.STUDIO_POWERED_BY_URL = void 0;
exports.StudioPoweredByBanner = StudioPoweredByBanner;
const React = __importStar(require("react"));
const react_native_1 = require("react-native");
exports.STUDIO_POWERED_BY_URL = "https://studio.reactvision.xyz/?utm_source=scenenavigator-banner";
const DEFAULT_LABEL = "Powered by ReactVision Studio";
/**
 * Persistent "Powered by ReactVision Studio" watermark shown over the scene
 * for Free-tier scenes. Kept dependency-free (plain react-native) so it ships
 * with the library; the host can pass `onPress`/`label`/`style` for richer
 * behaviour.
 */
function StudioPoweredByBanner({ onPress, label, style, }) {
    const handlePress = () => {
        if (onPress) {
            onPress();
            return;
        }
        react_native_1.Linking.openURL(exports.STUDIO_POWERED_BY_URL).catch(() => {
            // Swallow: a missing URL handler must not crash the AR session.
        });
    };
    return (<react_native_1.View style={[styles.container, style]} pointerEvents="box-none">
      <react_native_1.Pressable onPress={handlePress} accessibilityRole="button" accessibilityLabel={label ?? DEFAULT_LABEL} style={({ pressed }) => [styles.pill, pressed && styles.pillPressed]}>
        <react_native_1.Text style={styles.text}>{label ?? DEFAULT_LABEL}</react_native_1.Text>
      </react_native_1.Pressable>
    </react_native_1.View>);
}
const styles = react_native_1.StyleSheet.create({
    container: {
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 40,
        alignItems: "center",
    },
    pill: {
        backgroundColor: "rgba(0, 0, 0, 0.6)",
        borderRadius: 999,
        paddingHorizontal: 16,
        paddingVertical: 8,
    },
    pillPressed: {
        opacity: 0.8,
    },
    text: {
        color: "#ffffff",
        fontSize: 12,
        fontWeight: "500",
    },
});
