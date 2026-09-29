import * as React from "react";
import { useEffect, useState } from "react";
import type { ViroColocationPeer } from "../../AR/ViroColocation";
import { useViroSmoothedPeers } from "../../hooks/useViroSmoothing";
import { ViroMaterials } from "../../Material/ViroMaterials";
import { ViroBox } from "../../ViroBox";
import { ViroNode } from "../../ViroNode";
import { ViroSphere } from "../../ViroSphere";
import { quatToEuler } from "./frameMath";

/** Faster than the 20 Hz peers arrive at: see useViroColocation's `pollMs`. */
const PEER_POLL_MS = 33;

ViroMaterials.createMaterials({
  StudioColocationPeer: {
    lightingModel: "Constant",
    diffuseColor: "#34C759",
  },
});

function samePeers(a: ViroColocationPeer[], b: ViroColocationPeer[]): boolean {
  return (
    a.length === b.length &&
    a.every(
      (p, i) => p.peerId === b[i].peerId && p.timestampMs === b[i].timestampMs
    )
  );
}

/**
 * A marker per other device, in location-frame coordinates, so it renders
 * inside the location-frame node. Peers live in this component's own state:
 * they change 20 times a second, and a render of the scene around it rebuilds
 * every asset node.
 */
export function StudioColocationPeers({
  readPeers,
}: {
  readPeers: () => Promise<ViroColocationPeer[]>;
}) {
  const [peers, setPeers] = useState<ViroColocationPeer[]>([]);

  useEffect(() => {
    let cancelled = false;
    let inFlight = false;
    const id = setInterval(() => {
      if (inFlight) return;
      inFlight = true;
      readPeers()
        .then((next) => {
          if (cancelled) return;
          // A peer that has sent no pose yet has no position worth drawing.
          const localized = next.filter((p) => p.localized);
          setPeers((prev) => (samePeers(prev, localized) ? prev : localized));
        })
        .catch(() => {})
        .finally(() => {
          inFlight = false;
        });
    }, PEER_POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [readPeers]);

  const smoothed = useViroSmoothedPeers(peers);

  return (
    <>
      {smoothed.map((peer) => (
        <ViroNode
          key={peer.peerId}
          position={peer.position}
          rotation={quatToEuler(peer.rotation)}
        >
          <ViroBox
            width={0.07}
            height={0.14}
            length={0.01}
            materials={["StudioColocationPeer"]}
          />
          <ViroSphere
            radius={0.025}
            position={[0, 0.11, 0]}
            materials={["StudioColocationPeer"]}
          />
        </ViroNode>
      ))}
    </>
  );
}
