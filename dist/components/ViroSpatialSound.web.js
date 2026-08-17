"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ViroSpatialSound = ViroSpatialSound;
/**
 * Web implementation of ViroSpatialSound — positional audio via the Web Audio
 * PannerNode. The sound sits at `position` (world space); distance attenuation
 * follows `rolloffModel`/`minDistance`/`maxDistance`. Scene-level (no node).
 *
 * MVP note: the AudioListener stays at the world origin (not camera-tracked yet),
 * so panning is relative to origin. Autoplay may be blocked until a user gesture.
 */
const react_1 = require("react");
const viroImageLoader_1 = require("./Web/viroImageLoader");
const viroAudio_1 = require("./Web/viroAudio");
function distanceModel(rolloff) {
    switch (rolloff) {
        case "Logarithmic":
            return "inverse";
        case "Linear":
            return "linear";
        default:
            return "inverse";
    }
}
function setPannerPosition(panner, x, y, z) {
    if (panner.positionX) {
        panner.positionX.value = x;
        panner.positionY.value = y;
        panner.positionZ.value = z;
    }
    else {
        // Deprecated fallback for older Safari.
        panner.setPosition(x, y, z);
    }
}
function ViroSpatialSound(props) {
    const url = (0, viroImageLoader_1.resolveImageSource)(props.source);
    const [px, py, pz] = props.position ?? [0, 0, 0];
    const audioRef = (0, react_1.useRef)(null);
    const pannerRef = (0, react_1.useRef)(null);
    const gainRef = (0, react_1.useRef)(null);
    const propsRef = (0, react_1.useRef)(props);
    propsRef.current = props;
    (0, react_1.useEffect)(() => {
        if (!url)
            return;
        const ctx = (0, viroAudio_1.getAudioContext)();
        const audio = new Audio(url);
        audio.crossOrigin = "anonymous";
        audioRef.current = audio;
        const src = ctx.createMediaElementSource(audio);
        const panner = ctx.createPanner();
        panner.panningModel = "HRTF";
        panner.distanceModel = distanceModel(propsRef.current.rolloffModel);
        panner.refDistance = propsRef.current.minDistance ?? 1;
        panner.maxDistance = propsRef.current.maxDistance ?? 10000;
        if (propsRef.current.rolloffModel === "None")
            panner.rolloffFactor = 0;
        setPannerPosition(panner, px, py, pz);
        const gain = ctx.createGain();
        gain.gain.value = propsRef.current.volume ?? 1;
        src.connect(panner).connect(gain).connect(ctx.destination);
        pannerRef.current = panner;
        gainRef.current = gain;
        const onEnded = () => propsRef.current.onFinish?.();
        const onErr = () => propsRef.current.onError?.(new Error(`audio failed: ${url}`));
        audio.addEventListener("ended", onEnded);
        audio.addEventListener("error", onErr);
        return () => {
            audio.removeEventListener("ended", onEnded);
            audio.removeEventListener("error", onErr);
            audio.pause();
            audio.src = "";
            src.disconnect();
            panner.disconnect();
            gain.disconnect();
            audioRef.current = null;
            pannerRef.current = null;
            gainRef.current = null;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [url]);
    // Position updates.
    (0, react_1.useEffect)(() => {
        if (pannerRef.current)
            setPannerPosition(pannerRef.current, px, py, pz);
    }, [px, py, pz]);
    // Playback controls.
    (0, react_1.useEffect)(() => {
        const a = audioRef.current;
        if (!a)
            return;
        a.loop = props.loop ?? false;
        a.muted = props.muted ?? false;
        if (gainRef.current)
            gainRef.current.gain.value = props.volume ?? 1;
        if (props.paused ?? false) {
            a.pause();
        }
        else {
            const ctx = (0, viroAudio_1.getAudioContext)();
            if (ctx.state === "suspended")
                void ctx.resume();
            a.play().catch((err) => propsRef.current.onError?.(err));
        }
    }, [props.paused, props.loop, props.muted, props.volume, url]);
    return null;
}
