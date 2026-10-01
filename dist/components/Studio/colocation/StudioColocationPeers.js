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
exports.StudioColocationPeers = StudioColocationPeers;
const React = __importStar(require("react"));
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
    return (<>
      {smoothed.map((peer) => (<ViroNode_1.ViroNode key={peer.peerId} position={peer.position} rotation={(0, frameMath_1.quatToEuler)(peer.rotation)}>
          <ViroBox_1.ViroBox width={0.07} height={0.14} length={0.01} materials={["StudioColocationPeer"]}/>
          <ViroSphere_1.ViroSphere radius={0.025} position={[0, 0.11, 0]} materials={["StudioColocationPeer"]}/>
        </ViroNode_1.ViroNode>))}
    </>);
}
