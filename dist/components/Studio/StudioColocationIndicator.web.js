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
/**
 * Web host for StudioColocationIndicator: DOM instead of react-native, for the
 * reason in StudioPlacementIndicator.web.tsx. On web a `colocation` prop only
 * ever reports that the frame kind is unsupported, which this shows.
 */
const React = __importStar(require("react"));
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
    return (<div style={pill}>
      <span style={content.tone === "error" ? { ...title, color: "#FF8A80" } : title}>
        {content.title}
      </span>
      {content.code && <span style={code}>{content.code}</span>}
      {content.detail && <span style={detail}>{content.detail}</span>}
      {content.done && (<button type="button" disabled={!content.done.enabled} onClick={() => colocationStore_1.studioColocationStore.finishScan()} style={content.done.enabled
                ? button
                : { ...button, opacity: 0.4, cursor: "default" }}>
          Done
        </button>)}
    </div>);
}
