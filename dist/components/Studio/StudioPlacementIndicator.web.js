"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StudioPlacementIndicator = StudioPlacementIndicator;
const jsx_runtime_1 = require("react/jsx-runtime");
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
    return ((0, jsx_runtime_1.jsxs)("div", { style: pill, children: [(0, jsx_runtime_1.jsx)("span", { style: text, children: `Tap a surface to place${name ? `: ${name}` : ""}` }), showMiss && ((0, jsx_runtime_1.jsx)("span", { style: hint, children: "Move your device to scan a surface, then tap." }))] }));
}
