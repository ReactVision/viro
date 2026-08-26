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
exports.StudioRecordingIndicator = StudioRecordingIndicator;
/**
 * Web host for StudioRecordingIndicator. See the note in
 * StudioPlacementIndicator.web.tsx for why this is DOM rather than
 * react-native-web.
 *
 * One difference worth stating rather than leaving to be discovered: the native
 * comment says this pill is *not* captured into the recording, because there it
 * is a react-native view sitting over the AR surface. That still holds on web —
 * it is a DOM sibling of the canvas, and neither the WebGL capture nor a
 * canvas-based recorder sees it.
 */
const React = __importStar(require("react"));
const react_1 = require("react");
const useStudioRecording_1 = require("./useStudioRecording");
function formatElapsed(ms) {
    const total = Math.max(0, Math.floor(ms / 1000));
    const minutes = Math.floor(total / 60);
    const seconds = total % 60;
    return `${minutes}:${String(seconds).padStart(2, "0")}`;
}
const pill = {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "center",
    backgroundColor: "rgba(0,0,0,0.55)",
    borderRadius: 8,
    padding: "6px 12px",
    pointerEvents: "none",
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
};
const dot = {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#FF3B30",
    marginRight: 8,
    flexShrink: 0,
};
const label = {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: 600,
};
function StudioRecordingIndicator() {
    const { isRecording, startedAt } = (0, useStudioRecording_1.useStudioRecording)();
    const [elapsed, setElapsed] = (0, react_1.useState)("0:00");
    (0, react_1.useEffect)(() => {
        if (!isRecording)
            return;
        const start = startedAt ?? Date.now();
        const tick = () => setElapsed(formatElapsed(Date.now() - start));
        tick();
        const id = setInterval(tick, 1000);
        return () => clearInterval(id);
    }, [isRecording, startedAt]);
    if (!isRecording)
        return null;
    return (<div style={pill}>
      <div style={dot}/>
      <span style={label}>REC {elapsed}</span>
    </div>);
}
