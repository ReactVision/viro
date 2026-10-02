"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StudioColocationIndicator = StudioColocationIndicator;
const jsx_runtime_1 = require("react/jsx-runtime");
const indicatorContent_1 = require("./colocation/indicatorContent");
const colocationStore_1 = require("./domain/colocationStore");
const useStudioColocation_1 = require("./useStudioColocation");
const pill = {
    backgroundColor: "rgba(0,0,0,0.7)",
    borderRadius: 8,
    padding: "10px 16px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    maxWidth: "100%",
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
};
const title = {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: 600,
    textAlign: "center",
};
const code = {
    color: "#FFFFFF",
    fontSize: 28,
    fontWeight: 700,
    letterSpacing: 4,
    marginTop: 4,
    textAlign: "center",
};
const detail = {
    color: "#E0E0E0",
    fontSize: 13,
    marginTop: 4,
    textAlign: "center",
};
const button = {
    backgroundColor: "#FFFFFF",
    border: "none",
    borderRadius: 6,
    color: "#000000",
    cursor: "pointer",
    fontSize: 14,
    fontWeight: 600,
    marginTop: 8,
    padding: "6px 20px",
};
function StudioColocationIndicator() {
    const state = (0, useStudioColocation_1.useStudioColocation)();
    const content = (0, indicatorContent_1.studioColocationIndicatorContent)(state);
    if (!content)
        return null;
    return ((0, jsx_runtime_1.jsxs)("div", { style: pill, children: [(0, jsx_runtime_1.jsx)("span", { style: content.tone === "error" ? { ...title, color: "#FF8A80" } : title, children: content.title }), content.code && (0, jsx_runtime_1.jsx)("span", { style: code, children: content.code }), content.detail && (0, jsx_runtime_1.jsx)("span", { style: detail, children: content.detail }), content.done && ((0, jsx_runtime_1.jsx)("button", { type: "button", disabled: !content.done.enabled, onClick: () => colocationStore_1.studioColocationStore.finishScan(), style: content.done.enabled
                    ? button
                    : { ...button, opacity: 0.4, cursor: "default" }, children: "Done" }))] }));
}
