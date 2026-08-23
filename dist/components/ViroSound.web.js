"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ViroSound = ViroSound;
/**
 * Web implementation of ViroSound — non-spatial audio playback via an
 * `<audio>` element. Scene-level (renders no node).
 *
 * Browser autoplay policies may block playback until a user gesture; the play()
 * rejection is surfaced via onError.
 */
const react_1 = require("react");
const viroImageLoader_1 = require("./Web/viroImageLoader");
function ViroSound(props) {
    const url = (0, viroImageLoader_1.resolveImageSource)(props.source);
    const audioRef = (0, react_1.useRef)(null);
    const propsRef = (0, react_1.useRef)(props);
    propsRef.current = props;
    (0, react_1.useEffect)(() => {
        if (!url)
            return;
        const audio = new Audio(url);
        audio.crossOrigin = "anonymous";
        audioRef.current = audio;
        const onEnded = () => propsRef.current.onFinish?.();
        const onErr = () => propsRef.current.onError?.(new Error(`audio failed: ${url}`));
        audio.addEventListener("ended", onEnded);
        audio.addEventListener("error", onErr);
        return () => {
            audio.removeEventListener("ended", onEnded);
            audio.removeEventListener("error", onErr);
            audio.pause();
            audio.src = "";
            audioRef.current = null;
        };
    }, [url]);
    (0, react_1.useEffect)(() => {
        const a = audioRef.current;
        if (!a)
            return;
        a.loop = props.loop ?? false;
        a.muted = props.muted ?? false;
        a.volume = props.volume ?? 1;
        if (props.paused ?? false)
            a.pause();
        else
            a.play().catch((err) => propsRef.current.onError?.(err));
    }, [props.paused, props.loop, props.muted, props.volume, url]);
    return null;
}
