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
/**
 * Web host for StudioPlacementIndicator. Same component, same hook, same
 * behaviour — DOM instead of react-native primitives.
 *
 * Why not just let react-native-web handle it: `react-native-web` is an
 * *optional* peer dependency of this package, and no other `.web.tsx` in the
 * tree imports from "react-native". A web build without it installed would fail
 * to resolve the import rather than degrade, and a Studio scene previewed on
 * web would take the whole navigator down with it. Plain DOM has no such
 * dependency and the styles here are a direct transcription of the native
 * StyleSheet, so the two look the same.
 *
 * The logic lives in useStudioPlacement(), which is React and a store and is
 * already platform-agnostic — so nothing about *when* this appears is
 * duplicated here.
 */
const React = __importStar(require("react"));
const useStudioPlacement_1 = require("./useStudioPlacement");
const pill = {
    backgroundColor: "rgba(0,0,0,0.7)",
    borderRadius: 8,
    padding: "10px 16px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    maxWidth: "100%",
    pointerEvents: "none",
    // The native pill inherits the app's font; on web there is nothing to
    // inherit inside a canvas host, so it is named rather than left to the UA.
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
};
const text = {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: 600,
    textAlign: "center",
};
const hint = {
    color: "#FFD27F",
    fontSize: 13,
    marginTop: 4,
    textAlign: "center",
};
function StudioPlacementIndicator() {
    const { isPlacing, name, showMiss } = (0, useStudioPlacement_1.useStudioPlacement)();
    if (!isPlacing)
        return null;
    return (<div style={pill}>
      <span style={text}>
        {`Tap a surface to place${name ? `: ${name}` : ""}`}
      </span>
      {showMiss && (<span style={hint}>Move your device to scan a surface, then tap.</span>)}
    </div>);
}
