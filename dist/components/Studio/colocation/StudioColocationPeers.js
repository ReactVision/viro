"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StudioColocationPeers = StudioColocationPeers;
const jsx_runtime_1 = require("react/jsx-runtime");
const react_1 = require("react");
const useViroSmoothing_1 = require("../../hooks/useViroSmoothing");
const ViroMaterials_1 = require("../../Material/ViroMaterials");
const ViroBox_1 = require("../../ViroBox");
const ViroNode_1 = require("../../ViroNode");
const ViroSphere_1 = require("../../ViroSphere");
const frameMath_1 = require("./frameMath");
/** Faster than the 20 Hz peers arrive at: see useViroColocation's `pollMs`. */
const PEER_POLL_MS = 33;
ViroMaterials_1.ViroMaterials.createMaterials({
    StudioColocationPeer: {
        lightingModel: "Constant",
        diffuseColor: "#34C759",
    },
});
function samePeers(a, b) {
    return (a.length === b.length &&
        a.every((p, i) => p.peerId === b[i].peerId && p.timestampMs === b[i].timestampMs));
}
/**
 * A marker per other device, in location-frame coordinates, so it renders
 * inside the location-frame node. Peers live in this component's own state:
 * they change 20 times a second, and a render of the scene around it rebuilds
 * every asset node.
 */
function StudioColocationPeers({ readPeers, }) {
    const [peers, setPeers] = (0, react_1.useState)([]);
    (0, react_1.useEffect)(() => {
        let cancelled = false;
        let inFlight = false;
        const id = setInterval(() => {
            if (inFlight)
                return;
            inFlight = true;
            readPeers()
                .then((next) => {
                if (cancelled)
                    return;
                // A peer that has sent no pose yet has no position worth drawing.
                const localized = next.filter((p) => p.localized);
                setPeers((prev) => (samePeers(prev, localized) ? prev : localized));
            })
                .catch(() => { })
                .finally(() => {
                inFlight = false;
            });
        }, PEER_POLL_MS);
        return () => {
            cancelled = true;
            clearInterval(id);
        };
    }, [readPeers]);
    const smoothed = (0, useViroSmoothing_1.useViroSmoothedPeers)(peers);
    return ((0, jsx_runtime_1.jsx)(jsx_runtime_1.Fragment, { children: smoothed.map((peer) => ((0, jsx_runtime_1.jsxs)(ViroNode_1.ViroNode, { position: peer.position, rotation: (0, frameMath_1.quatToEuler)(peer.rotation), children: [(0, jsx_runtime_1.jsx)(ViroBox_1.ViroBox, { width: 0.07, height: 0.14, length: 0.01, materials: ["StudioColocationPeer"] }), (0, jsx_runtime_1.jsx)(ViroSphere_1.ViroSphere, { radius: 0.025, position: [0, 0.11, 0], materials: ["StudioColocationPeer"] })] }, peer.peerId))) }));
}
