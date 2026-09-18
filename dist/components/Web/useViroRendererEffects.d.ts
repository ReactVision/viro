import type { ViroWebRenderer } from "@reactvision/viro-web-renderer";
export interface ViroRendererEffectProps {
    hdrEnabled?: boolean;
    bloomEnabled?: boolean;
    pbrEnabled?: boolean;
    shadowsEnabled?: boolean;
}
export declare function useViroRendererEffects(renderer: ViroWebRenderer | null, { hdrEnabled, bloomEnabled, pbrEnabled, shadowsEnabled }: ViroRendererEffectProps): void;
