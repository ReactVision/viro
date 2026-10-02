"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StudioRecordingIndicator = StudioRecordingIndicator;
const jsx_runtime_1 = require("react/jsx-runtime");
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
    return ((0, jsx_runtime_1.jsxs)("div", { style: pill, children: [(0, jsx_runtime_1.jsx)("div", { style: dot }), (0, jsx_runtime_1.jsxs)("span", { style: label, children: ["REC ", elapsed] })] }));
}
