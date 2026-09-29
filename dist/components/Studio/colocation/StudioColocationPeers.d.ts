import * as React from "react";
import type { ViroColocationPeer } from "../../AR/ViroColocation";
/**
 * A marker per other device, in location-frame coordinates, so it renders
 * inside the location-frame node. Peers live in this component's own state:
 * they change 20 times a second, and a render of the scene around it rebuilds
 * every asset node.
 */
export declare function StudioColocationPeers({ readPeers, }: {
    readPeers: () => Promise<ViroColocationPeer[]>;
}): React.JSX.Element;
