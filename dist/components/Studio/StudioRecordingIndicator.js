"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StudioRecordingIndicator = StudioRecordingIndicator;
const jsx_runtime_1 = require("react/jsx-runtime");
const react_1 = require("react");
const react_native_1 = require("react-native");
const useStudioRecording_1 = require("./useStudioRecording");
function formatElapsed(ms) {
    const total = Math.max(0, Math.floor(ms / 1000));
    const minutes = Math.floor(total / 60);
    const seconds = total % 60;
    return `${minutes}:${String(seconds).padStart(2, "0")}`;
}
/**
 * REC pill for the RECORD_VIDEO toggle: a red dot + elapsed timer, shown only
 * while recording. Position-agnostic (it lays out no absolute position of its
 * own) so the embedding host controls placement.
 *
 * StudioSceneNavigator renders this by default (see its `recordingIndicator`
 * prop). Hosts with their own top-of-screen chrome can set that prop to false
 * and render this where it fits, or build a custom UI from useStudioRecording().
 * As a RN view over the AR surface it is NOT captured into the recording.
 */
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
    return ((0, jsx_runtime_1.jsxs)(react_native_1.View, { style: styles.pill, pointerEvents: "none", children: [(0, jsx_runtime_1.jsx)(react_native_1.View, { style: styles.dot }), (0, jsx_runtime_1.jsxs)(react_native_1.Text, { style: styles.label, children: ["REC ", elapsed] })] }));
}
const styles = react_native_1.StyleSheet.create({
    pill: {
        flexDirection: "row",
        alignItems: "center",
        alignSelf: "center",
        backgroundColor: "rgba(0,0,0,0.55)",
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: 6,
    },
    dot: {
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: "#FF3B30",
        marginRight: 8,
    },
    label: {
        color: "#FFFFFF",
        fontSize: 13,
        fontWeight: "600",
    },
});
